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

/** A game as prose: what the tutor actually wants to read. */
export function gameMarkdown(g: Game, { withSource = false } = {}): string {
  const out: string[] = [`# ${g.title}`, "", g.blurb, ""];
  out.push(`- Play: ${g.url}`);
  if (g.ctkUrl) out.push(`- Original: ${g.ctkUrl}`);
  if (g.applet) out.push(`- Applet: ${g.applet} in classes.zip`);
  out.push(`- Concepts: ${g.tags.map((t) => tags[t] ?? t).join(", ")}`);
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
    g.tags.join(" "),
    g.tags.map((t) => tags[t] ?? "").join(" "),
    g.rules?.text ?? "",
    g.math?.intro ?? "",
    g.math?.sections.map((s) => `${s.heading} ${s.body}`).join(" ") ?? "",
    g.wikiTerms.map((w) => w.label).join(" "),
  ]
    .join(" ")
    .toLowerCase();

export { content, manifest };
