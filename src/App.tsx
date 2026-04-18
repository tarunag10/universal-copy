import { useState, useEffect, useRef } from 'react'

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
}

const STORAGE_KEY = 'scr_items'
const MAX_ITEMS = 500

const INITIAL_ITEMS: Item[] = [
  { id: '1', _creationTime: Date.now() - 120000, text: 'https://github.com/tanstack/router', sourceName: 'github.com', type: 'link', isFavorite: false, isDeleted: false },
  { id: '2', _creationTime: Date.now() - 900000, text: 'The quick brown fox jumps over the lazy dog', sourceName: 'Medium', type: 'text', isFavorite: true, isDeleted: false },
  { id: '3', _creationTime: Date.now() - 3600000, text: 'npm install @tanstack/react-query', sourceName: 'Terminal', type: 'code', isFavorite: false, isDeleted: false },
  { id: '4', _creationTime: Date.now() - 7200000, text: 'React context is a way to pass data through the component tree...', sourceName: 'StackOverflow', type: 'text', isFavorite: false, isDeleted: false },
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

function getItems(): Item[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveItems(items: Item[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (e) {
    console.error('Failed to save items:', e)
  }
}

export default function App() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'history' | 'favorites' | 'extension' | 'trash'>('history')
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'link' | 'code'>('all')
  const [items, setItems] = useState<Item[]>([])
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setItems(JSON.parse(saved))
    } else {
      setItems(INITIAL_ITEMS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ITEMS))
    }
    getDeviceId()
  }, [])

  useEffect(() => {
    if (items.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  }, [items])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && filteredItems.length > 0) {
        e.preventDefault()
        navigator.clipboard.writeText(filteredItems[0].text)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, filter, typeFilter])

  const toggleFavorite = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
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
    if (filter === 'trash') {
      setItems(items.filter(item => !item.isDeleted && !item.isFavorite))
    } else {
      setItems(items.map(item => (!item.isFavorite ? { ...item, isDeleted: true } : item)))
    }
    setShowClearConfirm(false)
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.text.toLowerCase().includes(search.toLowerCase()) ||
                         item.sourceName.toLowerCase().includes(search.toLowerCase())
    
    if (filter === 'trash') return matchesSearch && item.isDeleted
    if (item.isDeleted) return false
    
    const matchesFilter = filter === 'history' || (filter === 'favorites' && item.isFavorite)
    const matchesType = typeFilter === 'all' || item.type === typeFilter
    
    return matchesSearch && matchesFilter && matchesType
  }).sort((a, b) => b._creationTime - a._creationTime)

  const trashCount = items.filter(item => item.isDeleted).length

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
        <div className="flex items-center gap-2 px-2 mb-4 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">SCR</div>
          <h1 className="font-bold text-lg tracking-tight">Safari Restore</h1>
        </div>
        
        <nav className="flex flex-col gap-1 shrink-0">
          <button 
            onClick={() => setFilter('history')}
            className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${filter === 'history' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
          >
            <ClipboardIcon size={18} />
            <span>History</span>
          </button>
          <button 
            onClick={() => setFilter('favorites')}
            className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${filter === 'favorites' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
          >
            <StarIcon size={18} />
            <span>Favorites</span>
          </button>
          <button 
            onClick={() => setFilter('extension')}
            className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-left transition-colors ${filter === 'extension' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
          >
            <BoxIcon size={18} />
            <span>Extensions</span>
          </button>
          <button 
            onClick={() => setFilter('trash')}
            className={`flex items-center justify-between px-3 py-2 rounded-md font-medium text-left transition-colors ${filter === 'trash' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
          >
            <div className="flex items-center gap-3">
              <TrashIcon size={18} />
              <span>Trash</span>
            </div>
            {trashCount > 0 && (
              <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full text-zinc-500">{trashCount}</span>
            )}
          </button>
        </nav>

        <div className="mt-4 shrink-0">
          <p className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">My Devices</p>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-3 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
              <LaptopIcon size={16} />
              <span>MacBook Pro</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
              <SmartphoneIcon size={16} />
              <span>iPhone 15 Pro</span>
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl shrink-0">
          <p className="text-xs font-semibold text-zinc-500 uppercase mb-2 text-[10px]">Sync Status</p>
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Active</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-8 bg-white dark:bg-zinc-950 shrink-0">
          <div className="relative w-96">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search (⌘K)..." 
              className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              <SettingsIcon size={20} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 border-2 border-white dark:border-zinc-800 shadow-sm" />
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">
                  {filter === 'history' ? 'Clipboard History' : 
                   filter === 'favorites' ? 'Favorite Clips' : 
                   filter === 'trash' ? 'Trash' :
                   'Extension Setup'}
                </h2>
                <p className="text-zinc-500 text-sm mb-4">
                  {filter === 'history' ? "Restore anything you've copied across your devices." :
                   filter === 'favorites' ? "Quick access to your most important snippets." :
                   filter === 'trash' ? "Items in trash are deleted permanently after 30 days." :
                   "Set up SCR in your browser to sync clipboard automatically."}
                </p>
                
                {filter !== 'extension' && filter !== 'trash' && (
                  <div className="flex gap-2">
                    {(['all', 'text', 'link', 'code'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                          typeFilter === type 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {filter !== 'extension' && items.length > 0 && (
                  <div className="relative">
                    {showClearConfirm ? (
                      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 p-1 rounded-lg shadow-xl animate-in fade-in zoom-in duration-200">
                        <span className="text-xs px-2 text-red-600 font-medium">Are you sure?</span>
                        <button 
                          onClick={clearAll}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-bold hover:bg-red-700 transition-colors"
                        >
                          Yes, Clear
                        </button>
                        <button 
                          onClick={() => setShowClearConfirm(false)}
                          className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-xs font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowClearConfirm(true)}
                        className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors border border-zinc-200 dark:border-zinc-800"
                      >
                        {filter === 'trash' ? 'Empty Trash' : 'Clear All'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {filter === 'extension' ? (
              <div className="space-y-8">
                <div className="flex gap-4 p-1 bg-zinc-100 dark:bg-zinc-900 w-fit rounded-xl mb-4">
                  <button className="px-4 py-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm text-sm font-bold">Chrome</button>
                  <button className="px-4 py-2 text-zinc-500 text-sm font-medium">Safari</button>
                  <button className="px-4 py-2 text-zinc-500 text-sm font-medium">Firefox</button>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-6 rounded-2xl">
                      <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">1. Download Extension Files</h3>
                      <p className="text-sm text-blue-800 dark:text-blue-300 mb-4 opacity-80">Download the ZIP containing the manifest and background scripts.</p>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm">Download .zip</button>
                    </div>

                    <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                      <h3 className="font-bold mb-2">2. Enable Developer Mode</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">Go to <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">chrome://extensions</code> and toggle "Developer mode".</p>
                    </div>
                    
                    <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                      <h3 className="font-bold mb-2">3. Load Unpacked</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">Click "Load unpacked" and select the folder containing manifest.json.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="p-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl w-full flex flex-col items-center">
                       <h3 className="font-bold text-sm mb-4 uppercase tracking-widest text-zinc-400">Live Popup Preview</h3>
                       <div className="border-8 border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl scale-90 origin-top">
                          <iframe src="popup.html" className="w-[350px] h-[500px] pointer-events-none" />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    </div>
                    <h3 className="text-xl font-bold">Safari Installation</h3>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                      <span className="block w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-3">1</span>
                      <p className="font-bold mb-1">Develop Menu</p>
                      <p className="text-zinc-500">Enable "Show Develop menu in menu bar" in Safari Settings &gt; Advanced.</p>
                    </div>
                    <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                      <span className="block w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-3">2</span>
                      <p className="font-bold mb-1">Allow Extensions</p>
                      <p className="text-zinc-500">Go to Develop menu and check "Allow Unsigned Extensions".</p>
                    </div>
                    <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                      <span className="block w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-3">3</span>
                      <p className="font-bold mb-1">XCode Converter</p>
                      <p className="text-zinc-500">Run <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-[10px]">xcrun safari-web-extension-converter path/to/extension</code></p>
                    </div>
                  </div>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 mb-4">
                  {filter === 'trash' ? <TrashIcon size={32} /> : <ClipboardIcon size={32} />}
                </div>
                <h3 className="text-lg font-medium">No items found</h3>
                <p className="text-zinc-500 max-w-xs">
                  {filter === 'trash' ? "Your trash is empty." : "Copy something to see it appear here instantly."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {filteredItems.map((item) => (
                  <div key={item.id} className="group p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            item.type === 'link' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                            item.type === 'code' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' :
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {item.type}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {new Date(item._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.sourceName}
                          </span>
                        </div>
                        <p className="text-zinc-800 dark:text-zinc-200 line-clamp-3 font-mono text-xs leading-relaxed break-all">
                          {item.text}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 translate-x-2 group-hover:translate-x-0">
                        {filter === 'trash' ? (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                restore(item.id)
                              }}
                              className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded-lg transition-colors" 
                              title="Restore"
                            >
                              <RotateIcon size={16} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                permanentDelete(item.id)
                              }}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors" 
                              title="Delete Permanently"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(item.text)
                              }}
                              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-lg transition-colors" 
                              title="Copy again (⌘Enter)"
                            >
                              <CopyIcon size={16} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(item.id)
                              }}
                              className={`p-2 rounded-lg transition-colors ${item.isFavorite ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} 
                              title="Favorite"
                            >
                              <StarIcon size={16} fill={item.isFavorite ? "currentColor" : "none"} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                softDelete(item.id)
                              }}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors" 
                              title="Move to Trash"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function BoxIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
}

function ClipboardIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
}

function StarIcon({ size, fill = "none" }: { size: number, fill?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}

function TrashIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
}

function SearchIcon({ className, size }: { className?: string, size: number }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
}

function SettingsIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
}

function CopyIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
}

function LaptopIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="12" x="3" y="4" rx="2" ry="2"/><line x1="2" x2="22" y1="20" y2="20"/></svg>
}

function SmartphoneIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="10" height="18" x="7" y="3" rx="2" ry="2"/><line x1="11" x2="13" y1="18" y2="18"/></svg>
}

function RotateIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
}