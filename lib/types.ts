export type Book = {
  id: string;
  slug: string;
  title: string;
  author: string;
  category: string;
  age: string;
  format: string;
  price: number;
  cover: string;
  accent: string;
  description: string;
  is_new?: boolean;
  is_featured?: boolean;
  stock_quantity?: number | null;
  isbn?: string | null;
  page_count?: number | null;
  publication_date?: string | null;
  arrival_note?: string | null;
  preorder_closes_on?: string | null;
  gallery_images?: string[];
};

export type AdminBook = Book & {
  status: "draft" | "published" | "archived";
  revision: number;
};
