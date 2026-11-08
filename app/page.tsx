import Storefront from "@/components/storefront";
import { getBooks } from "@/lib/books";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  const { data, error } = await getBooks();
  return <Storefront books={data ?? []} catalogError={error} />;
}
