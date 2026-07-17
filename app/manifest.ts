import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "CareerGroove", short_name: "Groove", description: "Your career, in rhythm.", start_url: "/", display: "standalone", background_color: "#f6f0e5", theme_color: "#26312c", icons: [] };
}
