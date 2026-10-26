import type { Metadata, Viewport } from "next";
import { Baloo_2, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/lib/ui/toast";

const display = Baloo_2({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display-loaded" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body-loaded" });

export const metadata: Metadata = { title: { default: "CareerGroove — Your career, in rhythm", template: "%s · CareerGroove" }, description: "Turn rough career stories into polished achievements, tailored applications, and confident interviews.", applicationName: "CareerGroove" };
export const viewport: Viewport = { themeColor: "#26312c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="font-[var(--font-body)] antialiased">
        <ThemeProvider>
          <ToastProvider>
            {children}
            <ServiceWorker />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
