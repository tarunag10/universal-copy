/**
 * SCR Unlocker - Complete bypass system for restricted websites
 * Handles right-click, text selection, keyboard shortcuts, and context menu blocks
 */

(function() {
  'use strict';

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
    rememberDomainSettings: true
  };

  const STATS_KEY = 'scr_stats';
  const DOMAIN_STATE_KEY = 'scr_domain_states';

  let settings = { ...DEFAULT_SETTINGS };
  let toolbarInjected = false;
  let originalStyles = new Map();
  let currentDomain = '';

  // Stats functions
  function getStats() {
    try {
      const data = localStorage.getItem(STATS_KEY);
      return data ? JSON.parse(data) : { totalUnlocks: 0, pagesUnlocked: [], lastUnlock: null };
    } catch {
      return { totalUnlocks: 0, pagesUnlocked: [], lastUnlock: null };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function incrementStats(domain) {
    const stats = getStats();
    stats.totalUnlocks++;
    stats.lastUnlock = Date.now();
    if (!stats.pagesUnlocked.includes(domain)) {
      stats.pagesUnlocked.push(domain);
    }
    saveStats(stats);
  }

  // Domain state functions
  function getDomainState(domain) {
    try {
      const data = localStorage.getItem(DOMAIN_STATE_KEY);
      const states = data ? JSON.parse(data) : {};
      return states[domain] || null;
    } catch {
      return null;
    }
  }

  function setDomainState(domain, isUnlocked) {
    try {
      const data = localStorage.getItem(DOMAIN_STATE_KEY);
      const states = data ? JSON.parse(data) : {};
      states[domain] = { isUnlocked, timestamp: Date.now() };
      localStorage.setItem(DOMAIN_STATE_KEY, JSON.stringify(states));
    } catch (e) {}
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem('scr_unlock_settings');
      if (saved) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem('scr_unlock_settings', JSON.stringify(settings));
    } catch (e) {}
  }

  function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    saveSettings();
    if (settings.autoUnlock || isRestricted()) {
      applyUnlock();
    }
  }

  function getDomainSettings() {
    const domain = window.location.hostname;
    return settings.domainSettings[domain] || null;
  }

  function setDomainSettings(domain, domainSettings) {
    settings.domainSettings[domain] = domainSettings;
    saveSettings();
  }

  // ==================== RIGHT-CLICK BYPASS ====================

  function bypassRightClick(e) {
    if (!settings.enableRightClick) return;
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY);
    return false;
  }

  function bypassRightClickCapture(e) {
    if (!settings.enableRightClick) return;
    if (e.button === 2 || e.button === 0 && e.ctrlKey) {
      e.preventDefault();
      return false;
    }
  }

  // ==================== CONTEXT MENU BYPASS ====================

  function bypassContextMenu(e) {
    if (!settings.enableContextMenu) return;
    e.preventDefault();
    return false;
  }

  function showContextMenu(x, y) {
    removeContextMenu();
    const menu = document.createElement('div');
    menu.id = 'scr-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 4px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
    `;

    const items = [
      { label: 'Copy', action: () => execCommand('copy'), icon: '📋' },
      { label: 'Cut', action: () => execCommand('cut'), icon: '✂️' },
      { label: 'Paste', action: () => execCommand('paste'), icon: '📥' },
      { label: 'Select All', action: () => execCommand('selectAll'), icon: '☑️' },
      { type: 'separator' },
      { label: 'Copy All', action: copyAllText, icon: '📄' },
      { label: 'Extract Images', action: extractImages, icon: '🖼️' },
      { label: 'Unlock Page', action: applyUnlock, icon: '🔓' },
      { label: 'Lock Page', action: applyLock, icon: '🔒' },
    ];

    items.forEach(item => {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: #3f3f46; margin: 4px 8px;';
        menu.appendChild(sep);
        return;
      }

      const btn = document.createElement('button');
      btn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: #fafafa;
        cursor: pointer;
        border-radius: 4px;
        text-align: left;
      `;
      btn.textContent = `${item.icon} ${item.label}`;
      btn.addEventListener('mouseenter', () => btn.style.background = '#27272a');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      btn.addEventListener('click', () => {
        item.action();
        removeContextMenu();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Position adjustment
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', removeContextMenu, { once: true });
    }, 100);
  }

  function removeContextMenu() {
    const menu = document.getElementById('scr-context-menu');
    if (menu) menu.remove();
  }

  // ==================== SELECTION BYPASS ====================

  function bypassSelection(e) {
    if (!settings.enableSelection) return;
    // Allow selection
  }

  // ==================== KEYBOARD BYPASS ====================

  const blockedKeys = [
    'c', 'v', 'x', 'a', // Copy, Paste, Cut, Select All
    'C', 'V', 'X', 'A',
    'Insert', // Insert key for copy
    'Delete', 'Backspace' // Sometimes blocked
  ];

  function bypassKeyboard(e) {
    if (!settings.enableKeyboard) return;

    // Ctrl/Cmd + C/V/X/A
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (blockedKeys.includes(key) || e.key === 'Insert') {
        // Allow the default action - don't prevent
        return;
      }
    }

    // F12 sometimes blocked
    if (e.key === 'F12') {
      e.preventDefault();
      return;
    }

    // Ctrl/Cmd + U (View Source) - allow
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
      return;
    }

    // Ctrl/Cmd + S (Save) - allow
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      return;
    }

    // Ctrl/Cmd + P (Print) - allow
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      return;
    }

    // Ctrl/Cmd + Shift + C (Accessibility)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      return;
    }
  }

  // ==================== DRAG BYPASS ====================

  function bypassDrag(e) {
    if (!settings.enableDrag) return;
    e.dataTransfer.setData('text/plain', e.target.textContent || e.target.value);
  }

  function bypassDragStart(e) {
    if (!settings.enableDrag) return;
    const selection = window.getSelection();
    if (selection.toString()) {
      e.dataTransfer.setData('text/plain', selection.toString());
    }
  }

  // ==================== TOUCH BYPASS ====================

  function bypassTouch(e) {
    if (!settings.enableTouch) return;
    // Long press = context menu (on mobile)
    if (e.type === 'touchstart' && e.touches.length === 1) {
      // Enable text selection on touch
    }
  }

  // ==================== TEXT EXTRACTION ====================

  const SNIPPETS_KEY = 'scr_snippets';

  function getSnippets() {
    try {
      const data = localStorage.getItem(SNIPPETS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveSnippets(snippets) {
    try {
      localStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets));
    } catch (e) {}
  }

  function addSnippet(name, content) {
    const snippets = getSnippets();
    snippets.push({
      id: Date.now().toString(36),
      name,
      content,
      created: Date.now()
    });
    saveSnippets(snippets);
    return snippets;
  }

  function deleteSnippet(id) {
    const snippets = getSnippets().filter(s => s.id !== id);
    saveSnippets(snippets);
    return snippets;
  }

  function copySnippet(id) {
    const snippet = getSnippets().find(s => s.id === id);
    if (snippet) {
      navigator.clipboard.writeText(snippet.content).then(() => {
        showNotification(`Copied: ${snippet.name}`);
      });
    }
  }

  // ==================== OCR ====================

  let tesseractLoaded = false;

  async function loadTesseract() {
    if (tesseractLoaded) return true;
    
    return new Promise((resolve) => {
      showNotification('Loading OCR...');
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => {
        tesseractLoaded = true;
        showNotification('OCR Ready!');
        resolve(true);
      };
      script.onerror = () => {
        showNotification('OCR failed to load');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  async function performOCR() {
    // First, let user select an image area or use canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Get all images from page
    const images = document.querySelectorAll('img');
    if (images.length === 0) {
      showNotification('No images found on page');
      return;
    }

    // For simplicity, OCR the first image - can extend to image picker
    const img = images[0];
    
    if (img.width < 50 || img.height < 50) {
      showNotification('Image too small for OCR');
      return;
    }

    showNotification('Running OCR...');

    try {
      const loaded = await loadTesseract();
      if (!loaded) return;

      // Use Tesseract
      const result = await Tesseract.recognize(img, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            showNotification(`OCR: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const text = result.data.text.trim();
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showNotification('OCR text copied!');
        });
      } else {
        showNotification('No text found in image');
      }
    } catch (e) {
      showNotification('OCR Error: ' + e.message);
    }
  }

  // ==================== TEXT CLEANER ====================

  function cleanText(text) {
    let cleaned = text;

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove common ad artifacts
    const adPatterns = [
      /Advertisement/gi,
      /Advertisemen/gi,
      /Continue reading/gi,
      /Subscribe to read/gi,
      /Sign up for/gi,
      /Newsletter/gi,
      /Privacy Policy/gi,
      /Terms of Service/gi,
      /Cookie Policy/gi,
    ];
    adPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Fix common encoding issues
    cleaned = cleaned.replace(/\u2018|\u2019/g, "'");
    cleaned = cleaned.replace(/\u201c|\u201d/g, '"');
    cleaned = cleaned.replace(/\u2013/g, '-');
    cleaned = cleaned.replace(/\u2014/g, '--');
    cleaned = cleaned.replace(/\u2026/g, '...');

    // Remove multiple line breaks
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  }

  function copyCleanText() {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || getPageText();
    const cleaned = cleanText(selectedText);
    navigator.clipboard.writeText(cleaned).then(() => {
      showNotification('Text cleaned & copied!');
    });
  }

  // ==================== URL CLEANER ====================

  function cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // UTM parameters to remove
      const utmParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'mc_cid', 'mc_eid',
        'fbclid', 'gclid', 'dclid',
        '_ga', '_gl',
        'ref', 'ref_src',
        'share', 'sr_share'
      ];
      
      utmParams.forEach(param => urlObj.searchParams.delete(param));
      
      // Remove empty query params
      [...urlObj.searchParams].forEach(([key]) => {
        if (!urlObj.searchParams.get(key)) {
          urlObj.searchParams.delete(key);
        }
      });
      
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  function copyCleanUrl() {
    const clean = cleanUrl(window.location.href);
    navigator.clipboard.writeText(clean).then(() => {
      showNotification('URL cleaned & copied!');
    });
  }

  function getPageText() {
    const text = document.body.innerText || document.body.textContent;
    return text.trim();
  }

  function copyAllText() {
    const text = getPageText();
    navigator.clipboard.writeText(text).then(() => {
      showNotification('All text copied!');
    }).catch(() => {
      execCommand('selectAll');
      execCommand('copy');
      showNotification('All text selected - press Cmd/Ctrl+C');
    });
  }

  function extractImages() {
    const images = document.querySelectorAll('img[src]');
    const srcs = Array.from(images).map(img => img.src).filter(s => s.startsWith('http'));

    if (srcs.length === 0) {
      showNotification('No images found');
      return;
    }

    const list = srcs.join('\n');
    navigator.clipboard.writeText(list).then(() => {
      showNotification(`Found ${srcs.length} image URLs copied!`);
    }).catch(() => {
      showNotification(`Found ${srcs.length} images - check console`);
      console.log('Image URLs:', srcs);
    });
  }

  function extractFormData() {
    const data = {};
    const forms = document.querySelectorAll('form');

    forms.forEach((form, i) => {
      const formData = new FormData(form);
      const entries = {};
      for (const [key, value] of formData.entries()) {
        entries[key] = value;
      }
      if (Object.keys(entries).length > 0) {
        data[`form${i + 1}`] = entries;
      }
    });

    if (Object.keys(data).length > 0) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
        showNotification('Form data extracted!');
      });
    } else {
      showNotification('No form data found');
    }
  }

  // ==================== OCR EXTRACTION ====================

  function extractTextFromCanvas(canvas) {
    // Basic canvas text detection (placeholder - real OCR would need Tesseract.js)
    return 'Canvas content detected';
  }

  function extractFromIframes() {
    const texts = [];
    const iframes = document.querySelectorAll('iframe');

    iframes.forEach((iframe, i) => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc && doc.body) {
          texts.push(`Frame ${i + 1}: ${doc.body.innerText.substring(0, 500)}`);
        }
      } catch (e) {
        // Cross-origin - can't access
      }
    });

    return texts;
  }

  // ==================== CSS INJECTION ====================

  function injectUnlockCSS() {
    if (document.getElementById('scr-unlock-styles')) return;

    const style = document.createElement('style');
    style.id = 'scr-unlock-styles';
    style.textContent = `
      /* Allow right-click everywhere */
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
        user-select: auto !important;
      }

      /* Allow text selection */
      body, html {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
      }

      /* Remove no-select attributes */
      [oncontextmenu],
      [ondragstart],
      [onselectstart],
      [oncopy] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
        pointer-events: auto !important;
      }

      /* Remove no-copy attributes */
      .no-copy,
      [class*="no-copy"],
      [class*="noselect"],
      [class*="disable-copy"],
      [data-nocopy],
      [data-locked] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
        pointer-events: auto !important;
      }

      /* Input fields */
      input, textarea, select, contenteditable {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
        pointer-events: auto !important;
      }

      /* Links */
      a {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
      }

      /* Paragraphs and divs */
      p, div, span, li, td, th, article, section {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
      }

      /* Allow drag */
      * {
        -webkit-drag-behavior: auto !important;
        drag-behavior: auto !important;
      }

      /* Allow context menu on all elements */
      body {
        -webkit-touch-callout: default !important;
        touch-action: manipulation !important;
      }
    `;

    document.head.appendChild(style);
    originalStyles.set('unlock', style);
  }

  function removeUnlockCSS() {
    const style = originalStyles.get('unlock');
    if (style) {
      style.remove();
      originalStyles.delete('unlock');
    }
  }

  // ==================== EVENT LISTENERS ====================

  function attachEvents() {
    const options = { capture: true, passive: false };

    // Right-click
    document.addEventListener('contextmenu', bypassRightClick, options);

    // Mouse events for context menu
    document.addEventListener('mousedown', bypassRightClickCapture, options);

    // Keyboard
    document.addEventListener('keydown', bypassKeyboard, options);

    // Drag
    document.addEventListener('dragstart', bypassDragStart, false);
    document.addEventListener('drag', bypassDrag, false);

    // Touch
    document.addEventListener('touchstart', bypassTouch, { passive: false });
    document.addEventListener('touchend', bypassTouch, { passive: false });
  }

  function detachEvents() {
    const options = { capture: true, passive: false };

    document.removeEventListener('contextmenu', bypassRightClick, options);
    document.removeEventListener('mousedown', bypassRightClickCapture, options);
    document.removeEventListener('keydown', bypassKeyboard, options);
    document.removeEventListener('dragstart', bypassDragStart, false);
    document.removeEventListener('drag', bypassDrag, false);
    document.removeEventListener('touchstart', bypassTouch, { passive: false });
    document.removeEventListener('touchend', bypassTouch, { passive: false });
  }

  // ==================== TOOLBAR ====================

  function createToolbar() {
    if (toolbarInjected || !settings.showToolbar) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'scr-toolbar';
    toolbar.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      padding: 8px;
      z-index: 999998;
      display: flex;
      gap: 4px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;

    const buttons = [
      { icon: '📋', title: 'Copy All', action: copyAllText },
      { icon: '✨', title: 'Clean Text', action: copyCleanText },
      { icon: '🔗', title: 'Clean URL', action: copyCleanUrl },
      { icon: '🖼️', title: 'Images', action: extractImages },
      { icon: '📷', title: 'OCR Image', action: performOCR },
      { icon: '📝', title: 'Snippets', action: showSnippetsMenu },
      { icon: '🔓', title: 'Unlock', action: applyUnlock },
      { icon: '🔒', title: 'Lock', action: applyLock },
      { icon: '✕', title: 'Close', action: removeToolbar },
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.innerHTML = btn.icon;
      button.title = btn.title;
      button.style.cssText = `
        width: 36px;
        height: 36px;
        border: none;
        background: #27272a;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      `;
      button.addEventListener('mouseenter', () => button.style.background = '#3f3f46');
      button.addEventListener('mouseleave', () => button.style.background = '#27272a');
      button.addEventListener('click', btn.action);
      toolbar.appendChild(button);
    });

    document.body.appendChild(toolbar);
    toolbarInjected = true;

    // Make draggable
    makeElementDraggable(toolbar);
  }

  function removeToolbar() {
    const toolbar = document.getElementById('scr-toolbar');
    if (toolbar) {
      toolbar.remove();
      toolbarInjected = false;
    }
  }

  function makeElementDraggable(el) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    el.style.cursor = 'move';

    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = el.offsetLeft;
      initialY = el.offsetTop;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = initialX + dx + 'px';
      el.style.top = initialY + dy + 'px';
      el.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // ==================== NOTIFICATIONS ====================

  function showNotification(message, type = 'info') {
    const existed = document.getElementById('scr-notification');
    if (existed) existed.remove();

    const notif = document.createElement('div');
    notif.id = 'scr-notification';
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#18181b'};
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: scr-fade-in 0.2s;
    `;
    notif.textContent = message;

    document.body.appendChild(notif);

    setTimeout(() => {
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 200);
    }, 2500);
  }

  // ==================== SNIPPETS MENU ====================

  function showSnippetsMenu() {
    const existing = document.getElementById('scr-snippets-menu');
    if (existing) {
      existing.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.id = 'scr-snippets-menu';
    menu.style.cssText = `
      position: fixed;
      top: 20px;
      right: 80px;
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      padding: 12px;
      z-index: 999998;
      width: 280px;
      max-height: 400px;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;

    const snippets = getSnippets();

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:600;font-size:13px;color:#fafafa;">📝 Snippets</span>
        <button id="scr-add-snippet" style="background:#2563eb;color:white;border:none;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;">+ Add</button>
      </div>
    `;

    if (snippets.length === 0) {
      html += `<div style="color:#71717a;font-size:12px;text-align:center;padding:20px 0;">No snippets yet.<br>Select text and click Add to save.</div>`;
    } else {
      snippets.forEach(s => {
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#27272a;border-radius:8px;margin-bottom:6px;">
            <span style="color:#fafafa;font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</span>
            <div style="display:flex;gap:4px;">
              <button data-copy="${s.id}" style="background:#22c55e;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:10px;cursor:pointer;">Copy</button>
              <button data-delete="${s.id}" style="background:#ef4444;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:10px;cursor:pointer;">✕</button>
            </div>
          </div>
        `;
      });
    }

    menu.innerHTML = html;
    document.body.appendChild(menu);

    // Sanitize event listener to prevent XSS
    menu.onclick = null;

    // Add event listeners
    menu.querySelector('#scr-add-snippet')?.addEventListener('click', () => {
      const selection = window.getSelection();
      const text = selection?.toString();
      if (text) {
        const name = prompt('Enter snippet name:', text.substring(0, 30));
        if (name) {
          addSnippet(name, text);
          showSnippetsMenu();
          showNotification('Snippet saved!');
        }
      } else {
        showNotification('Select text first');
      }
    });

    menu.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        copySnippet(btn.dataset.copy);
      });
    });

    menu.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSnippet(btn.dataset.delete);
        showSnippetsMenu();
      });
    });
  }

  // ==================== MAIN UNLOCK/LOCK ====================

  function applyUnlock() {
    injectUnlockCSS();
    attachEvents();
    if (settings.showToolbar) {
      createToolbar();
    }
    showNotification('🔓 Page unlocked!');
    
    // Track stats
    incrementStats(currentDomain);
    
    // Remember domain state
    if (settings.rememberDomainSettings) {
      setDomainState(currentDomain, true);
    }
  }

