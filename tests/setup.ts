import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import React from "react";

export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() };
export const nav = { pathname: "/", params: {} as Record<string, string>, search: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.search,
  useParams: () => nav.params,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => {
    void _p;
    return React.createElement("a", { href, ...rest }, children);
  },
}));

afterEach(() => {
  cleanup();
  // Server-side tests run in the node environment, without web storage.
  globalThis.localStorage?.clear();
  globalThis.sessionStorage?.clear();
  router.push.mockClear();
  router.replace.mockClear();
});
