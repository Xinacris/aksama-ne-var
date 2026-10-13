"use client";

import { useParams } from "next/navigation";
import { CookingMode } from "@/components/cooking/CookingMode";
import { Guard } from "@/components/Guard";

/**
 * Cooking mode: `/pisir/<YYYY-MM-DD>` for an evening's menu, `/pisir/<recipe id>`
 * for a single recipe. Full screen, outside the app shell (no tab bar).
 */
export default function PisirPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Guard need="household">
      <CookingMode id={id} />
    </Guard>
  );
}
