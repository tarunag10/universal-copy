(function () {
  'use strict';

  // Check if running in extension context
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

  const STORAGE_KEY = 'scr_settings';
  const ITEMS_KEY = 'scr_items';
  const MAX_DISPLAY = 5;

  const PRESETS = {
    news: {
      name: 'News Sites',
      icon: '📰',
      domains: ['nytimes.com', 'wsj.com', 'washingtonpost.com', 'theguardian.com', 'medium.com', 'ft.com', 'bloomberg.com'],
    },
    realestate: {
      name: 'Real Estate',
      icon: '🏠',
      domains: ['zillow.com', 'realtor.com', 'redfin.com', 'trulia.com', 'rightmove.co.uk', 'zoopla.co.uk'],
    },
    government: {
      name: 'Government Forms',
      icon: '🏛️',
      domains: ['.gov', 'gov.uk', 'gov.au', 'govt.nz'],
    },
    academic: {
      name: 'Academic/Journals',
      icon: '📚',
      domains: ['jstor.org', 'sciencedirect.com', 'springer.com', 'wiley.com', 'ieee.org'],
    },
  };

  let settings = {
    enableRightClick: true,
    enableSelection: true,
    enableCopy: true,
    enableContextMenu: true,
    enableKeyboard: true,
    enableDrag: true,
    enableTouch: true,
    autoUnlock: false,
    showToolbar: true,
    domainSettings: {},
    activeProfile: null,
  };

  let currentTab = null;

  function getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? { ...settings, ...JSON.parse(data) } : settings;
    } catch {
      return settings;
    }
  }

  function saveSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function getItems() {
    try {
      const data = localStorage.getItem(ITEMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function getDeviceId() {
    let deviceId = localStorage.getItem('scr_device_id');
    if (!deviceId) {
      deviceId = generateId();
      localStorage.setItem('scr_device_id', deviceId);
    }
    return deviceId;
  }

  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#18181b';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== TAB COMMUNICATION ====================

  function sendToTab(type, data = {}) {
    return new Promise((resolve) => {
      if (!isExtension) {
        console.log('SCR: Not in extension context');
        resolve({ error: 'Not in extension context' });
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].id) {
          console.log('SCR: No active tab');
          resolve({ error: 'No active tab' });
          return;
        }
        currentTab = tabs[0];
        console.log('SCR: Sending', type, 'to tab', tabs[0].id, 'URL:', tabs[0].url);
        
        try {
          chrome.tabs.sendMessage(tabs[0].id, { type, ...data }, (response) => {
            console.log('SCR: Response:', response);
            resolve(response || { success: true });
          });
        } catch (e) {
          console.log('SCR: Send error:', e);
          resolve({ error: e.message });
        }
      });
    });
  }

  // ==================== UI RENDERING ====================

  let currentState = 'locked'; // 'locked' or 'unlocked'

  function renderStatus(status) {
    const toggle = document.getElementById('unlockToggle');
    const icon = document.getElementById('unlockIcon');
    const text = document.getElementById('unlockText');
    const hint = document.getElementById('unlockHint');
    
    // Determine state from status
    if (status && status.unlocked === true && !status.restricted) {
      currentState = 'unlocked';
    } else {
      currentState = 'locked';
    }
    
    if (toggle && icon && text && hint) {
      if (currentState === 'unlocked') {
        toggle.classList.remove('locked');
        toggle.classList.add('unlocked');
        icon.textContent = '🔓';
        text.textContent = 'UNLOCKED';
        hint.textContent = 'Click to lock';
      } else {
        toggle.classList.remove('unlocked');
        toggle.classList.add('locked');
        icon.textContent = '🔒';
        text.textContent = 'LOCKED';
        hint.textContent = 'Click to unlock';
      }
    }
  }

  function renderSettings() {
    const toggles = document.querySelectorAll('.toggle');
    toggles.forEach(toggle => {
      const setting = toggle.dataset.setting;
      if (settings[setting]) {
        toggle.classList.add('active');
      } else {
        toggle.classList.remove('active');
      }
    });
  }

  function renderPresets() {
    const buttons = document.querySelectorAll('.preset-btn');
    buttons.forEach(btn => {
      const preset = btn.dataset.preset;
      if (settings.activeProfile === preset) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  const STATS_KEY = 'scr_stats';

  function getStats() {
    try {
      const data = localStorage.getItem(STATS_KEY);
      return data ? JSON.parse(data) : { totalUnlocks: 0, pagesUnlocked: [], lastUnlock: null };
    } catch {
      return { totalUnlocks: 0, pagesUnlocked: [], lastUnlock: null };
    }
  }

  function renderStats() {
    const stats = getStats();
    const totalEl = document.getElementById('totalUnlocks');
    const sitesEl = document.getElementById('sitesUnlocked');
    
    if (totalEl) totalEl.textContent = stats.totalUnlocks;
    if (sitesEl) sitesEl.textContent = stats.pagesUnlocked.length;
  }

  function renderHistory() {
    const items = getItems()
      .filter(item => !item.isDeleted)
      .slice(0, MAX_DISPLAY);

    const container = document.getElementById('historyList');
    const count = document.getElementById('historyCount');

    if (!container) return;
    if (count) count.textContent = items.length;

    renderStats();

    container.innerHTML = items.map(item => `
      <div class="history-item" data-text="${encodeURIComponent(item.text)}">
        <span class="history-text">${escapeHtml(item.text.substring(0, 50))}</span>
        <span class="history-type ${item.type}">${item.type}</span>
      </div>
    `).join('');

    container.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const text = decodeURIComponent(el.dataset.text);
        navigator.clipboard.writeText(text).then(() => {
          showToast('Copied!', 'success');
        }).catch(() => {
          showToast('Copy failed', 'error');
        });
      });
    });
  }

  // ==================== ACTIONS ====================

  async function handleAction(action) {
    console.log('SCR: handleAction called with:', action);
    
    try {
      switch (action) {
        case 'unlock':
          await sendToTab('UNLOCK');
          showToast('🔓 Page unlocked!', 'success');
          break;
        case 'lock':
          await sendToTab('LOCK');
          showToast('🔒 Page locked', 'info');
          break;
        case 'copyAll':
          await sendToTab('COPY_ALL');
          showToast('All text copied!', 'success');
          break;
        case 'cleanText':
          await sendToTab('CLEAN_TEXT');
          showToast('Text cleaned!', 'success');
          break;
        case 'cleanUrl':
          await sendToTab('CLEAN_URL');
          showToast('URL cleaned!', 'success');
          break;
        case 'performOCR':
          await sendToTab('PERFORM_OCR');
          showToast('Running OCR...', 'info');
          break;
        case 'extractImages':
          await sendToTab('EXTRACT_IMAGES');
          showToast('Extracting images...', 'info');
          break;
        default:
          console.log('SCR: Unknown action:', action);
          showToast('Action: ' + action, 'info');
      }
    } catch (e) {
      console.log('SCR: handleAction error:', e);
      showToast('Error: ' + e.message, 'error');
    }
  }

  function handleToggle(setting) {
    const newValue = !settings[setting];
    settings[setting] = newValue;
    saveSettings(settings);
    sendToTab('UPDATE_SETTINGS', settings);
    renderSettings();
  }

  function handlePreset(preset) {
    const presetData = PRESETS[preset];
    if (!presetData) return;

    const presetSettings = {
      enableRightClick: true,
      enableSelection: true,
      enableCopy: true,
      enableContextMenu: true,
      enableKeyboard: true,
      enableDrag: true,
      enableTouch: true,
      showToolbar: true,
    };

    settings = { ...settings, ...presetSettings, activeProfile: preset };
    saveSettings(settings);
    sendToTab('UPDATE_SETTINGS', settings);

    renderPresets();
    showToast(`Applied: ${presetData.name}`, 'success');
  }

  // ==================== INITIALIZATION ====================

  async function init() {
    getDeviceId();
    settings = getSettings();

    renderSettings();
    renderPresets();
    renderHistory();

    // Get page status
    let status = { restricted: true, unlocked: true };
    if (isExtension) {
      try {
        status = await sendToTab('GET_STATUS');
      } catch (e) {
        console.log('SCR: Could not get status');
      }
    }
    renderStatus(status || { restricted: true, unlocked: true });

    document.getElementById('unlockToggle')?.addEventListener('click', async () => {
      try {
        if (currentState === 'unlocked') {
          await sendToTab('LOCK');
          renderStatus({ restricted: true, unlocked: false });
          showToast('🔒 Page locked', 'info');
          currentState = 'locked';
        } else {
          await sendToTab('UNLOCK');
          renderStatus({ restricted: false, unlocked: true });
          showToast('🔓 Page unlocked!', 'success');
          currentState = 'unlocked';
        }
      } catch (e) {
        console.log('SCR: Toggle error', e);
        // Even if sendToTab fails, toggle locally
        if (currentState === 'unlocked') {
          renderStatus({ restricted: true, unlocked: false });
          currentState = 'locked';
        } else {
          renderStatus({ restricted: false, unlocked: true });
          currentState = 'unlocked';
        }
      }
    });

    // Make toggle clickable
    document.getElementById('unlockToggle').style.pointerEvents = 'auto';

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });

    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', () => handleToggle(toggle.dataset.setting));
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => handlePreset(btn.dataset.preset));
    });

    document.getElementById('openDashboard')?.addEventListener('click', (e) => {
      if (!isExtension) return;
      e.preventDefault();
      chrome.tabs.create({ url: 'index.html' });
    });

    document.getElementById('openSettings')?.addEventListener('click', (e) => {
      if (!isExtension) return;
      e.preventDefault();
      chrome.tabs.create({ url: 'index.html#/settings' });
    });

    if (isExtension) {
      setInterval(renderHistory, 5000);
    }
  }

  try {
    document.addEventListener('DOMContentLoaded', init);
  } catch (e) {
    console.error('SCR: Error initializing popup', e);
  }
})();