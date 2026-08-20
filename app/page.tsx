import type { Metadata } from "next";
import MetronomeApp from "./metronome-app";

export const metadata: Metadata = {
  title: "Klangmaß — Präzises Metronom",
  description:
    "Ein präzises, vollständig offline nutzbares Metronom mit kuratierter Pattern-Bibliothek.",
};

export default function Home() {
  return <MetronomeApp />;
}
