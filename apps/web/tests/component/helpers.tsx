import { createMemoryData, type DataContext } from "@/data";
import { setNow } from "@anv/core/lib/clock";
import { useApp, setDataContext } from "@/store/app";

/** Fresh in-memory data + store, optionally with the demo household loaded. */
export async function freshStore(opts: { demo?: boolean; at?: Date } = {}): Promise<DataContext> {
  setNow(opts.at ?? new Date(2026, 9, 12, 8, 45));
  const d = createMemoryData();
  setDataContext(d);
  useApp.setState({ status: "booting", me: null, household: null, notice: null, presence: {} });
  if (opts.demo) await useApp.getState().loadDemo();
  else await useApp.getState().refresh();
  return d;
}

export async function soloUser(name = "Ali"): Promise<void> {
  await useApp.getState().signUp({ name, email: `${name.toLowerCase()}@ornek.com`, password: "123456" });
  await useApp.getState().createHousehold();
  await useApp.getState().refresh();
}
