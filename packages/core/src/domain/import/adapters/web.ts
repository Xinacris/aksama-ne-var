import { pageMeta, readSchemaOrgRecipe } from "../schemaOrg";
import { SourceUnavailableError, type SourceAdapter } from "./types";

const MAX_HTML = 1_500_000;

/** Any other site: read its schema.org/Recipe JSON-LD. Recipe-site partnerships start here. */
export const webAdapter: SourceAdapter = {
  platform: "web",
  async fetchSource(url, ctx) {
    let res: Response;
    try {
      res = await ctx.fetch(url, {
        signal: ctx.signal,
        redirect: "follow",
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "AksamaNeVar/1.0 (+recipe import; reads schema.org/Recipe)" },
      });
    } catch {
      throw new SourceUnavailableError("web", "unreachable");
    }
    if (!res.ok) throw new SourceUnavailableError("web", `status ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml/i.test(type)) throw new SourceUnavailableError("web", "not html");
    const html = (await res.text()).slice(0, MAX_HTML);
    const found = readSchemaOrgRecipe(html);
    const meta = pageMeta(html);
    const host = new URL(url).hostname.replace(/^www\./, "");
    return {
      platform: "web",
      url,
      title: found?.recipe.name ?? meta.title,
      text: null,
      author: found?.author ?? meta.siteName ?? host,
      thumbnailUrl: found?.image ?? meta.image,
      needsPaste: !found || found.recipe.ingredients.length === 0,
      siteName: meta.siteName ?? host,
      recipe: found?.recipe ?? null,
    };
  },
};
