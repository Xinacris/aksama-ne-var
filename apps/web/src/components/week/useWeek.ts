"use client";

import { useMemo } from "react";
import { buildWeek, type WeekModel } from "@anv/core/domain/week";
import { useApp } from "@/store/app";

export type { AsideMatch, DayModel, SlotCell, WeekModel } from "@anv/core/domain/week";

export function useWeek(offsetWeeks: number): WeekModel {
  const st = useApp();
  return useMemo(() => buildWeek(st, offsetWeeks), [st, offsetWeeks]);
}
