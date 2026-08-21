import { createStore, get, set } from 'idb-keyval';

const settingsStore = createStore('local-keepflash', 'settings');
const DIRECTORY_KEY = 'save-directory';
const PREFERENCES_KEY = 'preferences';

export interface Preferences {
  locale: 'en' | 'zh';
  transcriptLanguages: string[];
  onboardingComplete: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  locale: navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en',
  transcriptLanguages: navigator.language.toLowerCase().startsWith('zh')
    ? ['zh-Hans', 'zh-Hant', 'en']
    : ['en', 'zh-Hans', 'zh-Hant'],
  onboardingComplete: false,
};

export async function getPreferences(): Promise<Preferences> {
  return (await get<Preferences>(PREFERENCES_KEY, settingsStore)) ?? DEFAULT_PREFERENCES;
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await set(PREFERENCES_KEY, preferences, settingsStore);
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return (await get<FileSystemDirectoryHandle>(DIRECTORY_KEY, settingsStore)) ?? null;
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await set(DIRECTORY_KEY, handle, settingsStore);
}

export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  const descriptor: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  if ((await handle.queryPermission(descriptor)) === 'granted') return true;
  if (!request) return false;
  return (await handle.requestPermission(descriptor)) === 'granted';
}
