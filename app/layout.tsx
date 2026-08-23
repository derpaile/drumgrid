import type { Metadata, Viewport } from "next";
import globalStyles from "./globals.css?inline";

export async function generateMetadata(): Promise<Metadata> {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = configuredOrigin && /^https?:\/\//.test(configuredOrigin)
    ? new URL(configuredOrigin).origin
    : "http://localhost:3000";
  return {
    metadataBase: new URL(origin),
    title: { default: "Klangmaß — Drum-Groove-Trainer", template: "%s · Klangmaß" },
    description: "Kuratierte Drum-Grooves mit kompakten Sample-Kits — installierbar und vollständig offline.",
    applicationName: "Klangmaß",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Klangmaß" },
    formatDetection: { telephone: false },
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    openGraph: {
      type: "website",
      locale: "de_DE",
      title: "Klangmaß — Drum-Groove-Trainer",
      description: "Kuratierte Drum-Grooves mit kompakten Sample-Kits. Installierbar und vollständig offline.",
      images: [{ url: `${origin}/og-drums.png`, width: 1731, height: 909, alt: "Klangmaß Drum-Groove-Trainer" }],
    },
    twitter: { card: "summary_large_image", title: "Klangmaß — Drum-Groove-Trainer", images: [`${origin}/og-drums.png`] },
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
