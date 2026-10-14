import { createMemoryData } from "@anv/core/data/context";
import { setLocale, type Locale } from "@anv/core/i18n";
import { setNow } from "@anv/core/lib/clock";
import { appStore, setDataContext } from "@anv/core/store/app";

/** In-memory data + store, optionally with the demo household, pinned to the design's Monday morning. */
export async function freshStore(opts: { demo?: boolean; locale?: Locale } = {}) {
  setNow(new Date(2026, 9, 12, 8, 45));
  setLocale(opts.locale ?? "tr");
  const d = createMemoryData();
  setDataContext(d);
  appStore.setState({ status: "booting", me: null, household: null, notice: null, presence: {} });
  if (opts.demo) await appStore.getState().loadDemo();
  else await appStore.getState().refresh();
  return d;
}

export function routerMock() {
  return jest.requireMock("expo-router") as { router: { push: jest.Mock; replace: jest.Mock; back: jest.Mock }; __params: { current: Record<string, string> } };
}
