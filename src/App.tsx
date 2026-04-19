import { useState, useEffect, useRef } from 'react'

type Snippet = {
  id: string
  name: string
  content: string
  created: number
}

type Item = {
  id: string
  _creationTime: number
  text: string
  sourceUrl?: string
  sourceName: string
  type: 'text' | 'link' | 'code'
  deviceId?: string
  isFavorite: boolean
  isDeleted: boolean
  isPinned: boolean
}

type DomainSettings = {
  domain: string
  enableRightClick: boolean
  enableSelection: boolean
  enableCopy: boolean
  enableKeyboard: boolean
  showToolbar: boolean
}

type Settings = {
  enableRightClick: boolean
  enableSelection: boolean
  enableCopy: boolean
  enableContextMenu: boolean
  enableKeyboard: boolean
  enableDrag: boolean
  enableTouch: boolean
  autoUnlock: boolean
  showToolbar: boolean
  domainSettings: Record<string, DomainSettings>
  activeProfile: string | null
}

const STORAGE_KEY = 'scr_settings'
const ITEMS_KEY = 'scr_items'
const SNIPPETS_KEY = 'scr_snippets'
const STATS_KEY = 'scr_stats'

const DEFAULT_SETTINGS: Settings = {
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
}

const PROFILES = {
  news: { name: 'News Sites', icon: '📰', domains: ['nytimes.com', 'wsj.com', 'theguardian.com', 'medium.com'] },
  realestate: { name: 'Real Estate', icon: '🏠', domains: ['zillow.com', 'realtor.com', 'redfin.com'] },
  government: { name: 'Government', icon: '🏛️', domains: ['.gov', 'gov.uk'] },
  academic: { name: 'Academic', icon: '📚', domains: ['jstor.org', 'sciencedirect.com'] },
}

const SHORTCUTS = [
  { keys: '⌘⇧U', action: 'Toggle page unlock', category: 'Global' },
  { keys: '⌘⇧C', action: 'Copy all text from page', category: 'Global' },
  { keys: '⌘K', action: 'Focus search bar', category: 'Dashboard' },
  { keys: '⌘⇧V', action: 'Copy last clipboard item', category: 'Global' },
  { keys: '⌘Enter', action: 'Copy first item in list', category: 'Dashboard' },
  { keys: 'Right Click', action: 'Open custom context menu', category: 'Page' },
  { keys: 'Double Click', action: 'Select word/phrase quickly', category: 'Page' },
  { keys: 'Ctrl/Cmd+C', action: 'Copy selected text', category: 'Page' },
  { keys: 'Ctrl/Cmd+A', action: 'Select all text', category: 'Page' },
]

const INITIAL_ITEMS: Item[] = [
  { id: '1', _creationTime: Date.now() - 120000, text: 'https://github.com/tanstack/router', sourceName: 'github.com', type: 'link', isFavorite: false, isDeleted: false, isPinned: false },
  { id: '2', _creationTime: Date.now() - 900000, text: 'The quick brown fox jumps over the lazy dog', sourceName: 'Medium', type: 'text', isFavorite: true, isDeleted: false, isPinned: false },
  { id: '3', _creationTime: Date.now() - 3600000, text: 'npm install @tanstack/react-query', sourceName: 'Terminal', type: 'code', isFavorite: false, isDeleted: false, isPinned: false },
]

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

function getDeviceId() {
  let deviceId = localStorage.getItem('scr_device_id')
  if (!deviceId) {
    deviceId = generateId()
    localStorage.setItem('scr_device_id', deviceId)
  }
  return deviceId
}

function getSettings(): Settings {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {}
}

function getItems(): Item[] {
  try {
    const data = localStorage.getItem(ITEMS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveItems(items: Item[]) {
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items))
  } catch (e) {}
}

// Snippets
function getSnippets(): Snippet[] {
  try {
    const data = localStorage.getItem(SNIPPETS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveSnippets(snippets: Snippet[]) {
  try {
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets))
  } catch (e) {}
}

function addSnippet(name: string, content: string) {
  const snippets = getSnippets()
  snippets.push({ id: Date.now().toString(36), name, content, created: Date.now() })
  saveSnippets(snippets)
  return snippets
}

function deleteSnippet(id: string) {
  const snippets = getSnippets().filter(s => s.id !== id)
  saveSnippets(snippets)
  return snippets
}

// Text cleaner
function cleanText(text: string): string {
  let cleaned = text.replace(/\s+/g, ' ').trim()
  const adPatterns = [/Advertisement/gi, /Advertisemen/gi, /Continue reading/gi, /Subscribe to read/gi]
  adPatterns.forEach(pattern => { cleaned = cleaned.replace(pattern, '') })
  cleaned = cleaned.replace(/\u2018|\u2019/g, "'").replace(/\u201c|\u201d/g, '"')
  cleaned = cleaned.replace(/\u2013/g, '-').replace(/\u2014/g, '--').replace(/\u2026/g, '...')
  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}

// URL cleaner
function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const params = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'mc_cid', 'mc_eid', 'fbclid', 'gclid', '_ga', '_gl', 'ref', 'share']
    params.forEach(p => urlObj.searchParams.delete(p))
    return urlObj.toString()
  } catch {
    return url
  }
}

