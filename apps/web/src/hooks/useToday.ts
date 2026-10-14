"use client";

import { useMemo } from "react";
import { buildToday, type TodayModel } from "@anv/core/domain/today";
import { useApp } from "@/store/app";

export { approvalPill, recipeTime, type TodayModel } from "@anv/core/domain/today";

export function useToday(): TodayModel {
  const state = useApp();
  return useMemo(() => buildToday(state), [state]);
}
