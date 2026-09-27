import type { MetadataRoute } from "next";

const SITE_URL = "https://stepfree-alpha.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The confirm/stop links are single-use and rider-specific; keep crawlers out of them.
      disallow: "/watch",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
