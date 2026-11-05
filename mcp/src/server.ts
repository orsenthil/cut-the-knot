/*
 * What the tutor exposes (see mcp/README.md).
 *
 * The server does not teach. The client's model teaches, and this supplies
 * grounded material: the site's own rules text, its own "Look for the math"
 * explanations, its own source, and its games' real logic. That way an answer
 * cites this site rather than the model's memory of Bogomolny.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Generated at build time by scripts/build-index.mjs.
import content from "./generated/content.json";
// Generated at build time by scripts/build-index.mjs.
import manifest from "./generated/manifest.json";
import { runGameLogic, actionCatalogue, ACTIONS } from "./logic.js";

interface Game {
  slug: string;
  title: string;
  blurb: string;
  tags: string[];
  url: string;
  ctkUrl: string | null;
  applet: string | null;
  rules: { lead: string; leadLabel: string; howToPlay: string; text: string } | null;
  math: { intro: string; sections: { heading: string; body: string }[]; tip: string | null } | null;
  wikiTerms: { page: string; label: string; url: string }[];
  scripts: { name: string; path: string; isCore: boolean; source: string }[];
}

interface Applet {
  name: string;
  archive: string | null;
  kind: string;
  priority: number;
  ctkUrl: string | null;
  slug: string | null;
  status: string;
  notes: string;
}

const games: Game[] = content.games;
const tags: Record<string, string> = content.tags;
const applets: Applet[] = manifest.applets;

const bySlug = new Map(games.map((g) => [g.slug, g]));

/* ------------------------------------------------------------- formatting */

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const fail = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

