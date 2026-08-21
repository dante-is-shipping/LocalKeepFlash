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

type SaveIntent =
  | { kind: 'page'; tabId: number }
  | { kind: 'selection'; tabId: number }
  | { kind: 'image'; tabId: number; imageUrl: string };

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
  if (!sourceUrl || !/^https?:/.test(sourceUrl)) {
    throw new Error('LocalKeepFlash supports HTTP(S) pages only.');
  }

  if (intent.kind === 'page' && extractYoutubeVideoId(sourceUrl)) {
    return materializeYoutubeCapture(intent.tabId, sourceUrl, identity, preferences);
  }

  if (intent.kind === 'page') {
    const extracted = await sendToContent<ExtractedPage>(intent.tabId, { type: 'EXTRACT_PAGE' });
    return materializePageCapture(extracted, { ...identity, sourceUrl });
  }

  if (intent.kind === 'selection') {
    const extracted = await sendToContent<ExtractedSelection>(intent.tabId, {
      type: 'EXTRACT_SELECTION',
    });
    return materializeSelectionCapture(extracted, { ...identity, sourceUrl });
  }

  const context = await sendToContent<PageContext>(intent.tabId, { type: 'GET_PAGE_CONTEXT' });
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
    if (tab.id) void executeSave({ kind: 'page', tabId: tab.id });
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'save-current-page') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await executeSave({ kind: 'page', tabId: tab.id });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === MENU_PAGE) void executeSave({ kind: 'page', tabId: tab.id });
    if (info.menuItemId === MENU_SELECTION) {
      void executeSave({ kind: 'selection', tabId: tab.id });
    }
    if (info.menuItemId === MENU_IMAGE && info.srcUrl) {
      void executeSave({ kind: 'image', tabId: tab.id, imageUrl: info.srcUrl });
    }
  });

  browser.runtime.onMessage.addListener(async (message: { type?: string }) => {
    if (message.type !== 'ONBOARDING_COMPLETE') return;
    const stored = await browser.storage.local.get(PENDING_INTENT_KEY);
    const intent = stored[PENDING_INTENT_KEY] as SaveIntent | undefined;
    if (!intent) return;
    await browser.storage.local.remove(PENDING_INTENT_KEY);
    await executeSave(intent);
  });
});
