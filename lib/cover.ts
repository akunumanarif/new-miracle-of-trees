// Keep legacy emoji covers while accepting only this project's public cover bucket.
export function getCoverImage(cover: string): string | null {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return null;
  try {
    const url = new URL(cover);
    const project = new URL(projectUrl);
    return url.origin === project.origin && url.pathname.startsWith("/storage/v1/object/public/book-covers/")
      ? url.href : null;
  } catch { return null; }
}