// Stats
function getStats() {
  try {
    const data = localStorage.getItem(STATS_KEY)
    return data ? JSON.parse(data) : { totalUnlocks: 0, pagesUnlocked: [], lastUnlock: null }
  } catch {
    return { totalUnlocks: 0, pagesUnlocked: [], lastUnlock: null }
  }
}

function saveStats(stats: any) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch (e) {}
}

function incrementStats(domain: string) {
  const stats = getStats()
  stats.totalUnlocks = (stats.totalUnlocks || 0) + 1
  stats.lastUnlock = Date.now()
  if (!stats.pagesUnlocked.includes(domain)) {
    stats.pagesUnlocked.push(domain)
  }
  saveStats(stats)
}

export default function App() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'dashboard' | 'settings' | 'domains' | 'history' | 'shortcuts' | 'snippets'>('dashboard')
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [items, setItems] = useState<Item[]>([])
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [activeTab, setActiveTab] = useState<number | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showToast, setShowToast] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(ITEMS_KEY)
    if (saved) {
      setItems(JSON.parse(saved))
    } else {
      setItems(INITIAL_ITEMS)
      localStorage.setItem(ITEMS_KEY, JSON.stringify(INITIAL_ITEMS))
    }
    setSnippets(getSnippets())
    setSettings(getSettings())
    getDeviceId()
  }, [])

  useEffect(() => {
    if (items.length > 0 || localStorage.getItem(ITEMS_KEY)) {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(items))
    }
  }, [items])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleSetting = (key: keyof Settings) => {
    const newSettings = { ...settings, [key]: !settings[key] }
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  const applyProfile = (profile: string) => {
    const profileSettings = {
      enableRightClick: true,
      enableSelection: true,
      enableCopy: true,
      enableKeyboard: true,
      showToolbar: true,
    }
    const newSettings = { ...settings, ...profileSettings, activeProfile: profile }
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  const toggleFavorite = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
  }

  const togglePinned = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, isPinned: !item.isPinned } : item))
  }

  const handleToolAction = async (action: string) => {
    switch (action) {
      case 'copyAll':
        const text = document.body.innerText
        await navigator.clipboard.writeText(text)
        setShowToast('All text copied!')
        break
      case 'cleanText':
        const selection = window.getSelection()
        const selectedText = selection?.toString() || document.body.innerText
        await navigator.clipboard.writeText(cleanText(selectedText))
        setShowToast('Text cleaned!')
        break
      case 'cleanUrl':
        await navigator.clipboard.writeText(cleanUrl(window.location.href))
        setShowToast('URL cleaned!')
        break
      case 'unlock':
        incrementStats(window.location.hostname)
        setShowToast('Page unlocked!')
        break
      case 'lock':
        setShowToast('Page locked')
        break
    }
    setTimeout(() => setShowToast(''), 2500)
  }

  const softDelete = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, isDeleted: true } : item))
  }

  const restore = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, isDeleted: false } : item))
  }

  const permanentDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const clearAll = () => {
    if (view === 'history') {
      setItems(items.filter(item => item.isFavorite || item.isPinned))
    } else {
      setItems(items.map(item => (!item.isFavorite && !item.isPinned ? { ...item, isDeleted: true } : item)))
    }
    setShowClearConfirm(false)
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.text.toLowerCase().includes(search.toLowerCase()) ||
                         item.sourceName.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    return true
  }).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return b._creationTime - a._creationTime
  })

  const trashCount = items.filter(item => item.isDeleted).length

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
        <div className="flex items-center gap-2 px-2 mb-4 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">SCR</div>
          <h1 className="font-bold text-lg tracking-tight">Universal Copy</h1>
        </div>
        
        <nav className="flex flex-col gap-1 shrink-0">
          <button onClick={() => setView('dashboard')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${view === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'}`}>
            <UnlockIcon size={18} />
            <span>Unlock</span>
          </button>
          <button onClick={() => setView('settings')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${view === 'settings' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'}`}>
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>
          <button onClick={() => setView('domains')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${view === 'domains' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'}`}>
            <GlobeIcon size={18} />
            <span>Domains</span>
          </button>
          <button onClick={() => setView('history')} className={`flex items-center justify-between px-3 py-2 rounded-md font-medium text-left transition-colors ${view === 'history' ? 'bg-zinc-200 dark:bg-zinc-800' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'}`}>
            <div className="flex items-center gap-3">
              <HistoryIcon size={18} />
              <span>History</span>
            </div>
            {items.length > 0 && <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">{items.length}</span>}
          </button>
          <button onClick={() => setView('shortcuts')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${view === 'shortcuts' ? 'bg-zinc-200 dark:bg-zinc-800' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'}`}>
            <KeyboardIcon size={18} />
            <span>Shortcuts</span>
          </button>
          <button onClick={() => setView('snippets')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${view === 'snippets' ? 'bg-zinc-200 dark:bg-zinc-800' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'}`}>
            <DocumentIcon size={18} />
            <span>Snippets</span>
          </button>
        </nav>

        <div className="mt-4 shrink-0">
          <p className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Quick Profiles</p>
          <div className="flex flex-col gap-1">
            {Object.entries(PROFILES).map(([key, profile]) => (
              <button key={key} onClick={() => applyProfile(key)} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${settings.activeProfile === key ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'}`}>
                <span>{profile.icon}</span>
                <span>{profile.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-4 bg-green-50 dark:bg-green-900/20 rounded-xl shrink-0 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Protection Active</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-8 bg-white dark:bg-zinc-950 shrink-0">
          <div className="relative w-96">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input ref={searchInputRef} type="text" placeholder="Search (⌘K)..." className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2">
              <UnlockIcon size={16} />
              <span>Unlock Page</span>
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-8">
          {view === 'dashboard' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Bypass Controls</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { key: 'enableRightClick', label: 'Right Click', desc: 'Enable right-click context menu' },
                  { key: 'enableSelection', label: 'Text Selection', desc: 'Allow text highlighting' },
                  { key: 'enableCopy', label: 'Copy (Ctrl+C)', desc: 'Enable keyboard copy' },
                  { key: 'enableKeyboard', label: 'Keyboard Shortcuts', desc: 'All keyboard shortcuts' },
                  { key: 'enableDrag', label: 'Drag & Drop', desc: 'Enable text dragging' },
                  { key: 'showToolbar', label: 'Floating Toolbar', desc: 'Show quick actions bar' },
                ].map(toggle => (
                  <div key={toggle.key} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <div>
                      <p className="font-medium text-sm">{toggle.label}</p>
                      <p className="text-xs text-zinc-500">{toggle.desc}</p>
                    </div>
                    <button onClick={() => toggleSetting(toggle.key as keyof Settings)} className={`w-12 h-6 rounded-full transition-colors ${settings[toggle.key as keyof Settings] ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${settings[toggle.key as keyof Settings] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>

              <h2 className="text-2xl font-bold mb-6">Tools</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: '📋', label: 'Copy All Text', action: 'copyAll' },
                  { icon: '✨', label: 'Clean Text', action: 'cleanText' },
                  { icon: '🔗', label: 'Clean URL', action: 'cleanUrl' },
                  { icon: '🖼️', label: 'List Images', action: 'images' },
                  { icon: '📝', label: 'Snippets', action: 'snippets' },
                  { icon: '🔓', label: 'Unlock Page', action: 'unlock' },
                  { icon: '🔒', label: 'Lock Page', action: 'lock' },
                ].map(tool => (
                  <button key={tool.action} onClick={() => handleToolAction(tool.action)} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition-colors flex flex-col items-center gap-2">
                    <span className="text-2xl">{tool.icon}</span>
                    <span className="text-sm font-medium">{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Settings</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <div>
                    <p className="font-medium">Auto Unlock</p>
                    <p className="text-sm text-zinc-500">Automatically unlock restricted sites</p>
                  </div>
                  <button onClick={() => toggleSetting('autoUnlock')} className={`w-12 h-6 rounded-full transition-colors ${settings.autoUnlock ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${settings.autoUnlock ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <div>
                    <p className="font-medium">Global Hotkey</p>
                    <p className="text-sm text-zinc-500">Keyboard shortcut to toggle unlock</p>
                  </div>
                  <code className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm">⌘⇧U</code>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <div>
                    <p className="font-medium">Show Toolbar</p>
                    <p className="text-sm text-zinc-500">Display floating toolbar on pages</p>
                  </div>
                  <button onClick={() => toggleSetting('showToolbar')} className={`w-12 h-6 rounded-full transition-colors ${settings.showToolbar ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${settings.showToolbar ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Reset All Settings</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">This will reset all bypass settings to defaults.</p>
                <button onClick={() => setSettings(DEFAULT_SETTINGS)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700">Reset to Defaults</button>
              </div>
            </div>
          )}

          {view === 'domains' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Domain Settings</h2>
              <p className="text-zinc-500 mb-6">Configure custom bypass settings for specific domains.</p>
              
              <div className="space-y-3">
                <div className="flex gap-3 mb-4">
                  <input type="text" placeholder="Enter domain (e.g., nytimes.com)" className="flex-1 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg" />
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Domain</button>
                </div>

                <div className="p-8 text-center text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <GlobeIcon size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No custom domain settings yet</p>
                  <p className="text-sm">Add a domain to configure custom bypass rules</p>
                </div>
              </div>
            </div>
          )}

          {view === 'shortcuts' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Keyboard Shortcuts</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Global Shortcuts</h3>
                  <div className="space-y-2">
                    {SHORTCUTS.filter(s => s.category === 'Global').map((shortcut, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        <span className="text-sm">{shortcut.action}</span>
                        <code className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">{shortcut.keys}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Dashboard Shortcuts</h3>
                  <div className="space-y-2">
                    {SHORTCUTS.filter(s => s.category === 'Dashboard').map((shortcut, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        <span className="text-sm">{shortcut.action}</span>
                        <code className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">{shortcut.keys}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Page Interactions</h3>
                  <div className="space-y-2">
                    {SHORTCUTS.filter(s => s.category === 'Page').map((shortcut, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        <span className="text-sm">{shortcut.action}</span>
                        <code className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">{shortcut.keys}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-2xl font-bold">Clipboard History</h2>
                <div className="flex items-center gap-2">
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-1 rounded-lg">
                      <span className="text-xs px-2 text-red-600">Clear all?</span>
                      <button onClick={clearAll} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-bold">Yes</button>
                      <button onClick={() => setShowClearConfirm(false)} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowClearConfirm(true)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-sm hover:bg-zinc-200">Clear All</button>
                  )}
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 mb-4">
                    <ClipboardIcon size={32} />
                  </div>
                  <h3 className="text-lg font-medium">No items found</h3>
                  <p className="text-zinc-500">Copy something to see it here</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredItems.map(item => (
                    <div key={item.id} className="group p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition-all cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${item.type === 'link' ? 'bg-blue-50 text-blue-600' : item.type === 'code' ? 'bg-purple-50 text-purple-600' : 'bg-zinc-100'}`}>
                              {item.type}
                            </span>
                            {item.isPinned && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">📌 Pinned</span>}
                            <span className="text-[11px] text-zinc-400">{new Date(item._creationTime).toLocaleTimeString()} • {item.sourceName}</span>
                          </div>
                          <p className="text-sm font-mono break-all line-clamp-2">{item.text}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => navigator.clipboard.writeText(item.text)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Copy">
                            <CopyIcon size={16} />
                          </button>
                          <button onClick={() => togglePinned(item.id)} className={`p-2 rounded-lg ${item.isPinned ? 'text-amber-500 bg-amber-50' : 'text-zinc-400 hover:bg-zinc-100'}`} title="Pin">
                            <PinIcon size={16} fill={item.isPinned ? "currentColor" : "none"} />
                          </button>
                          <button onClick={() => toggleFavorite(item.id)} className={`p-2 rounded-lg ${item.isFavorite ? 'text-amber-500' : 'text-zinc-400 hover:bg-zinc-100'}`} title="Favorite">
                            <StarIcon size={16} fill={item.isFavorite ? "currentColor" : "none"} />
                          </button>
                          <button onClick={() => softDelete(item.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg" title="Delete">
                            <TrashIcon size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function UnlockIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}

function SettingsIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}

function GlobeIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}

function HistoryIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}

function KeyboardIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="8" y1="12" x2="8" y2="12"/><line x1="12" y1="12" x2="12" y2="12"/><line x1="16" y1="12" x2="16" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
}

function SearchIcon({ className = "", size = 24 }: { className?: string, size?: number }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
}

function DocumentIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}

function ClipboardIcon({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
}

function CopyIcon({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
}

function StarIcon({ size = 24, fill = "none" }: { size?: number, fill?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}

function PinIcon({ size = 24, fill = "none" }: { size?: number, fill?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>
}

function TrashIcon({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
}