/**
 * Design tokens as plain values (design/*.dc.html). The web app uses the same
 * values as CSS variables in apps/web/src/app/globals.css (a core test keeps
 * them equal); the phone app reads them from here.
 */
export const palette = {
  light: {
    bg: "#f4ecdf",
    surface: "#fffaf2",
    surface2: "#ede2cf",
    ink: "#2a2119",
    ink2: "#685846",
    line: "#e0d1ba",
    tomato: "#b33a25",
    onTomato: "#ffffff",
    tomatoSoft: "#f5dcd2",
    olive: "#55612a",
    oliveSoft: "#e2e5cb",
    sand: "#8a6630",
    sandSoft: "#f0e1c2",
    /** Web: color-mix(sand 82 %, ink) — sand text on sand-soft needs that contrast (WCAG AA). */
    sandText: "#79592c",
    leftoverLink: "#7a8a3a",
    shadowInk: "#2a2119",
  },
  dark: {
    bg: "#1b1612",
    surface: "#261f19",
    surface2: "#30281f",
    ink: "#f2e8d9",
    ink2: "#b8a68e",
    line: "#3a3027",
    tomato: "#e5735b",
    onTomato: "#1b1612",
    tomatoSoft: "#3b241d",
    olive: "#b3bf78",
    oliveSoft: "#2b2f1e",
    sand: "#d8b57c",
    sandSoft: "#362c1e",
    sandText: "#d8b57c",
    leftoverLink: "#7a8a3a",
    shadowInk: "#000000",
  },
} as const;

export type ThemeName = keyof typeof palette;
export type Palette = { [K in keyof (typeof palette)["light"]]: string };

/** 4-pt spacing scale (px / pt). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, field: 16, sheet: 24, card: 24, pill: 999 } as const;

/** Minimum touch target (Apple HIG 44 pt; the web uses 44 px). */
export const touchTarget = 44;

/** Fonts: Young Serif for headings, Figtree for everything else. */
export const fonts = {
  serif: "YoungSerif_400Regular",
  sans: "Figtree_400Regular",
  sansMedium: "Figtree_500Medium",
  sansSemibold: "Figtree_600SemiBold",
  sansBold: "Figtree_700Bold",
} as const;

/** Type scale (size / line height), same steps as the web CSS. */
export const type = {
  display: { size: 34, line: 38 },
  title: { size: 30, line: 34 },
  h2: { size: 24, line: 28 },
  h3: { size: 21, line: 26 },
  body: { size: 16, line: 22 },
  bodySmall: { size: 15, line: 21 },
  meta: { size: 13.5, line: 19 },
  small: { size: 13, line: 18 },
  eyebrow: { size: 12, line: 16, letterSpacing: 0.96 },
  tab: { size: 12, line: 15 },
} as const;
