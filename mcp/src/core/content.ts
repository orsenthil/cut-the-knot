/*
 * The site's content, as the server sees it.
 *
 * scripts/build-index.mjs turns the site into src/generated/ before every
 * build; this module loads that, gives it types, and holds the few helpers
 * every tool needs: a game as markdown, a game as searchable text, and the
 * two shapes of tool result.
 */

// Generated at build time by scripts/build-index.mjs.
import content from "../generated/content.json";
// Generated at build time by scripts/build-index.mjs.
import manifest from "../generated/manifest.json";
import { ACTIONS } from "../games/registry.js";

export interface Game {
  slug: string;
  title: string;
  blurb: string;
  tags: string[];
  /** Concepts the game also illustrates; not shown on its page, but it belongs to them. */
  hiddenTags: string[];
  /** 1 (anyone can start here) to 3. */
  level: number;
  /** "game" can be won or lost; "demo" is something to explore. */
  kind: string;
  url: string;
  ctkUrl: string | null;
  applet: string | null;
  rules: { lead: string; leadLabel: string; howToPlay: string; text: string } | null;
  math: { intro: string; sections: { heading: string; body: string }[]; tip: string | null } | null;
  wikiTerms: { page: string; label: string; url: string }[];
  scripts: { name: string; path: string; isCore: boolean; source: string }[];
}

export interface Applet {
  name: string;
  archive: string | null;
  kind: string;
  priority: number;
  ctkUrl: string | null;
  slug: string | null;
  status: string;
  notes: string;
}

export const games: Game[] = content.games;
export const tags: Record<string, string> = content.tags;
/** The concept graph (assets/concepts.js): each tag's prerequisites. */
export const concepts: Record<string, { prereqs: string[] }> = content.concepts;
export const applets: Applet[] = manifest.applets;

export const bySlug = new Map(games.map((g) => [g.slug, g]));

/* ------------------------------------------------------------- formatting */

export const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export const fail = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

/** Every concept a game belongs to: its shown tags, then its hidden ones. */
export const allTags = (g: Game): string[] => g.tags.concat(g.hiddenTags ?? []);

/** A game as prose: what the tutor actually wants to read. */
export function gameMarkdown(g: Game, { withSource = false } = {}): string {
  const out: string[] = [`# ${g.title}`, "", g.blurb, ""];
  out.push(`- Play: ${g.url}`);
  if (g.ctkUrl) out.push(`- Original: ${g.ctkUrl}`);
  if (g.applet) out.push(`- Applet: ${g.applet} in classes.zip`);
  out.push(`- Concepts: ${allTags(g).map((t) => tags[t] ?? t).join(", ")}`);
  out.push("");

  if (g.rules) {
    out.push("## Rules", "", `**${g.rules.leadLabel}:** ${g.rules.lead}`, "", `**How to play:** ${g.rules.howToPlay}`, "");
  }

  if (g.math) {
    out.push("## The maths", "", g.math.intro, "");
    for (const s of g.math.sections) out.push(`### ${s.heading}`, "", s.body, "");
    if (g.math.tip) out.push(`*Try this:* ${g.math.tip}`, "");
  }

  if (g.wikiTerms.length) {
    out.push("## Named concepts", "");
    for (const w of g.wikiTerms) out.push(`- ${w.label} — ${w.url}`);
    out.push("");
  }

  if (ACTIONS[g.slug]) {
    out.push(
      "## Runnable logic",
      "",
      `This game's real code can be called with run_game_logic("${g.slug}", action, args). Actions: ${Object.keys(ACTIONS[g.slug]).join(", ")}.`,
      "",
    );
  }

  if (withSource) {
    out.push("## Source", "");
    for (const s of g.scripts) {
      out.push(`### ${s.path}${s.isCore ? " (the DOM-free core)" : ""}`, "", "```js", s.source.trimEnd(), "```", "");
    }
  }
  return out.join("\n");
}

/** Everything about a game as plain text, for keyword search. */
export const haystack = (g: Game): string =>
  [
    g.slug,
    g.title,
    g.blurb,
    allTags(g).join(" "),
    allTags(g).map((t) => tags[t] ?? "").join(" "),
    g.rules?.text ?? "",
    g.math?.intro ?? "",
    g.math?.sections.map((s) => `${s.heading} ${s.body}`).join(" ") ?? "",
    g.wikiTerms.map((w) => w.label).join(" "),
  ]
    .join(" ")
    .toLowerCase();

/**
 * What to say when a slug is not a game. It names a few near misses rather
 * than every game: with a thousand games the full list would bury the answer.
 */
export function unknownGame(slug: string): string {
  const wanted = String(slug).toLowerCase();
  const near = games
    .filter((g) => g.slug.includes(wanted) || wanted.includes(g.slug) || g.title.toLowerCase().includes(wanted))
    .slice(0, 5)
    .map((g) => g.slug);
  const hint = near.length ? ` Did you mean: ${near.join(", ")}?` : "";
  return `No game "${slug}".${hint} Use search or list_games to find a game's slug.`;
}

/** The games whose slug or title is close to what was typed, best first. */
export function nearGames(input: string, limit = 5): typeof games {
  const wanted = String(input).trim().toLowerCase();
  const asSlug = wanted.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!asSlug) return [];
  const words = asSlug.split("-");
  const score = (g: (typeof games)[number]): number => {
    const title = g.title.toLowerCase();
    if (g.slug === asSlug || title === wanted) return 100;
    if (g.slug.startsWith(asSlug) || title.startsWith(wanted)) return 60;
    if (g.slug.includes(asSlug) || title.includes(wanted) || asSlug.includes(g.slug)) return 40;
    return words.filter((w) => w.length > 2 && (g.slug.includes(w) || title.includes(w))).length * 10;
  };
  return games
    .map((g) => ({ g, n: score(g) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => x.g);
}

/**
 * The game someone meant: by slug, by title ("Coins in a Row"), or by the
 * only game that comes close. People type titles into a prompt's argument
 * box, so an exact slug is too much to ask.
 */
export function findGame(input: string): (typeof games)[number] | undefined {
  const exact = bySlug.get(String(input).trim());
  if (exact) return exact;
  const near = nearGames(input, 2);
  const wanted = String(input).trim().toLowerCase();
  const asSlug = wanted.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const hit = near.find((g) => g.slug === asSlug || g.title.toLowerCase() === wanted);
  if (hit) return hit;
  return near.length === 1 ? near[0] : undefined;
}

/** The concept tag someone meant: by slug or by label ("Game Strategy"). */
export function findTag(input: string): string | undefined {
  const wanted = String(input).trim().toLowerCase();
  const asSlug = wanted.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return Object.keys(tags).find((t) => t === asSlug || tags[t].toLowerCase() === wanted);
}

export { content, manifest };
