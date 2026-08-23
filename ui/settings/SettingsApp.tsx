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
type ThemePreference = 'system' | 'light' | 'dark';

const languageChoices = [
  { code: 'en', label: 'English' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
] as const;

const KEEPFLASH_MARKETING_URL =
  'https://keepflash.com/?utm_source=localkeepflash&utm_medium=extension&utm_campaign=onboarding';
const THEME_STORAGE_KEY = 'local-keepflash-theme';

function getInitialTheme(): ThemePreference {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme;
    }
  } catch {
    // Keep the system preference when storage is unavailable.
  }
  return 'system';
}

export function SettingsApp({ mode }: { mode: Mode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle | null>(null);
  const [permissionReady, setPermissionReady] = useState(false);
  const [step, setStep] = useState(mode === 'onboarding' ? 1 : 2);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(true);
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);
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

  useEffect(() => {
    document.documentElement.lang = preferences.locale === 'zh' ? 'zh-CN' : 'en';
    document.title = mode === 'onboarding' ? text.pageTitleOnboarding : text.pageTitleSettings;
  }, [mode, preferences.locale, text]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The visual preference can remain session-only when storage is unavailable.
    }
  }, [theme]);

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
      await port.writeText(testPath, `LocalKeepFlash write test - ${new Date().toISOString()}\n`);
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
    }
    await browser.runtime.sendMessage({ type: 'ONBOARDING_COMPLETE' }).catch(() => undefined);
  }

  if (busy) {
    return (
      <main className="shell loading" aria-label={text.loading} aria-busy="true">
        <div className="page-frame">
          <div className="loading-header" />
          <div className="loading-hero">
            <div>
              <span />
              <strong />
              <i />
              <i />
            </div>
            <aside />
          </div>
          <div className="loading-panel" />
        </div>
      </main>
    );
  }

  const isReadyScreen = mode === 'onboarding' && step === 4;
  const orderedLanguageChoices = [
    ...preferences.transcriptLanguages
      .map((code) => languageChoices.find((choice) => choice.code === code))
      .filter((choice): choice is (typeof languageChoices)[number] => Boolean(choice)),
    ...languageChoices.filter(
      (choice) => !preferences.transcriptLanguages.includes(choice.code),
    ),
  ];
  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'system', label: text.themeSystem },
    { value: 'light', label: text.themeLight },
    { value: 'dark', label: text.themeDark },
  ];
  const progressItems = [
    { value: 1, label: text.permissionStep },
    { value: 2, label: text.folderStep },
    { value: 3, label: text.captionsStep },
  ];
  const showPermission = mode === 'options' || step === 1;
  const showFolder = mode === 'options' || step === 2;
  const showLanguages = mode === 'options' || step === 3;

  return (
    <main className={`shell ${mode}-mode`}>
      <div className="page-frame">
        <header className="masthead">
          <a className="brand" href="#top" aria-label="LocalKeepFlash">
            <ArchiveMark />
            <span>LocalKeepFlash</span>
          </a>
          <div className="header-actions">
            <div className="theme-switch" role="group" aria-label={text.themeLabel}>
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={theme === option.value}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="locale-switch">
              <span className="sr-only">{text.languageLabel}</span>
              <select
                aria-label={text.languageLabel}
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
          </div>
        </header>

        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="section-label">{text.eyebrow}</p>
            <h1>{mode === 'onboarding' ? text.onboardingTitle : text.settingsTitle}</h1>
            <div className="pencil-line" aria-hidden="true" />
            <p className="lede">{text.intro}</p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-brand-card">
              <ArchiveMark />
              <div>
                <small>{text.localLabel}</small>
                <strong>LocalKeepFlash</strong>
              </div>
            </div>
            <div className="hero-route">
              <span>WEB</span>
              <i />
              <span>MARKDOWN</span>
            </div>
          </div>
        </section>

        {mode === 'onboarding' && !isReadyScreen && (
          <nav className="setup-progress" aria-label={text.progressLabel}>
            {progressItems.map((item) => (
              <div
                key={item.value}
                className={item.value === step ? 'current' : item.value < step ? 'complete' : ''}
                aria-current={item.value === step ? 'step' : undefined}
              >
                <span>{item.value}</span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </nav>
        )}

        {isReadyScreen ? (
          <section className="ready-panel">
            <div className="ready-mark" aria-hidden="true">✓</div>
            <p className="section-label">{text.readyStep}</p>
            <h2>{text.readyTitle}</h2>
            <p>{text.readyBody}</p>
            <button type="button" className="primary" onClick={() => window.close()}>
              {text.readyButton}
            </button>
          </section>
        ) : (
          <section className="steps" aria-live="polite">
            {showPermission && (
              <article className="step-card permission-card">
                <p className="section-label">{text.permissionStep}</p>
                <h2>{text.permissionTitle}</h2>
                <p>{text.permissionBody}</p>
                {mode === 'onboarding' && (
                  <button type="button" className="primary" onClick={() => setStep(2)}>
                    {text.next}
                  </button>
                )}
              </article>
            )}

            {showFolder && (
              <article className="step-card folder-card">
                <p className="section-label">{text.folderStep}</p>
                <h2>{text.folderTitle}</h2>
                <p>{text.folderBody}</p>
                <button type="button" className="folder-button" onClick={chooseDirectory}>
                  <span className="folder-icon" aria-hidden="true">MD</span>
                  <span>
                    <strong>{directory ? directory.name : text.noFolder}</strong>
                    <small>{permissionReady ? text.permissionReady : text.permissionMissing}</small>
                  </span>
                  <em>{directory ? text.changeFolder : text.chooseFolder}</em>
                </button>
                <p className="privacy-note">{text.folderPrivacy}</p>
                {mode === 'onboarding' && (
                  <div className="button-row">
                    <button type="button" className="secondary" onClick={() => setStep(1)}>
                      {text.back}
                    </button>
                    {directory && permissionReady && (
                      <button type="button" className="primary" onClick={() => setStep(3)}>
                        {text.next}
                      </button>
                    )}
                  </div>
                )}
              </article>
            )}

            {showLanguages && (
              <article className="step-card language-card">
                <p className="section-label">{text.captionsStep}</p>
                <h2>{text.languageTitle}</h2>
                <p>{text.languageBody}</p>
                <div className="language-list">
                  {orderedLanguageChoices.map((language) => {
                    const checked = preferences.transcriptLanguages.includes(language.code);
                    const order = preferences.transcriptLanguages.indexOf(language.code);
                    return (
                      <label className="language-row" key={language.code}>
                        <span className="language-order">
                          {checked ? String(order + 1).padStart(2, '0') : '-'}
                        </span>
                        <span>{language.label}</span>
                        {checked && (
                          <span className="order-buttons">
                            <button
                              type="button"
                              aria-label={`${language.label} ${text.moveUp}`}
                              disabled={order === 0}
                              onClick={(event) => {
                                event.preventDefault();
                                moveTranscriptLanguage(language.code, -1);
                              }}
                            >↑</button>
                            <button
                              type="button"
                              aria-label={`${language.label} ${text.moveDown}`}
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
                <div className="button-row">
                  {mode === 'onboarding' && (
                    <button type="button" className="secondary" onClick={() => setStep(2)}>
                      {text.back}
                    </button>
                  )}
                  <button type="button" className="primary" onClick={finish}>
                    {mode === 'onboarding' ? text.finish : text.saveSettings}
                  </button>
                </div>
              </article>
            )}
          </section>
        )}

        {mode === 'onboarding' && (
          <aside className="keepflash-bridge" aria-labelledby="keepflash-bridge-title">
            <div className="keepflash-bridge-copy">
              <p className="section-label">{text.keepFlashEyebrow}</p>
              <h2 id="keepflash-bridge-title">{text.keepFlashTitle}</h2>
              <p>{text.keepFlashBody}</p>
              <div className="keepflash-bridge-action">
                <a href={KEEPFLASH_MARKETING_URL} target="_blank" rel="noreferrer">
                  {text.keepFlashCta}
                  <span aria-hidden="true">↗</span>
                </a>
                <small>{text.keepFlashNote}</small>
              </div>
            </div>
            <div className="keepflash-bridge-mark" aria-hidden="true">
              <span>{text.keepFlashMarkKicker}</span>
              <i />
              <strong>KEEPFLASH</strong>
              <small>{text.keepFlashMarkFeatures}</small>
            </div>
          </aside>
        )}
        {notice && <div className="notice" role="status">{notice}</div>}
        <footer>
          <span>LocalKeepFlash 0.1.1</span>
          <span>AGPL-3.0</span>
        </footer>
      </div>
    </main>
  );
}
