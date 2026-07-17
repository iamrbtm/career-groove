import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "CareerGroove", description: "Your career, in rhythm.", applicationName: "CareerGroove" };
export const viewport: Viewport = { themeColor: "#26312c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="font-[var(--font-body)] antialiased">{children}</body></html>;
}
