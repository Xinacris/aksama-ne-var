/**
 * Icon geometry from design/*.dc.html as plain data (24×24, round stroke).
 * The web draws the same shapes as inline SVG (apps/web/src/components/icons.tsx);
 * the phone renders this data with react-native-svg.
 */
export type IconShape =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number };

export interface IconDef {
  strokeWidth?: number;
  /** Filled instead of stroked (the solid heart). */
  fill?: boolean;
  shapes: IconShape[];
}

const p = (d: string): IconShape => ({ kind: "path", d });

export const ICONS = {
  home: { shapes: [p("M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z")] },
  cards: { shapes: [{ kind: "rect", x: 3, y: 7, width: 12, height: 14, rx: 2 }, p("M8 4h11a2 2 0 0 1 2 2v12")] },
  basket: { shapes: [p("M3 9h18l-2 10a2 2 0 0 1-2 1.6H7A2 2 0 0 1 5 19z"), p("M8 9l3-6M16 9l-3-6")] },
  calendar: { shapes: [{ kind: "rect", x: 3, y: 5, width: 18, height: 16, rx: 2 }, p("M3 10h18M8 3v4M16 3v4")] },
  book: { shapes: [p("M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2z"), p("M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z")] },
  settings: {
    shapes: [
      { kind: "circle", cx: 12, cy: 12, r: 3 },
      p("M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"),
    ],
  },
  snowflake: { shapes: [p("M12 2v20M4.9 6l14.2 12M19.1 6L4.9 18M9 4l3 2 3-2M9 20l3-2 3 2")] },
  check: { strokeWidth: 2.2, shapes: [p("M5 12.5l4.5 4.5L19 7.5")] },
  arrowRight: { strokeWidth: 2, shapes: [p("M5 12h14M13 6l6 6-6 6")] },
  chevronLeft: { strokeWidth: 2, shapes: [p("M15 5l-7 7 7 7")] },
  chevronRight: { strokeWidth: 2, shapes: [p("M9 5l7 7-7 7")] },
  leftover: { shapes: [p("M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"), p("M3 6h18v3H3z"), p("M10 13h4")] },
  cutlery: { shapes: [p("M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1.5-3 4-3 7h3v11")] },
  swap: { shapes: [p("M4 8h13l-3-3M20 16H7l3 3")] },
  clock: { strokeWidth: 1.9, shapes: [{ kind: "circle", cx: 12, cy: 12, r: 9 }, p("M12 7v5l3 2")] },
  close: { strokeWidth: 2.2, shapes: [p("M6 6l12 12M18 6L6 18")] },
  heart: { fill: true, shapes: [p("M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z")] },
  heartOutline: { strokeWidth: 2, shapes: [p("M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z")] },
  plus: { strokeWidth: 2, shapes: [p("M12 5v14M5 12h14")] },
  minus: { strokeWidth: 2, shapes: [p("M5 12h14")] },
  search: { strokeWidth: 2, shapes: [{ kind: "circle", cx: 11, cy: 11, r: 7 }, p("M20 20l-4-4")] },
  link: { strokeWidth: 2, shapes: [p("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"), p("M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1")] },
  more: { strokeWidth: 3, shapes: [p("M5 12h.01M12 12h.01M19 12h.01")] },
  import: { strokeWidth: 2, shapes: [p("M12 4v11M7 10l5 5 5-5M4 20h16")] },
  emptyPlate: { strokeWidth: 1.6, shapes: [{ kind: "circle", cx: 12, cy: 12, r: 8.5 }, { kind: "circle", cx: 12, cy: 12, r: 4.5 }] },
  trash: { shapes: [p("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13")] },
  edit: { shapes: [p("M4 20h4L19 9l-4-4L4 16z"), p("M13 7l4 4")] },
  history: { strokeWidth: 1.9, shapes: [p("M3 12a9 9 0 1 0 3-6.7L3 8"), p("M3 3v5h5")] },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
