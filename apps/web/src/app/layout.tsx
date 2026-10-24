import type { Metadata, Viewport } from "next";
import { Figtree, Young_Serif } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { LocaleProvider } from "@/i18n";
import { themeBootScript } from "@/lib/themeBoot";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  subsets: ["latin", "latin-ext"],
  weight: "400",
});

// Title and description are rendered by the locale provider (`DocumentTitle`, src/i18n.tsx), so they
// follow the language; the server render is Turkish.
export const metadata: Metadata = {
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4ECDF" },
    { media: "(prefers-color-scheme: dark)", color: "#1B1612" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${figtree.variable} ${youngSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <AppProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </AppProvider>
      </body>
    </html>
  );
}
