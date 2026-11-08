"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Binoculars, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Headphones, Leaf, Maximize, Minus, Moon, Plus, RotateCcw, Search, Sparkles, Sun, Volume2, VolumeX, X } from "lucide-react";
import { ANIMALS, HABITATS, type Animal, type Habitat } from "./animals";
import { AnimalAudio } from "./animal-audio";
import type { ViewRequest } from "./world-scene";

const WorldScene = dynamic(() => import("./world-scene"), { ssr: false });
const STORAGE_KEY = "mot-dunia-hewan-discoveries-v1";

export default function AnimalWorld() {
  const [selected, setSelected] = useState<Animal | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [night, setNight] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [collection, setCollection] = useState(false);
  const [credits, setCredits] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("semua");
  const [habitat, setHabitat] = useState<Habitat | null>(null);
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<ViewRequest>({ point: [0, 0, 3], zoom: 47, serial: 0 });
  const audio = useRef<AnimalAudio | null>(null);
  const world = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    audio.current = new AnimalAudio();
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); if (Array.isArray(saved)) setFound(saved.filter(id => typeof id === "string" && ANIMALS.some(a => a.id === id))); } catch { /* private mode can disable storage */ }
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const change = () => setReducedMotion(media.matches); media.addEventListener("change", change);
    const hidden = () => { if (document.hidden) { audio.current?.stop(); void audio.current?.ambience(false); setAmbient(false); } };
    document.addEventListener("visibilitychange", hidden);
    const timer = setTimeout(() => setSlow(true), 18000);
    return () => { audio.current?.dispose(); document.body.style.cursor = ""; media.removeEventListener("change", change); document.removeEventListener("visibilitychange", hidden); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!collection && !credits) return;
    const previous = document.activeElement as HTMLElement | null;
    const container = dialog.current;
    container?.querySelector<HTMLElement>("button, input")?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCollection(false); setCredits(false); }
      if (e.key !== "Tab" || !container) return;
      const elements = container.querySelectorAll<HTMLElement>('button, input, a[href]');
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [collection, credits]);

  const play = useCallback((animal: Animal) => {
    if (muted) return;
    setMessage("");
    void audio.current?.play(animal).catch(() => setMessage("Suara belum bisa diputar. Ketuk tombol suara untuk mencoba lagi."));
  }, [muted]);

  const select = useCallback((animal: Animal) => {
    setSelected(animal); setStarted(true); setCollection(false); setHabitat(animal.habitat);
    setView(v => ({ point: animal.position, zoom: animal.flying ? 26 : 22, focus: true, serial: v.serial + 1 }));
    setFound(previous => {
      const next = previous.includes(animal.id) ? previous : [...previous, animal.id];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* discovery still works without storage */ }
      return next;
    });
    play(animal);
  }, [play]);

  const onReady = useCallback(() => { setReady(true); setFailed(false); }, []);
  const onError = useCallback(() => { setFailed(true); setReady(true); }, []);
  const visit = (id: Habitat) => { setHabitat(id); setView(v => ({ point: HABITATS[id].point, zoom: 35, serial: v.serial + 1 })); };
  const toggleMute = () => {
    if (!muted) { audio.current?.stop(); void audio.current?.ambience(false); setAmbient(false); }
    setMuted(!muted);
  };
  const toggleAmbient = () => {
    const enabled = !ambient; setMuted(false); setAmbient(enabled);
    void audio.current?.ambience(enabled).catch(() => { setAmbient(false); setMessage("Suasana hutan belum dapat diputar. Coba lagi, ya."); });
  };
  const zoom = (amount: number) => setView(v => ({ point: v.point, zoomDelta: amount, serial: v.serial + 1 }));
  const reset = () => { setHabitat(null); setView(v => ({ point: [0, 0, 3], zoom: 47, serial: v.serial + 1 })); };
  const filtered = ANIMALS.filter(a => (filter === "semua" || (filter === "terbang" ? a.flying : filter === "ditemukan" ? found.includes(a.id) : !a.flying)) && `${a.name} ${a.english}`.toLowerCase().includes(query.toLowerCase()));

  return <main className={`dw-world ${night ? "dw-night" : ""} ${selected ? "dw-has-selection" : ""}`} ref={world}>
    <div className="dw-scene" aria-label="Peta hutan 3D interaktif. Geser untuk menjelajah, ketuk hewan untuk berkenalan.">
      <WorldScene selected={selected?.id ?? null} night={night} reducedMotion={reducedMotion} view={view} onSelect={select} onReady={onReady} onError={onError} />
    </div>
    <div className="dw-vignette" />

    <header className="dw-header">
      <Link href="/" className="dw-home" aria-label="Kembali ke Miracle of Trees"><ArrowLeft size={17} /><span>Miracle of Trees</span></Link>
      <div className="dw-logo"><span className="dw-logo-icon"><Leaf size={20} /></span><span>Dunia <b>Hewan</b><small>RUANG BERMAIN & BELAJAR</small></span></div>
      <div className="dw-header-actions">
        <button className="dw-icon-button" onClick={toggleMute} aria-label={muted ? "Aktifkan suara" : "Matikan semua suara"} aria-pressed={muted}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <button className="dw-icon-button" onClick={() => setNight(!night)} aria-label={night ? "Ubah ke suasana siang" : "Ubah ke suasana malam"}>{night ? <Moon size={18} /> : <Sun size={19} />}</button>
        <span className="dw-header-divider" />
        <button className="dw-collection-button" onClick={() => setCollection(true)}><BookOpen size={17} /><span>Koleksiku</span><b>{found.length}/{ANIMALS.length}</b></button>
      </div>
    </header>

    <section className="dw-intro"><div className="dw-eyebrow"><span /> PETUALANGAN SI KECIL</div><h1>Halo, penjelajah <span>kecil!</span></h1><p>Ada banyak teman baru di sini.<br />Yuk, sapa dan dengarkan suara mereka.</p><div className="dw-discovery"><span className="dw-discovery-icon"><Binoculars size={17} /></span><span><b>{found.length} dari {ANIMALS.length}</b> teman ditemukan</span><div className="dw-progress"><i style={{ width: `${found.length / ANIMALS.length * 100}%` }} /></div></div></section>

    <nav className="dw-habitats" aria-label="Jelajahi habitat">{(Object.keys(HABITATS) as Habitat[]).map(id => <button key={id} className={habitat === id ? "is-active" : ""} onClick={() => visit(id)}><span>{HABITATS[id].emoji}</span><span>{HABITATS[id].name}</span></button>)}</nav>

    {!ready && !failed && <div className="dw-loading" role="status"><span className="dw-loading-emoji">🌿</span><b>Menyiapkan petualanganmu…</b><span>{slow ? "Hewan 3D masih dimuat. Sambil menunggu, buka koleksi di bawah." : "Pepohonan, sayap, dan teman-teman baru."}</span>{slow && <button onClick={() => setCollection(true)}>Buka koleksi hewan <ArrowRight size={15} /></button>}</div>}
    {failed && <div className="dw-fallback" role="status"><Leaf size={22} /><b>Yuk, jelajahi lewat koleksi!</b><p>Perangkat ini belum bisa menampilkan hutan 3D. Nama, fakta, dan suara hewan tetap bisa dimainkan.</p><button onClick={() => setCollection(true)}>Temui semua hewan <ArrowRight size={16} /></button></div>}

    {ready && !failed && !started && <div className="dw-welcome"><span>🦊</span><div><b>Petualanganmu dimulai di sini.</b><p>Geser hutannya, lalu ketuk hewan yang kamu temukan!</p></div><button onClick={() => { setStarted(true); select(ANIMALS[0]); }}>Ayo jelajah <ArrowRight size={17} /></button><button className="dw-welcome-close" aria-label="Tutup petunjuk" onClick={() => setStarted(true)}><X size={14} /></button></div>}

    {selected && <section className="dw-animal-card" aria-label={`Kenalan dengan ${selected.name}`}>
      <button className="dw-card-close" onClick={() => { setSelected(null); audio.current?.stop(); }} aria-label="Tutup kartu hewan"><X size={17} /></button>
      <div className="dw-card-top"><span className="dw-animal-portrait">{selected.emoji}</span><div><span className="dw-eyebrow">{selected.flying ? "TEMAN BERSAYAP" : "KENALAN, YUK!"}</span><h2>{selected.name}</h2><span className="dw-english">{selected.english} <i>·</i> {HABITATS[selected.habitat].name}</span></div></div>
      <p className="dw-fact">“{selected.fact}”</p>
      <div className="dw-food"><Leaf size={14} /><span>Makananku: {selected.food}</span></div>
      <button className="dw-play" onClick={() => { if (muted) { setMuted(false); void audio.current?.play(selected).catch(() => setMessage("Suara belum dapat diputar.")); } else play(selected); }}><Volume2 size={19} /><span>{selected.audioLabel ?? "Dengarkan suaraku"} <small>{selected.call}</small></span><span className="dw-sound-bars"><i /><i /><i /><i /></span></button>
      <small className="dw-audio-note">Rekaman asli · {selected.soundDescription}</small>
      <div className="dw-card-bottom"><span><Check size={13} /> Sudah jadi temanmu</span><button onClick={() => select(ANIMALS[(ANIMALS.findIndex(a => a.id === selected.id) + 1) % ANIMALS.length])}>Teman berikutnya <ChevronRight size={14} /></button></div>
    </section>}

    <aside className="dw-map-tools" aria-label="Kontrol peta"><button onClick={() => zoom(-7)} aria-label="Perbesar peta"><Plus size={20} /></button><button onClick={() => zoom(7)} aria-label="Perkecil peta"><Minus size={20} /></button><span /><button onClick={reset} aria-label="Kembali ke tampilan awal"><RotateCcw size={17} /></button><button onClick={() => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => setMessage("Layar penuh tidak tersedia."));
      else if (world.current?.requestFullscreen) void world.current.requestFullscreen().catch(() => setMessage("Layar penuh tidak tersedia di perangkat ini."));
      else setMessage("Gunakan mode lanskap untuk melihat peta lebih luas.");
    }} aria-label="Layar penuh"><Maximize size={17} /></button></aside>

    <aside className="dw-minimap" aria-label="Peta kecil"><span className="dw-minimap-title"><Compass size={12} /> PETA KECIL <b>U ↑</b></span><div className="dw-mini-island"><div className="dw-mini-water" />{ANIMALS.map(a => <button key={a.id} title={a.name} aria-label={`Temukan ${a.name} di peta`} onClick={() => select(a)} className={`${found.includes(a.id) ? "found" : ""} ${selected?.id === a.id ? "selected" : ""}`} style={{ left: `${(a.position[0] + 35) / 70 * 100}%`, top: `${(a.position[2] + 35) / 70 * 100}%` }} />)}</div><span className="dw-mini-caption">Dunia kecil, banyak cerita.</span></aside>

    <div className="dw-bottom-area"><div className="dw-bottom-info"><span><span className="dw-live-dot" /> {night ? "Malam yang tenang" : "Hari yang indah untuk menjelajah"}</span><span className="dw-gesture-hint">Geser untuk menjelajah <i>·</i> Cubit / scroll untuk zoom</span><button className={ambient ? "is-playing" : ""} onClick={toggleAmbient} aria-pressed={ambient}><Headphones size={14} /> Suasana hutan {ambient ? "aktif" : ""}</button></div>
      <section className="dw-animal-tray" aria-label="Pilih teman hewan"><button className="dw-tray-heading" onClick={() => setCollection(true)}><span className="dw-tray-icon"><Binoculars size={22} /></span><span>Siapa yang ingin<br /><b>kamu temui?</b></span><ChevronRight size={16} /></button><button className="dw-rail-arrow" aria-label="Geser daftar ke kiri" onClick={() => rail.current?.scrollBy({ left: -280, behavior: reducedMotion ? "instant" : "smooth" })}><ChevronLeft size={17} /></button><div className="dw-rail" ref={rail}>{ANIMALS.map(a => <button key={a.id} className={`dw-animal-tile ${selected?.id === a.id ? "is-selected" : ""}`} onClick={() => select(a)} aria-label={`Temui ${a.name}`} aria-pressed={selected?.id === a.id}><span className="dw-tile-emoji">{a.emoji}</span><span>{a.name}</span>{found.includes(a.id) && <i><Check size={9} /></i>}{a.flying && <small>TERBANG</small>}</button>)}</div><button className="dw-rail-arrow" aria-label="Geser daftar ke kanan" onClick={() => rail.current?.scrollBy({ left: 280, behavior: reducedMotion ? "instant" : "smooth" })}><ChevronRight size={17} /></button></section>
      <div className="dw-footer"><span>Dibuat untuk rasa ingin tahu yang tak pernah habis.</span><button onClick={() => setCredits(true)}>Tentang dunia ini <Sparkles size={11} /></button></div>
    </div>

    {message && <div className="dw-toast" role="status">{message}<button aria-label="Tutup pesan" onClick={() => setMessage("")}><X size={15} /></button></div>}
    {found.length === ANIMALS.length && !selected && <div className="dw-complete" role="status">🌟 Hebat! Semua teman sudah kamu temukan.</div>}

    {(collection || credits) && <div className="dw-modal-backdrop" onClick={() => { setCollection(false); setCredits(false); }}><div className={`dw-modal ${credits ? "dw-credits" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dw-dialog-title" ref={dialog} onClick={e => e.stopPropagation()}>
      <button className="dw-modal-close" aria-label="Tutup jendela" onClick={() => { setCollection(false); setCredits(false); }}><X size={20} /></button>
      {collection ? <><span className="dw-eyebrow">BUKU PETUALANGANMU</span><h2 id="dw-dialog-title">Teman-teman kecilku <span>🌿</span></h2><p>{found.length} dari {ANIMALS.length} teman sudah kamu sapa. Siapa berikutnya?</p><label className="dw-search"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama hewan…" aria-label="Cari hewan" /></label><div className="dw-filters">{[["semua", "Semua teman"], ["darat", "🐾 Di darat"], ["terbang", "🪽 Bisa terbang"], ["ditemukan", "✓ Ditemukan"]].map(([id, name]) => <button key={id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{name}</button>)}</div><div className="dw-collection-grid">{filtered.map(a => <button key={a.id} onClick={() => select(a)}><span>{a.emoji}</span><b>{a.name}</b><small>{a.english}</small><i className={found.includes(a.id) ? "found" : ""}>{found.includes(a.id) ? <><Check size={12} /> Ditemukan</> : "Ayo berkenalan"}</i></button>)}{!filtered.length && <p className="dw-no-results">Belum ada hewan di sini. Coba nama atau pilihan lain, ya.</p>}</div></> : <><span className="dw-eyebrow">MIRACLE OF TREES</span><h2 id="dw-dialog-title">Dunia kecil untuk<br />rasa ingin tahu besar.</h2><p>Tempat bermain dan berkenalan dengan hewan melalui bentuk, gerak, dan suara. Hewan dari berbagai habitat berkumpul di dunia imajinasi ini.</p><p><b>Aset & kredit</b><br />Model hewan oleh <a href="https://quaternius.com/packs/ultimateanimatedanimals.html" target="_blank" rel="noreferrer">Quaternius</a> (CC0), dikonversi oleh <a href="https://github.com/danwahl/animasim" target="_blank" rel="noreferrer">animasim</a>. Model ternak dan anak ayam dari <a href="https://opengameart.org/content/lowpoly-animated-farm-animal-pack" target="_blank" rel="noreferrer">OpenGameArt</a> (CC0). Model satwa lain oleh Poly by Google, Хмара Сергей, dan Gwym Hendawyr melalui <a href="https://poly.pizza" target="_blank" rel="noreferrer">Poly Pizza</a> (<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>); model disesuaikan ukuran dan penempatannya.</p><p>Suara hewan memakai rekaman asli dari Freesound, Wikimedia Commons, dan OpenGameArt. Setiap hewan memiliki klip tersendiri; husky, shiba, dan pug memakai rekaman jenis anjing yang sesuai. Kelinci memperdengarkan suara kunyahan dan bangau ketukan paruh. Semua kreator, sumber, lisensi, dan pemotongan klip tercantum di catatan di bawah. Suasana hutan dari SFXMint (CC0). Hutan dibuat khusus untuk halaman ini.</p><p>Penemuan disimpan di perangkat ini. Tidak ada akun atau data pribadi yang diperlukan.</p><a className="dw-credit-file" href="/dunia-hewan/ASSET-CREDITS.md" target="_blank" rel="noreferrer">Lihat catatan sumber dan lisensi <ArrowRight size={14} /></a></>}
    </div></div>}
    <span className="dw-sr-only" aria-live="polite">{selected ? `${selected.name}. ${selected.fact} ${selected.call}` : `${found.length} teman ditemukan.`}</span>
  </main>;
}
