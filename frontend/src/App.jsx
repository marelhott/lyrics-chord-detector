import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, ChevronLeft, Headphones, LoaderCircle, LockKeyhole, Music2, Pause, Play, Plus, Repeat2, RotateCcw, Search, Trash2, Upload, Volume2, Waves, X } from 'lucide-react';
import './studio.css';

const labels = { original: 'Originál', vocals: 'Zpěv', drums: 'Bicí', bass: 'Basa', guitar: 'Kytara', piano: 'Piano', other: 'Ostatní' };
const colors = { original: '#d3cbfc', vocals: '#ceadff', drums: '#ffae8f', bass: '#a5d6bf', guitar: '#f3d995', piano: '#94c7f4', other: '#c1b9d4' };
const steps = { queued: 'Čeká ve frontě', downloading: 'Získávám audio', separating: 'Odděluji nástroje', chords: 'Analyzuji harmonii', lyrics: 'Přepisuji zpěv', ready: 'Připraveno', failed: 'Zpracování selhalo' };
const clock = n => `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, '0')}`;
async function api(path, options) {
  const response = await fetch(`/api${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || 'Spojení se serverem se nezdařilo.');
  return body;
}
function Artwork({ small = false }) {
  return <div className={`artwork ${small ? 'small' : ''}`} aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="orb-core"/><span className="art-grain"/></div>;
}
function Waveform({ color, peaks = [], progress = 0 }) {
  return <svg className="waveform" viewBox="0 0 500 40" preserveAspectRatio="none" aria-hidden="true">{Array.from({ length: 110 }, (_, i) => {
    const height = 2 + (peaks[i] || 0) * 34;
    return <rect key={i} x={i * 4.5} y={(40 - height) / 2} width="2.5" height={height} rx="1.2" fill={color} opacity={i / 110 < progress ? 1 : 0.35}/>;
  })}</svg>;
}
function Mixer({ song }) {
  const audio = useRef({});
  const graph = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [volumes, setVolumes] = useState({});
  const [muted, setMuted] = useState({});
  const [solo, setSolo] = useState(null);
  const [mode, setMode] = useState('stems');
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(song.result.duration);
  const [error, setError] = useState('');
  const result = song.result;
  const duration = result.duration;
  const lanes = ['original', ...result.stems];
  const activeChord = result.chords.find(c => position >= c.start && position < c.end)?.chord || '—';
  useEffect(() => {
    const players = audio.current;
    return () => {
      Object.values(players).forEach(player => player.pause());
      graph.current?.context.close();
    };
  }, []);
  useEffect(() => {
    for (const [name, player] of Object.entries(audio.current)) {
      const volume = mode === 'original' ? (name === 'original' ? 1 : 0) : (name === 'original' || muted[name] || (solo && name !== solo) ? 0 : (volumes[name] ?? 0.8));
      if (graph.current) graph.current.gains[name].gain.setTargetAtTime(volume, graph.current.context.currentTime, 0.015);
      player.playbackRate = speed;
      player.preservesPitch = true;
    }
  }, [mode, muted, solo, volumes, speed]);
  function seek(value) {
    const time = Math.max(0, Math.min(duration, value));
    for (const player of Object.values(audio.current)) player.currentTime = time;
    setPosition(time);
  }
  async function toggle() {
    if (playing) {
      Object.values(audio.current).forEach(player => player.pause());
      setPlaying(false);
      return;
    }
    setError('');
    if (position >= duration - 0.1) seek(0);
    try {
      if (!graph.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContextClass();
        const gains = {};
        for (const [name, player] of Object.entries(audio.current)) {
          const gain = context.createGain();
          gain.gain.value = mode === 'original' ? (name === 'original' ? 1 : 0) : (name === 'original' || muted[name] || (solo && name !== solo) ? 0 : (volumes[name] ?? 0.8));
          context.createMediaElementSource(player).connect(gain).connect(context.destination);
          gains[name] = gain;
        }
        graph.current = { context, gains };
      }
      await graph.current.context.resume();
      await Promise.all(Object.values(audio.current).map(player => player.play()));
      setPlaying(true);
    } catch {
      Object.values(audio.current).forEach(player => player.pause());
      setError('Audio se ještě načítá nebo přehrávání prohlížeč odmítl. Zkuste přehrát znovu.');
      setPlaying(false);
    }
  }
  function tick() {
    const master = audio.current.original;
    if (!master) return;
    const now = master.currentTime;
    if (loop && now >= loopEnd) { seek(loopStart); return; }
    setPosition(now);
    if (playing) for (const [name, player] of Object.entries(audio.current)) {
      if (name !== 'original' && Math.abs(player.currentTime - now) > 0.08) player.currentTime = now;
    }
  }
  return <div className="studio-content">
    {lanes.map(name => <audio key={name} ref={el => { if (el) audio.current[name] = el; }} src={`/api/songs/${song.id}/audio/${name}`} preload="metadata" onTimeUpdate={name === 'original' ? tick : undefined} onEnded={name === 'original' ? () => { Object.values(audio.current).forEach(p => p.pause()); setPlaying(false); } : undefined}/>) }
    <section className="now-playing"><Artwork/><div className="track-heading"><span className="eyebrow">TVŮJ POSLECH. TVŮJ PROSTOR.</span><h1>{song.title}</h1><p>{clock(duration)} <span>·</span> {result.stems.length} stop <span>·</span> {result.key}</p><div className="track-tags"><span><AudioLines size={13}/> Oddělené nástroje</span><span>CPU · vlastní modely</span></div></div></section>
    <section className={`transport ${playing ? 'is-playing' : ''}`}>
      <div className="transport-top"><div className="transport-buttons"><button className="play-button" onClick={toggle} aria-label={playing ? 'Pozastavit' : 'Přehrát'}>{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button><button className="icon-button" onClick={() => seek(0)} aria-label="Přehrát od začátku"><RotateCcw size={18}/></button><button className={`icon-button ${loop ? 'active' : ''}`} onClick={() => setLoop(!loop)} aria-label="Opakovat úsek" aria-pressed={loop}><Repeat2 size={20}/></button><span className="time-label">{clock(position)} <i>/ {clock(duration)}</i></span></div><select aria-label="Rychlost přehrávání" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.5,0.65,0.8,1,1.2].map(n => <option key={n} value={n}>{n}×</option>)}</select></div>
      <input className="timeline" aria-label="Pozice přehrávání" type="range" min="0" max={duration} step="0.1" value={position} onChange={e => seek(Number(e.target.value))}/>
      {loop && <div className="loop-settings"><span>Opakovat</span><label>Od <input type="number" min="0" max={loopEnd - 1} value={loopStart} onChange={e => setLoopStart(Math.max(0, Math.min(loopEnd - 1, Number(e.target.value))))}/></label><label>Do <input type="number" min={loopStart + 1} max={duration} value={loopEnd} onChange={e => setLoopEnd(Math.max(loopStart + 1, Math.min(duration, Number(e.target.value))))}/></label><span>sekund</span></div>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    <section className="mixer"><div className="section-top"><div><span className="eyebrow">ROZEZNĚJ DETAILY</span><h2>Uvnitř skladby</h2></div><div className="segmented"><button className={mode === 'stems' ? 'selected' : ''} onClick={() => setMode('stems')}>Stemy</button><button className={mode === 'original' ? 'selected' : ''} onClick={() => setMode('original')}>Originál</button></div></div>
      {result.stems.map((name, i) => <div className={`stem-lane ${muted[name] || (solo && solo !== name) ? 'dimmed' : ''}`} key={name} style={{ '--lane': colors[name], '--delay': `${i * 60}ms` }}><div className="stem-icon"><AudioLines size={19}/></div><div className="stem-name"><strong>{labels[name]}</strong><small>{String(i + 1).padStart(2, '0')} / STEM</small></div><div className={`lane-wave ${playing && mode === 'stems' && !muted[name] && (!solo || solo === name) ? 'moving' : ''}`}><Waveform color={colors[name]} peaks={result.waveforms?.[name]} progress={position / duration}/><div className="playhead" style={{ left: `${position / duration * 100}%` }}/></div><div className="lane-controls"><button className={muted[name] ? 'active' : ''} onClick={() => setMuted({ ...muted, [name]: !muted[name] })} aria-label={`Ztlumit ${labels[name]}`} aria-pressed={!!muted[name]}>M</button><button className={solo === name ? 'active' : ''} onClick={() => setSolo(solo === name ? null : name)} aria-label={`Solo ${labels[name]}`} aria-pressed={solo === name}>S</button><input type="range" min="0" max="1" step="0.01" aria-label={`Hlasitost ${labels[name]}`} value={volumes[name] ?? 0.8} onChange={e => setVolumes({ ...volumes, [name]: Number(e.target.value) })}/><a href={`/api/songs/${song.id}/audio/${name}`} download={`${song.title}-${name}.mp3`} aria-label={`Stáhnout ${labels[name]}`}><ArrowUpRight size={17}/></a></div></div>)}
      <p className="wave-note">M — ztlumit · S — samostatný poslech · ↗ — stáhnout stopu</p>
    </section>
    <div className="analysis-grid"><section className="analysis-panel"><div className="section-top"><div><span className="eyebrow">HARMONIE</span><h2>Akordy</h2></div><span className="current-chord">{activeChord}</span></div><p className="muted">Základní odhad dur/moll. Klepnutím skočíš na dané místo.</p><div className="chord-strip">{result.chords.filter(c => c.chord !== 'N').map((c, i) => <button key={i} className={position >= c.start && position < c.end ? 'current' : ''} onClick={() => seek(c.start)}><strong>{c.chord}</strong><small>{clock(c.start)}</small></button>)}</div></section>
    <section className="analysis-panel"><div className="section-top"><div><span className="eyebrow">HLAS A SLOVA</span><h2>Text skladby</h2></div><span className="language-tag">{result.language?.toUpperCase()}</span></div><p className="lyrics-text">{result.words.length ? result.words.map((w, i) => <button key={i} className={position >= w.start && position < w.end ? 'word-active' : ''} onClick={() => seek(w.start)}>{w.word} </button>) : 'Ve skladbě se nepodařilo rozpoznat zpěv.'}</p>{result.suppliedLyrics && <details><summary>Tvůj dodaný text</summary><p className="supplied-lyrics">{result.suppliedLyrics}</p></details>}<p className="muted">Automatický přepis může chybovat, zvlášť u více hlasů a protahovaných slov.</p></section></div>
    <div className="notes">{result.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
  </div>;
}
function ImportDialog({ onClose, onCreated }) {
  const [mode, setMode] = useState('search');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('youtube');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [language, setLanguage] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function search(e) {
    e.preventDefault(); setSearching(true); setError(''); setResults(null);
    try { const value = await api(`/search?q=${encodeURIComponent(query.trim())}&source=${source}`); setResults(value.items); }
    catch (err) { setError(err.message); }
    finally { setSearching(false); }
  }
  async function submit(e, chosenUrl = '', chosenTitle = '') {
    e?.preventDefault(); setBusy(true); setError('');
    const body = new FormData();
    if (mode === 'file' && file) body.append('file', file); else body.append('url', chosenUrl || url);
    body.append('language', language); body.append('title', chosenTitle);
    try { const value = await api('/songs', { method: 'POST', body }); onCreated(value.id); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <form className="import-dialog" onSubmit={mode === 'search' ? search : submit} role="dialog" aria-modal="true" aria-labelledby="import-title">
      <button className="icon-button close" type="button" onClick={onClose} disabled={busy} aria-label="Zavřít"><X/></button>
      <span className="eyebrow">ZAČÍNÁ TO JEDNOU SKLADBOU</span><h2 id="import-title">Poslechni si ji jinak.</h2><p className="muted">Odděl nástroje. Zpomal detail. Najdi svůj part.</p>
      <div className="import-tabs segmented">{[['search','Hledat'],['link','Odkaz'],['file','Soubor']].map(([id,label]) => <button key={id} type="button" className={mode === id ? 'selected' : ''} disabled={busy || searching} onClick={() => { setMode(id); setError(''); }}>{label}</button>)}</div>
      {mode === 'search' ? <div className="search-area">
        <div className="source-picker"><button type="button" className={source === 'youtube' ? 'selected' : ''} disabled={busy || searching} onClick={() => { setSource('youtube'); setResults(null); }}>YouTube</button><button type="button" className={source === 'soundcloud' ? 'selected' : ''} disabled={busy || searching} onClick={() => { setSource('soundcloud'); setResults(null); }}>SoundCloud</button></div>
        <div className="search-field"><input className="text-input" placeholder="Název skladby nebo interpret…" aria-label="Hledat skladbu" value={query} onChange={e => setQuery(e.target.value)} disabled={busy || searching} minLength="2" maxLength="120"/><button className="primary-button" aria-label="Vyhledat" disabled={busy || searching || query.trim().length < 2}>{searching ? <LoaderCircle size={19} className="spin"/> : <Search size={19}/>}</button></div>
        {searching && <p className="helper search-status">Hledám na {source === 'youtube' ? 'YouTube' : 'SoundCloudu'}…</p>}
        {results && <div className="search-results">{results.length ? results.map((item,i) => <button key={item.url + i} className="search-result" type="button" disabled={busy || !item.importable} onClick={() => submit(null,item.url,item.title)}>{item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/> : <span className="result-art"><Music2 size={20}/></span>}<span className="result-copy"><strong>{item.title}</strong><small>{item.artist}{item.duration ? ` · ${clock(item.duration)}` : ''}{!item.importable ? ' · přesahuje 10 minut' : ''}</small></span><span className="result-add">{busy ? <LoaderCircle size={17} className="spin"/> : <Plus size={19}/>}</span></button>) : <p className="helper">Žádné výsledky. Zkus jiný název nebo druhý zdroj.</p>}</div>}
        <p className="helper">Klepnutím na + přidáš skladbu ke zpracování. Veřejný výsledek nemusí umožnit cloudové stažení.</p>
      </div> : mode === 'file' ? <label className={`dropzone ${file ? 'has-file' : ''}`}><Upload/><strong>{file?.name || 'Vyber audio ze souborů'}</strong><span>MP3, WAV, M4A, FLAC, OGG, MP4 · do 80 MB / 10 minut</span><input type="file" accept=".mp3,.wav,.m4a,.flac,.ogg,.mp4" disabled={busy} onChange={e => setFile(e.target.files[0] || null)}/></label> : <><input className="text-input" type="url" placeholder="https://youtube.com/watch?v=…" aria-label="Odkaz na skladbu" disabled={busy} value={url} onChange={e => setUrl(e.target.value)}/><p className="helper">YouTube a SoundCloud. Spotify neposkytuje celé zdrojové audio.</p></>}
      <label className="language-select">Jazyk zpěvu<select value={language} disabled={busy} onChange={e => setLanguage(e.target.value)}><option value="auto">Rozpoznat automaticky</option><option value="cs">Čeština</option><option value="sk">Slovenština</option><option value="en">Angličtina</option><option value="de">Němčina</option><option value="fr">Francouzština</option><option value="es">Španělština</option></select></label>
      {error && <p className="error" role="alert">{error}</p>}
      {mode !== 'search' && <button className="primary-button wide" disabled={busy || (mode === 'file' ? !file : !url.trim())}>{busy ? <LoaderCircle className="spin" size={18}/> : <Waves size={18}/>} {busy ? 'Nahrávám…' : 'Otevřít skladbu'}</button>}
      <p className="helper center">Zpracování běží v cloudu. Aplikaci můžeš mezitím zavřít.</p>
    </form>
  </div>;
}
export default function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState('');
  const [songs, setSongs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api('/session').then(v => setAuthenticated(v.authenticated)).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!authenticated) return;
    let live = true;
    async function refresh() {
      try {
        const items = await api('/songs');
        if (!live) return;
        setSongs(items);
        if (selected?.id) {
          const value = await api(`/songs/${selected.id}`);
          if (live) setSelected(value);
        }
      } catch (err) { if (live) setError(err.message); }
    }
    refresh(); const timer = setInterval(refresh, 4000);
    return () => { live = false; clearInterval(timer); };
  }, [authenticated, selected?.id]);
  async function open(id) { try { setSelected(await api(`/songs/${id}`)); setError(''); } catch (err) { setError(err.message); } }
  async function login(e) { e.preventDefault(); try { await api('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); setAuthenticated(true); setPassword(''); setError(''); } catch (err) { setError(err.message); } }
  async function remove() {
    if (!window.confirm(`Odstranit skladbu „${selected.title}“ a její audio z knihovny?`)) return;
    try { await api(`/songs/${selected.id}`, { method: 'DELETE' }); setSongs(songs.filter(s => s.id !== selected.id)); setSelected(null); } catch (err) { setError(err.message); }
  }
  return <div className="app-shell"><div className="ambient ambient-one"/><div className="ambient ambient-two"/><header className="app-header"><button className="brand" onClick={() => setSelected(null)}><span className="brand-icon"><AudioLines size={21}/></span>stem<span className="brand-light">studio</span><i>PRIVATE EDITION</i></button>{authenticated && <div className="header-actions"><span className="cloud-status"><span/> Railway cloud</span><button className="primary-button compact" aria-label="Přidat skladbu" onClick={() => setImporting(true)}><Plus size={17}/><span>Přidat skladbu</span></button></div>}</header>
    {authenticated === null ? <main className="loading-screen"><LoaderCircle className="spin"/><p>{error || 'Připojuji studio…'}</p></main> : !authenticated ? <main className="login-page"><div className="login-art"><Artwork/><span className="eyebrow">KAŽDÁ SKLADBA MÁ VÍC VRSTEV.</span><h1>Najdi tu svoji.</h1><p>Tvůj soukromý prostor pro hlubší poslech.</p></div><form className="login-card" onSubmit={login}><span className="lock-icon"><LockKeyhole size={20}/></span><h2>Vítej ve studiu.</h2><p className="muted">Zadej přístupové heslo ke své knihovně.</p><input className="text-input" type="password" autoComplete="current-password" placeholder="Tvoje heslo" aria-label="Přístupové heslo" value={password} onChange={e => setPassword(e.target.value)} required/>{error && <p className="error" role="alert">{error}</p>}<button className="primary-button wide">Vstoupit do studia <ArrowUpRight size={18}/></button><p className="helper">Na iPhonu: Safari → Sdílet → Přidat na plochu.</p></form></main> : <main className="main-content">{error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Zavřít upozornění"><X size={16}/></button></div>}{selected ? <><div className="back-row"><button className="back-button" onClick={() => setSelected(null)}><ChevronLeft size={16}/> Knihovna</button>{!['running','queued'].includes(selected.status) && <button className="icon-button" aria-label="Odstranit skladbu" onClick={remove}><Trash2 size={16}/></button>}</div>{selected.status === 'ready' && selected.result ? <Mixer key={selected.id} song={selected}/> : <section className="processing-card"><Artwork/><span className="eyebrow">{selected.status === 'failed' ? 'SKLADBA POTŘEBUJE POZORNOST' : 'HLEDÁM JEDNOTLIVÉ VRSTVY'}</span><h1>{selected.title}</h1><div className="processing-status">{selected.status !== 'failed' && <LoaderCircle className="spin" size={20}/>} {steps[selected.step] || selected.step}</div><p className="muted">{selected.error || 'Zpracování na CPU může trvat několik minut i déle. Skladba zůstane v knihovně, i když aplikaci zavřeš.'}</p>{selected.status === 'failed' && <button className="primary-button" onClick={async () => { try { await api(`/songs/${selected.id}/retry`, { method: 'POST' }); await open(selected.id); } catch (e) { setError(e.message); } }}>Zkusit znovu</button>}<div className="processing-stages">{['separating','chords','lyrics','ready'].map((s,i) => <div key={s} className={selected.step === s ? 'current' : ''}><span>0{i + 1}</span>{steps[s]}</div>)}</div></section>}</> : <><section className="library-hero"><div><span className="eyebrow">PROSTOR PRO HLUBŠÍ POSLECH</span><h1>Hudba.<br/><em>Vrstva po vrstvě.</em></h1><p>Rozlož skladbu na nástroje.<br/>Poslouchej, objevuj a hraj po svém.</p><button className="primary-button" onClick={() => setImporting(true)}><Plus size={18}/> Otevřít novou skladbu <ArrowUpRight size={17}/></button></div><div className="hero-art"><Artwork/><span className="floating-label label-a"><Waves size={15}/> Každý nástroj zvlášť</span><span className="floating-label label-b"><Headphones size={15}/> Tvůj nový způsob poslechu</span></div></section><section className="library-section"><div className="section-top"><div><span className="eyebrow">TVŮJ VLASTNÍ ARCHIV</span><h2>Knihovna <span className="count">{songs.length}</span></h2></div><Music2 size={20} className="muted"/></div>{!songs.length ? <button className="empty-library" onClick={() => setImporting(true)}><span className="empty-icon"><AudioLines/></span><strong>První skladba je začátek.</strong><span>Vlož odkaz nebo vyber audio z telefonu.</span><span className="empty-action">Přidat skladbu <ArrowUpRight size={16}/></span></button> : <div className="song-grid">{songs.map((s,i) => <button key={s.id} className="song-card" style={{ '--delay': `${i * 50}ms` }} onClick={() => open(s.id)}><Artwork small/><div className="song-card-body"><span className={`song-state ${s.status}`}>{s.status === 'ready' ? <Volume2 size={13}/> : s.status === 'failed' ? <X size={13}/> : <LoaderCircle size={13} className="spin"/>}{steps[s.step] || s.step}</span><h3>{s.title}</h3><p>{new Date(s.created * 1000).toLocaleDateString('cs-CZ')}</p></div><span className="song-arrow"><ArrowUpRight size={20}/></span></button>)}</div>}</section><section className="feature-line"><span><AudioLines size={16}/> Šest nástrojových stop</span><span><Repeat2 size={16}/> Smyčky a zpomalení</span><span><Music2 size={16}/> Text a harmonie</span></section></> }</main>}
    <footer className="app-footer"><span>Vytvořeno pro tvoje uši.</span><span>stemstudio <i>·</i> vlastní modely / vlastní knihovna</span></footer>{importing && <ImportDialog onClose={() => setImporting(false)} onCreated={id => { setImporting(false); open(id); }}/>}</div>;
}
