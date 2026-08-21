import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface ExtractedAssetCandidate {
  sourceUrl: string;
  alt: string;
}

export interface ExtractedPage {
  title: string;
  canonicalUrl?: string;
  siteName?: string;
  language?: string;
  markdown: string;
  assets: ExtractedAssetCandidate[];
  extractionStatus: 'complete' | 'partial';
}

export interface ExtractedSelection {
  title: string;
  canonicalUrl?: string;
  siteName?: string;
  language?: string;
  markdown: string;
  selectedText: string;
  textFragmentUrl?: string;
}

function metadataContent(document: Document, selector: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(selector)?.content.trim() || undefined;
}

function absoluteUrl(value: string, sourceUrl: string): string | null {
  try {
    const url = new URL(value, sourceUrl);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  });
  service.use(gfm);
  service.remove(['script', 'style', 'form', 'iframe', 'noscript', 'template']);
  return service;
}

export function extractReadableDocument(
  document: Document,
  sourceUrl: string,
): ExtractedPage {
  const clone = document.cloneNode(true) as Document;
  const article = new Readability(clone, { keepClasses: false }).parse();
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const canonicalUrl = canonical ? absoluteUrl(canonical, sourceUrl) ?? undefined : undefined;
  const siteName = metadataContent(document, 'meta[property="og:site_name"]');
  const language = document.documentElement.lang.trim() || undefined;
  const title = article?.title?.trim() || document.title.trim() || new URL(sourceUrl).hostname;

  if (!article?.content) {
    const description =
      metadataContent(document, 'meta[name="description"]') ??
      metadataContent(document, 'meta[property="og:description"]') ??
      'The readable article body could not be extracted.';
    return {
      title,
      canonicalUrl,
      siteName,
      language,
      markdown: description,
      assets: [],
      extractionStatus: 'partial',
    };
  }

  const container = document.createElement('div');
  container.innerHTML = article.content;
  container
    .querySelectorAll('script, style, form, iframe, noscript, template, input, button')
    .forEach((node) => node.remove());

  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
    }
  }

  for (const anchor of container.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const safe = absoluteUrl(anchor.getAttribute('href') ?? '', sourceUrl);
    if (safe) anchor.href = safe;
    else anchor.removeAttribute('href');
  }

  const assets: ExtractedAssetCandidate[] = [];
  const seen = new Set<string>();
  for (const image of container.querySelectorAll<HTMLImageElement>('img[src]')) {
    const source = absoluteUrl(image.getAttribute('src') ?? '', sourceUrl);
    if (!source) {
      image.remove();
      continue;
    }
    image.src = source;
    if (!seen.has(source)) {
      seen.add(source);
      assets.push({ sourceUrl: source, alt: image.alt.trim() });
    }
  }

  return {
    title,
    canonicalUrl,
    siteName,
    language,
    markdown: createTurndownService().turndown(container).trim(),
    assets,
    extractionStatus: 'complete',
  };
}

export function extractSelection(
  document: Document,
  selection: Selection,
  sourceUrl: string,
): ExtractedSelection {
  if (selection.rangeCount === 0 || selection.isCollapsed) {
    throw new Error('Select some text before saving.');
  }

  const container = document.createElement('div');
  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.append(selection.getRangeAt(index).cloneContents());
  }

  const selectedText = selection.toString().trim();
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const canonicalUrl = canonical ? absoluteUrl(canonical, sourceUrl) ?? undefined : undefined;
  const siteName = metadataContent(document, 'meta[property="og:site_name"]');
  const language = document.documentElement.lang.trim() || undefined;
  const textFragmentUrl = selectedText
    ? `${sourceUrl.split('#')[0]}#:~:text=${encodeURIComponent(selectedText.slice(0, 300))}`
    : undefined;

  return {
    title: document.title.trim() || new URL(sourceUrl).hostname,
    canonicalUrl,
    siteName,
    language,
    markdown: createTurndownService().turndown(container).trim(),
    selectedText,
    textFragmentUrl,
  };
}
