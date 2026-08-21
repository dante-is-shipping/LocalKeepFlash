import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractReadableDocument, extractSelection } from './page-extractor';

describe('extractReadableDocument', () => {
  it('turns the readable article into Markdown and reports localizable images', () => {
    const dom = new JSDOM(`<!doctype html>
      <html lang="en">
        <head>
          <title>A durable local archive</title>
          <link rel="canonical" href="https://example.com/guide" />
          <meta property="og:site_name" content="Field Notes" />
        </head>
        <body>
          <nav>Account Pricing Contact</nav>
          <article>
            <h1>A durable local archive</h1>
            <p>Keep a copy that <strong>you can read</strong>.</p>
            <img src="/images/archive.png" alt="Archive box" />
            <script>window.tracker = true</script>
          </article>
        </body>
      </html>`, { url: 'https://example.com/guide?utm_source=test' });

    const result = extractReadableDocument(
      dom.window.document,
      'https://example.com/guide?utm_source=test',
    );

    expect(result.title).toBe('A durable local archive');
    expect(result.canonicalUrl).toBe('https://example.com/guide');
    expect(result.siteName).toBe('Field Notes');
    expect(result.language).toBe('en');
    expect(result.markdown).toContain('Keep a copy that **you can read**.');
    expect(result.markdown).not.toContain('Account Pricing');
    expect(result.markdown).not.toContain('tracker');
    expect(result.assets).toEqual([
      {
        sourceUrl: 'https://example.com/images/archive.png',
        alt: 'Archive box',
      },
    ]);
  });
});

describe('extractSelection', () => {
  it('keeps only the exact selected fragment with page metadata', () => {
    const dom = new JSDOM(`<!doctype html><html><head>
      <title>Selection source</title>
      <link rel="canonical" href="https://example.com/source" />
      </head><body><p id="quote">Before <strong>keep this</strong> after</p></body></html>`, {
      url: 'https://example.com/source?view=full',
    });
    const selection = dom.window.getSelection()!;
    const range = dom.window.document.createRange();
    range.selectNode(dom.window.document.querySelector('strong')!);
    selection.addRange(range);

    const result = extractSelection(
      dom.window.document,
      selection,
      'https://example.com/source?view=full',
    );

    expect(result.title).toBe('Selection source');
    expect(result.canonicalUrl).toBe('https://example.com/source');
    expect(result.markdown).toBe('**keep this**');
    expect(result.markdown).not.toContain('Before');
    expect(result.selectedText).toBe('keep this');
  });
});
