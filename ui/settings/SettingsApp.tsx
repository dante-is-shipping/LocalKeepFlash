import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { BrowserDirectory } from '@/storage/browser-directory';
import {
  DEFAULT_PREFERENCES,
  getDirectoryHandle,
  getPreferences,
  saveDirectoryHandle,
  savePreferences,
  verifyDirectoryPermission,
  type Preferences,
} from '@/storage/settings';
import { ArchiveMark } from './ArchiveMark';
import { copy } from './copy';

type Mode = 'onboarding' | 'options';

const languageChoices = [
  { code: 'en', label: 'English' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
] as const;

export function SettingsApp({ mode }: { mode: Mode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle | null>(null);
  const [permissionReady, setPermissionReady] = useState(false);
  const [step, setStep] = useState(mode === 'onboarding' ? 1 : 2);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(true);
  const text = useMemo(() => copy[preferences.locale], [preferences.locale]);

  useEffect(() => {
    void Promise.all([getPreferences(), getDirectoryHandle()]).then(
      async ([storedPreferences, storedDirectory]) => {
        setPreferences(storedPreferences);
        setDirectory(storedDirectory);
        if (storedDirectory) {
          setPermissionReady(await verifyDirectoryPermission(storedDirectory, false));
        }
        setBusy(false);
      },
    );
  }, []);

  async function chooseDirectory() {
    setNotice('');
    try {
      const handle = await window.showDirectoryPicker({
        id: 'local-keepflash-archive',
        mode: 'readwrite',
      });
      if (!(await verifyDirectoryPermission(handle, true))) throw new Error('permission-denied');

      const port = new BrowserDirectory(handle);
      const testPath = '.local-keepflash/write-test.txt';
      await port.writeText(testPath, `LocalKeepFlash write test — ${new Date().toISOString()}\n`);
      await port.remove(testPath);
      await saveDirectoryHandle(handle);
      setDirectory(handle);
      setPermissionReady(true);
      if (mode === 'onboarding') setStep(3);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNotice(text.testFailed);
      setPermissionReady(false);
    }
  }

  function toggleTranscriptLanguage(code: string) {
    setPreferences((current) => {
      const hasLanguage = current.transcriptLanguages.includes(code);
      const transcriptLanguages = hasLanguage
        ? current.transcriptLanguages.filter((language) => language !== code)
        : [...current.transcriptLanguages, code];
      return { ...current, transcriptLanguages };
    });
  }

  function moveTranscriptLanguage(code: string, direction: -1 | 1) {
    setPreferences((current) => {
      const index = current.transcriptLanguages.indexOf(code);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.transcriptLanguages.length) return current;
      const transcriptLanguages = [...current.transcriptLanguages];
      [transcriptLanguages[index], transcriptLanguages[target]] = [
        transcriptLanguages[target]!,
        transcriptLanguages[index]!,
      ];
      return { ...current, transcriptLanguages };
    });
  }

  async function finish() {
    if (!directory || !permissionReady) {
      setNotice(text.testFailed);
      setStep(2);
      return;
    }
    const next = { ...preferences, onboardingComplete: true };
    await savePreferences(next);
    setPreferences(next);
    setNotice(text.saved);
    if (mode === 'onboarding') {
      setStep(4);
      await browser.runtime.sendMessage({ type: 'ONBOARDING_COMPLETE' }).catch(() => undefined);
    }
  }

  if (busy) return <main className="shell loading" aria-label="Loading" />;

  const isReadyScreen = mode === 'onboarding' && step === 4;
  const orderedLanguageChoices = [
    ...preferences.transcriptLanguages
      .map((code) => languageChoices.find((choice) => choice.code === code))
      .filter((choice): choice is (typeof languageChoices)[number] => Boolean(choice)),
    ...languageChoices.filter(
      (choice) => !preferences.transcriptLanguages.includes(choice.code),
    ),
  ];
  return (
    <main className="shell">
      <div className="grain" />
      <header className="masthead">
        <a className="brand" href="#top" aria-label="LocalKeepFlash">
          <ArchiveMark />
          <span>LocalKeepFlash</span>
        </a>
        <label className="locale-switch">
          <span className="sr-only">Language</span>
          <select
            value={preferences.locale}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                locale: event.target.value as Preferences['locale'],
              }))
            }
          >
            <option value="en">EN</option>
            <option value="zh">中文</option>
          </select>
        </label>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{mode === 'onboarding' ? text.onboardingTitle : text.settingsTitle}</h1>
          <p className="lede">{text.intro}</p>
        </div>
        <div className="file-stack" aria-hidden="true">
          <span className="file-card file-card-back">.md</span>
          <span className="file-card file-card-middle">01</span>
          <span className="file-card file-card-front">LOCAL</span>
        </div>
      </section>

      {isReadyScreen ? (
        <section className="ready-panel">
          <span className="ready-pulse" />
          <p className="section-number">03 — READY</p>
          <h2>{text.readyTitle}</h2>
          <p>{text.readyBody}</p>
          <button className="primary" onClick={() => window.close()}>
            OK
          </button>
        </section>
      ) : (
        <section className="steps" aria-live="polite">
          <article className={`step-card ${step === 1 || mode === 'options' ? 'active' : ''}`}>
            <p className="section-number">01 — PERMISSION</p>
            <h2>{text.permissionTitle}</h2>
            <p>{text.permissionBody}</p>
            {mode === 'onboarding' && step === 1 && (
              <button className="primary" onClick={() => setStep(2)}>{text.next}</button>
            )}
          </article>

          <article className={`step-card ${step === 2 || mode === 'options' ? 'active' : ''}`}>
            <p className="section-number">02 — FOLDER</p>
            <h2>{text.folderTitle}</h2>
            <p>{text.folderBody}</p>
            <button className="folder-button" onClick={chooseDirectory}>
              <span className="folder-icon" aria-hidden="true" />
              <span>
                <strong>{directory ? directory.name : text.noFolder}</strong>
                <small>{permissionReady ? text.permissionReady : text.permissionMissing}</small>
              </span>
              <em>{directory ? text.changeFolder : text.chooseFolder}</em>
            </button>
            <p className="privacy-note">{text.folderPrivacy}</p>
          </article>

          <article className={`step-card ${step === 3 || mode === 'options' ? 'active' : ''}`}>
            <p className="section-number">03 — CAPTIONS</p>
            <h2>{text.languageTitle}</h2>
            <p>{text.languageBody}</p>
            <div className="language-list">
              {orderedLanguageChoices.map((language) => {
                const checked = preferences.transcriptLanguages.includes(language.code);
                const order = preferences.transcriptLanguages.indexOf(language.code);
                return (
                  <label className="language-row" key={language.code}>
                    <span className="language-order">{checked ? String(order + 1).padStart(2, '0') : '—'}</span>
                    <span>{language.label}</span>
                    {checked && (
                      <span className="order-buttons">
                        <button
                          type="button"
                          aria-label={`Move ${language.label} up`}
                          disabled={order === 0}
                          onClick={(event) => {
                            event.preventDefault();
                            moveTranscriptLanguage(language.code, -1);
                          }}
                        >↑</button>
                        <button
                          type="button"
                          aria-label={`Move ${language.label} down`}
                          disabled={order === preferences.transcriptLanguages.length - 1}
                          onClick={(event) => {
                            event.preventDefault();
                            moveTranscriptLanguage(language.code, 1);
                          }}
                        >↓</button>
                      </span>
                    )}
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTranscriptLanguage(language.code)}
                    />
                  </label>
                );
              })}
            </div>
            <button className="primary" onClick={finish}>
              {mode === 'onboarding' ? text.finish : text.saveSettings}
            </button>
          </article>
        </section>
      )}
      {notice && <div className="notice">{notice}</div>}
      <footer>
        <span>LOCALKEEPFLASH / 0.1.0</span>
        <span>AGPL-3.0</span>
      </footer>
    </main>
  );
}
