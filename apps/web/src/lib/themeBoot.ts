import { THEME_STORAGE_KEY } from "@anv/core/lib/theme";

/**
 * Inline script executed before first paint so the theme never flashes.
 * It is the only code outside src/data that reads storage, because it must
 * run before React hydrates (see docs/DECISIONS.md).
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=p==="dark"||((p===null||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;
