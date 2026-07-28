import { MetadataRoute } from "next";

const BASE_URL = "https://careergroove.website";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/signin",
    "/register",
    "/terms",
    "/privacy",
    "/dashboard",
    "/dashboard/crm",
    "/dashboard/resume",
    "/dashboard/cover-letter",
    "/dashboard/interview",
    "/dashboard/applications",
    "/dashboard/research",
    "/dashboard/settings",
    "/dashboard/billing",
    "/profile",
    "/journey",
    "/network",
    "/analytics",
    "/follow-ups",
    "/documents",
    "/mock-interview",
    "/brand",
    "/admin",
    "/admin/users",
    "/admin/payments",
    "/admin/ai",
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.startsWith("/dashboard") ? 0.8 : 0.6,
  }));
}