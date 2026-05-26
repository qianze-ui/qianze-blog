import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '../stores/playerStore'
import { getMediaUrl } from '../utils/mediaUrl'
import { api } from '../api'

const HISTORY_KEY = 'search_history'
const getHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] } }
const setHistory = (v) => { localStorage.setItem(HISTORY_KEY, JSON.stringify(v)) }

export default function SearchModal() {
  const { searchOpen, setSearchOpen, playSong, mergedSongs, guestSongs, setGuestSongs, authorSongs } = usePlayerStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [history, setHistoryState] = useState(getHistory)
  const [customUrl, setCustomUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100)
    }
  }, [searchOpen])

  // Debounced search via gequhai
  const doSearch = useCallback(async (term) => {
    if (!term.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const data = await api.searchMusic(term, '')
      setResults((data || []).map(r => ({
        title: r.title || '未知',
        artist: r.artist || '未知',
        album: r.album || '',
        cover: r.coverUrl || '',
        url: r.url || r.playUrl || '',
        mp3Id: r.mp3Id || '',
        songId: r.songId,
        sourceType: 'external',
        _search: true,
      })))
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [])

  const onInput = (e) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 400)
  }

  const onPlay = async (song) => {
    let s = { ...song }
    // Resolve mp3Id to real URL, cover, and lyrics before playing
    if (s.mp3Id && !s.url) {
      try {
        const res = await api.getPlayUrl(s.mp3Id)
        if (res && res.url) {
          s.url = res.url
          s.cover = res.cover || s.cover
          s.lyricUrl = res.lyric || ''
        }
      } catch { /* will try direct URL */ }
    }
    const h = getHistory().filter(h => h.title !== s.title).slice(0, 19)
    setHistory([{ title: s.title, artist: s.artist }, ...h])
    setHistoryState([{ title: s.title, artist: s.artist }, ...h])
    playSong(s, 'guest')
    api.trackGuestMusic({ ...s }).catch(() => {})
  }

  const onAddToList = (song) => {
    setGuestSongs([...guestSongs, { ...song, _guest: true }])
  }

  const allSongs = mergedSongs()
  const isInList = (url) => allSongs.some(s => s.url === url)

  if (!searchOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4"
        onClick={() => setSearchOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-amber-50/75 dark:bg-stone-900/75 backdrop-blur-2xl border border-amber-200/50 dark:border-stone-700/50 rounded-3xl shadow-2xl shadow-amber-900/10 dark:shadow-black/40 overflow-hidden"
        >
          {/* Search input */}
          <div className="p-4 pb-0">
            <div className="flex items-center gap-3 bg-white/60 dark:bg-stone-800/60 rounded-2xl px-4 py-3 border border-amber-200/30 dark:border-stone-700/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input ref={inputRef} value={query} onChange={onInput}
                placeholder="搜索音乐 (gequhai 曲库)..."
                className="flex-1 bg-transparent text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 outline-none"
              />
              <button onClick={() => setSearchOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full" />
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="space-y-1">
                {results.map((r, i) => (
                  <motion.div key={r.url + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-amber-100/40 dark:hover:bg-stone-800/40 transition-colors group">
                    {/* Cover */}
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-amber-100 dark:bg-stone-700 shrink-0">
                      {r.cover ? (
                        <img src={r.cover} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-amber-400">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{r.title}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{r.artist}{r.album ? ` · ${r.album}` : ''}</p>
                      <p className="text-[10px] text-stone-400">{r.artist}{r.url ? ' · 可播放' : ' · 点击获取链接'}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {r.url && (
                        <button onClick={() => onPlay(r)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-600 text-white transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                      )}
                      <button onClick={() => onAddToList(r)}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isInList(r.url) ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-amber-500'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <p className="text-center text-sm text-stone-400 py-10">未找到相关歌曲</p>
            )}

            {/* Search history */}
            {!query && history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-stone-400">搜索历史</span>
                  <button onClick={() => { setHistory([]); setHistoryState([]) }}
                    className="text-[10px] text-stone-400 hover:text-red-400">清除</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {history.slice(0, 10).map((h, i) => (
                    <button key={i} onClick={() => { setQuery(h.title); doSearch(h.title) }}
                      className="text-xs px-2.5 py-1 rounded-full bg-amber-100/50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-300 hover:bg-amber-200/50 dark:hover:bg-stone-700/50 transition-colors">
                      {h.title} · {h.artist}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom URL */}
            <div className="border-t border-amber-200/30 dark:border-stone-700/30 pt-3 mt-2">
              <p className="text-[10px] text-stone-400 mb-2 px-1">或者粘贴完整音频链接（支持外链 mp3，不限时长）</p>
              <div className="flex gap-2">
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                  placeholder="歌曲名(可选)" className="w-24 bg-white/60 dark:bg-stone-800/60 rounded-xl px-3 py-2 text-xs outline-none border border-amber-200/30 dark:border-stone-700/30 text-stone-700 dark:text-stone-200" />
                <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                  placeholder="https://...mp3" className="flex-1 bg-white/60 dark:bg-stone-800/60 rounded-xl px-3 py-2 text-xs outline-none border border-amber-200/30 dark:border-stone-700/30 text-stone-700 dark:text-stone-200" />
                <button onClick={() => {
                  if (!customUrl.trim()) return
                  const title = customTitle.trim() || '自定义歌曲'
                  const song = { title, artist: '自定义', url: customUrl.trim(), cover: '', sourceType: 'external', _guest: true }
                  playSong(song, 'guest')
                  setCustomUrl(''); setCustomTitle('')
                  api.trackGuestMusic(song).catch(() => {})
                }}
                  className="shrink-0 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-xl transition-colors">
                  播放
                </button>
              </div>
            </div>

            {!query && history.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-stone-400">输入关键词搜索音乐</p>
                <p className="text-[10px] text-stone-400/60 mt-1">通过 gequhai 搜索，动态获取播放链接</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
