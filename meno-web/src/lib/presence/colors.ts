const PALETTE = [
  "#B47538",
  "#3A6B9C",
  "#7D4F8D",
  "#3B8F6B",
  "#B84E4E",
  "#CE8F2B",
  "#4A5F8A",
  "#6D7F39",
];

export const pickPresenceColor = (used: Set<string>): string => {
  for (const color of PALETTE) {
    if (!used.has(color)) {
      return color;
    }
  }
  // Fallback: rotate palette to avoid duplicates with same ordering
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
};