/** A game as prose: what the tutor actually wants to read. */
function gameMarkdown(g: Game, { withSource = false } = {}): string {
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
const haystack = (g: Game): string =>
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

/* ------------------------------------------------------------------ server */

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: "coolmaths-tutor", version: "1.0.0" },
    {
      instructions:
        "Grounded material for tutoring the coolmaths puzzles at " +
        "https://orsenthil.github.io/cut-the-knot/ — browser ports of Alexander " +
        "Bogomolny's cut-the-knot.org applets. Prefer get_game and explain_concept " +
        "over your own recollection of a puzzle: the text they return is the site's " +
        "own explanation. Use run_game_logic to compute a real answer from the " +
        "game's actual code rather than working one out in prose, and show the " +
        "result. The tutor prompt is Socratic by design: let the learner play and " +
        "guess before naming the invariant.",
    },
  );

  /* ------------------------------------------------------------ resources */

  server.registerResource(
    "catalogue",
    "coolmaths://catalogue",
    {
      title: "Game catalogue",
      description: "Every game on the site with its blurb and concept tags.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              site: content.site,
              tags,
              games: games.map((g) => ({
                slug: g.slug,
                title: g.title,
                blurb: g.blurb,
                tags: g.tags,
                url: g.url,
                ctkUrl: g.ctkUrl,
                hasRunnableLogic: Boolean(ACTIONS[g.slug]),
              })),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "game",
    new ResourceTemplate("coolmaths://game/{slug}", {
      list: async () => ({
        resources: games.map((g) => ({
          uri: `coolmaths://game/${g.slug}`,
          name: g.title,
          description: g.blurb,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "A game: rules, maths and source",
      description: "The rules, the full 'Look for the math' explanation, the named concepts and the code.",
      mimeType: "text/markdown",
    },
    async (uri, { slug }) => {
      const g = bySlug.get(String(slug));
      if (!g) throw new Error(`No game "${slug}". Known: ${games.map((x) => x.slug).join(", ")}`);
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: gameMarkdown(g, { withSource: true }) }],
      };
    },
  );

  server.registerResource(
    "tag",
    new ResourceTemplate("coolmaths://tag/{tag}", {
      list: async () => ({
        resources: Object.entries(tags).map(([slug, label]) => ({
          uri: `coolmaths://tag/${slug}`,
          name: label,
          description: `Games about ${label.toLowerCase()}.`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "A concept and the games that use it",
      description: "Every game tagged with this concept, with the relevant part of its maths section.",
      mimeType: "text/markdown",
    },
    async (uri, { tag }) => {
      const t = String(tag);
      const matching = games.filter((g) => g.tags.includes(t));
      const label = tags[t] ?? t;
      const body = matching.length
        ? matching.map((g) => gameMarkdown(g)).join("\n\n---\n\n")
        : `No games are tagged "${t}". Known tags: ${Object.keys(tags).join(", ")}`;
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: `# ${label}\n\n${body}` }],
      };
    },
  );

  server.registerResource(
    "manifest",
    "coolmaths://manifest",
    {
      title: "Applet porting manifest",
      description: "All ~1,280 applets in classes.zip with kind, priority and porting status.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(manifest, null, 2) }],
    }),
  );

  /* ---------------------------------------------------------------- tools */

  server.registerTool(
    "list_games",
    {
      title: "List games",
      description: "Every game on the site, optionally only those tagged with one concept.",
      inputSchema: {
        tag: z.string().optional().describe(`Concept tag. One of: ${Object.keys(tags).join(", ")}`),
      },
    },
    async ({ tag }) => {
      const list = tag ? games.filter((g) => g.tags.includes(tag)) : games;
      if (tag && !list.length) {
        return fail(`No games tagged "${tag}". Known tags: ${Object.keys(tags).join(", ")}`);
      }
      return json(
        list.map((g) => ({
          slug: g.slug,
          title: g.title,
          blurb: g.blurb,
          tags: g.tags,
          url: g.url,
          hasRunnableLogic: Boolean(ACTIONS[g.slug]),
        })),
      );
    },
  );

  server.registerTool(
    "get_game",
    {
      title: "Get a game",
      description:
        "The rules, the site's own 'Look for the math' explanation, the named concepts and optionally the source. Read this before explaining a puzzle.",
      inputSchema: {
        slug: z.string().describe(`Game slug, e.g. "hourglass". One of: ${games.map((g) => g.slug).join(", ")}`),
        includeSource: z.boolean().optional().describe("Include the game's JavaScript. Defaults to false."),
      },
    },
    async ({ slug, includeSource }) => {
      const g = bySlug.get(slug);
      if (!g) return fail(`No game "${slug}". Known: ${games.map((x) => x.slug).join(", ")}`);
      return { content: [{ type: "text" as const, text: gameMarkdown(g, { withSource: includeSource === true }) }] };
    },
  );

  server.registerTool(
    "search",
    {
      title: "Search the site",
      description: "Keyword search over titles, blurbs, rules, maths text and tags.",
      inputSchema: {
        query: z.string().describe("Words to look for, e.g. 'parity' or 'why does the chocolate bar always take the same number of breaks'"),
        limit: z.number().int().min(1).max(20).optional().describe("Maximum results (default 5)."),
      },
    },
    async ({ query, limit }) => {
      const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      if (!words.length) return fail("Give at least one word of three letters or more.");
      const scored = games
        .map((g) => {
          const hay = haystack(g);
          let score = 0;
          for (const w of words) {
            const hits = hay.split(w).length - 1;
            score += hits;
            if (g.title.toLowerCase().includes(w)) score += 10;
            if (g.slug.includes(w)) score += 10;
            if (g.tags.some((t) => t.includes(w))) score += 5;
          }
          return { g, score };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit ?? 5);

      if (!scored.length) return fail(`Nothing matched "${query}".`);
      return json(
        scored.map(({ g, score }) => ({
          slug: g.slug,
          title: g.title,
          blurb: g.blurb,
          tags: g.tags,
          url: g.url,
          score,
          matchedIn:
            g.math?.sections
              .filter((s) => words.some((w) => `${s.heading} ${s.body}`.toLowerCase().includes(w)))
              .map((s) => s.heading) ?? [],
        })),
      );
    },
  );

  server.registerTool(
    "explain_concept",
    {
      title: "Explain a concept",
      description:
        "Every game that uses a concept, with the maths paragraphs that explain it and the Wikipedia link. Takes a tag slug or a free-text term.",
      inputSchema: {
        concept: z.string().describe(`A tag (${Object.keys(tags).join(", ")}) or a term like "invariant" or "Bezout".`),
      },
    },
    async ({ concept }) => {
      const key = concept.toLowerCase().trim();
      const asTag = Object.keys(tags).find((t) => t === key || tags[t].toLowerCase() === key);

      const matching = asTag
        ? games.filter((g) => g.tags.includes(asTag))
        : games.filter(
            (g) =>
              haystack(g).includes(key) ||
              g.wikiTerms.some((w) => w.label.toLowerCase().includes(key) || w.page.toLowerCase().includes(key)),
          );

      if (!matching.length) {
        return fail(
          `Nothing on "${concept}". Try a tag (${Object.keys(tags).join(", ")}) or search() for free text.`,
        );
      }

      const label = asTag ? tags[asTag] : concept;
      const out: string[] = [`# ${label}`, ""];

      const links = new Map<string, string>();
      for (const g of matching) {
        for (const w of g.wikiTerms) {
          if (asTag ? true : w.label.toLowerCase().includes(key) || w.page.toLowerCase().includes(key)) {
            links.set(w.label, w.url);
          }
        }
      }
      if (links.size) {
        out.push("## Background", "");
        for (const [l, u] of links) out.push(`- ${l} — ${u}`);
        out.push("");
      }

      out.push(`## Where it shows up (${matching.length} game${matching.length === 1 ? "" : "s"})`, "");
      for (const g of matching) {
        out.push(`### ${g.title} (${g.slug})`, "", g.blurb, "");
        const relevant =
          g.math?.sections.filter((s) =>
            asTag ? true : `${s.heading} ${s.body}`.toLowerCase().includes(key),
          ) ?? [];
        for (const s of relevant.length ? relevant : (g.math?.sections ?? []).slice(0, 1)) {
          out.push(`**${s.heading}**`, "", s.body, "");
        }
        out.push(`Play: ${g.url}`, "");
      }
      return { content: [{ type: "text" as const, text: out.join("\n") }] };
    },
  );

  server.registerTool(
    "run_game_logic",
    {
      title: "Run a game's real logic",
      description:
        "Calls the game's actual code — the same file the live page runs — so you can show a worked answer instead of describing one.\n\n" +
        "Available actions:\n" +
        actionCatalogue(),
      inputSchema: {
        slug: z.string().describe(`Game slug. One of: ${Object.keys(ACTIONS).join(", ")}`),
        action: z.string().describe("Action name; see the description for each game's actions."),
        // passthrough() rather than z.record(z.any()): the arguments differ per
        // action, so this really is a free-form object, and passthrough says so
        // as `additionalProperties: true` instead of an empty schema that
        // strict clients flag as constraining nothing.
        args: z
          .object({})
          .passthrough()
          .optional()
          .describe("Arguments for the action, as JSON. See the tool description for each action's shape."),
      },
    },
    async ({ slug, action, args }) => {
      try {
        return json(runGameLogic(slug, action, args ?? {}));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.registerTool(
    "porting_status",
    {
      title: "Porting status",
      description: "How the porting campaign stands, from porting/manifest.json.",
      inputSchema: {
        kind: z.enum(["game", "demo", "illustration", "helper"]).optional().describe("Only this kind of applet."),
        status: z.enum(["todo", "in-progress", "ported", "failed", "skip"]).optional(),
        limit: z.number().int().min(1).max(100).optional().describe("Entries to list (default 20)."),
      },
    },
    async ({ kind, status, limit }) => {
      let list = applets;
      if (kind) list = list.filter((a) => a.kind === kind);
      if (status) list = list.filter((a) => a.status === status);
      const counts: Record<string, number> = {};
      for (const a of list) counts[a.status] = (counts[a.status] ?? 0) + 1;
      return json({
        overall: manifest.counts,
        matching: { total: list.length, byStatus: counts },
        entries: list.slice(0, limit ?? 20),
      });
    },
  );

  server.registerTool(
    "next_to_port",
    {
      title: "Next applet to port",
      description:
        "The next applets to work through: lowest priority number first, which means games before demos before illustrations.",
      inputSchema: {
        count: z.number().int().min(1).max(25).optional().describe("How many to suggest (default 1)."),
        kind: z.enum(["game", "demo", "illustration"]).optional(),
      },
    },
    async ({ count, kind }) => {
      const todo = applets
        .filter((a) => a.status === "todo" && a.kind !== "helper" && (!kind || a.kind === kind))
        .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
      if (!todo.length) return json({ done: true, message: "Nothing left to port in that category." });
      return json({
        done: false,
        remaining: todo.length,
        next: todo.slice(0, count ?? 1).map((a) => ({
          ...a,
          extract: `unzip classes.zip 'classes/${a.name}*' -d /tmp/applet`,
        })),
      });
    },
  );

  server.registerTool(
    "get_original",
    {
      title: "Get the original applet",
      description:
        "The manifest entry and cut-the-knot page for an applet, plus the port's source when it has been ported. Use it to check whether a port is faithful.",
      inputSchema: {
        name: z.string().describe('Applet name as it appears in classes.zip, e.g. "RFWH", or a game slug.'),
      },
    },
    async ({ name }) => {
      const key = name.toLowerCase();
      const entry =
        applets.find((a) => a.name.toLowerCase() === key) ??
        applets.find((a) => a.slug === key) ??
        applets.find((a) => a.name.toLowerCase().includes(key));
      if (!entry) return fail(`No applet matching "${name}" in the manifest.`);

      const port = entry.slug ? bySlug.get(entry.slug) : undefined;
      return json({
        applet: entry,
        extract: entry.archive ? `unzip classes.zip '${entry.archive}' -d /tmp/applet` : null,
        inspect: entry.archive
          ? "jar xf <Name>.jar && javap -c -p <Name>.class   # no decompiler is installed"
          : null,
        javaSource:
          "Decompiled *_src/ folders are not in the repo; read the bytecode with javap, or the cut-the-knot page for the rules.",
        port: port
          ? {
              slug: port.slug,
              url: port.url,
              scripts: port.scripts.map((s) => ({ path: s.path, isCore: s.isCore, source: s.source })),
            }
          : null,
      });
    },
  );

  /* -------------------------------------------------------------- prompts */

  const slugEnum = z.string().describe(`Game slug. One of: ${games.map((g) => g.slug).join(", ")}`);

  server.registerPrompt(
    "tutor",
    {
      title: "Tutor me on a game",
      description: "Socratic: play first, then hints, then the invariant.",
      argsSchema: { slug: slugEnum },
    },
    ({ slug }) => {
      const g = bySlug.get(slug);
      if (!g) throw new Error(`No game "${slug}".`);
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Be my tutor for this puzzle. Work in three stages and do not skip ahead.\n\n` +
                `1. Give me the rules and send me to ${g.url} to play. Ask what I notice. Stop and wait.\n` +
                `2. When I report back, ask questions that lead me toward the pattern. Give one small hint at a ` +
                `time. If I am stuck, use run_game_logic to compute a concrete example and show it to me, rather ` +
                `than telling me the rule.\n` +
                `3. Only once I have guessed the pattern, or asked outright, name the underlying idea and explain ` +
                `why it works.\n\n` +
                `Here is the material. Use this rather than your own memory of the puzzle.\n\n` +
                gameMarkdown(g),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "quiz_me",
    {
      title: "Quiz me on a concept",
      description: "Questions drawn from the games that use a concept.",
      argsSchema: { tag: z.string().describe(`Concept tag. One of: ${Object.keys(tags).join(", ")}`) },
    },
    ({ tag }) => {
      const matching = games.filter((g) => g.tags.includes(tag));
      const label = tags[tag] ?? tag;
      if (!matching.length) throw new Error(`No games tagged "${tag}". Known: ${Object.keys(tags).join(", ")}`);
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Quiz me on ${label}, using these ${matching.length} puzzles.\n\n` +
                `Ask one question at a time and wait for my answer before the next. Start easy and get harder. ` +
                `Mix recall with "what would happen if" questions. Where a question has a computable answer, ` +
                `check mine with run_game_logic before telling me whether I am right. After each answer, say ` +
                `briefly why, and point me at the game it comes from.\n\n` +
                matching.map((g) => gameMarkdown(g)).join("\n\n---\n\n"),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "explain_like_im",
    {
      title: "Explain at a level",
      description: "The same puzzle explained for a 10-year-old, a high schooler or an undergraduate.",
      argsSchema: {
        slug: slugEnum,
        level: z.string().describe('Audience: "10", "high school" or "undergraduate".'),
      },
    },
    ({ slug, level }) => {
      const g = bySlug.get(slug);
      if (!g) throw new Error(`No game "${slug}".`);
      const guidance: Record<string, string> = {
        "10": "No algebra and no jargon. Short sentences, concrete objects, and a picture in words. One idea only.",
        "high school":
          "Algebra is fine. Name the idea properly, show the formula, and say what it would take to prove it.",
        undergraduate:
          "Be precise: state the invariant or theorem exactly, sketch the proof, and say where the argument generalises or fails.",
      };
      const key = Object.keys(guidance).find((k) => level.toLowerCase().includes(k)) ?? "high school";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Explain this puzzle and the mathematics behind it for: ${level}.\n\n${guidance[key]}\n\n` +
                `End with one question to check I followed. Base it on the material below, not on your own ` +
                `recollection, and use run_game_logic if a worked example would help.\n\n` +
                gameMarkdown(g),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "review_port",
    {
      title: "Review a port",
      description: "Compare the JavaScript port against the original applet's rules and suggest improvements.",
      argsSchema: { slug: slugEnum },
    },
    ({ slug }) => {
      const g = bySlug.get(slug);
      if (!g) throw new Error(`No game "${slug}".`);
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Review this port for faithfulness and quality.\n\n` +
                `Check in this order:\n` +
                `1. Faithfulness. Read ${g.ctkUrl ?? "the original cut-the-knot page"} and call get_original(${JSON.stringify(
                  g.slug,
                )}) for the applet. Do the rules, win condition, opponent strategy, board sizes and option ranges match? CLAUDE.md requires a deliberate change to be stated in the commit message, so flag anything that differs silently.\n` +
                `2. The maths section. Is it correct, is it the site's own words rather than Bogomolny's, and does it build in 2-5 steps?\n` +
                `3. The code. Is the logic in a DOM-free core, and does run_game_logic agree with what the page claims?\n` +
                `4. The page against CLAUDE.md: section order, two-line rules, accessibility, 375px, both themes.\n\n` +
                `Be specific and say what you would change. Here is the port:\n\n` +
                gameMarkdown(g, { withSource: true }),
            },
          },
        ],
      };
    },
  );

  return server;
}
