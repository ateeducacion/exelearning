import { beforeEach, describe, expect, it, vi } from 'vitest';
import Locale from './locale.js';

describe('Locale translations', () => {
  let locale;
  let mockApp;
  let translations;
  let contentTranslations;
  const originalWindow = window;

  beforeEach(() => {
    document.body.innerHTML = '<body></body>';
    translations = {
      translations: {
        hello: '~Hola',
        escaped: '\\"quoted\\"',
        'idevice.hello': 'Idevice Hola',
      },
    };
    contentTranslations = {
      translations: {
        content: '~Contenido',
        slash: 'path\\/resource',
      },
    };
    mockApp = {
      eXeLearning: {
        config: {
          locale: 'es',
        },
      },
      api: {
        getTranslations: vi.fn().mockResolvedValue(translations),
      },
    };
    locale = new Locale(mockApp);
  });

  afterEach(() => {
    window._ = () => undefined;
    window.c_ = () => undefined;
    vi.restoreAllMocks();
  });

  it('sets locale language attribute when setLocaleLang called', async () => {
    await locale.setLocaleLang('fr');
    expect(document.querySelector('body').getAttribute('lang')).toBe('fr');
  });

  it('loadTranslationsStrings populates strings via api', async () => {
    await locale.setLocaleLang('es');
    await locale.loadTranslationsStrings();

    expect(mockApp.api.getTranslations).toHaveBeenCalledWith('es');
    // The result object is stored directly, with translations in the translations property
    expect(locale.strings.translations.hello).toBe('~Hola');
  });

  it('getGUITranslation returns cleaned translation with tilde removed', () => {
    locale.strings = translations;
    expect(locale.getGUITranslation('hello')).toBe('Hola');
    expect(locale.getGUITranslation('escaped')).toBe('"quoted"');
    expect(locale.getGUITranslation(null)).toBe('');
  });

  it('getContentTranslation resolves content translations and strips tilde', () => {
    locale.c_strings = contentTranslations;
    expect(locale.getContentTranslation('content')).toBe('Contenido');
    expect(locale.getContentTranslation('slash')).toBe('path/resource');
    expect(locale.getContentTranslation(123)).toBe('');
  });

  it('getTranslation resolves idevice-specific keys before default', () => {
    locale.strings = translations;
    expect(locale.getTranslation('hello', null, 'idevice')).toBe('Idevice Hola');
    // "~" marks machine-translated placeholders in the XLF files and must
    // never leak into the UI, so getTranslation strips it like the GUI/content
    // helpers already do.
    expect(locale.getTranslation('hello')).toBe('Hola');
    expect(locale.getTranslation('missing')).toBe('missing');
  });

  it('getTranslation strips the "~" fuzzy marker from idevice-specific translations', () => {
    locale.strings = {
      translations: {
        'idevice.next': '~Siguiente',
      },
    };
    expect(locale.getTranslation('next', null, 'idevice')).toBe('Siguiente');
  });

  it('window _ and c_ helpers delegate to translation helpers and adjust elp suffix', () => {
    locale.strings = translations;
    locale.c_strings = contentTranslations;

    const guiResult = window._('hello');
    const contentResult = window.c_('file.elp');

    expect(guiResult).toBe('Hola');
    expect(contentResult).toBe('file.elpx');
  });

  it('window _ with idevice parameter uses idevice-specific translation', () => {
    locale.strings = translations; // Already includes 'idevice.hello': 'Idevice Hola'

    // Without idevice: uses getGUITranslation (removes ~ prefix)
    expect(window._('hello')).toBe('Hola');

    // With idevice: uses getTranslation with idevice support
    expect(window._('hello', 'idevice')).toBe('Idevice Hola');
  });

  it('loadContentTranslationsStrings stores content translations from api', async () => {
    const contentPayload = {
      translations: {
        notes: 'Notas',
      },
    };
    mockApp.api.getTranslations.mockResolvedValueOnce(contentPayload);

    await locale.loadContentTranslationsStrings('en');

    expect(mockApp.api.getTranslations).toHaveBeenCalledWith('en');
    // The result object is stored directly, with translations in the translations property
    expect(locale.c_strings).toEqual({ translations: { notes: 'Notas' } });
  });

  it('getContentTranslation returns sanitized fallback when missing', () => {
    locale.c_strings = { translations: {} };

    expect(locale.getContentTranslation('path\\/to\\"file')).toBe('path/to\\"file');
  });

  it('getTranslation returns empty for non-string inputs', () => {
    expect(locale.getTranslation(123)).toBe('');
  });

  describe('init', () => {
    it('should call setLocaleLang and loadTranslationsStrings', async () => {
      const setLocaleLangSpy = vi.spyOn(locale, 'setLocaleLang').mockImplementation(() => {});
      const loadTranslationsSpy = vi.spyOn(locale, 'loadTranslationsStrings').mockResolvedValue();

      await locale.init();

      expect(setLocaleLangSpy).toHaveBeenCalledWith('es');
      expect(loadTranslationsSpy).toHaveBeenCalled();
    });
  });

  describe('refreshI18nGlobals', () => {
    // Pre-built file: c_() already resolved to translated strings
    const PREBUILT_ES = `$exe_i18n = { "previous": "Anterior", "next": "Siguiente", "block": "bloque" };`;
    const PREBUILT_EN = `$exe_i18n = { "previous": "Previous", "next": "Next", "block": "block" };`;

    beforeEach(() => {
      window.eXeLearning = { version: 'v1.0.0', config: { basePath: '' } };
    });

    afterEach(() => {
      delete window.eXeLearning;
      delete window.$exe_i18n;
    });

    it('should fetch pre-built file and execute it to set $exe_i18n', async () => {
      locale._contentLang = 'es';
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => PREBUILT_ES });

      await locale.refreshI18nGlobals();

      expect(window.$exe_i18n.previous).toBe('Anterior');
      expect(window.$exe_i18n.next).toBe('Siguiente');
      expect(window.$exe_i18n.block).toBe('bloque');
    });

    it('should use contentLang derived from loadContentTranslationsStrings', async () => {
      locale._contentLang = 'es';
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => PREBUILT_ES });

      await locale.refreshI18nGlobals();

      expect(mockFetch).toHaveBeenCalledWith('/v1.0.0/app/common/i18n/common_i18n.es.js');
    });

    it('should fall back to English when locale file returns 404', async () => {
      locale._contentLang = 'fr';
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, text: async () => PREBUILT_EN });

      await locale.refreshI18nGlobals();

      expect(window.$exe_i18n.previous).toBe('Previous');
    });

    it('should warn and return early when both fetches fail', async () => {
      locale._contentLang = 'fr';
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await locale.refreshI18nGlobals();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch'), 404);
      expect(window.$exe_i18n).toBeUndefined();
    });

    it('should construct URL with version prefix when version is set', async () => {
      window.eXeLearning = { version: 'v2.0.0', config: { basePath: '/app' } };
      locale._contentLang = 'es';
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => PREBUILT_ES });

      await locale.refreshI18nGlobals();

      expect(mockFetch).toHaveBeenCalledWith('/app/v2.0.0/app/common/i18n/common_i18n.es.js');
    });

    it('should construct URL without version when version is empty', async () => {
      window.eXeLearning = { version: '', config: { basePath: '' } };
      locale._contentLang = 'es';
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => PREBUILT_ES });

      await locale.refreshI18nGlobals();

      expect(mockFetch).toHaveBeenCalledWith('/app/common/i18n/common_i18n.es.js');
    });
  });

  describe('getGUITranslation edge cases', () => {
    it('should return original string with escaped quotes removed when key not found', () => {
      locale.strings = { translations: {} };
      expect(locale.getGUITranslation('unknown key')).toBe('unknown key');
    });

    it('should handle string with quotes when key not found', () => {
      locale.strings = { translations: {} };
      expect(locale.getGUITranslation('text "quoted"')).toBe('text "quoted"');
    });
  });

  describe('catalogue key escaping (incomplete-sanitization fix)', () => {
    // Real XLF <source> keys are stored verbatim (unescaped). The first lookup
    // branch handles those, so quoted source strings keep resolving exactly as
    // before. These cases lock in that legitimate-input behaviour.
    it('getGUITranslation still resolves a real quoted source key', () => {
      locale.strings = { translations: { 'Click the "Reply" button.': '~Pulsa el botón "Responder".' } };
      expect(locale.getGUITranslation('Click the "Reply" button.')).toBe('Pulsa el botón "Responder".');
    });

    it('getContentTranslation still resolves a real quoted source key', () => {
      locale.c_strings = { translations: { 'Open "{name}".': 'Abrir "{name}".' } };
      expect(locale.getContentTranslation('Open "{name}".')).toBe('Abrir "{name}".');
    });

    // Security property (incomplete-sanitization): backslashes in the input
    // must be escaped BEFORE quotes, so a literal backslash in the lookup key
    // is doubled. The naive `replace(/"/g, '\\"')` left backslashes untouched,
    // letting `\"` collapse ambiguously. Inputs WITHOUT backslashes (every real
    // translation source string) escape identically, preserving lookups.

    it('getGUITranslation doubles backslashes when building the fallback key', () => {
      // Plain quote (no backslash) must still escape to `\"` and resolve the
      // legacy escaped key exactly as before — behaviour preserved.
      // Key `\\"` in JS source = backslash + quote.
      locale.strings = { translations: { '\\"': 'plain-quote-value' } };
      expect(locale.getGUITranslation('"')).toBe('plain-quote-value');

      // Backslash-bearing input `\y` is NOT a direct key, so it goes through the
      // escaping fallback. Backslash-first escaping builds key `\\y` (doubled
      // backslash + y). The catalogue exposes only that correctly-escaped key
      // plus the naive single-backslash form; the fix must resolve the former.
      locale.strings = {
        translations: { '\\\\y': 'correct', z: 'unused' },
      };
      expect(locale.getGUITranslation('\\y')).toBe('correct');
    });

    it('getContentTranslation doubles backslashes when building the fallback key', () => {
      locale.c_strings = { translations: { '\\"': 'plain-quote-value' } };
      expect(locale.getContentTranslation('"')).toBe('plain-quote-value');

      locale.c_strings = {
        translations: { '\\\\y': 'correct', z: 'unused' },
      };
      expect(locale.getContentTranslation('\\y')).toBe('correct');
    });

    it('getTranslation doubles backslashes when building the lookup key', () => {
      // Plain quote still escapes to `\"` and resolves the legacy escaped key.
      locale.strings = { translations: { '\\"': 'plain-quote-value' } };
      expect(locale.getTranslation('"')).toBe('plain-quote-value');

      // getTranslation escapes the input unconditionally; with backslash-first
      // escaping `\y` becomes `\\y` (doubled), matching the correctly-escaped key.
      locale.strings = {
        translations: { '\\\\y': 'correct', z: 'unused' },
      };
      expect(locale.getTranslation('\\y')).toBe('correct');
    });
  });
});
