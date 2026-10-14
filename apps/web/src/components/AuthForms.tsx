"use client";

import { useState, type FormEvent } from "react";
import { messageOf } from "@anv/core/services/errors";
import { useApp } from "@/store/app";
import { Button } from "./ui/Button";
import { TextField } from "./ui/Field";
import { shell } from "./SimpleShell";

export function SignUpForm({ onDone, submitLabel = "Hesap oluştur" }: { onDone: () => void | Promise<void>; submitLabel?: string }) {
  const signUp = useApp((s) => s.signUp);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp({ name, email, password });
      await onDone();
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  return (
    <form className={shell.form} onSubmit={submit} noValidate>
      <TextField label="Adın" name="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
      <TextField
        label="E-posta"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <TextField
        label="Şifre"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="En az 6 karakter. Bu bir demo; şifren yalnızca bu tarayıcıda, karıştırılmış olarak durur."
        required
      />
      {error && (
        <p role="alert" style={{ margin: 0, color: "var(--tomato)", fontWeight: 600, fontSize: 14.5 }}>
          {error}
        </p>
      )}
      <Button type="submit" size="xl" block disabled={busy}>
        {busy ? "Hazırlanıyor…" : submitLabel}
      </Button>
    </form>
  );
}

export function LogInForm({ onDone }: { onDone: () => void | Promise<void> }) {
  const logIn = useApp((s) => s.logIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await logIn({ email, password });
      await onDone();
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  return (
    <form className={shell.form} onSubmit={submit} noValidate>
      <TextField
        label="E-posta"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <TextField
        label="Şifre"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && (
        <p role="alert" style={{ margin: 0, color: "var(--tomato)", fontWeight: 600, fontSize: 14.5 }}>
          {error}
        </p>
      )}
      <Button type="submit" size="xl" block disabled={busy}>
        {busy ? "Giriliyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
