"use client";

import { useActionState, useEffect, useState } from "react";
import { saveStockOpname } from "@/app/admin/actions";

export default function StockForm({ bookId, quantity, version }: { bookId: string; quantity: number; version: number }) {
  const [state, action, pending] = useActionState(saveStockOpname, {});
  const [count, setCount] = useState("");
  useEffect(() => { setCount(""); }, [version]);
  const numericCount = /^\d+$/.test(count) ? Number(count) : null;
  const difference = numericCount === null ? null : numericCount - quantity;
  return <form action={action} className="admin-stock-form">
    <input type="hidden" name="bookId" value={bookId} /><input type="hidden" name="version" value={version} />
    <div className="admin-count-fields"><label>Stok fisik<input aria-label="Stok fisik hasil hitung" name="count" type="number" min="0" max="2147483647" step="1" required value={count} onChange={event => setCount(event.target.value)} placeholder="Hasil hitung" /></label><div className="admin-difference"><span>Selisih</span><strong className={difference && difference < 0 ? "negative" : ""}>{difference === null ? "—" : `${difference > 0 ? "+" : ""}${difference}`}</strong></div></div>
    <label>Catatan<input name="note" required maxLength={500} placeholder="Contoh: hitung ulang rak A" /></label>
    <button className="admin-button small" disabled={pending}>{pending ? "Menyimpan…" : "Simpan opname"}</button>
    {state.error && <p className="admin-message error" role="alert">{state.error} <a href="/admin">Muat ulang</a></p>}
    {state.success && <p className="admin-message success" role="status">{state.success}</p>}
  </form>;
}
