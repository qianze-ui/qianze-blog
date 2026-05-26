import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'
import { usePlayerStore } from '../stores/playerStore'
import { getMediaUrl } from '../utils/mediaUrl'

const MODES = ['list', 'shuffle', 'single']

// ── LRC lyric parser ──
function parseLyrics(text) {
  const lines = text.split('\n')
  const result = []
  const re = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/
  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    const min = parseInt(m[1]); const sec = parseInt(m[2])
    const ms = m[3].length === 2 ? parseInt(m[3]) * 10 : parseInt(m[3])
    const time = min * 60 + sec + ms / 1000
    const txt = line.replace(re, '').trim()
    if (txt) result.push({ time, text: txt })
  }
  return result.sort((a, b) => a.time - b.time)
}

// ── Decorative spectrum ──
function Spectrum({ playing }) {
  const ref = useRef(null); const frameRef = useRef(null)
  useEffect(() => {
    if (!playing) return
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); const W = c.width; const H = c.height
    const bars = 48; const bw = (W / bars) * 0.6; const gap = (W / bars) * 0.4
    const hs = new Array(bars).fill(2)
    const isDark = document.documentElement.classList.contains('dark')
    const draw = () => {
      frameRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < bars; i++) {
        hs[i] = Math.max(1, Math.min(H * 0.85, hs[i] + (Math.random() - 0.5) * 15))
        const x = i * (bw + gap)
        ctx.fillStyle = isDark ? `rgba(251,191,36,${0.25 + hs[i] / H * 0.4})` : `rgba(217,119,59,${0.25 + hs[i] / H * 0.4})`
        ctx.beginPath(); ctx.roundRect(x, H - hs[i], bw, hs[i], [1.5, 1.5, 0, 0]); ctx.fill()
      }
    }
    draw()
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [playing])
  return <canvas ref={ref} width={280} height={36} className="w-full h-9 opacity-60" />
}

