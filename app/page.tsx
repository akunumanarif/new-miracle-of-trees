import Storefront from "@/components/storefront";
import { getBooks } from "@/lib/books";

export const revalidate = 300;

export default async function HomePage() {
  const books = await getBooks();
  return <Storefront books={books} />;
}
