import type { Metadata, Viewport } from "next";
import globalStyles from "./globals.css?inline";

export async function generateMetadata(): Promise<Metadata> {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = configuredOrigin && /^https?:\/\//.test(configuredOrigin)
    ? new URL(configuredOrigin).origin
    : "http://localhost:3000";
  return {
    metadataBase: new URL(origin),
    title: { default: "drumgrid — Drum Practice Workstation", template: "%s · drumgrid" },
    description: "200 Drum-Grooves, adaptive Sessions, Lernleitern und Gap Click — privat, präzise und offline.",
    applicationName: "drumgrid",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "drumgrid" },
    formatDetection: { telephone: false },
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    openGraph: {
      type: "website",
      locale: "de_DE",
      title: "drumgrid — Drum Practice Workstation",
      description: "200 Drum-Grooves, adaptive Sessions, Lernleitern und Gap Click. Privat, präzise und offline.",
      images: [{ url: `${origin}/og-drums.png`, width: 1731, height: 909, alt: "drumgrid Drum Practice Workstation" }],
    },
    twitter: { card: "summary_large_image", title: "drumgrid — Drum Practice Workstation", images: [`${origin}/og-drums.png`] },
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
