import { describe, expect, it } from 'vitest';
import type { ExtractedPage } from './page-extractor';
import {
  materializeImageCapture,
  materializePageCapture,
  materializeSelectionCapture,
} from './materialize-capture';
import type { ExtractedSelection } from './page-extractor';

describe('materializePageCapture', () => {
  it('downloads a readable image and rewrites Markdown to a relative local path', async () => {
    const extracted: ExtractedPage = {
      title: 'Archive guide',
      canonicalUrl: 'https://example.com/guide',
      siteName: 'Example',
      language: 'en',
      extractionStatus: 'complete',
      markdown: 'A body.\n\n![Archive](https://cdn.example.com/archive.png)',
      assets: [
        { sourceUrl: 'https://cdn.example.com/archive.png', alt: 'Archive' },
      ],
    };

    const capture = await materializePageCapture(
      extracted,
      {
        id: '01J61Y4P9X3P0K5J0YJ9K4W2Q8',
        sourceUrl: 'https://example.com/guide?utm_source=test',
        capturedAt: '2026-08-21T08:15:30.000Z',
      },
      async () =>
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { 'content-type': 'image/png', 'content-length': '4' },
        }),
    );

    expect(capture.markdown).toContain(
      '![Archive](../../../assets/01J61Y4P9X3P0K5J0YJ9K4W2Q8/archive-0f4636.png)',
    );
    expect(capture.assets).toHaveLength(1);
    expect(capture.assets[0]?.path).toBe('archive-0f4636.png');
    expect(capture.assets[0]?.bytes).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(capture.extractionStatus).toBe('complete');
  });
});

describe('materializeImageCapture', () => {
  it('stores the original image beside a searchable Markdown note', async () => {
    const capture = await materializeImageCapture(
      {
        imageUrl: 'https://cdn.example.com/hero.png',
        pageTitle: 'Image source',
        pageUrl: 'https://example.com/gallery',
        alt: 'A local archive',
      },
      {
        id: 'image-1',
        sourceUrl: 'https://example.com/gallery',
        capturedAt: '2026-08-21T08:15:30.000Z',
      },
      async () =>
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { 'content-type': 'image/png' },
        }),
    );

    expect(capture.type).toBe('image');
    expect(capture.assets[0]?.path).toBe('hero-0f4636.png');
    expect(capture.markdown).toBe(
      '![A local archive](../../../assets/image-1/hero-0f4636.png)',
    );
  });
});

describe('materializeSelectionCapture', () => {
  it('preserves the exact selection and its text-fragment address', () => {
    const extracted: ExtractedSelection = {
      title: 'Selection source',
      canonicalUrl: 'https://example.com/source',
      markdown: '**keep this**',
      selectedText: 'keep this',
      textFragmentUrl: 'https://example.com/source#:~:text=keep%20this',
    };

    const capture = materializeSelectionCapture(extracted, {
      id: 'selection-1',
      sourceUrl: 'https://example.com/source?view=full',
      capturedAt: '2026-08-21T08:15:30.000Z',
    });

    expect(capture.type).toBe('selection');
    expect(capture.markdown).toBe('**keep this**');
    expect(capture.textFragmentUrl).toBe(
      'https://example.com/source#:~:text=keep%20this',
    );
  });
});
