import type { Capture } from '@/domain/capture';
import type { ExtractedPage, ExtractedSelection } from '@/extraction/page-extractor';
import {
  materializeImageCapture,
  materializePageCapture,
  materializeSelectionCapture,
} from '@/extraction/materialize-capture';
import { extractYoutubeVideoId, materializeYoutubeCapture } from '@/extraction/youtube';
import type { ContentRequest, ContentResponse, PageContext, ToastTone } from '@/messaging/protocol';
import { BrowserDirectory } from '@/storage/browser-directory';
import {
  getDirectoryHandle,
  getPreferences,
  verifyDirectoryPermission,
} from '@/storage/settings';
import { cleanupStalePending, saveCapture } from '@/storage/save-capture';

const MENU_PAGE = 'local-keepflash-save-page';
const MENU_SELECTION = 'local-keepflash-save-selection';
const MENU_IMAGE = 'local-keepflash-save-image';
const PENDING_INTENT_KEY = 'pending-save-intent';

interface SaveIntentBase {
  tabId: number;
  expectedUrl: string;
  expectedDocumentToken: string;
  createdAt: number;
}

type SaveIntent =
  | (SaveIntentBase & { kind: 'page' })
  | (SaveIntentBase & { kind: 'selection' })
  | (SaveIntentBase & { kind: 'image'; imageUrl: string });

const messages = {
  en: {
    working: 'Saving a local copy…',
    success: 'Saved to your LocalKeepFlash folder.',
    partial: 'Saved, with some remote resources left in place.',
    error: 'LocalKeepFlash could not save this page.',
  },
  zh: {
    working: '正在保存本地副本…',
    success: '已保存到 LocalKeepFlash 目录。',
    partial: '已保存，部分远程资源未能下载。',
    error: 'LocalKeepFlash 无法保存此页面。',
  },
} as const;

function createId(): string {
  return crypto.randomUUID().replaceAll('-', '').toUpperCase();
}

async function createIntent(
  tab: Browser.tabs.Tab,
  intent: { kind: 'page' | 'selection' } | { kind: 'image'; imageUrl: string },
): Promise<SaveIntent | null> {
  if (!tab.id || !tab.url || !/^https?:/.test(tab.url)) return null;
  const expectedDocumentToken = await sendToContent<string>(tab.id, {
    type: 'GET_DOCUMENT_TOKEN',
  }).catch(() => null);
  if (!expectedDocumentToken) return null;
  return {
    ...intent,
    tabId: tab.id,
    expectedUrl: tab.url,
    expectedDocumentToken,
    createdAt: Date.now(),
  } as SaveIntent;
}

async function sendToContent<T>(tabId: number, request: ContentRequest): Promise<T> {
  let response: ContentResponse;
  try {
    response = await browser.tabs.sendMessage(tabId, request) as ContentResponse;
  } catch {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/content-scripts/extractor.js'],
    });
    response = await browser.tabs.sendMessage(tabId, request) as ContentResponse;
  }
  if (!response?.ok) throw new Error(response?.error ?? 'The page did not respond.');
  return response.payload as T;
}

async function toast(tabId: number, tone: ToastTone, message: string) {
  await sendToContent<null>(tabId, { type: 'SHOW_TOAST', tone, message }).catch(() => undefined);
}

async function queueIntentAndOpenSetup(intent: SaveIntent) {
  await browser.storage.local.set({ [PENDING_INTENT_KEY]: intent });
  const handle = await getDirectoryHandle();
  const page = handle ? '/options.html' : '/onboarding.html';
  await browser.tabs.create({ url: browser.runtime.getURL(page) });
}

async function buildCapture(intent: SaveIntent): Promise<Capture> {
  const identity = {
    id: createId(),
    capturedAt: new Date().toISOString(),
  };
  const preferences = await getPreferences();
  const tab = await browser.tabs.get(intent.tabId);
  const sourceUrl = tab.url;
  if (
    !sourceUrl ||
    sourceUrl !== intent.expectedUrl ||
    Date.now() - intent.createdAt > 15 * 60 * 1000
  ) {
    throw new Error('The page changed or the save request expired. Save it again.');
  }
  const currentDocumentToken = await sendToContent<string>(intent.tabId, {
    type: 'GET_DOCUMENT_TOKEN',
  });
  if (currentDocumentToken !== intent.expectedDocumentToken) {
    throw new Error('The page document changed. Save it again.');
  }

  if (intent.kind === 'page' && extractYoutubeVideoId(sourceUrl)) {
    return materializeYoutubeCapture(intent.tabId, sourceUrl, identity, preferences);
  }

  if (intent.kind === 'page') {
    const extracted = await sendToContent<ExtractedPage>(intent.tabId, {
      type: 'EXTRACT_PAGE',
      expectedUrl: sourceUrl,
      expectedDocumentToken: intent.expectedDocumentToken,
    });
    return materializePageCapture(extracted, { ...identity, sourceUrl });
  }

  if (intent.kind === 'selection') {
    const extracted = await sendToContent<ExtractedSelection>(intent.tabId, {
      type: 'EXTRACT_SELECTION',
      expectedUrl: sourceUrl,
      expectedDocumentToken: intent.expectedDocumentToken,
    });
    return await materializeSelectionCapture(extracted, { ...identity, sourceUrl });
  }

  const context = await sendToContent<PageContext>(intent.tabId, {
    type: 'GET_PAGE_CONTEXT',
    expectedUrl: sourceUrl,
    expectedDocumentToken: intent.expectedDocumentToken,
  });
  return materializeImageCapture(
    {
      imageUrl: intent.imageUrl,
      pageTitle: context.title,
      pageUrl: sourceUrl,
      canonicalUrl: context.canonicalUrl,
      siteName: context.siteName,
      language: context.language,
    },
    { ...identity, sourceUrl },
  );
}

