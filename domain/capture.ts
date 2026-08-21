export const CAPTURE_SCHEMA_VERSION = 1 as const;

export type CaptureType = 'page' | 'selection' | 'image' | 'youtube';
export type ExtractionStatus = 'complete' | 'partial';

export interface CaptureAsset {
  path: string;
  sourceUrl: string;
  mediaType: string;
  bytes?: Uint8Array;
}

export interface TranscriptSegment {
  text: string;
  startSeconds: number;
  endSeconds?: number;
}

export interface Chapter {
  title: string;
  startSeconds: number;
}

export interface Capture {
  schemaVersion: typeof CAPTURE_SCHEMA_VERSION;
  id: string;
  type: CaptureType;
  title: string;
  sourceUrl: string;
  canonicalUrl?: string;
  textFragmentUrl?: string;
  imageSourceUrl?: string;
  siteName?: string;
  capturedAt: string;
  language?: string;
  extractionStatus: ExtractionStatus;
  markdown: string;
  assets: CaptureAsset[];
  youtube?: {
    videoId: string;
    transcriptLanguage?: string;
    transcriptKind?: 'manual' | 'automatic' | 'unknown';
    transcriptStatus: 'complete' | 'unavailable';
    chapters: Chapter[];
    transcript: TranscriptSegment[];
  };
}
