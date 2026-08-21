import type { Capture, ExtractionStatus } from '../domain/capture';
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

function buildNotePath(capture: Capture): string {
  const timestamp = capture.capturedAt
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:TZ]/g, '')
    .slice(0, 14);
  const date = timestamp.slice(0, 8);
  const time = timestamp.slice(8, 14);
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const shortId = capture.id.slice(-6);

  return `notes/${year}/${month}/${year}-${month}-${day}-${time}--${sanitizeTitle(capture.title)}--${shortId}.md`;
}

async function ensureCompatibleSchema(directory: DirectoryPort): Promise<void> {
  const existing = await directory.readText(DIRECTORY_SCHEMA_PATH);
  if (existing) {
    const schema = JSON.parse(existing) as { schema_version?: number };
    if ((schema.schema_version ?? 0) > 1) {
      throw new Error('The selected directory was created by a newer LocalKeepFlash version.');
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
  const notePath = buildNotePath(capture);
  await directory.writeText(
    pendingPath,
    `${JSON.stringify({ id: capture.id, note_path: notePath, started_at: new Date().toISOString() })}\n`,
  );

  let status = capture.extractionStatus;
  for (const asset of capture.assets) {
    if (!asset.bytes) {
      status = 'partial';
      continue;
    }
    await directory.writeBinary(`assets/${capture.id}/${asset.path}`, asset.bytes);
  }

  const committedCapture = status === capture.extractionStatus
    ? capture
    : { ...capture, extractionStatus: status };
  await directory.writeText(notePath, serializeCapture(committedCapture));
  await directory.remove(pendingPath);

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
      const pending = JSON.parse(content) as { id?: string; started_at?: string };
      if (!pending.id || !/^[a-zA-Z0-9_-]+$/.test(pending.id) || !pending.started_at) continue;
      const age = now.getTime() - new Date(pending.started_at).getTime();
      if (!Number.isFinite(age) || age < 24 * 60 * 60 * 1000) continue;
      await directory.remove(`assets/${pending.id}`, { recursive: true });
      await directory.remove(pendingPath);
    } catch {
      // Leave malformed journals untouched so a user can inspect them.
    }
  }
}
