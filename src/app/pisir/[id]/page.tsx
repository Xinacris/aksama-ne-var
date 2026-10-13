"use client";

import { useParams } from "next/navigation";
import { CookingMode } from "@/components/cooking/CookingMode";
import { cookingExtras, useWakeLock } from "@/components/cooking/extras";
import { Guard } from "@/components/Guard";

/**
 * Cooking mode: `/pisir/<YYYY-MM-DD>` for an evening's menu, `/pisir/<recipe id>`
 * for a single recipe. Full screen, outside the app shell (no tab bar);
 * the screen stays on while it is open.
 */
export default function PisirPage() {
  const { id } = useParams<{ id: string }>();
  useWakeLock();
  return (
    <Guard need="household">
      <CookingMode id={id} extras={cookingExtras} />
    </Guard>
  );
}
