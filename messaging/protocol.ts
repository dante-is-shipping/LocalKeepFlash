import type { ExtractedPage, ExtractedSelection } from '@/extraction/page-extractor';

export type ToastTone = 'working' | 'success' | 'partial' | 'error';

export type ContentRequest =
  | { type: 'GET_DOCUMENT_TOKEN' }
  | { type: 'EXTRACT_PAGE'; expectedUrl: string; expectedDocumentToken: string }
  | { type: 'EXTRACT_SELECTION'; expectedUrl: string; expectedDocumentToken: string }
  | { type: 'GET_PAGE_CONTEXT'; expectedUrl: string; expectedDocumentToken: string }
  | { type: 'SHOW_TOAST'; tone: ToastTone; message: string };

export interface PageContext {
  title: string;
  sourceUrl: string;
  canonicalUrl?: string;
  siteName?: string;
  language?: string;
}

export type ContentResponse =
  | { ok: true; payload: ExtractedPage | ExtractedSelection | PageContext | string | null }
  | { ok: false; error: string };
