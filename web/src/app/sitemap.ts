import type { MetadataRoute } from "next";

const SITE_URL = "https://stepfree-alpha.vercel.app";

// /watch is excluded: it only ever renders one rider's confirm/stop link and is
// already marked noindex on the page itself.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
