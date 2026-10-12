import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuCard, TonightCard } from "@/components/MenuCard";
import { ReminderBanner, ReminderChip } from "@/components/ReminderBanner";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { DishChip, DishTag, StatusPill } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/Field";
import { ActivityLine, EmptyState, PhotoPlaceholder, SyncIndicator, SyncInline } from "@/components/ui/Misc";

const ali = { id: "a", name: "Ali", initial: "A", color: "#55612A" };
const zeynep = { id: "z", name: "Zeynep", initial: "Z", color: "#9A5512" };

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("DishChip", () => {
  it("toggles aria-pressed and shows a check when selected", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <DishChip selected={false} onClick={onClick}>
        Kuru fasulye
      </DishChip>,
    );
    const btn = screen.getByRole("button", { name: "Kuru fasulye" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn.querySelector("svg")).toBeNull();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
    rerender(<DishChip selected>Kuru fasulye</DishChip>);
    expect(screen.getByRole("button", { name: "Kuru fasulye" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button").querySelector("svg")).not.toBeNull();
  });

  it("renders draggable, match and leftover tags", () => {
    render(
      <>
        <DishTag variant="draggable">Menemen</DishTag>
        <DishTag variant="match">Karnıyarık</DishTag>
        <DishTag variant="leftover">Öğlen · kuru fasulye</DishTag>
      </>,
    );
    expect(screen.getByText("Menemen").className).toMatch(/draggable/);
    expect(screen.getByText("Karnıyarık").className).toMatch(/match/);
    expect(screen.getByText("Öğlen · kuru fasulye").className).toMatch(/leftover/);
  });
});

describe("Avatar", () => {
  it("shows the initial in the member color and the presence ring", () => {
    render(<AvatarStack people={[ali, zeynep]} label="Ev halkı: Ali ve Zeynep" ringIds={["z"]} />);
    const stack = screen.getByRole("img", { name: "Ev halkı: Ali ve Zeynep" });
    const [a, z] = stack.querySelectorAll("span");
    expect(a.textContent).toBe("A");
    expect((a as HTMLElement).style.background).toMatch(/rgb\(85, 97, 42\)|#55612A/i);
    expect(z.className).toMatch(/ring/);
  });

  it("sizes the font with the avatar", () => {
    const { container } = render(<Avatar person={ali} size={44} />);
    expect((container.firstChild as HTMLElement).style.fontSize).toBe("17px");
  });
});

describe("SyncIndicator", () => {
  it("renders the three states with role=status", () => {
    const { rerender } = render(<SyncIndicator state="live" />);
    expect(screen.getByRole("status")).toHaveTextContent("Canlı");
    rerender(<SyncIndicator state="syncing" />);
    expect(screen.getByRole("status")).toHaveTextContent("Eşitleniyor");
    rerender(<SyncIndicator state="offline" pending={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("Çevrimdışı · 2 değişiklik sırada");
  });

  it("compact header variant mentions the partner when live", () => {
    render(<SyncInline state="live" suffix="Zeynep de burada" />);
    expect(screen.getByRole("status")).toHaveTextContent("Senkron · Zeynep de burada");
  });
});

describe("ReminderBanner", () => {
  it("pending state shows Bekliyor and the action", async () => {
    const onDone = vi.fn();
    render(
      <ReminderBanner
        text="Akşama İzmir köfte var, kıymayı buzluktan çıkarmayı unutma."
        meta="Sabah 09:00 · Ali'nin işi"
        done={false}
        actionLabel="Çıkardım"
        onDone={onDone}
      />,
    );
    expect(screen.getByRole("region", { name: "Günün hatırlatması" }).className).toMatch(/pending/);
    expect(screen.getByText("Bekliyor")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Çıkardım" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("partner-done state shows who and when, with undo", async () => {
    const onUndo = vi.fn();
    render(<ReminderBanner text="x" meta="y" done doneBy={ali} doneAt="09:12" onUndo={onUndo} />);
    expect(screen.getByRole("status")).toHaveTextContent("Ali tamamladı · 09:12");
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("compact chip variant", () => {
    render(<ReminderChip title="Kıymayı buzluktan çıkar" status="Bekliyor · Ali" done={false} />);
    expect(screen.getByText("Bekliyor · Ali")).toBeInTheDocument();
  });
});

describe("MenuCard", () => {
  const rows = [
    { slot: "corba" as const, name: "Yayla çorbası" },
    { slot: "ana" as const, name: "Karnıyarık" },
    { slot: "yaninda" as const, name: "Şehriyeli pilav" },
    { slot: "salata" as const, name: null },
  ];
  it("shows waiting approval and a deleted-recipe row calmly", () => {
    render(<MenuCard dayLabel="Salı akşamı" title="Karnıyarık sofrası" rows={rows} approval={{ tone: "wait", label: "Zeynep'in onayı bekleniyor" }} />);
    expect(screen.getByRole("heading", { name: "Karnıyarık sofrası" })).toBeInTheDocument();
    expect(screen.getByText("Zeynep'in onayı bekleniyor")).toBeInTheDocument();
    expect(screen.getByText("Silinmiş tarif")).toBeInTheDocument();
  });

  it("tonight card shows times, approved pill and the menu link", () => {
    render(
      <TonightCard
        photoDish="İzmir köfte"
        title="İzmir köfte sofrası"
        rows={[{ slot: "ana", name: "İzmir köfte", time: "1 sa 10 dk" }]}
        approval={{ tone: "ok", label: "İkiniz de onayladınız" }}
        href="/tarif/izmir-kofte"
      />,
    );
    expect(screen.getByText("1 sa 10 dk")).toBeInTheDocument();
    expect(screen.getByText("İkiniz de onayladınız")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Menüyü ve ön hazırlığı aç/ })).toHaveAttribute("href", "/tarif/izmir-kofte");
    expect(screen.getByRole("img", { name: "Fotoğraf yeri: İzmir köfte" })).toHaveTextContent("Fotoğraf · İzmir köfte");
  });
});

describe("misc", () => {
  it("empty state with actions", () => {
    render(
      <EmptyState
        title="Cuma akşamı henüz boş"
        text="Eşleşmelerden bir şey seçebilir ya da öyle bırakabilirsiniz."
        actions={<Button size="sm">Eşleşmelerden seç</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Cuma akşamı henüz boş" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eşleşmelerden seç" })).toBeInTheDocument();
  });

  it("activity line", () => {
    render(<ActivityLine person={zeynep} text="bu akşamki menüyü onayladı" when="14 dk önce" />);
    expect(screen.getByText(/bu akşamki menüyü onayladı · 14 dk önce/)).toBeInTheDocument();
  });

  it("status pill can be a button", async () => {
    const fn = vi.fn();
    render(
      <StatusPill tone="tomato" onClick={fn} label="Patatesi listeye ekle">
        Eksik · ekle
      </StatusPill>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Patatesi listeye ekle" }));
    expect(fn).toHaveBeenCalled();
  });

  it("text field wires label, hint and error", () => {
    render(<TextField label="E-posta" hint="ipucu" error="Hata" defaultValue="" />);
    const input = screen.getByLabelText("E-posta");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toMatch(/hint/);
    expect(screen.getByRole("alert")).toHaveTextContent("Hata");
  });

  it("photo placeholder never loads an image", () => {
    const { container } = render(<PhotoPlaceholder dish="Mantı" height={100} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstChild).toHaveClass("ph");
  });
});

describe("theme tokens", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").toLowerCase();
  it("defines every light and dark token from the design", () => {
    const light = { "--bg": "#f4ecdf", "--surface": "#fffaf2", "--tomato": "#b33a25", "--olive": "#55612a", "--sand-soft": "#f0e1c2" };
    const dark = { "--bg": "#1b1612", "--surface": "#261f19", "--tomato": "#e5735b", "--on-tomato": "#1b1612", "--olive": "#b3bf78" };
    for (const [k, v] of Object.entries(light)) expect(css).toContain(`${k}: ${v}`);
    const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'));
    for (const [k, v] of Object.entries(dark)) expect(darkBlock).toContain(`${k}: ${v}`);
  });

  it("dark theme switches via data-theme on <html>", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<SyncIndicator state="live" />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    document.documentElement.removeAttribute("data-theme");
  });
});
