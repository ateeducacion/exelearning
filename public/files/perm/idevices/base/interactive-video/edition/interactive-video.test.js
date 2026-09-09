/**
 * Unit tests for interactive-video iDevice (edition)
 */

/* eslint-disable no-undef */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('interactive-video iDevice edition', () => {
  let $exeDevice;
  let originalCommon;
  let originalTabs;
  let originalGamificationCommon;
  let originalProgressBar;
  let originalScorm;

  beforeEach(() => {
    global.$exeDevice = undefined;
    document.body.innerHTML = '';

    originalCommon = $exeDevicesEdition.iDevice.common;
    originalTabs = $exeDevicesEdition.iDevice.tabs;
    originalGamificationCommon = $exeDevicesEdition.iDevice.gamification.common;
    originalProgressBar = $exeDevicesEdition.iDevice.gamification.progressBar;
    originalScorm = $exeDevicesEdition.iDevice.gamification.scorm;

    $exeDevicesEdition.iDevice.common = {
      getTextFieldset: vi.fn(() => ''),
    };
    $exeDevicesEdition.iDevice.tabs = {
      init: vi.fn(),
    };
    $exeDevicesEdition.iDevice.gamification.common = {
      ...originalGamificationCommon,
      getLanguageTab: vi.fn(() => ''),
    };
    $exeDevicesEdition.iDevice.gamification.progressBar = {
      ...originalProgressBar,
      getContents: vi.fn((path) => `<img id="progress-help-icon" src="${path}quextIEHelp.png">`),
      addEvents: vi.fn(),
    };
    $exeDevicesEdition.iDevice.gamification.scorm = {
      ...originalScorm,
      getTab: vi.fn(() => ''),
      init: vi.fn(),
    };

    $exeDevice = global.loadIdevice(join(__dirname, 'interactive-video.js'));
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.common = originalCommon;
    $exeDevicesEdition.iDevice.tabs = originalTabs;
    $exeDevicesEdition.iDevice.gamification.common = originalGamificationCommon;
    $exeDevicesEdition.iDevice.gamification.progressBar = originalProgressBar;
    $exeDevicesEdition.iDevice.gamification.scorm = originalScorm;
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
  });

  it('renders the progress report help icon from the iDevice edition assets', () => {
    const container = document.createElement('div');
    const path = '/files/perm/idevices/base/interactive-video/edition/';
    document.body.appendChild(container);

    $exeDevice.init(container, '', path);

    const helpIcon = document.getElementById('progress-help-icon');
    expect(helpIcon).not.toBeNull();
    expect(helpIcon.getAttribute('src')).toBe(`${path}quextIEHelp.png`);
    expect(existsSync(join(__dirname, 'quextIEHelp.png'))).toBe(true);
  });

  describe('isYoutubeURL', () => {
    it('accepts legitimate YouTube watch URLs', () => {
      expect($exeDevice.isYoutubeURL('https://www.youtube.com/watch?v=g9gPKSGGkEk')).toBe(true);
      expect($exeDevice.isYoutubeURL('https://youtube.com/watch?v=g9gPKSGGkEk')).toBe(true);
      expect($exeDevice.isYoutubeURL('https://m.youtube.com/watch?v=g9gPKSGGkEk')).toBe(true);
    });

    it('rejects look-alike hostnames', () => {
      // Subdomain attack: host endsWith but is not youtube.com
      expect($exeDevice.isYoutubeURL('https://www.youtube.com.evil.com/watch?v=x')).toBe(false);
      // Substring-only attack that the old indexOf(...) > -1 check accepted
      expect($exeDevice.isYoutubeURL('https://evil.com/?x=www.youtube.com')).toBe(false);
      expect($exeDevice.isYoutubeURL('https://notyoutube.com/watch?v=x')).toBe(false);
    });

    it('returns false for invalid or empty input', () => {
      expect($exeDevice.isYoutubeURL('')).toBe(false);
      expect($exeDevice.isYoutubeURL(undefined)).toBe(false);
      expect($exeDevice.isYoutubeURL('not a url')).toBe(false);
    });
  });
});
