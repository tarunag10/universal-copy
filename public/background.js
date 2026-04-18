const STORAGE_KEY = 'scr_items';
const MAX_ITEMS = 500;

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

function getSourceName(tab) {
  try {
    const url = new URL(tab.url);
    if (url.hostname.includes('github')) return 'GitHub';
    if (url.hostname.includes('stackoverflow')) return 'StackOverflow';
    if (url.hostname.includes('medium')) return 'Medium';
    if (url.hostname.includes('twitter') || url.hostname.includes('x.com')) return 'Twitter';
    if (url.hostname.includes('slack')) return 'Slack';
    if (url.hostname.includes('notion')) return 'Notion';
    return url.hostname.replace('www.', '');
  } catch {
    return 'Unknown';
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
    sourceUrl: sourceUrl || null,
    sourceName: sourceName,
    type: type,
    deviceId: getDeviceId(),
    isFavorite: false,
    isDeleted: false,
  };

  items.unshift(newItem);

  while (items.length > MAX_ITEMS) {
    const lastNonFavorite = items.findLastIndex(item => !item.isFavorite && item.isDeleted);
    if (lastNonFavorite !== -1) {
      items.splice(lastNonFavorite, 1);
    } else {
      items.pop();
    }
  }

  saveItems(items);

  chrome.runtime.sendMessage({ type: 'ITEM_ADDED', item: newItem }).catch(() => {});

  return newItem;
}

function removeItem(id) {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index].isDeleted = true;
    saveItems(items);
  }
}

function restoreItem(id) {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index].isDeleted = false;
    saveItems(items);
  }
}

function permanentDeleteItem(id) {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items.splice(index, 1);
    saveItems(items);
  }
}

function toggleFavorite(id) {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index].isFavorite = !items[index].isFavorite;
    saveItems(items);
    return items[index].isFavorite;
  }
  return false;
}

function clearAll(toTrash) {
  const items = getItems();
  if (toTrash) {
    items.forEach(item => {
      if (!item.isFavorite) {
        item.isDeleted = true;
      }
    });
  } else {
    items.forEach(item => {
      item.isDeleted = true;
    });
  }
  saveItems(items);
}

function emptyTrash() {
  const items = getItems().filter(item => !item.isDeleted);
  saveItems(items);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  getDeviceId();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_ITEMS':
      sendResponse({ items: getItems() });
      break;

    case 'ADD_ITEM': {
      const { text, sourceUrl, sourceName } = message;
      const type = detectType(text);
      const item = addItem(text, sourceUrl, sourceName || 'Browser', type);
      sendResponse({ item });
      break;
    }

    case 'REMOVE_ITEM':
      removeItem(message.id);
      sendResponse({ success: true });
      break;

    case 'RESTORE_ITEM':
      restoreItem(message.id);
      sendResponse({ success: true });
      break;

    case 'PERMANENT_DELETE_ITEM':
      permanentDeleteItem(message.id);
      sendResponse({ success: true });
      break;

    case 'TOGGLE_FAVORITE': {
      const isFavorite = toggleFavorite(message.id);
      sendResponse({ isFavorite });
      break;
    }

    case 'CLEAR_ALL':
      clearAll(message.toTrash);
      sendResponse({ success: true });
      break;

    case 'EMPTY_TRASH':
      emptyTrash();
      sendResponse({ success: true });
      break;

    case 'GET_DEVICE_ID':
      sendResponse({ deviceId: getDeviceId() });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

chrome.commands?.onCommand.addListener((command) => {
  if (command === 'copy-last-item') {
    const items = getItems().filter(item => !item.isDeleted);
    if (items.length > 0) {
      chrome.runtime.sendMessage({
        type: 'COPY_TO_CLIPBOARD',
        text: items[0].text,
      }).catch(() => {});
    }
  }
});