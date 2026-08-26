import type { Metadata, Viewport } from "next";
import globalStyles from "./globals.css?inline";

export async function generateMetadata(): Promise<Metadata> {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = configuredOrigin && /^https?:\/\//.test(configuredOrigin)
    ? new URL(configuredOrigin).origin
    : "http://localhost:3000";
  return {
    metadataBase: new URL(origin),
    title: { default: "Klangmaß — Lokaler Übecoach", template: "%s · Klangmaß" },
    description: "194 Drum-Grooves, adaptive Sessions, Lernleitern und Gap Click — privat, präzise und offline.",
    applicationName: "Klangmaß",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Klangmaß" },
    formatDetection: { telephone: false },
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    openGraph: {
      type: "website",
      locale: "de_DE",
      title: "Klangmaß — Lokaler Übecoach",
      description: "194 Drum-Grooves, adaptive Sessions, Lernleitern und Gap Click. Privat, präzise und offline.",
      images: [{ url: `${origin}/og-drums.png`, width: 1731, height: 909, alt: "Klangmaß Drum-Groove-Trainer" }],
    },
    twitter: { card: "summary_large_image", title: "Klangmaß — Lokaler Übecoach", images: [`${origin}/og-drums.png`] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171923",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head><style dangerouslySetInnerHTML={{ __html: globalStyles }} /></head>
      <body>{children}</body>
    </html>
  );
}
