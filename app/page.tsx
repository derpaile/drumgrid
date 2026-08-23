import type { Metadata } from "next";
import MetronomeApp from "./metronome-app";

export const metadata: Metadata = {
  title: "Klangmaß — Drum-Groove-Trainer",
  description:
    "Kuratierte Drum-Grooves mit kompakten Sample-Kits — präzise, installierbar und vollständig offline.",
};

export default function Home() {
  return <MetronomeApp />;
}
