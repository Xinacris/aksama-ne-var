import { t } from "@anv/core/i18n";
import { PLATFORM_LABEL, type SourcePlatform } from "@anv/core/data/models";
import { IconImport } from "./icons";
import s from "./ImportSourceCard.module.css";

export interface SourceInfo {
  platform: SourcePlatform;
  url: string;
  author: string | null;
  title: string | null;
  thumbnailUrl: string | null;
}

export { sourceCredit } from "@anv/core/services/importDraft";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Link card on the import screen: platform, creator, link and the platform's thumbnail when it gives one. */
export function ImportSourceCard({ source }: { source: SourceInfo }) {
  return (
    <section className={s.card} aria-label={t("import.source")}>
      {source.thumbnailUrl ? (
        // The creator's own thumbnail from the platform's oEmbed; not a stock photo.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source.thumbnailUrl} alt="" className={s.thumb} referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        <span className={s.icon} aria-hidden="true">
          <IconImport size={22} />
        </span>
      )}
      <span className={s.texts}>
        <span className={s.platform}>{PLATFORM_LABEL[source.platform]}</span>
        <strong className={s.author}>{source.author ?? hostOf(source.url)}</strong>
        {source.title && <span className={s.title}>{source.title}</span>}
      </span>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className={s.link}>
        {t("import.open")}
        <span className="visually-hidden">{t("import.openNewTab")}</span>
      </a>
    </section>
  );
}
