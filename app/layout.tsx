import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = { title: { default: "CareerGroove — Your career, in rhythm", template: "%s · CareerGroove" }, description: "Turn rough career stories into polished achievements, tailored applications, and confident interviews.", applicationName: "CareerGroove" };
export const viewport: Viewport = { themeColor: "#26312c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="font-[var(--font-body)] antialiased">{children}<ServiceWorker/></body></html>;
}
