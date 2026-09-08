export const STYLE_FAMILIES = [
  { id: "rock-heavy", label: "Rock & Heavy", categories: ["Rock & Pop", "Punk & Metal", "Progressive & Heavy"] },
  { id: "funk-soul", label: "Funk, Soul & R&B", categories: ["Funk & Soul", "R&B & Gospel"] },
  { id: "hiphop-down", label: "Hip-Hop & Downtempo", categories: ["Hip-Hop", "Old School Hip-Hop", "Trip-Hop & Downtempo"] },
  { id: "electronic", label: "Electronic & Breakbeat", categories: ["Dance & Electronic", "Jungle & Drum and Bass"] },
  { id: "jazz-roots", label: "Jazz, Blues & Americana", categories: ["Jazz", "Blues & Shuffle", "Country & Americana"] },
  { id: "global", label: "Latin, Reggae & World", categories: ["Latin & World", "Reggae"] },
  { id: "cross", label: "Querbeet", categories: ["Genreübergreifend"] },
] as const;

export const patternStyleFamily = (category: string) => STYLE_FAMILIES.find(family => (family.categories as readonly string[]).includes(category))?.id || "cross";
