import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "WorldFit",
  description: "PWA offline para registrar rutinas, progreso y objetivos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "WorldFit",
    statusBarStyle: "black-translucent",
    startupImage: [
      "/splash/iphone-portrait.png",
      {
        url: "/splash/iphone-portrait-2x.png",
        media: "(device-width: 390px) and (-webkit-device-pixel-ratio: 3)"
      }
    ]
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1218"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem("pure-lift-theme") || "dark";
                document.documentElement.dataset.theme = theme;
                document.documentElement.classList.toggle("dark", theme === "dark");
                document.documentElement.classList.toggle("light", theme === "light");
              } catch (e) {}
            `
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
