import { describe, expect, it } from 'vitest';
import type { Capture } from '../domain/capture';
import type { DirectoryPort } from './directory-port';
import { cleanupStalePending, saveCapture } from './save-capture';

class MemoryDirectory implements DirectoryPort {
  readonly files = new Map<string, string | Uint8Array>();

  async writeText(path: string, content: string) {
    this.files.set(path, content);
  }

  async writeBinary(path: string, content: Uint8Array) {
    this.files.set(path, content);
  }

  async readText(path: string) {
    const value = this.files.get(path);
    return typeof value === 'string' ? value : null;
  }

  async remove(path: string, options?: { recursive?: boolean }) {
    if (options?.recursive) {
      for (const key of this.files.keys()) {
        if (key === path || key.startsWith(`${path}/`)) this.files.delete(key);
      }
      return;
    }
    this.files.delete(path);
  }

  async list(path: string) {
    const prefix = `${path}/`;
    return [...new Set(
      [...this.files.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length).split('/')[0]!),
    )];
  }
}

describe('saveCapture', () => {
  it('commits assets before the note and removes its recovery journal', async () => {
    const directory = new MemoryDirectory();
    const capture: Capture = {
      schemaVersion: 1,
      id: '01J61Y4P9X3P0K5J0YJ9K4W2Q8',
      type: 'image',
      title: '你好 / Local files belong to you',
      sourceUrl: 'https://example.com/hero.png',
      capturedAt: '2026-08-21T08:15:30.000Z',
      extractionStatus: 'complete',
      markdown: '![Local copy](../../../assets/01J61Y4P9X3P0K5J0YJ9K4W2Q8/hero-a1b2c3.png)',
      assets: [
        {
          path: 'hero-a1b2c3.png',
          sourceUrl: 'https://example.com/hero.png',
          mediaType: 'image/png',
          bytes: new Uint8Array([137, 80, 78, 71]),
        },
      ],
    };

    const result = await saveCapture(capture, directory);

    expect(result).toEqual({
      notePath:
        'notes/2026/08/你好-local-files-belong-to-you--K4W2Q8.md',
      status: 'complete',
    });
    expect(directory.files.has('.local-keepflash/schema.json')).toBe(true);
    expect(
      directory.files.get(
        'assets/01J61Y4P9X3P0K5J0YJ9K4W2Q8/hero-a1b2c3.png',
      ),
    ).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(directory.files.get(result.notePath)).toContain(
      '# 你好 / Local files belong to you',
    );
    expect(
      directory.files.has(
        '.local-keepflash/pending/01J61Y4P9X3P0K5J0YJ9K4W2Q8.json',
      ),
    ).toBe(false);
  });

  it('uses a longer suffix instead of overwriting a colliding note', async () => {
    const directory = new MemoryDirectory();
    await directory.writeText(
      'notes/2026/08/collision--123456.md',
      '# Existing note',
    );
    const capture: Capture = {
      schemaVersion: 1,
      id: 'ABCDEF123456',
      type: 'page',
      title: 'Collision',
      sourceUrl: 'https://example.com',
      capturedAt: '2026-08-21T08:15:30.000Z',
      extractionStatus: 'complete',
      markdown: 'New note',
      assets: [],
    };

    const result = await saveCapture(capture, directory);

    expect(result.notePath).toBe('notes/2026/08/collision--CDEF123456.md');
    expect(directory.files.get('notes/2026/08/collision--123456.md')).toBe('# Existing note');
  });
});

describe('cleanupStalePending', () => {
  it('removes only abandoned assets whose journal is older than 24 hours', async () => {
    const directory = new MemoryDirectory();
    await directory.writeText(
      '.local-keepflash/pending/old.json',
      '{"id":"old","note_path":"notes/2026/08/old--old.md","state":"pending","started_at":"2026-08-19T08:00:00.000Z"}',
    );
    await directory.writeBinary('assets/old/image.png', new Uint8Array([1]));
    await directory.writeText(
      '.local-keepflash/pending/recent.json',
      '{"id":"recent","note_path":"notes/2026/08/recent--recent.md","state":"pending","started_at":"2026-08-21T07:30:00.000Z"}',
    );
    await directory.writeBinary('assets/recent/image.png', new Uint8Array([2]));

    await cleanupStalePending(directory, new Date('2026-08-21T08:00:00.000Z'));

    expect(directory.files.has('assets/old/image.png')).toBe(false);
    expect(directory.files.has('.local-keepflash/pending/old.json')).toBe(false);
    expect(directory.files.has('assets/recent/image.png')).toBe(true);
    expect(directory.files.has('.local-keepflash/pending/recent.json')).toBe(true);
  });

  it('keeps committed assets when a stale journal survives note commit', async () => {
    const directory = new MemoryDirectory();
    await directory.writeText(
      '.local-keepflash/pending/saved.json',
      '{"id":"saved","note_path":"notes/2026/08/saved--saved.md","state":"pending","started_at":"2026-08-19T08:00:00.000Z"}',
    );
    await directory.writeText('notes/2026/08/saved--saved.md', '# Saved');
    await directory.writeBinary('assets/saved/image.png', new Uint8Array([1]));

    await cleanupStalePending(directory, new Date('2026-08-21T08:00:00.000Z'));

    expect(directory.files.has('assets/saved/image.png')).toBe(true);
    expect(directory.files.has('.local-keepflash/pending/saved.json')).toBe(false);
  });
});
