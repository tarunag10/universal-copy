/**
 * SCR Content Script
 * Loads unlocker and monitors page for restrictions
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'scr_items';
  const MAX_ITEMS = 500;
  let lastClipboardText = '';
  let unlockerLoaded = false;

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
    ];

    if (urlPattern.test(text.trim())) return 'link';
    for (const pattern of codePatterns) {
      if (pattern.test(text)) return 'code';
    }
    return 'text';
  }

  function getSourceName() {
    try {
      const hostname = window.location.hostname;
      if (hostname.includes('github')) return 'GitHub';
      if (hostname.includes('stackoverflow')) return 'StackOverflow';
      if (hostname.includes('medium')) return 'Medium';
      if (hostname.includes('nytimes') || hostname.includes('wsj')) return 'News';
      if (hostname.includes('zillow') || hostname.includes('realtor')) return 'Real Estate';
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
    } catch (e) {}
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
      isPinned: false,
    };

    items.unshift(newItem);
    while (items.length > MAX_ITEMS) {
      const lastNonPinned = items.findLastIndex(item => !item.isPinned && !item.isDeleted);
      if (lastNonPinned !== -1) {
        items.splice(lastNonPinned, 1);
      } else {
        items.pop();
      }
    }

    saveItems(items);
    try {
      chrome.runtime.sendMessage({ type: 'ITEM_ADDED', item: newItem });
    } catch (e) {}
    return newItem;
  }

  // ==================== RESTRICTION DETECTION ====================

  function isRestricted() {
    const style = getComputedStyle(document.body);
    const userSelect = style.userSelect;
    const webkitUserSelect = style.webkitUserSelect;
    const mozUserSelect = style.mozUserSelect;
    const msUserSelect = style.msUserSelect;

    if (userSelect === 'none' || webkitUserSelect === 'none' || mozUserSelect === 'none' || msUserSelect === 'none') {
      return true;
    }

    if (document.body.classList.contains('no-select') || document.body.classList.contains('noselect') || document.body.classList.contains('unselectable')) {
      return true;
    }

    if (document.querySelector('[oncontextmenu]') || document.querySelector('[ondragstart]') || document.querySelector('[onselectstart="return false"]')) {
      return true;
    }

    const styleEl = document.querySelector('style');
    if (styleEl && styleEl.textContent && styleEl.textContent.includes('user-select')) {
      if (styleEl.textContent.includes('none')) return true;
    }

    return false;
  }

  function detectRestrictions() {
    const restrictions = {
      rightClick: false,
      selection: false,
      copy: false,
      keyboard: false,
      drag: false,
      contextMenu: false,
    };

    const style = getComputedStyle(document.body);
    if (style.userSelect === 'none') restrictions.selection = true;
    if (document.body.classList.contains('no-select')) restrictions.selection = true;
    if (document.querySelector('[oncontextmenu]')) restrictions.rightClick = true;
    if (document.querySelector('[ondragstart]')) restrictions.drag = true;
    if (document.querySelector('[oncopy]')) restrictions.copy = true;

    document.addEventListener('contextmenu', (e) => {
      restrictions.rightClick = true;
      return false;
    }, { capture: true });

    return restrictions;
  }

  // ==================== CLIPBOARD MONITORING ====================

  async function checkClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== lastClipboardText && text.trim().length > 0) {
        lastClipboardText = text;
        addItem(text);
      }
    } catch (e) {}
  }

  function handleCopyEvent(e) {
    const selection = window.getSelection();
    const selectedText = selection?.toString();
    if (selectedText && selectedText.trim().length > 0) {
      lastClipboardText = selectedText;
      addItem(selectedText);
    }
  }

  // ==================== MESSAGES ====================

  function handleMessage(message, sender, sendResponse) {
    const { type, data } = message;

    switch (type) {
      case 'GET_STATUS':
        sendResponse({
          restricted: isRestricted(),
          unlocked: unlockerLoaded,
          url: window.location.href,
          hostname: window.location.hostname,
        });
        break;

      case 'UNLOCK':
        dispatchCustomEvent('scr-command', { type: 'UNLOCK' });
        sendResponse({ success: true });
        break;

      case 'LOCK':
        dispatchCustomEvent('scr-command', { type: 'LOCK' });
        sendResponse({ success: true });
        break;

      case 'COPY_ALL':
        dispatchCustomEvent('scr-command', { type: 'COPY_ALL' });
        sendResponse({ success: true });
        break;

      case 'EXTRACT_IMAGES':
        dispatchCustomEvent('scr-command', { type: 'EXTRACT_IMAGES' });
        sendResponse({ success: true });
        break;

      case 'UPDATE_SETTINGS':
        dispatchCustomEvent('scr-command', { type: 'UPDATE_SETTINGS', data });
        sendResponse({ success: true });
        break;

      case 'SETTINGS_UPDATED':
        dispatchCustomEvent('scr-command', { type: 'SETTINGS_UPDATED', settings: data });
        sendResponse({ success: true });
        break;

      case 'GET_ITEMS':
        sendResponse({ items: getItems() });
        break;

      case 'TOGGLE_MONITORING':
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
    return true;
  }

  function dispatchCustomEvent(type, detail) {
    const event = new CustomEvent(type, { detail });
    document.dispatchEvent(event);

    const scrEvent = new CustomEvent('scr-message', { detail: { type, ...detail } });
    document.dispatchEvent(scrEvent);
  }

  // ==================== INIT ====================

  function init() {
    getDeviceId();

    if (isRestricted()) {
      loadUnlocker();
    } else {
      loadUnlocker();
    }

    setInterval(checkClipboard, 1000);
    document.addEventListener('mouseup', handleCopyEvent);
    document.addEventListener('keyup', handleCopyEvent);

    chrome.runtime?.onMessage?.addListener(handleMessage);

    console.log('🟢 SCR Content script initialized', { restricted: isRestricted() });
  }

  function loadUnlocker() {
    if (unlockerLoaded) return;
    unlockerLoaded = true;
    dispatchCustomEvent('scr-command', { type: 'UNLOCK' });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();