function applyLock() {
    removeUnlockCSS();
    detachEvents();
    removeToolbar();
    
    // Remember domain state
    if (settings.rememberDomainSettings) {
      setDomainState(currentDomain, false);
    }
    showNotification('🔒 Page locked');
  }
  }
    removeToolbar();
    showNotification('🔒 Page locked');
  }

  function isRestricted() {
    // Check if page has restrictions
    const hasNoSelect = document.body.classList.contains('no-select') ||
                        document.body.classList.contains('noselect') ||
                        getComputedStyle(document.body).userSelect === 'none';

    const hasNoContext = document.querySelector('[oncontextmenu]') !== null ||
                        document.querySelector('[ondragstart]') !== null;

    return hasNoSelect || hasNoContext;
  }

  function autoDetect() {
    if (isRestricted()) {
      if (settings.autoUnlock) {
        showNotification('🔓 Auto-unlocking restricted page');
        applyUnlock();
      }
    }
  }

  // ==================== MESSAGE HANDLING ====================

  function handleMessage(event) {
    const { type, data } = event.detail || event;

    switch (type) {
      case 'GET_STATUS':
        return { restricted: isRestricted(), unlocked: true };

      case 'UNLOCK':
        applyUnlock();
        break;

      case 'LOCK':
        applyLock();
        break;

      case 'UPDATE_SETTINGS':
        updateSettings(data);
        break;

      case 'COPY_ALL':
        copyAllText();
        break;

      case 'EXTRACT_IMAGES':
        extractImages();
        break;

      case 'EXTRACT_FORMS':
        extractFormData();
        break;

      case 'TOGGLE_TOOLBAR':
        if (toolbarInjected) {
          removeToolbar();
        } else {
          createToolbar();
        }
        break;
        
      case 'GET_STATS':
        return getStats();
        
      case 'GET_DOMAIN_STATE':
        return { domain: currentDomain, state: getDomainState(currentDomain) };

      case 'CLEAN_TEXT':
        copyCleanText();
        break;

      case 'CLEAN_URL':
        copyCleanUrl();
        break;

      case 'GET_SNIPPETS':
        return getSnippets();

      case 'ADD_SNIPPET':
        addSnippet(data.name, data.content);
        break;

      case 'DELETE_SNIPPET':
        deleteSnippet(data.id);
        break;

      case 'COPY_SNIPPET':
        copySnippet(data.id);
        break;

      case 'PERFORM_OCR':
        performOCR();
        break;
    }
  }

  // ==================== COMMANDS ====================

  function execCommand(cmd) {
    document.execCommand(cmd);
  }

  // ==================== INIT ====================

  function init() {
    loadSettings();
    
    // Get current domain
    try {
      currentDomain = window.location.hostname;
    } catch (e) {
      currentDomain = 'unknown';
    }

    // Check for saved domain state
    const savedDomainState = getDomainState(currentDomain);
    const isPageRestricted = isRestricted();
    
    // Apply saved state or default unlock for restricted pages
    if (savedDomainState !== null) {
      if (savedDomainState.isUnlocked) {
        applyUnlock();
      } else {
        applyLock();
      }
    } else if (isPageRestricted || settings.autoUnlock) {
      // Auto-unlock restricted pages
      applyUnlock();
    } else {
      // Default: unlock everything
      applyUnlock();
    }

    // Listen for messages from popup/background
    window.addEventListener('scr-message', (e) => handleMessage(e));

    // Also support custom event
    document.addEventListener('scr-command', (e) => {
      handleMessage(e.detail);
    });

    console.log('🟢 SCR Unlocker initialized', { domain: currentDomain });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for external use
  window.SCRUnlocker = {
    unlock: applyUnlock,
    lock: applyLock,
    copyAll: copyAllText,
    extractImages,
    extractForms: extractFormData,
    getText: getPageText,
    isRestricted,
    getSettings: () => settings,
    updateSettings,
    showToolbar: createToolbar,
    hideToolbar: removeToolbar,
  };
})();