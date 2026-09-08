import type { Metadata } from "next";
import MetronomeApp from "./metronome-app";

export const metadata: Metadata = {
  description:
    "571 Drum-Patterns, adaptive Sessions, Lernleitern, Gap Click und vollständige Scenes — privat, präzise und offline.",
};

export default function Home() {
  return <MetronomeApp />;
}
