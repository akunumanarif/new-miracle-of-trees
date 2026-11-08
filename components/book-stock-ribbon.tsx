export default function BookStockRibbon({ quantity }: { quantity?: number | null }) {
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) return null;
  const state = quantity === 0 ? "empty" : quantity === 1 ? "last" : quantity <= 3 ? "low" : "ready";
  const label = state === "last" ? "Wah, tinggal 1 nih!" : state === "low" ? "Hampir habis, amankan sekarang!" : state === "ready" ? "Ready Stock" : "Stok habis";
  return <span className={`book-stock-ribbon ${state}`}><span>{label}</span></span>;
}
