(function () {
  'use strict';

  const STORAGE_KEY = 'scr_items';
  const MAX_DISPLAY = 5;

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

  function toggleFavorite(id) {
    const items = getItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index].isFavorite = !items[index].isFavorite;
      saveItems(items);
      renderItems();
    }
  }

  function copyItem(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast();
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  function showToast() {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #18181b;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 1000;
    `;
    toast.textContent = 'Copied to clipboard!';
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 1500);
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  function renderItems() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const items = getItems()
      .filter(item => !item.isDeleted)
      .filter(item =>
        item.text.toLowerCase().includes(searchTerm) ||
        item.sourceName.toLowerCase().includes(searchTerm)
      )
      .slice(0, MAX_DISPLAY);

    const container = document.getElementById('itemsList');

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="8" y="2" width="8" height="4" rx="1"/>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            </svg>
          </div>
          <p class="empty-title">No items found</p>
          <p class="empty-text">Copy something to see it here</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="item" data-id="${item.id}" data-text="${encodeURIComponent(item.text)}">
        <div class="item-header">
          <span class="item-type ${item.type}">${item.type}</span>
          <span class="item-source">${item.sourceName} • ${formatTime(item._creationTime)}</span>
        </div>
        <p class="item-text">${escapeHtml(item.text)}</p>
      </div>
    `).join('');

    container.querySelectorAll('.item').forEach(el => {
      el.addEventListener('click', () => {
        const text = decodeURIComponent(el.dataset.text);
        copyItem(text);
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFavorite(el.dataset.id);
        renderItems();
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function init() {
    getDeviceId();

    document.getElementById('searchInput').addEventListener('input', renderItems);

    document.getElementById('openDashboard').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'index.html' });
    });

    renderItems();
  }

  document.addEventListener('DOMContentLoaded', init);
})();