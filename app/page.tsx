import type { Metadata } from "next";
import MetronomeApp from "./metronome-app";

export const metadata: Metadata = {
  title: "Klangmaß — Lokaler Übecoach",
  description:
    "200 Drum-Grooves, adaptive Sessions, Lernleitern, Gap Click und vollständige Scenes — privat, präzise und offline.",
};

export default function Home() {
  return <MetronomeApp />;
}
