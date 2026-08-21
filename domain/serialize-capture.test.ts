import { describe, expect, it } from 'vitest';
import type { Capture } from './capture';
import { serializeCapture } from './serialize-capture';

describe('serializeCapture', () => {
  it('serializes a saved page as portable Markdown with versioned metadata', () => {
    const capture: Capture = {
      schemaVersion: 1,
      id: '01J61Y4P9X3P0K5J0YJ9K4W2Q8',
      type: 'page',
      title: 'Local files belong to you',
      sourceUrl: 'https://example.com/article?utm_source=test',
      canonicalUrl: 'https://example.com/article',
      siteName: 'Example',
      capturedAt: '2026-08-21T08:15:30.000Z',
      language: 'en',
      extractionStatus: 'complete',
      markdown: '## A durable copy\n\nThe body stays readable.\n',
      assets: [],
    };

    expect(serializeCapture(capture)).toBe(`---
schema_version: 1
id: 01J61Y4P9X3P0K5J0YJ9K4W2Q8
type: page
title: Local files belong to you
source_url: https://example.com/article?utm_source=test
canonical_url: https://example.com/article
site_name: Example
captured_at: 2026-08-21T08:15:30.000Z
language: en
extraction_status: complete
---

# Local files belong to you

## A durable copy

The body stays readable.
`);
  });
});
