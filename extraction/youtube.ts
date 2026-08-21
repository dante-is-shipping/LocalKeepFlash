import { CAPTURE_SCHEMA_VERSION, type Capture, type Chapter, type TranscriptSegment } from '@/domain/capture';
import type { Preferences } from '@/storage/settings';
import { materializePageCapture } from './materialize-capture';

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: string;
}

interface PlayerSummary {
  videoId?: string;
  title?: string;
  description?: string;
  coverImage?: string;
  captionTracks: CaptionTrack[];
}

interface YoutubePageContext {
  apiKey?: string;
  clientVersion?: string;
  visitorData?: string;
  hl?: string;
  gl?: string;
  playerResponse?: unknown;
  timedTextUrls: string[];
  documentTitle: string;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
}

export function extractYoutubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? null;
    if (!/(^|\.)youtube(?:-nocookie)?\.com$/.test(url.hostname)) return null;
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const match = url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function parsePlayerResponse(response: unknown): PlayerSummary {
  const root = record(response);
  const details = record(root.videoDetails);
  const microformat = record(record(root.microformat).playerMicroformatRenderer);
  const thumbnails =
    record(details.thumbnail).thumbnails ?? record(microformat.thumbnail).thumbnails ?? [];
  const rawTracks = record(record(root.captions).playerCaptionsTracklistRenderer).captionTracks;
  const title = record(microformat.title);
  const description = record(microformat.description);

  return {
    videoId: text(details.videoId),
    title: text(details.title) ?? text(title.simpleText),
    description: text(details.shortDescription) ?? text(description.simpleText),
    coverImage: Array.isArray(thumbnails)
      ? text(record(thumbnails[thumbnails.length - 1]).url)
      : undefined,
    captionTracks: (Array.isArray(rawTracks) ? rawTracks : [])
      .map((value) => {
        const track = record(value);
        const name = record(track.name);
        const runs = Array.isArray(name.runs) ? name.runs : [];
        return {
          baseUrl: text(track.baseUrl) ?? '',
          languageCode: text(track.languageCode),
          kind: text(track.kind),
          name: text(name.simpleText) ?? text(record(runs[0]).text),
        };
      })
      .filter((track: CaptionTrack) => Boolean(track.baseUrl)),
  };
}

function languageMatches(trackLanguage: string | undefined, preferred: string): boolean {
  const track = trackLanguage?.toLowerCase();
  const wanted = preferred.toLowerCase();
  if (!track) return false;
  return track === wanted || track.split('-')[0] === wanted.split('-')[0];
}

function selectCaptionTrack(
  tracks: CaptionTrack[],
  preferredLanguages: string[],
): CaptionTrack | null {
  const manualFirst = (values: CaptionTrack[]) =>
    [...values].sort((a, b) => Number(a.kind === 'asr') - Number(b.kind === 'asr'));

  for (const language of preferredLanguages) {
    const selected = manualFirst(
      tracks.filter((track) => languageMatches(track.languageCode, language)),
    )[0];
    if (selected) return selected;
  }
  return manualFirst(tracks)[0] ?? null;
}

function parseJson3(payload: unknown): TranscriptSegment[] {
  const events = (payload as { events?: unknown })?.events;
  if (!Array.isArray(events)) return [];

  const transcript: TranscriptSegment[] = [];
  for (const rawEvent of events) {
    const event = rawEvent as {
      tStartMs?: unknown;
      dDurationMs?: unknown;
      segs?: Array<{ utf8?: unknown }>;
    };
    if (typeof event.tStartMs !== 'number' || !Array.isArray(event.segs)) continue;
    const segmentText = event.segs
      .map((segment) => (typeof segment.utf8 === 'string' ? segment.utf8 : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!segmentText) continue;
    const startSeconds = event.tStartMs / 1000;
    const duration = typeof event.dDurationMs === 'number' ? event.dDurationMs / 1000 : 5;
    transcript.push({
      text: segmentText,
      startSeconds,
      endSeconds: startSeconds + duration,
    });
  }
  return transcript.filter(
    (segment, index) =>
      index === 0 ||
      `${segment.startSeconds}:${segment.text}` !==
        `${transcript[index - 1]?.startSeconds}:${transcript[index - 1]?.text}`,
  );
}

function parseChapters(description: string | undefined): Chapter[] {
  if (!description) return [];
  const chapters: Chapter[] = [];
  for (const line of description.split('\n')) {
    const match = line.match(/^\s*((?:\d+:)?\d{1,2}:\d{2})\s+(.+?)\s*$/);
    if (!match) continue;
    const timestamp = match[1];
    const title = match[2];
    if (!timestamp || !title) continue;
    const parts = timestamp.split(':').map(Number);
    const [first = 0, second = 0, third = 0] = parts;
    const startSeconds = parts.length === 3
      ? first * 3600 + second * 60 + third
      : first * 60 + second;
    chapters.push({ title, startSeconds });
  }
  return chapters.filter(
    (chapter, index) => index === 0 || chapter.startSeconds !== chapters[index - 1]?.startSeconds,
  );
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, credentials: 'omit' });
  } finally {
    clearTimeout(timeout);
  }
}

