import type React from "react";

// Deterministic tag color picker. Same name -> same palette across sessions.
// Uses HSL tokens directly so it works in light/dark themes.

type Palette = {
  bg: string;
  text: string;
  border: string;
};

// Curated palette set — soft background + bold text + matching border.
const PALETTES: Palette[] = [
  { bg: "hsl(222 90% 95%)", text: "hsl(222 76% 36%)", border: "hsl(222 76% 80%)" }, // blue
  { bg: "hsl(152 70% 92%)", text: "hsl(152 62% 28%)", border: "hsl(152 50% 70%)" }, // green
  { bg: "hsl(38 95% 92%)",  text: "hsl(30 80% 32%)",  border: "hsl(38 80% 70%)"  }, // amber
  { bg: "hsl(280 75% 95%)", text: "hsl(280 60% 38%)", border: "hsl(280 55% 78%)" }, // purple
  { bg: "hsl(340 85% 95%)", text: "hsl(340 70% 40%)", border: "hsl(340 70% 80%)" }, // pink
  { bg: "hsl(190 80% 92%)", text: "hsl(195 80% 28%)", border: "hsl(190 65% 70%)" }, // cyan
  { bg: "hsl(15 85% 93%)",  text: "hsl(12 75% 38%)",  border: "hsl(15 75% 75%)"  }, // coral
  { bg: "hsl(255 80% 95%)", text: "hsl(250 65% 42%)", border: "hsl(255 60% 80%)" }, // indigo
  { bg: "hsl(85 65% 90%)",  text: "hsl(95 55% 28%)",  border: "hsl(85 50% 65%)"  }, // lime
  { bg: "hsl(220 12% 92%)", text: "hsl(220 18% 30%)", border: "hsl(220 14% 75%)" }, // slate
];

// Brand-ish overrides for known operadoras.
const BRAND: Record<string, Palette> = {
  amil: { bg: "hsl(208 90% 93%)", text: "hsl(208 85% 32%)", border: "hsl(208 75% 72%)" },
  bradesco: { bg: "hsl(0 85% 94%)", text: "hsl(0 75% 38%)", border: "hsl(0 70% 78%)" },
  "porto seguro": { bg: "hsl(212 80% 93%)", text: "hsl(212 80% 32%)", border: "hsl(212 70% 72%)" },
  porto: { bg: "hsl(212 80% 93%)", text: "hsl(212 80% 32%)", border: "hsl(212 70% 72%)" },
  "sulamerica": { bg: "hsl(28 90% 92%)", text: "hsl(22 85% 36%)", border: "hsl(28 80% 72%)" },
  "sulamérica": { bg: "hsl(28 90% 92%)", text: "hsl(22 85% 36%)", border: "hsl(28 80% 72%)" },
  "assim saúde": { bg: "hsl(150 60% 90%)", text: "hsl(155 70% 26%)", border: "hsl(150 55% 65%)" },
  "assim saude": { bg: "hsl(150 60% 90%)", text: "hsl(155 70% 26%)", border: "hsl(150 55% 65%)" },
  assim: { bg: "hsl(150 60% 90%)", text: "hsl(155 70% 26%)", border: "hsl(150 55% 65%)" },
  medsenior: { bg: "hsl(265 70% 94%)", text: "hsl(265 60% 40%)", border: "hsl(265 55% 78%)" },
  unimed: { bg: "hsl(140 65% 90%)", text: "hsl(145 70% 26%)", border: "hsl(140 55% 65%)" },
  hapvida: { bg: "hsl(195 80% 92%)", text: "hsl(200 85% 30%)", border: "hsl(195 70% 70%)" },
  notredame: { bg: "hsl(215 75% 93%)", text: "hsl(215 75% 34%)", border: "hsl(215 65% 74%)" },
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getTagColor(name?: string | null): Palette {
  if (!name) return PALETTES[PALETTES.length - 1];
  const key = name.trim().toLowerCase();
  if (BRAND[key]) return BRAND[key];
  // Try partial match (e.g. "Amil 400" -> "amil")
  for (const k of Object.keys(BRAND)) {
    if (key.includes(k)) return BRAND[k];
  }
  return PALETTES[hash(key) % PALETTES.length];
}

// Fixed palette per tipo de contrato.
const TIPO_COLORS: Record<string, Palette> = {
  PF: { bg: "hsl(222 90% 95%)", text: "hsl(222 76% 36%)", border: "hsl(222 76% 80%)" },
  PJ: { bg: "hsl(280 75% 95%)", text: "hsl(280 60% 38%)", border: "hsl(280 55% 78%)" },
  Adesao: { bg: "hsl(38 95% 92%)", text: "hsl(30 80% 32%)", border: "hsl(38 80% 70%)" },
};

export function getTipoColor(tipo?: string | null): Palette {
  if (tipo && TIPO_COLORS[tipo]) return TIPO_COLORS[tipo];
  return PALETTES[0];
}

export function tagStyle(p: Palette): React.CSSProperties {
  return {
    backgroundColor: p.bg,
    color: p.text,
    borderColor: p.border,
  };
}