import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "CareerGroove", short_name: "Groove", description: "Your career, in rhythm.", start_url: "/", scope: "/", display: "standalone", orientation: "portrait-primary", background_color: "#f6f0e5", theme_color: "#26312c", icons: [{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"},{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"maskable"}] };
}
