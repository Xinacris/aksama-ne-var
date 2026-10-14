import type { SVGProps } from "react";

/** Inline stroke icons copied from design/*.dc.html. */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; strokeWidth?: number };

function Svg({ size = 22, strokeWidth = 1.8, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconSnowflake = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2v20M4.9 6l14.2 12M19.1 6L4.9 18M9 4l3 2 3-2M9 20l3-2 3 2" />
  </Svg>
);
/** Small snowflake without the end ticks (board freezer marker). */
export const IconSnowflakeSmall = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M12 2v20M4.9 6l14.2 12M19.1 6L4.9 18" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);
export const IconLeftover = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M3 6h18v3H3z" />
    <path d="M10 13h4" />
  </Svg>
);
export const IconCutlery = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1.5-3 4-3 7h3v11" />
  </Svg>
);
export const IconSwap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </Svg>
);
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconCards = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="7" width="12" height="14" rx="2" />
    <path d="M8 4h11a2 2 0 0 1 2 2v12" />
  </Svg>
);
export const IconBasket = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9h18l-2 10a2 2 0 0 1-2 1.6H7A2 2 0 0 1 5 19z" />
    <path d="M8 9l3-6M16 9l-3-6" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg strokeWidth={1.9} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconHistory = (p: IconProps) => (
  <Svg strokeWidth={1.9} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export function IconHeart({ size = 22, ...p }: Omit<IconProps, "strokeWidth">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}
export const IconHeartOutline = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconGrip = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconMessage = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
  </Svg>
);
export const IconMore = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </Svg>
);
export const IconImport = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M4 20h16" />
  </Svg>
);
export const IconSync = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v4h-4" />
  </Svg>
);
export const IconOffline = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" />
    <path d="M4 4l16 16" />
  </Svg>
);
export const IconEmptyPlate = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
  </Svg>
);
/** Derived in the same stroke language: gear for settings. */
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </Svg>
);
/** Derived: open book for recipes. */
export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2z" />
    <path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);
export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M5 12h14" />
  </Svg>
);
