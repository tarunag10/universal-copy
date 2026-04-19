/**
 * SCR Background Service Worker
 * Manages settings, domain profiles, and communicates with content scripts
 */

const STORAGE_KEY = 'scr_settings';
const DOMAIN_PRESETS_KEY = 'scr_domain_presets';
const DOMAINS_KEY = 'scr_domains';

const DEFAULT_SETTINGS = {
  enableRightClick: true,
  enableSelection: true,
  enableCopy: true,
  enableContextMenu: true,
  enableKeyboard: true,
  enableDrag: true,
  enableTouch: true,
  autoUnlock: false,
  showToolbar: true,
  globalHotkey: 'Command+Shift+U',
  domainSettings: {},
  activeProfile: null,
};

const PROFILES = {
  news: {
    name: 'News Sites',
    settings: {
      enableRightClick: true,
      enableSelection: true,
      enableCopy: true,
      enableContextMenu: true,
      enableKeyboard: true,
      enableDrag: true,
      enableTouch: true,
    },
    domains: ['nytimes.com', 'wsj.com', 'washingtonpost.com', 'theguardian.com', 'medium.com', 'ft.com', 'bloomberg.com', 'economist.com'],
  },
  realestate: {
    name: 'Real Estate',
    settings: {
      enableRightClick: true,
      enableSelection: true,
      enableCopy: true,
      enableContextMenu: true,
      enableKeyboard: true,
      enableDrag: true,
      enableTouch: true,
    },
    domains: ['zillow.com', 'realtor.com', 'redfin.com', 'trulia.com', 'houses.com', 'rightmove.co.uk', 'zoopla.co.uk'],
  },
  government: {
    name: 'Government Forms',
    settings: {
      enableRightClick: true,
      enableSelection: true,
      enableCopy: true,
      enableContextMenu: true,
      enableKeyboard: true,
      enableDrag: true,
      enableTouch: true,
    },
    domains: ['.gov', '.gov.uk', 'gov.au', 'govt.nz'],
  },
  academic: {
    name: 'Academic/Journals',
    settings: {
      enableRightClick: true,
      enableSelection: true,
      enableCopy: true,
      enableContextMenu: true,
      enableKeyboard: true,
      enableDrag: true,
      enableTouch: true,
    },
    domains: ['jstor.org', 'sciencedirect.com', 'springer.com', 'wiley.com', 'ieee.org', 'acm.org', 'nature.com'],
  },
  minimal: {
    name: 'Minimal Override',
    settings: {
      enableRightClick: true,
      enableSelection: false,
      enableCopy: false,
      enableContextMenu: true,
      enableKeyboard: false,
      enableDrag: false,
      enableTouch: false,
    },
    domains: [],
  },
};

function getSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function updateSettings(updates) {
  const settings = getSettings();
  const newSettings = { ...settings, ...updates };
  saveSettings(newSettings);
  broadcastSettings(newSettings);
  return newSettings;
}

function getDomainSettings(domain) {
  const settings = getSettings();
  return settings.domainSettings[domain] || null;
}

function setDomainSettings(domain, domainSettings) {
  const settings = getSettings();
  settings.domainSettings[domain] = domainSettings;
  saveSettings(settings);
}

function clearDomainSettings(domain) {
  const settings = getSettings();
  delete settings.domainSettings[domain];
  saveSettings(settings);
}

function getAllDomains() {
  const settings = getSettings();
  return Object.keys(settings.domainSettings);
}

function getDomains() {
  try {
    const data = localStorage.getItem(DOMAINS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveDomains(domains) {
  try {
    localStorage.setItem(DOMAINS_KEY, JSON.stringify(domains));
  } catch (e) {
    console.error('Failed to save domains:', e);
  }
}

function detectRestrictedSite(tab) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
      resolve(response?.restricted || false);
    });
  });
}

function applyProfile(profileName) {
  const profile = PROFILES[profileName];
  if (!profile) return null;

  const settings = getSettings();
  const newSettings = { ...settings, ...profile.settings };
  saveSettings(newSettings);
  broadcastSettings(newSettings);

  // Also save domains
  const domains = getDomains();
  profile.domains.forEach(d => {
    if (!domains.includes(d)) {
      domains.push(d);
    }
  });
  saveDomains(domains);

  // Inject unlocker to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', data: profile.settings });
      } catch (e) {}
    });
  });

  return newSettings;
}

