import "server-only";
import { DOMParser } from "linkedom";
import { canonicalIsbn, type IsbnMetadata } from "./isbn";

type Source = { name: string; url: string };
type MetadataResult = { metadata: IsbnMetadata; sources: Source[]; notice?: string };
const text = (value: unknown, limit: number) => typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim().slice(0, limit) : "";
const fullDate = (value: unknown) => {
  if (typeof value !== "string") return "";
  let iso = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const match = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(iso);
    const month = match ? ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].findIndex(name => name === match[1].toLowerCase() || name.slice(0, 3) === match[1].toLowerCase()) : -1;
    if (!match || month < 0) return "";
    iso = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
  const parsed = Date.parse(iso);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === iso ? iso : "";
};
function clean(input: { title?: unknown; author?: unknown; description?: unknown; pages?: unknown; date?: unknown }): IsbnMetadata {
  const fields = {
    title: text(input.title, 200), author: text(input.author, 150), description: text(input.description, 10000),
    page_count: Number.isInteger(input.pages) && Number(input.pages) > 0 && Number(input.pages) <= 100000 ? String(input.pages) : "",
    publication_date: fullDate(input.date),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value));
}
async function request(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000), redirect: "error" });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response;
}
function report(provider: string, error: unknown) {
  // Never log request URLs: Google API keys are supplied as query parameters.
  console.error(`Book metadata ${provider} failed:`, error instanceof Error && /^HTTP_\d+$/.test(error.message) ? error.message : "request_or_response_error");
}
async function google(isbn: string): Promise<MetadataResult> {
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const response = await request(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=5${key ? `&key=${encodeURIComponent(key)}` : ""}`);
    const data = await response.json();
    const info = Array.isArray(data.items) ? data.items.find((item: { volumeInfo?: { industryIdentifiers?: { identifier?: string }[] } }) =>
      Array.isArray(item.volumeInfo?.industryIdentifiers) && item.volumeInfo.industryIdentifiers.some(identifier => typeof identifier.identifier === "string" && canonicalIsbn(identifier.identifier) === isbn))?.volumeInfo : null;
    const metadata = info ? clean({ title: info.title, author: Array.isArray(info.authors) ? info.authors.filter((v: unknown) => typeof v === "string").join(", ") : "", description: info.description, pages: info.pageCount, date: info.publishedDate }) : {};
    return { metadata, sources: Object.keys(metadata).length ? [{ name: "Google Books", url: `https://books.google.com/books?vid=ISBN${isbn}` }] : [] };
  } catch (error) { report("Google Books", error); return { metadata: {}, sources: [] }; }
}

async function isbnSearch(isbn: string): Promise<MetadataResult> {
  const url = `https://isbnsearch.org/isbn/${isbn}`;
  try {
    const html = await (await request(url)).text();
    if (html.length > 2000000) throw new Error("Oversized page");
    // Parse as inert server-side HTML; never execute scripts or return markup.
    const document = new DOMParser().parseFromString(html, "text/html");
    const book = document.querySelector(".bookinfo");
    if (!book) {
      if (/checking your browser|verify you are human/i.test(document.querySelector("title")?.textContent ?? "")) {
        console.error("Book metadata ISBN Search requires browser verification.");
        return { metadata: {}, sources: [], notice: "ISBN belum ada di koleksi. ISBN Search meminta verifikasi browser sehingga detail belum bisa diambil otomatis. Lengkapi detail secara manual." };
      }
      return { metadata: {}, sources: [] };
    }
    for (const node of book.querySelectorAll("script, style")) node.remove();
    const fields = new Map<string, string>();
    for (const paragraph of book.querySelectorAll("p")) {
      const label = paragraph.querySelector("strong");
      if (!label) continue;
      const name = label.textContent?.replace(/:\s*$/, "").trim().toLowerCase();
      label.remove();
      if (name) fields.set(name, paragraph.textContent?.trim() ?? "");
    }
    const matches = [fields.get("isbn-13"), fields.get("isbn-10")].some(value => value && canonicalIsbn(value) === isbn);
    if (!matches) return { metadata: {}, sources: [] };
    const title = book.querySelector("h1")?.textContent;
    if (!title?.trim()) return { metadata: {}, sources: [] };
    const pages = fields.get("pages");
    const metadata = clean({ title, author: fields.get("author") ?? fields.get("authors"), date: fields.get("published"), pages: pages && /^\d+$/.test(pages) ? Number(pages) : undefined });
    const binding = fields.get("binding")?.toLowerCase();
    if (binding === "hardcover" || binding === "hardback") metadata.format = "Hardback";
    if (binding === "paperback" || binding === "softcover") metadata.format = "Paperback";
    if (binding === "board book" || binding === "board books") metadata.format = "Board Book";
    return { metadata, sources: [{ name: "ISBN Search", url }] };
  } catch (error) { report("ISBN Search", error); return { metadata: {}, sources: [] }; }
}

export async function fetchBookMetadata(isbn: string): Promise<MetadataResult> {
  const primary = await google(isbn);
  if (primary.metadata.title) return primary;
  return isbnSearch(isbn);
}
