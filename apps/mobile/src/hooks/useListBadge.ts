import { useMemo } from "react";
import { selectList, useApp } from "@/store";

/** Unchecked items on the shopping list (the Liste tab badge). */
export function useListBadge(): number {
  const state = useApp();
  return useMemo(() => selectList(state).filter((r) => !r.checkedBy).length, [state]);
}