async function freshPlayerResponse(
  context: YoutubePageContext,
  videoId: string,
): Promise<unknown | null> {
  if (!context.apiKey || !context.clientVersion) return null;
  const response = await fetchWithTimeout(
    `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(context.apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: context.clientVersion,
            hl: context.hl,
            gl: context.gl,
            visitorData: context.visitorData,
          },
        },
      }),
    },
  );
  return response.ok ? response.json() : null;
}

async function fetchTranscript(baseUrl: string): Promise<TranscriptSegment[]> {
  const url = new URL(baseUrl);
  url.searchParams.set('fmt', 'json3');
  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) return [];
  return parseJson3(await response.json());
}

function timedTextTrack(
  urls: string[],
  videoId: string,
  preferredLanguages: string[],
): CaptionTrack | null {
  const tracks: CaptionTrack[] = [];
  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.pathname !== '/api/timedtext' || url.searchParams.get('v') !== videoId) continue;
      tracks.push({
        baseUrl: value,
        languageCode: url.searchParams.get('lang') ?? undefined,
        kind: url.searchParams.get('kind') ?? undefined,
      });
    } catch {
      // Ignore unrelated resource timing entries.
    }
  }
  return selectCaptionTrack(tracks, preferredLanguages);
}

export async function readYoutubePageContext(tabId: number): Promise<YoutubePageContext> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
      const global = window as typeof window & {
        ytcfg?: { get?: (key: string) => unknown; data_?: Record<string, unknown> };
        ytInitialPlayerResponse?: unknown;
      };
      const getConfig = (key: string) => global.ytcfg?.get?.(key) ?? global.ytcfg?.data_?.[key];
      const collect = () => performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => url.includes('/api/timedtext'));
      let timedTextUrls = collect();
      if (timedTextUrls.length === 0) {
        const button = document.querySelector<HTMLElement>(
          '#movie_player button.ytp-subtitles-button, button.ytp-subtitles-button',
        );
        const wasPressed = button?.getAttribute('aria-pressed') === 'true';
        button?.click();
        await new Promise((resolve) => setTimeout(resolve, 1600));
        timedTextUrls = collect();
        if (button && !wasPressed) button.click();
      }
      return {
        apiKey: getConfig('INNERTUBE_API_KEY'),
        clientVersion: getConfig('INNERTUBE_CLIENT_VERSION'),
        visitorData: getConfig('VISITOR_DATA'),
        hl: getConfig('HL'),
        gl: getConfig('GL'),
        playerResponse: global.ytInitialPlayerResponse,
        timedTextUrls,
        documentTitle: document.title,
      };
    },
  });
  return (result?.result ?? { timedTextUrls: [], documentTitle: 'YouTube' }) as YoutubePageContext;
}

export async function materializeYoutubeCapture(
  tabId: number,
  sourceUrl: string,
  identity: { id: string; capturedAt: string },
  preferences: Preferences,
): Promise<Capture> {
  const videoId = extractYoutubeVideoId(sourceUrl);
  if (!videoId) throw new Error('This is not a supported YouTube video URL.');
  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const context = await readYoutubePageContext(tabId);
  let player = parsePlayerResponse(context.playerResponse);
  if (player.videoId && player.videoId !== videoId) player = { captionTracks: [] };

  if (!player.title || player.captionTracks.length === 0) {
    const fresh = await freshPlayerResponse(context, videoId).catch(() => null);
    const parsedFresh = parsePlayerResponse(fresh);
    if (!parsedFresh.videoId || parsedFresh.videoId === videoId) {
      player = {
        videoId: parsedFresh.videoId ?? player.videoId,
        title: parsedFresh.title ?? player.title,
        description: parsedFresh.description ?? player.description,
        coverImage: parsedFresh.coverImage ?? player.coverImage,
        captionTracks:
          parsedFresh.captionTracks.length > 0 ? parsedFresh.captionTracks : player.captionTracks,
      };
    }
  }

  const preferredLanguages = [
    ...preferences.transcriptLanguages,
    context.hl,
    'en',
    'zh-Hans',
    'zh-Hant',
  ].filter((value): value is string => Boolean(value));
  let selectedTrack = selectCaptionTrack(player.captionTracks, preferredLanguages);
  let transcript = selectedTrack
    ? await fetchTranscript(selectedTrack.baseUrl).catch(() => [])
    : [];
  if (transcript.length === 0) {
    selectedTrack = timedTextTrack(context.timedTextUrls, videoId, preferredLanguages);
    transcript = selectedTrack
      ? await fetchTranscript(selectedTrack.baseUrl).catch(() => [])
      : [];
  }

  const title = player.title ?? context.documentTitle.replace(/\s+-\s+YouTube$/, '') ?? 'YouTube video';
  const coverMarkdown = player.coverImage
    ? `![${title.replaceAll('[', '').replaceAll(']', '')}](${player.coverImage})`
    : '';
  const base = await materializePageCapture(
    {
      title,
      canonicalUrl: normalizedUrl,
      siteName: 'YouTube',
      language: selectedTrack?.languageCode,
      markdown: [coverMarkdown, player.description].filter(Boolean).join('\n\n'),
      assets: player.coverImage ? [{ sourceUrl: player.coverImage, alt: title }] : [],
      extractionStatus: transcript.length > 0 ? 'complete' : 'partial',
    },
    { ...identity, sourceUrl: normalizedUrl },
  );

  return {
    ...base,
    type: 'youtube',
    schemaVersion: CAPTURE_SCHEMA_VERSION,
    youtube: {
      videoId,
      transcriptLanguage: selectedTrack?.languageCode,
      transcriptKind: selectedTrack ? (selectedTrack.kind === 'asr' ? 'automatic' : 'manual') : 'unknown',
      transcriptStatus: transcript.length > 0 ? 'complete' : 'unavailable',
      chapters: parseChapters(player.description),
      transcript,
    },
  };
}
