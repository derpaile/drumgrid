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
    title: { default: "Klangmaß — Drum-Groove-Trainer", template: "%s · Klangmaß" },
    description: "47 kuratierte Drum-Grooves mit synthetischen Drumkits — installierbar und vollständig offline.",
    applicationName: "Klangmaß",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Klangmaß" },
    formatDetection: { telephone: false },
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    openGraph: {
      type: "website",
      locale: "de_DE",
      title: "Klangmaß — Drum-Groove-Trainer",
      description: "47 kuratierte Drum-Grooves mit synthetischen Drumkits. Installierbar und vollständig offline.",
      images: [{ url: `${origin}/og-drums.png`, width: 1731, height: 909, alt: "Klangmaß Drum-Groove-Trainer" }],
    },
    twitter: { card: "summary_large_image", title: "Klangmaß — Drum-Groove-Trainer", images: [`${origin}/og-drums.png`] },
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
