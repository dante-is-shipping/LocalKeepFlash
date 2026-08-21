import { CAPTURE_SCHEMA_VERSION, type Capture, type CaptureAsset } from '@/domain/capture';
import { escapeMarkdownText } from '@/domain/markdown';
import { readResponseBytes } from '@/network/response-body';
import { safeFinalResponseUrl, safeRemoteUrl } from '@/network/url-safety';
import type { ExtractedPage, ExtractedSelection } from './page-extractor';

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_CAPTURE_ASSET_BYTES = 100 * 1024 * 1024;
const MAX_ASSET_COUNT = 64;
const MAX_CAPTURE_MILLISECONDS = 30_000;

const mediaExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export type AssetFetcher = (url: string, signal: AbortSignal) => Promise<Response>;

interface CaptureIdentity {
  id: string;
  sourceUrl: string;
  capturedAt: string;
}

export interface ImageCaptureInput {
  imageUrl: string;
  pageTitle: string;
  pageUrl: string;
  alt?: string;
  canonicalUrl?: string;
  siteName?: string;
  language?: string;
}

function assetStem(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image');
    const withoutExtension = name.replace(/\.[^.]+$/, '');
    return (
      Array.from(
        withoutExtension
          .normalize('NFKC')
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-+|-+$/g, '') || 'image',
      )
        .slice(0, 40)
        .join('') || 'image'
    );
  } catch {
    return 'image';
  }
}

async function sha256Prefix(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest))
    .slice(0, 3)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function downloadAsset(
  sourceUrl: string,
  fetcher: AssetFetcher,
  byteLimit = MAX_ASSET_BYTES,
  timeoutMilliseconds = 15_000,
): Promise<CaptureAsset | null> {
  if (!safeRemoteUrl(sourceUrl)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetcher(sourceUrl, controller.signal);
    if (!response.ok || !safeFinalResponseUrl(response)) return null;
    const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!mediaType || !mediaExtensions[mediaType]) return null;
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > byteLimit) return null;

    const bytes = await readResponseBytes(response, byteLimit);
    const hash = await sha256Prefix(bytes);
    return {
      sourceUrl,
      mediaType,
      path: `${assetStem(sourceUrl)}-${hash}.${mediaExtensions[mediaType]}`,
      bytes,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function materializePageCapture(
  extracted: ExtractedPage,
  identity: CaptureIdentity,
  fetcher: AssetFetcher = (url, signal) => fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    signal,
  }),
): Promise<Capture> {
  let markdown = extracted.markdown;
  let extractionStatus = extracted.extractionStatus;
  let totalBytes = 0;
  const assets: CaptureAsset[] = [];
  const deadline = Date.now() + MAX_CAPTURE_MILLISECONDS;
  const candidates = extracted.assets.slice(0, MAX_ASSET_COUNT);
  if (candidates.length !== extracted.assets.length) extractionStatus = 'partial';

  for (const candidate of candidates) {
    if (!safeRemoteUrl(candidate.sourceUrl)) {
      markdown = markdown.split(candidate.sourceUrl).join('');
      extractionStatus = 'partial';
      continue;
    }
    const remainingBytes = MAX_CAPTURE_ASSET_BYTES - totalBytes;
    const remainingMilliseconds = deadline - Date.now();
    if (remainingBytes <= 0 || remainingMilliseconds <= 0) {
      extractionStatus = 'partial';
      break;
    }
    const asset = await downloadAsset(
      candidate.sourceUrl,
      fetcher,
      Math.min(MAX_ASSET_BYTES, remainingBytes),
      Math.min(15_000, remainingMilliseconds),
    );
    if (!asset || !asset.bytes || totalBytes + asset.bytes.byteLength > MAX_CAPTURE_ASSET_BYTES) {
      extractionStatus = 'partial';
      continue;
    }
    totalBytes += asset.bytes.byteLength;
    assets.push(asset);
    const relativePath = `../../../assets/${identity.id}/${asset.path}`;
    markdown = markdown.split(candidate.sourceUrl).join(relativePath);
  }

  return {
    schemaVersion: CAPTURE_SCHEMA_VERSION,
    id: identity.id,
    type: 'page',
    title: extracted.title,
    sourceUrl: identity.sourceUrl,
    canonicalUrl: extracted.canonicalUrl,
    siteName: extracted.siteName,
    capturedAt: identity.capturedAt,
    language: extracted.language,
    extractionStatus,
    markdown,
    assets,
  };
}

export async function materializeSelectionCapture(
  extracted: ExtractedSelection,
  identity: CaptureIdentity,
  fetcher?: AssetFetcher,
): Promise<Capture> {
  const materialized = await materializePageCapture(extracted, identity, fetcher);
  return {
    ...materialized,
    type: 'selection',
    textFragmentUrl: extracted.textFragmentUrl,
  };
}

export async function materializeImageCapture(
  input: ImageCaptureInput,
  identity: CaptureIdentity,
  fetcher: AssetFetcher = (url, signal) => fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    signal,
  }),
): Promise<Capture> {
  const asset = await downloadAsset(input.imageUrl, fetcher);
  const alt = escapeMarkdownText(input.alt?.trim() || input.pageTitle);
  const safeSourceUrl = safeRemoteUrl(input.imageUrl)?.toString();
  const localPath = asset
    ? `../../../assets/${identity.id}/${asset.path}`
    : safeSourceUrl;

  return {
    schemaVersion: CAPTURE_SCHEMA_VERSION,
    id: identity.id,
    type: 'image',
    title: input.pageTitle,
    sourceUrl: input.pageUrl,
    canonicalUrl: input.canonicalUrl,
    imageSourceUrl: input.imageUrl,
    siteName: input.siteName,
    capturedAt: identity.capturedAt,
    language: input.language,
    extractionStatus: asset ? 'complete' : 'partial',
    markdown: localPath
      ? `![${alt}](${asset ? localPath : `<${localPath}>`})`
      : 'The image source was blocked because it targeted a local or unsafe address.',
    assets: asset ? [asset] : [],
  };
}
