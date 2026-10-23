import type { Book } from "./types";

export const seedBooks: Book[] = [
  {
    id: "1", slug: "bulan-punya-rahasia", title: "Bulan Punya Rahasia", author: "Rara Kinasih",
    category: "Dongeng", age: "3–6 tahun", format: "Hardback", price: 128000,
    cover: "🌙", accent: "#173f8a", is_new: true, is_featured: true,
    description: "Kisah lembut tentang keberanian bertanya dan indahnya mendengarkan, ditemani ilustrasi malam yang hangat."
  },
  {
    id: "2", slug: "si-kecil-penjaga-laut", title: "Si Kecil Penjaga Laut", author: "Dina Prameswari",
    category: "Alam", age: "4–7 tahun", format: "Hardback", price: 142000,
    cover: "🐋", accent: "#167a86", is_new: true, is_featured: true,
    description: "Petualangan bawah laut yang mengajak anak mengenal ekosistem, empati, dan kebiasaan baik untuk bumi."
  },
  {
    id: "3", slug: "rumah-untuk-kiko", title: "Rumah untuk Kiko", author: "Nadia Wibowo",
    category: "Emosi", age: "2–5 tahun", format: "Board Book", price: 89000,
    cover: "🐰", accent: "#e66a3c", is_new: true,
    description: "Cerita hangat untuk membantu anak memahami rasa nyaman, perubahan, dan arti sebuah rumah."
  },
  {
    id: "4", slug: "seribu-bintang-di-kepalaku", title: "Seribu Bintang di Kepalaku", author: "Ayu Larasati",
    category: "Emosi", age: "5–8 tahun", format: "Paperback", price: 76000,
    cover: "✨", accent: "#6f4b9b", is_new: true,
    description: "Buku tentang pikiran yang ramai dan cara-cara kecil untuk kembali tenang bersama orang tersayang."
  },
  {
    id: "5", slug: "dari-mana-hujan-datang", title: "Dari Mana Hujan Datang?", author: "Bima Aksara",
    category: "Sains", age: "4–8 tahun", format: "Board Book", price: 115000,
    cover: "🌧️", accent: "#316da8", is_featured: true,
    description: "Penjelasan siklus air yang sederhana dan penuh kejutan lewat lipatan interaktif yang menyenangkan."
  },
  {
    id: "6", slug: "kebun-rahasia-nenek", title: "Kebun Rahasia Nenek", author: "Tita Lestari",
    category: "Keluarga", age: "3–7 tahun", format: "Hardback", price: 135000,
    cover: "🌿", accent: "#477b4f", is_featured: true,
    description: "Perjalanan penuh aroma dan warna yang merayakan hubungan antargenerasi serta kearifan dari kebun."
  },
  {
    id: "7", slug: "roket-kardus-nara", title: "Roket Kardus Nara", author: "Fikri Alam",
    category: "Imajinasi", age: "4–7 tahun", format: "Paperback", price: 72000,
    cover: "🚀", accent: "#d75832",
    description: "Nara membuktikan bahwa sebuah kardus, selotip, dan imajinasi dapat membawa kita ke mana saja."
  },
  {
    id: "8", slug: "ayo-kenal-perasaan", title: "Ayo Kenal Perasaan", author: "Dr. Nisa Putri",
    category: "Emosi", age: "2–6 tahun", format: "Board Book", price: 98000,
    cover: "😊", accent: "#d78f22",
    description: "Panduan visual yang ramah untuk mengenali, menyebutkan, dan berdamai dengan berbagai perasaan."
  }
];

export const formatRupiah = (price: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
