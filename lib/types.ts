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
};
