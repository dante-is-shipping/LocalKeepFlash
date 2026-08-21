import { stringify } from 'yaml';
import type { Capture } from './capture';
import { escapeMarkdownText } from './markdown';

function videoTimestampUrl(sourceUrl: string, startSeconds: number): string {
  const url = new URL(sourceUrl);
  url.searchParams.set('t', String(Math.max(0, Math.floor(startSeconds))));
  return url.toString();
}

function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function serializeCapture(capture: Capture): string {
  const metadata: Record<string, string | number> = {
    schema_version: capture.schemaVersion,
    id: capture.id,
    type: capture.type,
    title: capture.title,
    source_url: capture.sourceUrl,
  };

  if (capture.canonicalUrl) metadata.canonical_url = capture.canonicalUrl;
  if (capture.textFragmentUrl) metadata.text_fragment_url = capture.textFragmentUrl;
  if (capture.imageSourceUrl) metadata.image_source_url = capture.imageSourceUrl;
  if (capture.siteName) metadata.site_name = capture.siteName;

  metadata.captured_at = capture.capturedAt;
  if (capture.language) metadata.language = capture.language;
  metadata.extraction_status = capture.extractionStatus;

  if (capture.youtube) {
    metadata.video_id = capture.youtube.videoId;
    if (capture.youtube.transcriptLanguage) {
      metadata.transcript_language = capture.youtube.transcriptLanguage;
    }
    if (capture.youtube.transcriptKind) {
      metadata.transcript_kind = capture.youtube.transcriptKind;
    }
    metadata.transcript_status = capture.youtube.transcriptStatus;
  }

  const sections = [`# ${escapeMarkdownText(capture.title)}`];
  const body = capture.markdown.trim();
  if (body) sections.push(body);

  if (capture.youtube?.chapters.length) {
    const chapters = capture.youtube.chapters.map(
      (chapter) =>
        `- [${formatTimestamp(chapter.startSeconds)}](${videoTimestampUrl(capture.sourceUrl, chapter.startSeconds)}) ${escapeMarkdownText(chapter.title)}`,
    );
    sections.push(`## Chapters\n\n${chapters.join('\n')}`);
  }

  if (capture.youtube?.transcript.length) {
    const transcript = capture.youtube.transcript.map(
      (segment) =>
        `[${formatTimestamp(segment.startSeconds)}](${videoTimestampUrl(capture.sourceUrl, segment.startSeconds)}) ${escapeMarkdownText(segment.text)}`,
    );
    sections.push(`## Transcript\n\n${transcript.join('\n\n')}`);
  }

  return `---\n${stringify(metadata, { lineWidth: 0 }).trimEnd()}\n---\n\n${sections.join('\n\n')}\n`;
}
