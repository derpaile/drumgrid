import type { Metadata } from "next";
import MetronomeApp from "./metronome-app";

export const metadata: Metadata = {
  title: "Klangmaß — Drum-Groove-Trainer",
  description:
    "47 kuratierte Drum-Grooves mit synthetischen Drumkits — präzise, installierbar und vollständig offline.",
};

export default function Home() {
  return <MetronomeApp />;
}
