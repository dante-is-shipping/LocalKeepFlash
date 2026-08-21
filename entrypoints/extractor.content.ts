import { extractReadableDocument, extractSelection } from '@/extraction/page-extractor';
import type { ContentRequest, ContentResponse, PageContext, ToastTone } from '@/messaging/protocol';

function meta(selector: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(selector)?.content.trim() || undefined;
}

function getPageContext(): PageContext {
  return {
    title: document.title.trim() || location.hostname,
    sourceUrl: location.href,
    canonicalUrl:
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || undefined,
    siteName: meta('meta[property="og:site_name"]'),
    language: document.documentElement.lang.trim() || undefined,
  };
}

function showToast(tone: ToastTone, message: string) {
  const previous = document.getElementById('local-keepflash-toast-host');
  previous?.remove();

  const host = document.createElement('div');
  host.id = 'local-keepflash-toast-host';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:24px;bottom:24px;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const toast = document.createElement('div');
  const accent = tone === 'success' ? '#74d29b' : tone === 'error' ? '#ff785c' : '#e7a64a';
  toast.textContent = message;
  toast.style.cssText = [
    'box-sizing:border-box',
    'max-width:380px',
    'padding:13px 16px',
    'border:1px solid #e9e4d7',
    'background:#171a17',
    'color:#f1ecdf',
    'box-shadow:5px 5px 0 ' + accent,
    'font:600 12px/1.5 Avenir Next,Segoe UI,sans-serif',
    'letter-spacing:.01em',
  ].join(';');
  shadow.append(toast);
  document.documentElement.append(host);
  if (tone !== 'working') window.setTimeout(() => host.remove(), tone === 'error' ? 8000 : 4200);
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    const scope = globalThis as typeof globalThis & { __localKeepFlashDocumentToken?: string };
    const documentToken = scope.__localKeepFlashDocumentToken ??= crypto.randomUUID();
    browser.runtime.onMessage.addListener(
      async (message: ContentRequest): Promise<ContentResponse | undefined> => {
        try {
          if (message.type === 'GET_DOCUMENT_TOKEN') {
            return { ok: true, payload: documentToken };
          }
          if (
            message.type !== 'SHOW_TOAST' &&
            (message.expectedUrl !== location.href || message.expectedDocumentToken !== documentToken)
          ) {
            throw new Error('The page changed before LocalKeepFlash could capture it. Save again.');
          }
          if (message.type === 'EXTRACT_PAGE') {
            return { ok: true, payload: extractReadableDocument(document, location.href) };
          }
          if (message.type === 'EXTRACT_SELECTION') {
            return { ok: true, payload: extractSelection(document, getSelection()!, location.href) };
          }
          if (message.type === 'GET_PAGE_CONTEXT') {
            return { ok: true, payload: getPageContext() };
          }
          if (message.type === 'SHOW_TOAST') {
            showToast(message.tone, message.message);
            return { ok: true, payload: null };
          }
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : 'Page extraction failed.',
          };
        }
      },
    );
  },
});
