import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PRESET_EMOJIS = [
  '😀','😂','🥰','😎','🤩','😋','🤔','😭','😤','🥺',
  '👍','👎','👏','🙌','💪','🤝','❤️','💔','🔥','⭐',
  '🎉','🎂','🎵','🎶','🌈','☀️','🌙','⚡','💧','🌊',
  '🐱','🐶','🐼','🦊','🐰','🌸','🌻','🍀','✨','💫',
  '🍕','🍔','☕','🍺','🎸','📚','💻','🎮','🚀','💡',
]

export default function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [customEmojis, setCustomEmojis] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_emojis') || '[]') } catch { return [] }
  })

  const addCustom = () => {
    const url = customUrl.trim()
    if (!url) return
    const updated = [...customEmojis, url]
    setCustomEmojis(updated)
    localStorage.setItem('custom_emojis', JSON.stringify(updated))
    setCustomUrl('')
  }

  const removeCustom = (url) => {
    const updated = customEmojis.filter(u => u !== url)
    setCustomEmojis(updated)
    localStorage.setItem('custom_emojis', JSON.stringify(updated))
  }

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)}
        className="text-lg hover:scale-125 transition-transform">
        😀
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 z-50 bg-white/95 dark:bg-stone-800/95 backdrop-blur-xl border border-amber-200/50 dark:border-stone-600/50 rounded-2xl shadow-xl p-3 w-72"
          >
            {/* Preset grid */}
            <div className="grid grid-cols-10 gap-1 mb-3">
              {PRESET_EMOJIS.map((e, i) => (
                <button key={i} type="button" onClick={() => { onPick(e); setOpen(false) }}
                  className="w-6 h-6 flex items-center justify-center text-sm hover:bg-amber-100 dark:hover:bg-stone-700 rounded transition-colors">
                  {e}
                </button>
              ))}
            </div>

            {/* Custom emojis */}
            {customEmojis.length > 0 && (
              <div className="border-t border-amber-200/30 dark:border-stone-600/30 pt-2 mb-2">
                <p className="text-[10px] text-stone-400 mb-1">自定义表情</p>
                <div className="flex flex-wrap gap-1">
                  {customEmojis.map((url, i) => (
                    <div key={i} className="relative group">
                      <button type="button" onClick={() => { onPick(`![emoji](${url})`); setOpen(false) }}
                        className="w-7 h-7 p-0.5 rounded hover:bg-amber-100 dark:hover:bg-stone-700 transition-colors">
                        <img src={url} alt="" className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
                      </button>
                      <button onClick={() => removeCustom(url)}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-400 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add custom */}
            <div className="flex gap-1 border-t border-amber-200/30 dark:border-stone-600/30 pt-2">
              <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                placeholder="表情图片 URL..."
                className="flex-1 text-xs bg-amber-50 dark:bg-stone-700 rounded-lg px-2 py-1.5 outline-none border border-amber-200/30 dark:border-stone-600/30 text-stone-700 dark:text-stone-200" />
              <button type="button" onClick={addCustom}
                className="text-xs px-2 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shrink-0">
                添加
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
