import type { ExtractedPage, ExtractedSelection } from '@/extraction/page-extractor';

export type ToastTone = 'working' | 'success' | 'partial' | 'error';

export type ContentRequest =
  | { type: 'EXTRACT_PAGE' }
  | { type: 'EXTRACT_SELECTION' }
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'SHOW_TOAST'; tone: ToastTone; message: string };

export interface PageContext {
  title: string;
  sourceUrl: string;
  canonicalUrl?: string;
  siteName?: string;
  language?: string;
}

export type ContentResponse =
  | { ok: true; payload: ExtractedPage | ExtractedSelection | PageContext | null }
  | { ok: false; error: string };
