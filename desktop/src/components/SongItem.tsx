import { useState } from 'react'
import { Play, Pause, Download, Heart, MoreHorizontal, Disc3 } from 'lucide-react'
import { usePlayerStore } from '../stores/playerStore'
import { formatDuration } from '@common/utils/format'
import { cn } from '../utils/cn'
import type { Song } from '@common/types'

interface SongItemProps {
  song: Song
  index?: number
  list?: Song[]
  showIndex?: boolean
  onDownload?: (song: Song) => void
  onFavorite?: (song: Song) => void
  onAddToPlaylist?: (song: Song) => void
}

export default function SongItem({ song, index, list, showIndex, onDownload, onFavorite, onAddToPlaylist }: SongItemProps) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore()
  const [showMenu, setShowMenu] = useState(false)

  const isActive = currentSong?.source === song.source && currentSong?.song_identifier === song.song_identifier

  async function handlePlay() {
    if (isActive) {
      togglePlay()
    } else {
      playSong(song, list)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg group hover:bg-border-light transition-colors',
        isActive && 'bg-primary-light/50'
      )}
    >
      {/* Index or play button */}
      {showIndex && (
        <div className="w-8 text-center text-sm text-text-tertiary flex-shrink-0">
          {isActive && isPlaying ? (
            <div className="flex justify-center gap-[2px] items-end h-4">
              <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms' }} />
              <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
              <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms' }} />
            </div>
          ) : (
            <span className={cn(isActive && 'text-primary font-medium')}>{(index ?? 0) + 1}</span>
          )}
        </div>
      )}

      {/* Cover */}
      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-border">
        {song.cover_url ? (
          <img src={song.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Disc3 size={16} className="text-text-tertiary" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', isActive ? 'text-primary font-medium' : 'text-text')}>
          {song.song_name}
        </p>
        <p className="text-xs truncate text-text-tertiary">
          {song.singers}{song.album ? ` · ${song.album}` : ''}
        </p>
      </div>

      {/* Duration */}
      {song.duration_s > 0 && (
        <span className="text-xs text-text-tertiary tabular-nums flex-shrink-0">
          {formatDuration(song.duration_s)}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={handlePlay}
          className="p-1.5 rounded-full hover:bg-border text-text-secondary hover:text-text transition-colors"
        >
          {isActive && isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        {onDownload && (
          <button
            onClick={() => onDownload(song)}
            className="p-1.5 rounded-full hover:bg-border text-text-secondary hover:text-text transition-colors"
          >
            <Download size={16} />
          </button>
        )}
        {onFavorite && (
          <button
            onClick={() => onFavorite(song)}
            className="p-1.5 rounded-full hover:bg-border text-text-secondary hover:text-danger transition-colors"
          >
            <Heart size={16} />
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-full hover:bg-border text-text-secondary hover:text-text transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                <button
                  onClick={() => { usePlayerStore.getState().addToNext(song); setShowMenu(false) }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-border-light transition-colors"
                >
                  下一首播放
                </button>
                {onAddToPlaylist && (
                  <button
                    onClick={() => { onAddToPlaylist(song); setShowMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-border-light transition-colors"
                  >
                    添加到歌单
                  </button>
                )}
                {onFavorite && (
                  <button
                    onClick={() => { onFavorite(song); setShowMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-border-light transition-colors"
                  >
                    收藏
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
