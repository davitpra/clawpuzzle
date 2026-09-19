import type { MetadataRoute } from "next";
import { LAUNCH_MODE } from "@/shared/config/launch";
import { SITE_URL } from "@/shared/config/seo";

const PUBLIC_PAGES = ["/", "/privacy", "/terms", "/shipping-returns"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = LAUNCH_MODE
    ? PUBLIC_PAGES
    : [...PUBLIC_PAGES, "/contact", "/catalog", "/studio-landing"];

  return paths.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));
}
