(function () {
  'use strict';

  const STORAGE_KEY = 'scr_items';
  const MAX_ITEMS = 500;
  let lastClipboardText = '';
  let monitoringEnabled = true;

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function detectType(text) {
    const urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;
    const codePatterns = [
      /^import\s+/m,
      /^export\s+/m,
      /^const\s+\w+\s*=/m,
      /^let\s+\w+\s*=/m,
      /^function\s+\w+/m,
      /^class\s+\w+/m,
      /^\s*<\w+[^>]*>/m,
      /\{\s*["']?\w+["']?\s*:/,
      /^\s*[\w-]+\s*\([^)]*\)\s*\{/m,
    ];

    if (urlPattern.test(text.trim())) {
      return 'link';
    }

    for (const pattern of codePatterns) {
      if (pattern.test(text)) {
        return 'code';
      }
    }

    return 'text';
  }

  function getSourceName() {
    try {
      const hostname = window.location.hostname;
      if (hostname.includes('github')) return 'GitHub';
      if (hostname.includes('stackoverflow')) return 'StackOverflow';
      if (hostname.includes('medium')) return 'Medium';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter';
      if (hostname.includes('slack')) return 'Slack';
      if (hostname.includes('notion')) return 'Notion';
      if (hostname.includes('figma')) return 'Figma';
      return hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  function getDeviceId() {
    let deviceId = localStorage.getItem('scr_device_id');
    if (!deviceId) {
      deviceId = generateId();
      localStorage.setItem('scr_device_id', deviceId);
    }
    return deviceId;
  }

  function getItems() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save items:', e);
    }
  }

  function addItem(text, sourceUrl, sourceName, type) {
    const items = getItems();

    const existingIndex = items.findIndex(item => item.text === text);
    if (existingIndex !== -1) {
      items.splice(existingIndex, 1);
    }

    const newItem = {
      id: generateId(),
      _creationTime: Date.now(),
      text: text,
      sourceUrl: sourceUrl || window.location.href,
      sourceName: sourceName || getSourceName(),
      type: type || detectType(text),
      deviceId: getDeviceId(),
      isFavorite: false,
      isDeleted: false,
    };

    items.unshift(newItem);

    while (items.length > MAX_ITEMS) {
      const lastNonFavorite = items.findLastIndex(item => !item.isFavorite && !item.isDeleted);
      if (lastNonFavorite !== -1) {
        items.splice(lastNonFavorite, 1);
      } else {
        items.pop();
      }
    }

    saveItems(items);

    try {
      chrome.runtime.sendMessage({ type: 'ITEM_ADDED', item: newItem });
    } catch (e) {
      // Extension context not available
    }

    return newItem;
  }

  async function checkClipboard() {
    if (!monitoringEnabled) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== lastClipboardText && text.trim().length > 0) {
        lastClipboardText = text;
        addItem(text);
      }
    } catch (e) {
      // Clipboard access denied or not available
    }
  }

  function handleCopyEvent(e) {
    const selection = window.getSelection();
    const selectedText = selection?.toString();
    if (selectedText && selectedText.trim().length > 0) {
      lastClipboardText = selectedText;
    }
  }

  function toggleMonitoring(enabled) {
    monitoringEnabled = enabled;
  }

  function init() {
    getDeviceId();

    // Poll clipboard every 1 second
    setInterval(checkClipboard, 1000);

    // Listen for text selection
    document.addEventListener('mouseup', handleCopyEvent);
    document.addEventListener('keyup', handleCopyEvent);

    // Listen for messages from popup/background
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
          case 'GET_ITEMS':
            sendResponse({ items: getItems() });
            break;
          case 'TOGGLE_MONITORING':
            toggleMonitoring(message.enabled);
            sendResponse({ success: true });
            break;
          default:
            sendResponse({ error: 'Unknown message type' });
        }
        return true;
      });
    } catch (e) {
      // Extension context not available
    }

    console.log('Clipboard monitoring initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();