function broadcastSettings(settings) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings });
      } catch (e) {}
    });
  });
}

// ==================== MESSAGES ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;
  const tab = sender.tab;

  switch (type) {
    case 'GET_SETTINGS':
      sendResponse({ settings: getSettings() });
      break;

    case 'UPDATE_SETTINGS':
      updateSettings(data);
      sendResponse({ success: true, settings: getSettings() });
      break;

    case 'GET_PROFILE':
      sendResponse({ profiles: PROFILES, activeProfile: getSettings().activeProfile });
      break;

    case 'APPLY_PROFILE':
      const newSettings = applyProfile(data.profileName);
      updateSettings({ activeProfile: data.profileName });
      sendResponse({ success: true, settings: newSettings });
      break;

    case 'GET_DOMAIN_SETTINGS':
      sendResponse({ settings: getDomainSettings(data.domain) });
      break;

    case 'SET_DOMAIN_SETTINGS':
      setDomainSettings(data.domain, data.settings);
      sendResponse({ success: true });
      break;

    case 'CLEAR_DOMAIN_SETTINGS':
      clearDomainSettings(data.domain);
      sendResponse({ success: true });
      break;

    case 'GET_ALL_DOMAINS':
      sendResponse({ domains: getAllDomains() });
      break;

    case 'UNLOCK_PAGE':
      chrome.tabs.sendMessage(tab.id, { type: 'UNLOCK' });
      sendResponse({ success: true });
      break;

    case 'LOCK_PAGE':
      chrome.tabs.sendMessage(tab.id, { type: 'LOCK' });
      sendResponse({ success: true });
      break;

    case 'CHECK_RESTRICTED':
      detectRestrictedSite(tab).then((restricted) => {
        sendResponse({ restricted });
      });
      return true;

    case 'GET_TABS':
      chrome.tabs.query({}, (tabs) => {
        sendResponse({ tabs: tabs.map(t => ({ id: t.id, url: t.url, title: t.title })) });
      });
      break;

    case 'INJECT_UNLOCKER':
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['unlocker.js'],
      }, () => {
        sendResponse({ success: true });
      });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

// ==================== COMMANDS ====================

chrome.commands?.onCommand.addListener((command) => {
  if (command === 'toggle-unlock') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE' });
      }
    });
  }

  if (command === 'quick-copy') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'COPY_ALL' });
      }
    });
  }
});

// ==================== CONTEXT MENU ====================

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus?.create({
    id: 'scr-unlock',
    title: 'Unlock Page',
    contexts: ['page', 'frame'],
  });

  chrome.contextMenus?.create({
    id: 'scr-copy-all',
    title: 'Copy All Text',
    contexts: ['page', 'frame'],
  });

  chrome.contextMenus?.create({
    id: 'scr-extract-images',
    title: 'Extract Image URLs',
    contexts: ['page', 'frame'],
  });
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (!tab) return;

  switch (info.menuItemId) {
    case 'scr-unlock':
      chrome.tabs.sendMessage(tab.id, { type: 'UNLOCK' });
      break;
    case 'scr-copy-all':
      chrome.tabs.sendMessage(tab.id, { type: 'COPY_ALL' });
      break;
    case 'scr-extract-images':
      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_IMAGES' });
      break;
  }
});

// ====================badge updates ====================

function updateBadge(tab) {
  try {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
      if (response?.restricted) {
        chrome.action?.setBadgeText({ tabId: tab.id, text: '🔓' });
        chrome.action?.setBadgeBackgroundColor({ tabId: tab.id, color: '#22c55e' });
      } else {
        chrome.action?.setBadgeText({ tabId: tab.id, text: '' });
      }
    });
  } catch (e) {}
}

chrome.tabs?.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateBadge(tab);
  }
});

chrome.tabs?.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateBadge(tab);
  });
});

console.log('🟢 SCR Background Service initialized');