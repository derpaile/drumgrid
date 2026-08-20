import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: { default: "Klangmaß — Präzises Metronom", template: "%s · Klangmaß" },
    description: "Präzises, installierbares Metronom mit Pattern-Bibliothek — vollständig offline.",
    applicationName: "Klangmaß",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Klangmaß" },
    formatDetection: { telephone: false },
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    openGraph: {
      type: "website",
      locale: "de_DE",
      title: "Klangmaß — Präzise im Takt",
      description: "100 kuratierte Patterns. Installierbar und vollständig offline.",
      images: [{ url: `${origin}/og.png`, width: 1730, height: 909, alt: "Klangmaß Metronom bei 92 BPM" }],
    },
    twitter: { card: "summary_large_image", title: "Klangmaß — Präzise im Takt", images: [`${origin}/og.png`] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#e94f37",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
