"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lookupBookIsbn } from "@/app/admin/books/isbn-actions";
import { canonicalIsbn, type IsbnLookup, type IsbnMetadata } from "@/lib/isbn";

export default function IsbnScanner({ disabled, onAccept, onBusy, onBlocked, onManual }: {
  disabled: boolean;
  onAccept: (isbn: string, metadata: IsbnMetadata) => void;
  onBusy: (busy: boolean) => void;
  onBlocked: (blocked: boolean) => void;
  onManual: () => void;
}) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<IsbnLookup | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const request = useRef(0);
  const callbacks = useRef({ onAccept, onBusy, onBlocked });
  callbacks.current = { onAccept, onBusy, onBlocked };

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    let detected = false;
    const stop = () => { controls?.stop(); stream?.getTracks().forEach(track => track.stop()); };
    const sequence = ++request.current;
    const lookup = async (isbn: string) => {
      stop();
      setMessage("ISBN terbaca. Memeriksa duplikat dan mencari data buku…");
      try {
        const found = await lookupBookIsbn(isbn);
        if (cancelled || request.current !== sequence) return;
        setResult(found);
        if ("metadata" in found) {
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
        setMessage("Pemeriksaan gagal. Coba scan lagi atau gunakan Tambah manual.");
      } finally {
        if (!cancelled) { setActive(false); setBusy(false); callbacks.current.onBusy(false); }
      }
    };
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("secure");
        const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
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
          void lookup(isbn);
        });
        if (cancelled || detected) stop();
      } catch (error) {
        stop();
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        setMessage(error instanceof Error && error.message === "secure" ? "Kamera membutuhkan HTTPS atau localhost. Buka situs melalui HTTPS, atau tambah buku secara manual." : name === "NotAllowedError" ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi, atau tambah manual." : "Kamera tidak tersedia atau sedang digunakan. Tutup aplikasi kamera lain lalu coba lagi, atau tambah manual.");
        setBusy(false); setActive(false); callbacks.current.onBusy(false);
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [active]);

  const cancel = () => {
    request.current++;
    setActive(false); setBusy(false); onBusy(false);
    setMessage("Scan dibatalkan. Anda dapat mencoba lagi atau tambah buku secara manual.");
  };
  return <section className="admin-panel admin-form-panel">
    <h2>Tambah lewat scan ISBN</h2>
    <p className="admin-help">Gunakan kamera belakang HP untuk scan barcode ISBN. Buku duplikat diarahkan ke tambah manual. Harga, kategori, dan usia pembaca tetap perlu diisi.</p>
    {active && <video ref={video} className="admin-isbn-video" autoPlay muted playsInline aria-label="Pratinjau kamera untuk scan barcode ISBN" />}
    <div className="admin-isbn-actions">
      {!active ? <button type="button" className="admin-button secondary" disabled={disabled || busy} onClick={() => { setResult(null); setMessage("Arahkan barcode ISBN ke kamera. Pastikan cukup terang dan barcode terlihat jelas."); setBusy(true); onBusy(true); setActive(true); }}>Scan barcode ISBN</button> : <button type="button" className="admin-button secondary" onClick={cancel}>Batalkan scan</button>}
      <button type="button" className="admin-link" disabled={disabled} onClick={() => { cancel(); setResult(null); setMessage("Mode tambah manual. Periksa ISBN dan detail buku sebelum menyimpan."); onBlocked(false); onManual(); }}>Tambah manual</button>
    </div>
    {message && <p className={result && ("duplicate" in result || "error" in result) ? "admin-message error" : "admin-help"} role="status" aria-live="polite">{message}</p>}
    {result && "metadata" in result && Boolean(result.sources?.length) && <p className="admin-help">Sumber detail: {result.sources?.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a className="admin-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a></span>)}</p>}
    {result && "duplicate" in result && <Link className="admin-link" href={`/admin/books/${result.duplicate.id}/edit`}>Buka buku yang sudah ada: {result.duplicate.title} →</Link>}
  </section>;
}
