import type { MetadataRoute } from "next";
import { LAUNCH_MODE } from "@/shared/config/launch";
import { SITE_URL } from "@/shared/config/seo";

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/api/",
    "/admin/",
    "/user/",
    "/login",
    "/signup",
    "/create",
    "/studio",
    "/credits",
    ...(LAUNCH_MODE ? ["/catalog", "/product/", "/cart"] : []),
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