async function executeSave(intent: SaveIntent) {
  const preferences = await getPreferences();
  const localized = messages[preferences.locale];
  const handle = await getDirectoryHandle();
  if (!handle || !(await verifyDirectoryPermission(handle, false))) {
    await queueIntentAndOpenSetup(intent);
    return;
  }

  await toast(intent.tabId, 'working', localized.working);
  await browser.action.setBadgeBackgroundColor({ color: '#e95432', tabId: intent.tabId });
  await browser.action.setBadgeText({ text: '…', tabId: intent.tabId });
  try {
    await cleanupStalePending(new BrowserDirectory(handle));
    const capture = await buildCapture(intent);
    const finalDocumentToken = await sendToContent<string>(intent.tabId, {
      type: 'GET_DOCUMENT_TOKEN',
    });
    if (finalDocumentToken !== intent.expectedDocumentToken) {
      throw new Error('The page document changed during capture. Save it again.');
    }
    const result = await saveCapture(capture, new BrowserDirectory(handle));
    const tone = result.status === 'complete' ? 'success' : 'partial';
    await toast(intent.tabId, tone, localized[tone]);
    await browser.action.setBadgeBackgroundColor({
      color: tone === 'success' ? '#174b3c' : '#e7a64a',
      tabId: intent.tabId,
    });
    await browser.action.setBadgeText({ text: tone === 'success' ? '✓' : '!', tabId: intent.tabId });
  } catch (error) {
    console.error('[LocalKeepFlash] save failed', error);
    await toast(intent.tabId, 'error', localized.error);
    await browser.action.setBadgeBackgroundColor({ color: '#9f2e1c', tabId: intent.tabId });
    await browser.action.setBadgeText({ text: '!', tabId: intent.tabId });
  } finally {
    setTimeout(() => void browser.action.setBadgeText({ text: '', tabId: intent.tabId }), 4500);
  }
}

let saveQueue = Promise.resolve();

function enqueueSave(intent: SaveIntent): Promise<void> {
  const queued = saveQueue.then(() => executeSave(intent));
  saveQueue = queued.catch((error) => {
    console.error('[LocalKeepFlash] queued save failed', error);
  });
  return queued;
}

async function cleanupArchive() {
  const handle = await getDirectoryHandle();
  if (!handle || !(await verifyDirectoryPermission(handle, false))) return;
  await cleanupStalePending(new BrowserDirectory(handle));
}

async function recreateMenus() {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: MENU_PAGE,
    title: browser.i18n.getMessage('savePage'),
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
  browser.contextMenus.create({
    id: MENU_SELECTION,
    title: browser.i18n.getMessage('saveSelection'),
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
  browser.contextMenus.create({
    id: MENU_IMAGE,
    title: browser.i18n.getMessage('saveImage'),
    contexts: ['image'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void recreateMenus();
    if (details.reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
    }
  });

  browser.runtime.onStartup.addListener(() => {
    void recreateMenus();
    void cleanupArchive();
  });

  browser.action.onClicked.addListener((tab) => {
    void createIntent(tab, { kind: 'page' }).then((intent) => {
      if (intent) return enqueueSave(intent);
    });
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'save-current-page') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const intent = await createIntent(tab, { kind: 'page' });
      if (intent) await enqueueSave(intent);
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab) return;
    void (async () => {
      if (info.menuItemId === MENU_PAGE) {
        const intent = await createIntent(tab, { kind: 'page' });
        if (intent) await enqueueSave(intent);
      }
      if (info.menuItemId === MENU_SELECTION) {
        const intent = await createIntent(tab, { kind: 'selection' });
        if (intent) await enqueueSave(intent);
      }
      if (info.menuItemId === MENU_IMAGE && info.srcUrl) {
        const intent = await createIntent(tab, { kind: 'image', imageUrl: info.srcUrl });
        if (intent) await enqueueSave(intent);
      }
    })();
  });

  browser.runtime.onMessage.addListener(async (message: { type?: string }) => {
    if (message.type !== 'ONBOARDING_COMPLETE') return;
    const stored = await browser.storage.local.get(PENDING_INTENT_KEY);
    const intent = stored[PENDING_INTENT_KEY] as SaveIntent | undefined;
    if (!intent) return;
    await browser.storage.local.remove(PENDING_INTENT_KEY);
    await enqueueSave(intent);
  });
});