// ── Main ──
export default function MusicPlayer() {
  const store = usePlayerStore()
  const {
    authorSongs, setAuthorSongs, guestSongs, setGuestSongs,
    currentIdx, playing, setPlaying,
    progress, setProgress, duration, setDuration,
    volume, setVolume, muted, setMuted,
    mode, setMode, error, setError,
    open, setOpen,
    next, prev, removeGuestSong, clearGuestSongs,
  } = store

  const audioRef = useRef(null)
  const [rightTab, setRightTab] = useState('playlist')
  const [lyrics, setLyrics] = useState([])
  const [currentLyric, setCurrentLyric] = useState(-1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('search_history') || '[]') } catch { return [] }
  })
  const [customUrl, setCustomUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const lyricsRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { api.getSongs().then(setAuthorSongs).catch(() => {}) }, [])

  const merged = [...authorSongs, ...guestSongs]
  const song = merged[currentIdx] || null

  // ── Audio source ──
  useEffect(() => {
    if (!song) return
    const a = audioRef.current; if (!a) return
    setError(''); a.src = getMediaUrl(song.url)
    a.volume = muted ? 0 : volume; a.load()
    if (playing) a.play().catch(() => { setPlaying(false); setError('播放失败') })
    if (song.id) api.recordPlay(song.id)
    // Load lyrics — support both URL and raw LRC text
    if (song.lyricUrl) {
      const lrc = song.lyricUrl.trim()
      if (lrc.startsWith('http') || lrc.startsWith('/')) {
        fetch(getMediaUrl(lrc)).then(r => r.text()).then(t => setLyrics(parseLyrics(t))).catch(() => setLyrics([]))
      } else if (lrc.startsWith('[') && /\[\d{2}:\d{2}[.:]\d{2,3}\]/.test(lrc)) {
        setLyrics(parseLyrics(lrc))
      } else {
        setLyrics([])
      }
    } else { setLyrics([]) }
  }, [currentIdx, guestSongs.length, authorSongs.length])

  useEffect(() => {
    const a = audioRef.current; if (!a || !song) return
    a.volume = muted ? 0 : volume
    if (playing) a.play().catch(() => { setPlaying(false); setError('播放失败') })
    else a.pause()
  }, [playing, volume, muted])

  // ── Keyboard ──
  useEffect(() => {
    const k = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing) }
      if (e.code === 'ArrowRight' && e.ctrlKey) next()
      if (e.code === 'ArrowLeft' && e.ctrlKey) prev()
      if (e.code === 'ArrowUp' && e.ctrlKey) setVolume(Math.min(1, volume + 0.1))
      if (e.code === 'ArrowDown' && e.ctrlKey) setVolume(Math.max(0, volume - 0.1))
      if (e.code === 'KeyM' && e.ctrlKey) { e.preventDefault(); setMuted(!muted) }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [playing, volume, muted])

  // ── Time update + lyric sync ──
  const onTime = () => {
    const a = audioRef.current; if (!a) return
    setProgress(a.currentTime); setDuration(a.duration || 0)
    // Sync lyrics
    if (lyrics.length) {
      const t = a.currentTime; let cur = -1
      for (let i = lyrics.length - 1; i >= 0; i--) { if (t >= lyrics[i].time) { cur = i; break } }
      setCurrentLyric(cur)
    }
  }

  // ── Auto-scroll lyrics ──
  useEffect(() => {
    if (!lyricsRef.current || currentLyric < 0) return
    const el = lyricsRef.current
    const items = el.querySelectorAll('[data-lyric]')
    if (items[currentLyric]) {
      items[currentLyric].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentLyric])

  // ── Search via gequhai ──
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const data = await api.searchMusic(q, '')
      setSearchResults((data || []).map(r => ({
        title: r.title || '未知', artist: r.artist || '未知',
        cover: r.coverUrl || '', url: r.url || r.playUrl || '',
        songId: r.songId, mp3Id: r.mp3Id,
        lyricUrl: r.lyric || '', platform: r.platform || '',
        sourceType: 'external', _search: true,
      })))
    } catch { setSearchResults([]) }
    setSearchLoading(false)
  }, [])

  const onSearchInput = (v) => {
    setSearchQuery(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 400)
  }

  const addSearchHistory = (title, artist) => {
    const h = [{ title, artist }, ...searchHistory.filter(s => s.title !== title)].slice(0, 12)
    setSearchHistory(h); localStorage.setItem('search_history', JSON.stringify(h))
  }

  const playSong = async (s) => {
    let song = { ...s }
    // If song has mp3Id but no real URL, fetch the playable URL first
    if (s.mp3Id && !s.url) {
      try {
        const res = await api.getPlayUrl(s.mp3Id)
        if (res && res.url) {
          song.url = res.url
          song.cover = res.cover || song.cover
          song.lyricUrl = res.lyric || ''
          song._resolved = true
        } else {
          setError('获取播放链接失败')
          return
        }
      } catch {
        setError('获取播放链接失败')
        return
      }
    }
    store.playSong(song, 'guest')
    addSearchHistory(song.title, song.artist)
    api.trackGuestMusic(song).catch(() => {})
  }

  // ── Seek ──
  const seek = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const a = audioRef.current
    if (a && (duration || a.duration)) a.currentTime = pct * (duration || a.duration)
  }

  const fmt = (s) => (!s || isNaN(s)) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  const fmtDur = (s) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : ''

  if (!authorSongs.length && !guestSongs.length) return null

  // ===================== RENDER =====================
  return (
    <>
      <audio ref={audioRef} preload="auto" onTimeUpdate={onTime} onEnded={next}
        onLoadedMetadata={() => { const a = audioRef.current; if (a) setDuration(a.duration) }}
        onError={() => { setPlaying(false); setError('加载失败') }} />

      {/* ===== Expanded Music Hub ===== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[85vh] bg-amber-50/80 dark:bg-stone-900/80 backdrop-blur-3xl border border-amber-200/40 dark:border-stone-700/40 rounded-[2rem] shadow-2xl shadow-amber-900/10 dark:shadow-black/50 overflow-hidden flex flex-col"
            >
              {/* ── Body: Left (cover+lyrics) + Right (tabs) ── */}
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* ===== LEFT: Cover + Info + Lyrics ===== */}
                <div className="flex flex-col items-center md:w-[55%] p-6 pb-2 md:border-r border-amber-200/30 dark:border-stone-700/30 overflow-y-auto">
                  {/* Cover */}
                  <div className="relative shrink-0 mb-4">
                    {playing && (
                      <motion.div className="absolute -inset-4 rounded-full bg-amber-400/10 dark:bg-amber-500/8"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                    )}
                    <motion.div
                      animate={playing ? { rotate: 360 } : { rotate: 0 }}
                      transition={playing ? { duration: 20, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
                      className="w-28 h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/30 dark:ring-stone-600/30"
                    >
                      {song?.cover ? (
                        <img src={getMediaUrl(song.cover)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* Spectrum */}
                  <div className="w-full mb-3"><Spectrum playing={playing} /></div>

                  {/* Song info */}
                  <div className="text-center mb-3">
                    <p className="text-base font-bold text-stone-800 dark:text-stone-100 truncate max-w-[240px] mx-auto">{song?.title || '未选择'}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{song?.artist || '--'}{song?.album ? ` · ${song.album}` : ''}</p>
                    {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                  </div>

                  {/* ── Lyrics ── */}
                  <div ref={lyricsRef} className="flex-1 w-full max-h-36 md:max-h-48 overflow-y-auto text-center scrollbar-hide py-2">
                    {lyrics.length > 0 ? (
                      <div className="space-y-1.5">
                        {lyrics.map((l, i) => {
                          const isCurrent = i === currentLyric
                          return (
                            <p key={i} data-lyric=""
                              className={`transition-all duration-500 ease-out ${
                                isCurrent
                                  ? 'text-base font-bold text-amber-600 dark:text-amber-400 drop-shadow-sm'
                                  : 'text-xs text-stone-400 dark:text-stone-500'
                              } ${Math.abs(i - currentLyric) > 4 ? 'opacity-0' : 'opacity-100'}`}
                            >
                              {l.text}
                            </p>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 py-8">{song?.lyricUrl ? '加载歌词中...' : '暂无歌词'}</p>
                    )}
                  </div>
                </div>

                {/* ===== RIGHT: Tabs ===== */}
                <div className="flex flex-col md:w-[45%] border-t md:border-t-0 border-amber-200/30 dark:border-stone-700/30 overflow-hidden">
                  {/* Tab bar */}
                  <div className="flex text-xs border-b border-amber-200/30 dark:border-stone-700/30 shrink-0">
                    {[
                      { key: 'playlist', label: '歌单' },
                      { key: 'search', label: '搜索' },
                      { key: 'guest', label: guestSongs.length ? `临时(${guestSongs.length})` : '临时' },
                    ].map(t => (
                      <button key={t.key} onClick={() => setRightTab(t.key)}
                        className={`flex-1 py-2.5 text-center font-medium transition-colors ${rightTab === t.key ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {/* ── Playlist Tab ── */}
                    {rightTab === 'playlist' && (
                      <div className="space-y-0.5">
                        {authorSongs.map((s, i) => (
                          <button key={s.id || i} onClick={() => store.playSong(s, 'author')}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-colors ${i === currentIdx && merged[currentIdx]?.url === s.url && !merged[currentIdx]?._guest ? 'bg-amber-100/60 dark:bg-stone-800/60' : 'hover:bg-amber-50/30 dark:hover:bg-stone-800/20'}`}>
                            <span className="w-4 text-center shrink-0 text-[10px] font-mono text-stone-400">
                              {i === currentIdx && playing && !merged[currentIdx]?._guest ? <span className="inline-block w-1 h-3 bg-amber-500 rounded-full animate-pulse align-middle" /> : i + 1}
                            </span>
                            <span className="truncate flex-1 text-stone-700 dark:text-stone-200">{s.title}</span>
                            <span className="text-[10px] text-stone-400 truncate max-w-[56px]">{s.artist}</span>
                          </button>
                        ))}
                        {authorSongs.length === 0 && <p className="text-xs text-stone-400 text-center py-8">博客主还没添加歌曲</p>}
                      </div>
                    )}

                    {/* ── Search Tab ── */}
                    {rightTab === 'search' && (
                      <div className="space-y-3">
                        {/* Search input */}
                        <div className="flex items-center gap-2 bg-white/50 dark:bg-stone-800/50 rounded-xl px-3 py-2 border border-amber-200/30 dark:border-stone-700/30">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          <input value={searchQuery} onChange={e => onSearchInput(e.target.value)} placeholder="搜索音乐 (gequhai)..."
                            className="flex-1 bg-transparent text-xs text-stone-700 dark:text-stone-200 placeholder-stone-400 outline-none" />
                        </div>

                        {/* Custom URL */}
                        <div className="flex gap-1.5">
                          <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="歌名" className="w-16 bg-white/50 dark:bg-stone-800/50 rounded-lg px-2 py-1.5 text-[10px] outline-none border border-amber-200/30 dark:border-stone-700/30" />
                          <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="mp3 链接..." className="flex-1 bg-white/50 dark:bg-stone-800/50 rounded-lg px-2 py-1.5 text-[10px] outline-none border border-amber-200/30 dark:border-stone-700/30" />
                          <button onClick={() => {
                            if (!customUrl.trim()) return
                            const s = { title: customTitle.trim() || '自定义', artist: '自定义', url: customUrl.trim(), _guest: true }
                            playSong(s); setCustomUrl(''); setCustomTitle('')
                          }} className="shrink-0 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-medium rounded-lg hover:bg-amber-600">播</button>
                        </div>

                        {/* Results */}
                        {searchLoading && (
                          <div className="flex justify-center py-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-5 h-5 border-2 border-amber-300 border-t-amber-600 rounded-full" />
                          </div>
                        )}

                        {!searchLoading && searchResults.length > 0 && (
                          <div className="space-y-0.5">
                            {searchResults.map((r, i) => (
                              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50/40 dark:hover:bg-stone-800/40 group">
                                <div className="w-8 h-8 rounded-md overflow-hidden bg-amber-100 dark:bg-stone-700 shrink-0">
                                  {r.cover ? <img src={r.cover} alt="" className="w-full h-full object-cover" /> : (
                                    <div className="w-full h-full flex items-center justify-center text-amber-400"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-stone-700 dark:text-stone-200 truncate">{r.title}</p>
                                  <p className="text-[10px] text-stone-400 truncate">
                                    {r.platform && <span className="text-amber-500">{r.platform === 'netease' ? '网易云' : r.platform === 'qq' ? 'QQ' : r.platform === 'kugou' ? '酷狗' : r.platform === 'kuwo' ? '酷我' : r.platform === 'migu' ? '咪咕' : r.platform}</span>}
                                    {' '}{r.artist}
                                  </p>
                                </div>
                                <button onClick={() => playSong(r)}
                                  className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {!searchLoading && searchQuery && searchResults.length === 0 && (
                          <p className="text-xs text-stone-400 text-center py-6">未找到</p>
                        )}

                        {/* History */}
                        {!searchQuery && searchHistory.length > 0 && (
                          <div>
                            <p className="text-[10px] text-stone-400 mb-1.5">最近搜索</p>
                            <div className="flex flex-wrap gap-1">
                              {searchHistory.slice(0, 8).map((h, i) => (
                                <button key={i} onClick={() => { setSearchQuery(h.title); doSearch(h.title) }}
                                  className="text-[10px] px-2 py-1 rounded-full bg-amber-100/40 dark:bg-stone-800/40 text-stone-500 dark:text-stone-400 hover:bg-amber-200/40">
                                  {h.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Guest Tab ── */}
                    {rightTab === 'guest' && (
                      <div className="space-y-0.5">
                        {guestSongs.length > 0 && (
                          <button onClick={clearGuestSongs} className="text-[10px] text-stone-400 hover:text-red-400 mb-2">清空全部</button>
                        )}
                        {guestSongs.map((s, i) => {
                          const gIdx = authorSongs.length + i
                          return (
                            <div key={i} className="group flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-amber-50/30 dark:hover:bg-stone-800/20 transition-colors">
                              <button onClick={() => store.playSong(s, 'guest')} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                <span className="w-4 text-center shrink-0 text-[10px] font-mono text-stone-400">
                                  {gIdx === currentIdx && playing ? <span className="inline-block w-1 h-3 bg-amber-500 rounded-full animate-pulse align-middle" /> : gIdx + 1}
                                </span>
                                <span className="truncate flex-1 text-xs text-stone-700 dark:text-stone-200">{s.title}</span>
                                <span className="text-[10px] text-stone-400 truncate max-w-[48px]">{s.artist}</span>
                              </button>
                              <button onClick={() => removeGuestSong(s.url)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-400 shrink-0">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          )
                        })}
                        {guestSongs.length === 0 && <p className="text-xs text-stone-400 text-center py-8">搜索音乐并添加到临时歌单</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ===== BOTTOM: Controls ===== */}
              <div className="border-t border-amber-200/30 dark:border-stone-700/30 px-6 py-3">
                {/* Progress */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] text-stone-400 font-mono w-8">{fmt(progress)}</span>
                  <div className="flex-1 h-1 bg-amber-200/40 dark:bg-stone-700/40 rounded-full cursor-pointer group relative" onClick={seek}>
                    <motion.div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full relative"
                      style={{ width: `${duration ? (progress / (duration || 1)) * 100 : 0}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-orange-500 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono w-8 text-right">{fmt(duration)}</span>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between">
                  {/* Volume */}
                  <div className="flex items-center gap-1 w-20">
                    <button onClick={() => setMuted(!muted)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        {muted ? <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/> : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>}
                      </svg>
                    </button>
                    <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                      onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (v > 0) setMuted(false) }}
                      className="w-14 h-1 accent-amber-500 cursor-pointer" />
                  </div>

                  {/* Play controls */}
                  <div className="flex items-center gap-5">
                    <button onClick={prev} className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => setPlaying(!playing)}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-400/30 hover:shadow-amber-400/50 transition-shadow">
                      {playing ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </motion.button>
                    <button onClick={next} className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                  </div>

                  {/* Mode + Close */}
                  <div className="flex items-center gap-2 w-20 justify-end">
                    <button onClick={() => setMode(MODES[(MODES.indexOf(mode) + 1) % 3])}
                      className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors text-xs" title={mode}>
                      {mode === 'list' && <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h12v2H4z"/></svg>}
                      {mode === 'shuffle' && <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>}
                      {mode === 'single' && <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm14-3v4l-3-2.5"/></svg>}
                    </button>
                    <button onClick={() => setOpen(false)}
                      className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== FAB ===== */}
      <motion.button onClick={() => setOpen(!open)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-4 sm:right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full shadow-xl transition-all duration-500 ${
          open ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-800 rotate-45'
            : 'bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-amber-200/40 dark:border-stone-600/40 text-amber-500'}`}>
        {playing && !open ? (
          <div className="flex items-end gap-0.5 h-4">
            <span className="w-1 bg-amber-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" style={{ height: '60%' }} />
            <span className="w-1 bg-amber-500 rounded-full animate-[bounce_0.9s_ease-in-out_infinite_0.1s]" style={{ height: '100%' }} />
            <span className="w-1 bg-amber-500 rounded-full animate-[bounce_0.7s_ease-in-out_infinite_0.2s]" style={{ height: '40%' }} />
          </div>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        )}
      </motion.button>
    </>
  )
}
