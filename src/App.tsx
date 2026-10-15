import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Album, AudioLines, Check, ChevronDown, CircleHelp, Disc3, Download, Heart, Home, Library,
  ListMusic, ListPlus, Music2, Pause, Play, Plus, Radio, Repeat, Search, Settings, Shuffle,
  SkipBack, SkipForward, SlidersHorizontal, Trash2, Upload, Volume2, X, Youtube, MoreHorizontal
} from 'lucide-react'
import { parseBlob } from 'music-metadata-browser'
import { deleteTrack, getPlaylists, getSetting, getTracks, putPlaylist, putSetting, putTrack, type Playlist, type Track } from './db'

type View = 'Home' | 'Library' | 'Playlists' | 'Favorites' | 'YouTube'
const id = () => crypto.randomUUID()
const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
function youtubeId(input: string): string | null {
  try {
    const u = new URL(input.trim())
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const parts = u.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || null
    }
  } catch { /* invalid URL */ }
  return null
}
const gradientArt = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/500/500`

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [view, setView] = useState<View>('Home')
  const [search, setSearch] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [queue, setQueue] = useState<string[]>([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [notice, setNotice] = useState('')
  const [ytInput, setYtInput] = useState('')
  const [ytPlayingId, setYtPlayingId] = useState<string | null>(null)
  const [showAddPlaylist, setShowAddPlaylist] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const current = tracks.find(t => t.id === currentId) || null
  const currentIsLocal = current?.kind === 'local'
  const localTracks = tracks.filter(t => t.kind === 'local')

  const refresh = useCallback(async () => {
    try {
      const [all, lists, fav, last] = await Promise.all([getTracks(), getPlaylists(), getSetting('favorites'), getSetting('currentId')])
      setTracks(all.sort((a,b) => b.addedAt - a.addedAt))
      setPlaylists(lists)
      setFavorites(Array.isArray(fav?.value) ? fav!.value as string[] : [])
      if (typeof last?.value === 'string') setCurrentId(last.value)
    } catch (e) { console.error(e); setNotice('Could not open the local music database. Try refreshing the app.') }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { void putSetting('favorites', favorites).catch(console.error) }, [favorites])
  useEffect(() => { if (currentId) void putSetting('currentId', currentId).catch(console.error) }, [currentId])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current || current.kind !== 'local') return
    const blob = current.blob
    if (!blob) { setNotice(`The audio data for “${current.title}” is missing. Re-import the file.`); setPlaying(false); return }
    const src = URL.createObjectURL(blob)
    audio.src = src
    audio.volume = volume
    if (playing) void audio.play().catch(() => { setPlaying(false); setNotice('Playback was blocked. Press Play to start the track.') })
    return () => { audio.pause(); URL.revokeObjectURL(src) }
  }, [currentId, current?.blob])
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])
  useEffect(() => { if (current?.kind === 'youtube' && current.url) { setYtPlayingId(youtubeId(current.url)); setPlaying(false) } else setYtPlayingId(null) }, [currentId])
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 4200) }

  const importFiles = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|opus|aiff|wma)$/i.test(f.name))
    if (!accepted.length) { notify('No supported audio files selected.'); return }
    let imported = 0
    for (const file of accepted) {
      try {
        let title = file.name.replace(/\.[^.]+$/, ''), artist = 'Unknown artist', album = 'Unknown album', duration = 0, artwork: string | undefined
        try {
          const metadata = await parseBlob(file)
          title = metadata.common.title || title
          artist = metadata.common.artist || metadata.common.albumartist || artist
          album = metadata.common.album || album
          duration = metadata.format.duration || 0
          const pic = metadata.common.picture?.[0]
          if (pic) artwork = URL.createObjectURL(new Blob([new Uint8Array(pic.data)], { type: pic.format }))
        } catch { /* Metadata is optional; browser audio can still play the file. */ }
        const track: Track = { id: id(), title, artist, album, duration, kind: 'local', blob: file, mime: file.type, artwork, addedAt: Date.now() + imported }
        await putTrack(track); imported++
      } catch (e) {
        console.error(e)
        notify(`Could not save ${file.name}. Browser storage may be full; try fewer or smaller files.`)
      }
    }
    await refresh()
    if (imported) notify(`Imported ${imported} ${imported === 1 ? 'track' : 'tracks'} into your library.`)
  }
  const playTrack = (track: Track, list?: Track[]) => {
    const ids = (list || visibleTracks).map(t => t.id)
    setQueue(ids.includes(track.id) ? ids : [track.id, ...ids])
    setCurrentId(track.id)
    setProgress(0)
    setPlaying(track.kind === 'local')
    if (track.kind === 'youtube') {
      setYtPlayingId(youtubeId(track.url || ''))
      notify('YouTube playback opens in the embedded player. Use its Play control to start playback.')
    }
  }
  const next = () => {
    const active = queue.length ? queue : localTracks.map(t => t.id)
    if (!active.length) return
    if (shuffle) {
      const candidates = active.filter(x => x !== currentId)
      const chosen = candidates[Math.floor(Math.random() * candidates.length)] || currentId
      if (chosen) { setCurrentId(chosen); setProgress(0); setPlaying(true) }
      return
    }
    const index = active.indexOf(currentId || '')
    if (index >= 0 && index < active.length - 1) { setCurrentId(active[index + 1]); setProgress(0); setPlaying(true) }
    else if (repeat && active.length) { setCurrentId(active[0]); setProgress(0); setPlaying(true) }
    else setPlaying(false)
  }
  const previous = () => {
    if (progress > 3 && audioRef.current) { audioRef.current.currentTime = 0; setProgress(0); return }
    const active = queue.length ? queue : localTracks.map(t => t.id)
    const index = active.indexOf(currentId || '')
    if (index > 0) { setCurrentId(active[index - 1]); setProgress(0); setPlaying(true) }
    else if (active.length && repeat) { setCurrentId(active[active.length - 1]); setProgress(0); setPlaying(true) }
  }
  const togglePlay = () => {
    if (!current) { if (visibleTracks[0]) playTrack(visibleTracks[0]); else notify('Import music to start listening.'); return }
    if (current.kind === 'youtube') { notify('Use the embedded YouTube player controls for YouTube playback.'); return }
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().then(() => setPlaying(true)).catch(() => notify('Unable to play this file. Try re-importing it.'))
    else { audio.pause(); setPlaying(false) }
  }
  const removeTrack = async (track: Track) => {
    if (!confirm(`Remove “${track.title}” from your library?`)) return
    await deleteTrack(track.id)
    setFavorites(old => old.filter(x => x !== track.id))
    setPlaylists(old => old.map(p => ({ ...p, trackIds: p.trackIds.filter(x => x !== track.id) })))
    if (currentId === track.id) { setCurrentId(null); setPlaying(false) }
    await refresh()
    notify('Track removed from library.')
  }
  const addYoutube = async () => {
    const yt = youtubeId(ytInput)
    if (!yt) { notify('Paste a valid YouTube video URL.'); return }
    const track: Track = { id: id(), title: `YouTube video · ${yt}`, artist: 'YouTube', album: 'Saved links', duration: 0, kind: 'youtube', url: `https://www.youtube.com/watch?v=${yt}`, addedAt: Date.now() }
    await putTrack(track); await refresh(); setYtInput(''); setView('YouTube'); playTrack(track, [track])
  }
  const createPlaylist = async () => {
    const name = playlistName.trim()
    if (!name) return
    const playlist: Playlist = { id: id(), name, trackIds: [] }
    await putPlaylist(playlist); setPlaylists(old => [...old, playlist]); setPlaylistName(''); setShowAddPlaylist(false); notify('Playlist created.')
  }
  const addToPlaylist = async (playlist: Playlist, track: Track) => {
    const updated = { ...playlist, trackIds: playlist.trackIds.includes(track.id) ? playlist.trackIds : [...playlist.trackIds, track.id] }
    await putPlaylist(updated); setPlaylists(old => old.map(p => p.id === updated.id ? updated : p)); notify(`Added to ${playlist.name}.`)
  }
  const visibleTracks = useMemo(() => {
    let list = tracks
    if (view === 'Favorites') list = tracks.filter(t => favorites.includes(t.id))
    else if (view === 'YouTube') list = tracks.filter(t => t.kind === 'youtube')
    else if (view === 'Library') list = tracks
    else if (view === 'Home') list = tracks
    else if (view === 'Playlists') list = tracks
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(t => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q))
    return list
  }, [tracks, view, favorites, search])
  const activePlaylist = view.startsWith('Playlist:') ? playlists.find(p => `Playlist:${p.id}` === view) : undefined
  const displayedTracks = activePlaylist ? tracks.filter(t => activePlaylist.trackIds.includes(t.id)).filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(search.toLowerCase())) : visibleTracks
  const pageTitle = activePlaylist?.name || view
  const navItems: {label: View; icon: typeof Home}[] = [
    { label: 'Home', icon: Home }, { label: 'Library', icon: Library }, { label: 'Playlists', icon: ListMusic },
    { label: 'Favorites', icon: Heart }, { label: 'YouTube', icon: Youtube }
  ]
  const cover = (track: Track, large = false) => track.artwork
    ? <img className={`cover ${large ? 'cover-large' : ''}`} src={track.artwork} alt="" />
    : <div className={`cover generated-cover ${large ? 'cover-large' : ''}`}><Disc3 size={large ? 52 : 26}/></div>

  return <div className="app-shell">
    <audio ref={audioRef} onTimeUpdate={e => setProgress(e.currentTarget.currentTime)} onLoadedMetadata={e => { setDuration(e.currentTarget.duration || current?.duration || 0) }} onEnded={() => { if (repeat && audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play() } else next() }} onError={() => { if (currentIsLocal && current?.blob) { setPlaying(false); notify('This audio format may not be supported by your browser.') } }} />
    <aside className="sidebar glass">
      <div className="brand"><div className="brand-mark"><AudioLines size={23}/></div><div><strong>A-SRITI</strong><span>YOUR MUSIC SPACE</span></div></div>
      <div className="nav-label">MENU</div>
      <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${view === item.label ? 'active' : ''}`} onClick={() => setView(item.label)}><Icon size={18}/><span>{item.label}</span>{item.label === 'Library' && <small>{tracks.length}</small>}</button> })}</nav>
      <div className="sidebar-divider"/>
      <div className="nav-label row-between"><span>YOUR PLAYLISTS</span><button className="icon-button small" aria-label="Create playlist" onClick={() => setShowAddPlaylist(true)}><Plus size={16}/></button></div>
      <nav>{playlists.map(p => <button key={p.id} className={`nav-item ${activePlaylist?.id === p.id ? 'active' : ''}`} onClick={() => setView(`Playlist:${p.id}` as View)}><ListMusic size={17}/><span className="truncate">{p.name}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="storage-icon"><Disc3 size={18}/></div><div><strong>Your collection</strong><span>{tracks.length} saved tracks</span></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs">Your space <span>/</span> <strong>{pageTitle}</strong></div><div className="top-actions"><label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your music..." aria-label="Search music"/><kbd>⌘ K</kbd></label><button className="avatar" title="A-SRITI">A</button></div></header>

      {view === 'Home' ? <section className="page-content">
        <div className="welcome-line"><div><div className="eyebrow"><span className="live-dot"/> YOUR PERSONAL MUSIC LIBRARY</div><h1>Music, <span>collected.</span></h1><p>Your favorites, your discoveries, all in one place.</p></div><button className="primary-button" onClick={() => fileInputRef.current?.click()}><Upload size={17}/> Import music</button></div>
        <div className="hero-card"><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="hero-copy"><span className="pill"><AudioLines size={13}/> YOUR SOUND. YOUR SPACE.</span><h2>A soundtrack<br/>that feels like <em>you.</em></h2><p>Bring your music together and press play.</p><button className="light-button" onClick={() => localTracks.length ? playTrack(localTracks[0], localTracks) : fileInputRef.current?.click()}><Play size={16} fill="currentColor"/> {localTracks.length ? 'Play your library' : 'Add your first songs'}</button></div><div className="hero-art visualizer-art"><div className="visualizer-caption"><span className="visualizer-live-dot"/>{playing && currentIsLocal ? 'LIVE AUDIO VISUALIZER' : 'AUDIO VISUALIZER'}</div><AudioVisualizer audioRef={audioRef} playing={playing && currentIsLocal}/><div className="visualizer-footnote">{current ? current.title : 'PLAY SOMETHING TO BEGIN'}</div></div></div>
        <div className="stats-grid"><div className="stat-card glass"><span>IN YOUR LIBRARY</span><strong>{localTracks.length}</strong><small><Music2 size={14}/> local tracks</small></div><div className="stat-card glass"><span>PLAYLISTS</span><strong>{playlists.length}</strong><small><ListMusic size={14}/> your collections</small></div><div className="stat-card glass"><span>FAVORITES</span><strong>{favorites.length}</strong><small><Heart size={14}/> loved tracks</small></div></div>
        <div className="section-heading"><div><h2>Recently added</h2><p>Fresh additions to your collection</p></div><button className="text-button" onClick={() => setView('Library')}>View library <SkipForward size={14}/></button></div>
        <TrackTable tracks={tracks.slice(0,5)} currentId={currentId} playing={playing} favorites={favorites} onPlay={playTrack} onFavorite={t => setFavorites(old => old.includes(t.id) ? old.filter(x=>x!==t.id) : [...old,t.id])} onRemove={removeTrack} onAddToPlaylist={addToPlaylist} playlists={playlists} cover={cover}/>
        {!tracks.length && <EmptyState onImport={() => fileInputRef.current?.click()}/>}
      </section> : <section className="page-content">
        <div className="page-heading"><div className="page-icon">{view === 'YouTube' ? <Youtube/> : view === 'Favorites' ? <Heart/> : view === 'Playlists' ? <ListMusic/> : <Library/>}</div><div><div className="eyebrow">YOUR COLLECTION</div><h1>{pageTitle}</h1><p>{view === 'YouTube' ? 'Saved links played through the official YouTube player.' : view === 'Favorites' ? 'The tracks you love, together.' : view === 'Playlists' ? 'Make a collection for every mood.' : 'Every track you have imported, in one place.'}</p></div><div className="heading-actions">{view === 'YouTube' && <button className="secondary-button" onClick={() => document.getElementById('youtube-add')?.scrollIntoView({behavior:'smooth'})}><Plus size={16}/> Add link</button>}{view === 'Playlists' && <button className="primary-button" onClick={() => setShowAddPlaylist(true)}><Plus size={16}/> New playlist</button>}{view === 'Library' && <button className="primary-button" onClick={() => fileInputRef.current?.click()}><Upload size={16}/> Import</button>}</div></div>
        {view === 'YouTube' && <div className="youtube-add glass" id="youtube-add"><div className="youtube-logo"><Youtube size={22}/></div><div className="youtube-form"><strong>Add a YouTube link</strong><span>Videos play through YouTube's official embedded player.</span><div className="input-action"><input value={ytInput} onChange={e=>setYtInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void addYoutube()} placeholder="Paste a YouTube video URL..." aria-label="YouTube URL"/><button className="primary-button" onClick={()=>void addYoutube()}><Plus size={16}/> Save link</button></div></div></div>}
        {view === 'YouTube' && current?.kind === 'youtube' && youtubeId(current.url || '') && <div className="youtube-player-card glass"><div className="youtube-player-heading"><div><strong>Now playing on YouTube</strong><span>Playback is controlled by the official YouTube player.</span></div><span className="youtube-badge"><Youtube size={14}/> YouTube</span></div><div className="youtube-frame-wrap"><iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId(current.url || '')}?enablejsapi=1`} title={current.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></div>}
        {view === 'Playlists' && !activePlaylist && <div className="playlist-grid">{playlists.map(p=><button className="playlist-card glass" key={p.id} onClick={()=>setView(`Playlist:${p.id}` as View)}><div className="playlist-art"><ListMusic size={30}/><span>♫</span></div><strong>{p.name}</strong><span>{p.trackIds.length} tracks</span></button>)}<button className="playlist-card add-playlist glass" onClick={()=>setShowAddPlaylist(true)}><Plus size={26}/><strong>Create playlist</strong><span>Curate your next mood</span></button></div>}
        {!(view === 'Playlists' && !activePlaylist) && <TrackTable tracks={displayedTracks} currentId={currentId} playing={playing} favorites={favorites} onPlay={playTrack} onFavorite={t => setFavorites(old => old.includes(t.id) ? old.filter(x=>x!==t.id) : [...old,t.id])} onRemove={removeTrack} onAddToPlaylist={addToPlaylist} playlists={playlists} cover={cover}/>}
        {!displayedTracks.length && !(view === 'Playlists' && !activePlaylist) && <EmptyState onImport={() => view === 'YouTube' ? document.getElementById('youtube-add')?.scrollIntoView({behavior:'smooth'}) : fileInputRef.current?.click()} youtube={view === 'YouTube'} favorite={view === 'Favorites'}/>}
      </section>}
    </main>

    <div className="player-bar glass">
      <div className="now-playing">{current ? <>{cover(current)}<div className="now-text"><strong className="truncate">{current.title}</strong><span className="truncate">{current.artist}</span></div><button className={`icon-button favorite-mini ${favorites.includes(current.id)?'favorited':''}`} aria-label="Toggle favorite" onClick={()=>setFavorites(old=>old.includes(current.id)?old.filter(x=>x!==current.id):[...old,current.id])}><Heart size={17} fill={favorites.includes(current.id)?'currentColor':'none'}/></button></> : <><div className="cover generated-cover"><Disc3 size={24}/></div><div className="now-text"><strong>Nothing playing yet</strong><span>Choose a track to begin</span></div></>}</div>
      <div className="player-center"><div className="player-controls"><button className={`icon-button ${shuffle?'control-on':''}`} aria-label="Toggle shuffle" onClick={()=>setShuffle(!shuffle)}><Shuffle size={17}/></button><button className="icon-button" aria-label="Previous track" onClick={previous}><SkipBack size={19} fill="currentColor"/></button><button className="play-button" aria-label={playing?'Pause':'Play'} onClick={togglePlay}>{playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</button><button className="icon-button" aria-label="Next track" onClick={next}><SkipForward size={19} fill="currentColor"/></button><button className={`icon-button ${repeat?'control-on':''}`} aria-label="Toggle repeat" onClick={()=>setRepeat(!repeat)}><Repeat size={17}/></button></div><div className="progress-row"><span>{formatTime(progress)}</span><input aria-label="Playback position" type="range" min="0" max={Math.max(duration,1)} step="0.1" value={Math.min(progress,duration || 0)} onChange={e=>{const n=Number(e.target.value); if(audioRef.current){audioRef.current.currentTime=n;setProgress(n)}}}/><span>{formatTime(duration || current?.duration || 0)}</span></div></div>
      <div className="player-right"><button className={`icon-button ${queueOpen?'control-on':''}`} aria-label="Toggle queue" onClick={()=>setQueueOpen(!queueOpen)}><ListMusic size={19}/></button><Volume2 size={18}/><input className="volume-range" aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div>
    </div>
    {queueOpen && <div className="queue-panel glass"><div className="queue-head"><div><strong>Playback queue</strong><span>{queue.length} tracks</span></div><button className="icon-button" onClick={()=>setQueueOpen(false)} aria-label="Close queue"><X size={18}/></button></div>{queue.length ? queue.map((qid,i)=>{const t=tracks.find(x=>x.id===qid);return t?<button className={`queue-item ${qid===currentId?'queue-active':''}`} key={`${qid}-${i}`} onClick={()=>playTrack(t,queue.map(x=>tracks.find(y=>y.id===x)).filter((x):x is Track=>Boolean(x)))}>{cover(t)}<span className="truncate">{t.title}</span>{qid===currentId&&<AudioLines size={15}/>}</button>:null}) : <p className="muted">Play a track to start your queue.</p>}</div>}
    {showAddPlaylist && <div className="modal-backdrop" onClick={()=>setShowAddPlaylist(false)}><div className="modal glass" onClick={e=>e.stopPropagation()}><button className="icon-button modal-close" aria-label="Close" onClick={()=>setShowAddPlaylist(false)}><X size={18}/></button><div className="modal-icon"><ListPlus size={24}/></div><h2>Create a playlist</h2><p>Give your collection a name. You can add tracks from the library.</p><input autoFocus value={playlistName} onChange={e=>setPlaylistName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void createPlaylist()} placeholder="e.g. Late night listening"/><button className="primary-button full-width" onClick={()=>void createPlaylist()} disabled={!playlistName.trim()}><Plus size={16}/> Create playlist</button></div></div>}
    <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.aiff,.wma" multiple hidden onChange={e=>{if(e.target.files)void importFiles(e.target.files);e.target.value=''}}/>
    {notice && <div className="toast" role="status"><Check size={17}/><span>{notice}</span><button className="icon-button" onClick={()=>setNotice('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </div>
}

const visualizerGraphs = new WeakMap<HTMLAudioElement, { context: AudioContext; analyser: AnalyserNode }>()

function AudioVisualizer({ audioRef, playing }: { audioRef: React.RefObject<HTMLAudioElement>; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const playingRef = useRef(playing)
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => {
    const audio = audioRef.current
    const canvas = canvasRef.current
    if (!audio || !canvas) return
    let frame = 0
    let disposed = false
    let analyser: AnalyserNode | null = null
    try {
      let graph = visualizerGraphs.get(audio)
      if (!graph && window.AudioContext) {
        const context = new window.AudioContext()
        const node = context.createAnalyser()
        node.fftSize = 128
        node.smoothingTimeConstant = 0.82
        const source = context.createMediaElementSource(audio)
        source.connect(node)
        node.connect(context.destination)
        graph = { context, analyser: node }
        visualizerGraphs.set(audio, graph)
      }
      if (graph) {
        contextRef.current = graph.context
        analyserRef.current = graph.analyser
        analyser = graph.analyser
      }
    } catch (error) {
      console.warn('Audio visualizer could not connect to the audio output.', error)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const draw = () => {
      if (disposed) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(rect.width * dpr))
      const height = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      ctx.clearRect(0, 0, width, height)
      const count = 48
      const gap = Math.max(2 * dpr, width / 230)
      const barWidth = (width - gap * (count - 1)) / count
      const values = new Uint8Array(analyser?.frequencyBinCount || count)
      if (analyser) analyser.getByteFrequencyData(values)
      const center = height * 0.51
      for (let i = 0; i < count; i++) {
        const spectrumIndex = Math.min(values.length - 1, Math.floor(i / count * values.length * 0.86))
        const raw = analyser && playingRef.current ? (values[spectrumIndex] || 0) / 255 : 0
        const envelope = Math.pow(Math.sin((i / (count - 1)) * Math.PI), 0.65)
        const idle = 0.045 + Math.abs(Math.sin(i * 0.62)) * 0.025
        const motion = playingRef.current ? (raw * 0.84 + idle) : idle
        const barHeight = Math.max(3 * dpr, motion * envelope * height * 1.75)
        const x = i * (barWidth + gap)
        const y = center - barHeight / 2
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight)
        gradient.addColorStop(0, '#f8f8f8')
        gradient.addColorStop(0.5, '#a5a5a5')
        gradient.addColorStop(1, '#454545')
        ctx.fillStyle = gradient
        const radius = Math.min(barWidth / 2, 3 * dpr)
        ctx.beginPath()
        ctx.roundRect(x, y, Math.max(1, barWidth), barHeight, radius)
        ctx.fill()
        ctx.globalAlpha = 0.12
        ctx.fillRect(x, center + barHeight / 2 + 2 * dpr, Math.max(1, barWidth), Math.max(1, barHeight * 0.22))
        ctx.globalAlpha = 1
      }
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      // Keep the per-audio-element graph alive so React StrictMode can safely remount this canvas.
    }
  }, [audioRef])
  useEffect(() => {
    const context = contextRef.current
    if (!context) return
    if (playing && context.state === 'suspended') void context.resume().catch(() => undefined)
    if (!playing && context.state === 'running') void context.suspend().catch(() => undefined)
  }, [playing])
  return <canvas className="audio-visualizer" ref={canvasRef} role="img" aria-label={playing ? 'Live audio frequency visualizer' : 'Audio visualizer idle'} />
}

function TrackTable({ tracks, currentId, playing, favorites, onPlay, onFavorite, onRemove, onAddToPlaylist, playlists, cover }: {
  tracks: Track[]; currentId: string | null; playing: boolean; favorites: string[];
  onPlay: (track: Track, list?: Track[]) => void; onFavorite: (track: Track) => void;
  onRemove: (track: Track) => void; onAddToPlaylist: (playlist: Playlist, track: Track) => void;
  playlists: Playlist[]; cover: (track: Track, large?: boolean) => React.ReactNode
}) {
  if (!tracks.length) return null
  return <div className="track-table-wrap"><table className="track-table"><thead><tr><th className="number-col">#</th><th>TITLE</th><th className="album-col">ALBUM / SOURCE</th><th className="duration-col"><Disc3 size={14}/></th><th></th></tr></thead><tbody>{tracks.map((t,i)=><tr key={t.id} className={currentId===t.id?'selected-row':''}><td className="number-col"><button className="row-play" onClick={()=>onPlay(t,tracks)} aria-label={`Play ${t.title}`}>{currentId===t.id&&playing?<AudioLines size={16}/>:<><span className="row-number">{String(i+1).padStart(2,'0')}</span><Play className="row-play-icon" size={15} fill="currentColor"/></>}</button></td><td><div className="track-title-cell">{cover(t)}<div className="track-text"><strong>{t.title}</strong><span>{t.artist}</span></div></div></td><td className="album-col"><span className="album-name">{t.kind==='youtube'?<><Youtube size={13}/> YouTube</>:t.album}</span></td><td className="duration-col">{t.duration?formatTime(t.duration):'—'}</td><td><div className="row-actions"><button className={`icon-button ${favorites.includes(t.id)?'favorited':''}`} title="Toggle favorite" aria-label="Toggle favorite" onClick={()=>onFavorite(t)}><Heart size={16} fill={favorites.includes(t.id)?'currentColor':'none'}/></button><div className="dropdown"><button className="icon-button" title="More actions" aria-label="More actions"><MoreHorizontal size={18}/></button><div className="dropdown-menu">{playlists.map(p=><button key={p.id} onClick={()=>onAddToPlaylist(p,t)}><ListPlus size={14}/> Add to {p.name}</button>)}<button className="danger-action" onClick={()=>onRemove(t)}><Trash2 size={14}/> Remove track</button></div></div></div></td></tr>)}</tbody></table></div>
}
function EmptyState({ onImport, youtube=false, favorite=false }: { onImport:()=>void; youtube?:boolean; favorite?:boolean }) {
  return <div className="empty-state"><div className="empty-art">{youtube?<Youtube size={28}/>:favorite?<Heart size={28}/>:<Music2 size={28}/>}</div><h3>{youtube?'No saved YouTube links yet':favorite?'Your favorites will live here':'Your library is waiting for a soundtrack'}</h3><p>{youtube?'Save a video URL to keep it close at hand.':favorite?'Tap the heart on any track to save it here.':'Import audio files from your computer to start building your collection.'}</p>{!favorite&&<button className="secondary-button" onClick={onImport}>{youtube?<Plus size={16}/>:<Upload size={16}/>} {youtube?'Add a YouTube link':'Import audio files'}</button>}</div>
}