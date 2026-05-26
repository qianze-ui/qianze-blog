import { create } from 'zustand'
import { getMediaUrl } from '../utils/mediaUrl'

const LS = {
  get(k, fallback) { try { const v = localStorage.getItem('player_' + k); return v ? JSON.parse(v) : fallback } catch { return fallback } },
  set(k, v) { try { localStorage.setItem('player_' + k, JSON.stringify(v)) } catch {} },
}

export const usePlayerStore = create((set, get) => ({
  // === Author playlist (from server) ===
  authorSongs: [],
  setAuthorSongs: (songs) => set({ authorSongs: songs }),

  // === Guest playlist (localStorage, temporary) ===
  guestSongs: LS.get('guestSongs', []),
  setGuestSongs: (songs) => { LS.set('guestSongs', songs); set({ guestSongs: songs }) },

  // === Merged playlist for playback ===
  mergedSongs: () => {
    const { authorSongs, guestSongs } = get()
    return [...authorSongs, ...guestSongs]
  },

  // === Current playback ===
  currentIdx: LS.get('currentIdx', 0),
  currentSource: LS.get('currentSource', 'author'), // 'author' | 'guest'

  setCurrent: (idx, source) => {
    LS.set('currentIdx', idx); LS.set('currentSource', source)
    set({ currentIdx: idx, currentSource: source, progress: 0, playing: true, error: '' })
  },

  // === Audio state ===
  playing: false,
  progress: 0,
  duration: 0,
  volume: LS.get('volume', 0.7),
  muted: false,
  error: '',

  setPlaying: (v) => set({ playing: v }),
  setProgress: (v) => set({ progress: v }),
  setDuration: (v) => set({ duration: v }),
  setVolume: (v) => { LS.set('volume', v); set({ volume: v, muted: false }) },
  setMuted: (v) => set({ muted: v }),
  setError: (v) => set({ error: v }),

  // === Play mode ===
  mode: LS.get('mode', 'list'), // 'list' | 'shuffle' | 'single'
  setMode: (mode) => { LS.set('mode', mode); set({ mode }) },

  // === History ===
  history: LS.get('history', []),
  addHistory: (song) => {
    const { history } = get()
    const filtered = history.filter(h => h.url !== song.url)
    const updated = [song, ...filtered].slice(0, 50)
    LS.set('history', updated)
    set({ history: updated })
  },

  // === Favorites (localStorage) ===
  favorites: LS.get('favorites', []),
  toggleFavorite: (song) => {
    const { favorites } = get()
    const exists = favorites.find(f => f.url === song.url)
    const updated = exists ? favorites.filter(f => f.url !== song.url) : [song, ...favorites]
    LS.set('favorites', updated)
    set({ favorites: updated })
  },
  isFavorite: (url) => get().favorites.some(f => f.url === url),

  // === UI State ===
  open: false,
  setOpen: (v) => set({ open: v }),

  // === Search ===
  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),

  // === Actions ===
  playSong: (song, source) => {
    const merged = get().mergedSongs()
    const idx = merged.findIndex(s => s.url === song.url)
    if (idx >= 0) {
      get().setCurrent(idx, source)
    } else {
      // Add to guest playlist then play
      const { guestSongs } = get()
      const newGuest = [...guestSongs, { ...song, _guest: true }]
      get().setGuestSongs(newGuest)
      get().setCurrent(get().mergedSongs().length - 1, 'guest')
    }
    get().addHistory(song)
  },

  next: () => {
    const merged = get().mergedSongs()
    if (!merged.length) return
    const { currentIdx, mode } = get()
    if (mode === 'single') { set({ progress: 0, playing: true }); return }
    if (mode === 'shuffle') {
      const next = Math.floor(Math.random() * merged.length)
      get().setCurrent(next, 'guest')
      return
    }
    get().setCurrent((currentIdx + 1) % merged.length, 'guest')
  },

  prev: () => {
    const merged = get().mergedSongs()
    if (!merged.length) return
    const { currentIdx, mode } = get()
    if (get().progress > 3) { set({ progress: 0 }); return }
    if (mode === 'shuffle') {
      const next = Math.floor(Math.random() * merged.length)
      get().setCurrent(next, 'guest')
      return
    }
    get().setCurrent((currentIdx - 1 + merged.length) % merged.length, 'guest')
  },

  removeGuestSong: (url) => {
    const { guestSongs, currentIdx, currentSource } = get()
    const updated = guestSongs.filter(s => s.url !== url)
    get().setGuestSongs(updated)
    if (currentSource === 'guest' && get().mergedSongs()[currentIdx]?.url === url) {
      get().next()
    }
  },

  clearGuestSongs: () => get().setGuestSongs([]),
}))
