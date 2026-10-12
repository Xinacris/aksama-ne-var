"use client";

import { Guard } from "@/components/Guard";

export default function Page() {
  return (
    <Guard need="auth">
      <main style={{ padding: "22px 20px" }}>
        <h1 className="serif">Adım 2 / 2</h1>
      </main>
    </Guard>
  );
}
