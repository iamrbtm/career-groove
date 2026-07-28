import { MetadataRoute } from "next";

const BASE_URL = "https://careergroove.website";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/signin",
        "/register",
        "/terms",
        "/privacy",
        "/dashboard/",
        "/dashboard/crm",
        "/dashboard/resume",
        "/dashboard/cover-letter",
        "/dashboard/interview",
        "/dashboard/applications",
        "/dashboard/research",
        "/dashboard/settings",
        "/profile",
        "/journey",
        "/network",
        "/analytics",
        "/follow-ups",
        "/documents",
        "/mock-interview",
        "/brand",
        "/admin",
      ],
      disallow: [
        "/api/",
        "/_next/",
        "/static/",
        "/dashboard/billing",
        "/dashboard/settings/billing",
        "/admin/users",
        "/admin/payments",
        "/admin/ai",
        "/api/auth/",
        "/api/ai/",
        "/api/github/",
        "/api/push/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}