import type { Capture, CaptureAsset, ExtractionStatus } from '../domain/capture';
import { serializeCapture } from '../domain/serialize-capture';
import type { DirectoryPort } from './directory-port';

const DIRECTORY_SCHEMA_PATH = '.local-keepflash/schema.json';

export interface SaveResult {
  notePath: string;
  status: ExtractionStatus;
}

function sanitizeTitle(title: string): string {
  const withoutControls = Array.from(title.normalize('NFKC'))
    .map((character) => (character.charCodeAt(0) < 32 ? ' ' : character))
    .join('');
  const normalized = withoutControls
    .toLocaleLowerCase()
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return Array.from(normalized || 'untitled').slice(0, 80).join('').replace(/-+$/g, '');
}

function buildNotePath(capture: Capture, suffixLength: number): string {
  const year = capture.capturedAt.slice(0, 4);
  const month = capture.capturedAt.slice(5, 7);
  const shortId = capture.id.slice(-suffixLength);

  return `notes/${year}/${month}/${sanitizeTitle(capture.title)}--${shortId}.md`;
}

async function availableNotePath(capture: Capture, directory: DirectoryPort): Promise<string> {
  for (const suffixLength of [6, 10, capture.id.length]) {
    const path = buildNotePath(capture, suffixLength);
    if ((await directory.readText(path)) === null) return path;
  }
  throw new Error('Could not create a collision-free note filename.');
}

async function ensureCompatibleSchema(directory: DirectoryPort): Promise<void> {
  const existing = await directory.readText(DIRECTORY_SCHEMA_PATH);
  if (existing) {
    const schema = JSON.parse(existing) as { product?: unknown; schema_version?: unknown };
    if (schema.product !== 'LocalKeepFlash' || schema.schema_version !== 1) {
      throw new Error('The selected directory has an invalid or unsupported LocalKeepFlash schema.');
    }
    return;
  }

  await directory.writeText(
    DIRECTORY_SCHEMA_PATH,
    `${JSON.stringify(
      {
        product: 'LocalKeepFlash',
        schema_version: 1,
        created_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

export async function saveCapture(
  capture: Capture,
  directory: DirectoryPort,
): Promise<SaveResult> {
  await ensureCompatibleSchema(directory);

  const pendingPath = `.local-keepflash/pending/${capture.id}.json`;
  const notePath = await availableNotePath(capture, directory);
  await directory.writeText(
    pendingPath,
    `${JSON.stringify({
      id: capture.id,
      note_path: notePath,
      state: 'pending',
      started_at: new Date().toISOString(),
    })}\n`,
  );

  let status = capture.extractionStatus;
  let markdown = capture.markdown;
  const savedAssets: CaptureAsset[] = [];
  for (const asset of capture.assets) {
    if (!asset.bytes) {
      status = 'partial';
      markdown = markdown
        .split(`../../../assets/${capture.id}/${asset.path}`)
        .join(asset.sourceUrl);
      continue;
    }
    try {
      await directory.writeBinary(`assets/${capture.id}/${asset.path}`, asset.bytes);
      savedAssets.push(asset);
    } catch {
      status = 'partial';
      markdown = markdown
        .split(`../../../assets/${capture.id}/${asset.path}`)
        .join(asset.sourceUrl);
    }
  }

  const committedCapture = {
    ...capture,
    assets: savedAssets,
    extractionStatus: status,
    markdown,
  };
  await directory.writeText(notePath, serializeCapture(committedCapture));
  await directory.writeText(
    pendingPath,
    `${JSON.stringify({
      id: capture.id,
      note_path: notePath,
      state: 'committed',
      started_at: new Date().toISOString(),
    })}\n`,
  ).catch(() => undefined);
  await directory.remove(pendingPath).catch(() => undefined);

  return { notePath, status };
}

export async function cleanupStalePending(
  directory: DirectoryPort,
  now = new Date(),
): Promise<void> {
  const names = await directory.list('.local-keepflash/pending');
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const pendingPath = `.local-keepflash/pending/${name}`;
    const content = await directory.readText(pendingPath);
    if (!content) continue;
    try {
      const pending = JSON.parse(content) as {
        id?: string;
        note_path?: string;
        state?: string;
        started_at?: string;
      };
      if (
        !pending.id ||
        name !== `${pending.id}.json` ||
        !/^[a-zA-Z0-9_-]+$/.test(pending.id) ||
        !pending.note_path ||
        !/^notes\/\d{4}\/\d{2}\/[\p{L}\p{N}-]+--[a-zA-Z0-9_-]+\.md$/u.test(pending.note_path) ||
        !pending.started_at ||
        !['pending', 'committed'].includes(pending.state ?? '')
      ) continue;
      const age = now.getTime() - new Date(pending.started_at).getTime();
      if (!Number.isFinite(age) || age < 24 * 60 * 60 * 1000) continue;
      if (pending.state === 'committed' || (await directory.readText(pending.note_path)) !== null) {
        await directory.remove(pendingPath);
        continue;
      }
      await directory.remove(`assets/${pending.id}`, { recursive: true });
      await directory.remove(pendingPath);
    } catch {
      // Leave malformed journals untouched so a user can inspect them.
    }
  }
}
