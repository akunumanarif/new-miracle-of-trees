"use client";

import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import { addIsbnDraft, lookupBookIsbn } from "@/app/admin/books/isbn-actions";
import { canonicalIsbn, type IsbnLookup, type IsbnMetadata } from "@/lib/isbn";

export default function IsbnScanner({ disabled, onAccept, onBusy, onBlocked, onManual, onSaved }: {
  disabled: boolean;
  onAccept: (isbn: string, metadata: IsbnMetadata) => void;
  onBusy: (busy: boolean) => void;
  onBlocked: (blocked: boolean) => void;
  onManual: () => void;
  onSaved: () => void;
}) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<IsbnLookup | null>(null);
  const [autoAddDraft, setAutoAddDraft] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [camera, setCamera] = useState<{ deviceId?: string; facingMode: "environment" | "user" }>({ facingMode: "environment" });
  const [cameraReady, setCameraReady] = useState(false);
  const cameras = useRef<MediaDeviceInfo[]>([]);
  const currentCamera = useRef<MediaTrackSettings>({});
  const video = useRef<HTMLVideoElement>(null);
  const request = useRef(0);
  const callbacks = useRef({ onAccept, onBusy, onBlocked, onSaved });
  callbacks.current = { onAccept, onBusy, onBlocked, onSaved };

  useEffect(() => {
    try { setAutoAddDraft(localStorage.getItem("isbn-auto-add-draft") === "true"); } catch { /* Use manual saving when storage is unavailable. */ }
  }, []);

  useEffect(() => {
    if (!active) return;
    setCameraReady(false);
    let cancelled = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    let detected = false;
    const stop = () => { controls?.stop(); stream?.getTracks().forEach(track => track.stop()); };
    const sequence = ++request.current;
    const lookup = async (isbn: string) => {
      stop();
      setProcessing(true);
      setCameraReady(false);
      setMessage("ISBN terbaca. Memeriksa duplikat dan mencari data buku…");
      try {
        const found = await (autoAddDraft ? addIsbnDraft(isbn) : lookupBookIsbn(isbn));
        if (cancelled || request.current !== sequence) return;
        setResult(found);
        if ("metadata" in found && found.savedDraft) {
          callbacks.current.onSaved();
          callbacks.current.onBlocked(true);
          setMessage(found.notice ?? "Buku tersimpan sebagai draft. Silakan scan buku berikutnya.");
        } else if ("metadata" in found) {
          callbacks.current.onAccept(found.isbn, found.metadata);
          callbacks.current.onBlocked(false);
          setMessage(found.notice ?? "ISBN belum ada di koleksi. Data yang tersedia sudah diisi pada kolom kosong; periksa sebelum menyimpan.");
        } else {
          callbacks.current.onBlocked(true);
          setMessage("error" in found ? found.error : "ISBN duplikat. Hasil scan tidak disetujui. Jika tetap perlu menambah buku, gunakan Tambah manual dan periksa datanya.");
        }
      } catch {
        if (cancelled) return;
        callbacks.current.onBlocked(true);
        const error = autoAddDraft ? "Penyimpanan draft belum dapat dipastikan. Periksa daftar buku sebelum scan ulang." : "Pemeriksaan gagal. Coba scan lagi atau gunakan Tambah manual.";
        setResult({ error });
        setMessage(error);
      } finally {
        if (!cancelled) { setProcessing(false); setActive(false); setBusy(false); callbacks.current.onBusy(false); }
      }
    };
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("secure");
        const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...(camera.deviceId ? { deviceId: { exact: camera.deviceId } } : { facingMode: { ideal: camera.facingMode } }), width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (cancelled) { stop(); return; }
        currentCamera.current = stream.getVideoTracks()[0]?.getSettings() ?? {};
        // Device labels and IDs become available after camera permission is granted.
        // Some mobile browsers cannot list cameras; facingMode still allows switching.
        try {
          cameras.current = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "videoinput" && device.deviceId);
        } catch { cameras.current = []; }
        if (cancelled) { stop(); return; }
        // ISBN uses a 1D EAN-13 barcode. The generic multi-format reader in
        // ZXing 0.23 logs normal NotFoundExceptions as unexpected warnings.
        const reader = new BrowserMultiFormatOneDReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]]]));
        controls = await reader.decodeFromStream(stream, video.current!, (decoded, _error, scanner) => {
          if (cancelled || detected || !decoded) return;
          const isbn = canonicalIsbn(decoded.getText());
          if (!isbn) { setMessage("Barcode terbaca, tetapi bukan ISBN valid. Cari barcode buku berawalan 978 atau 979."); return; }
          detected = true;
          scanner.stop();
          startTransition(async () => { await lookup(isbn); });
        });
        if (cancelled || detected) stop();
        else setCameraReady(true);
      } catch (error) {
        stop();
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        setMessage(error instanceof Error && error.message === "secure" ? "Kamera membutuhkan HTTPS atau localhost. Buka situs melalui HTTPS, atau tambah buku secara manual." : name === "NotAllowedError" ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi, atau tambah manual." : "Kamera tidak tersedia atau sedang digunakan. Tutup aplikasi kamera lain lalu coba lagi, atau tambah manual.");
        setBusy(false); setActive(false); callbacks.current.onBusy(false);
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [active, camera, autoAddDraft]);

  const switchCamera = () => {
    if (!cameraReady) return;
    const available = cameras.current;
    const index = available.findIndex(device => device.deviceId === currentCamera.current.deviceId);
    const next = available.length > 1 ? available[(index + 1) % available.length] : undefined;
    const facingMode = (currentCamera.current.facingMode ?? camera.facingMode) === "environment" ? "user" : "environment";
    setCameraReady(false);
    setMessage("Mengganti kamera… Arahkan barcode ISBN ke kamera setelah pratinjau muncul.");
    setCamera({ deviceId: next?.deviceId, facingMode });
  };

  const cancel = () => {
    request.current++;
    setActive(false); setBusy(false); onBusy(false);
    setMessage("Scan dibatalkan. Anda dapat mencoba lagi atau tambah buku secara manual.");
  };
  return <section className="admin-panel admin-form-panel">
    <h2>Tambah lewat scan ISBN</h2>
    <p className="admin-help">Gunakan kamera belakang HP untuk scan barcode ISBN. Pilih Ganti kamera jika kamera yang terbuka kurang sesuai. Buku duplikat diarahkan ke tambah manual. Harga, kategori, dan usia pembaca tetap perlu diisi.</p>
    <label className="admin-checkbox"><input type="checkbox" checked={autoAddDraft} disabled={disabled || busy} onChange={event => {
      const enabled = event.target.checked;
      setAutoAddDraft(enabled);
      try { localStorage.setItem("isbn-auto-add-draft", String(enabled)); } catch { /* The setting still works for this visit. */ }
    }} />Auto add to draft</label>
    <p className="admin-help">{autoAddDraft ? "Setiap hasil scan otomatis disimpan sebagai draft tanpa klik Save. Detail yang belum tersedia dibiarkan kosong dan harga awal Rp0; lengkapi sebelum publikasi." : "Hasil scan mengisi form. Periksa detail lalu klik Tambah buku untuk menyimpan."} Pengaturan diingat di browser ini.</p>
    {active && <video ref={video} className="admin-isbn-video" autoPlay muted playsInline aria-label="Pratinjau kamera untuk scan barcode ISBN" />}
    <div className="admin-isbn-actions">
      {!active ? <button type="button" className="admin-button secondary" disabled={disabled || busy} onClick={() => { setResult(null); setMessage("Arahkan barcode ISBN ke kamera. Pastikan cukup terang dan barcode terlihat jelas."); setBusy(true); onBusy(true); setActive(true); }}>Scan barcode ISBN</button> : <button type="button" className="admin-button secondary" disabled={processing} onClick={cancel}>{processing ? autoAddDraft ? "Menyimpan draft…" : "Memeriksa ISBN…" : "Batalkan scan"}</button>}
      {active && <button type="button" className="admin-button secondary" disabled={disabled || !cameraReady} onClick={switchCamera}>Ganti kamera</button>}
      <button type="button" className="admin-link" disabled={disabled || processing} onClick={() => { cancel(); setResult(null); setMessage("Mode tambah manual. Periksa ISBN dan detail buku sebelum menyimpan."); onBlocked(false); onManual(); }}>Tambah manual</button>
    </div>
    {message && <p className={result && ("duplicate" in result || "error" in result) ? "admin-message error" : "admin-help"} role="status" aria-live="polite">{message}</p>}
    {result && "metadata" in result && Boolean(result.sources?.length) && <p className="admin-help">Sumber detail: {result.sources?.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a className="admin-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a></span>)}</p>}
    {result && "duplicate" in result && <Link className="admin-link" href={`/admin/books/${result.duplicate.id}/edit`}>Buka buku yang sudah ada: {result.duplicate.title} →</Link>}
    {result && "metadata" in result && result.savedDraft && <Link className="admin-link" href={`/admin/books/${result.savedDraft.id}/edit`}>Lengkapi draft: {result.savedDraft.title} →</Link>}
  </section>;
}
