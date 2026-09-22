/** Canonical public origin used by metadata, robots and sitemap generation. */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://clawpuzzle.com",
);
