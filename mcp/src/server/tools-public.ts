/*
 * The tools anyone may call, signed in or not: the catalogue, a game's own
 * explanation, search, a concept across games, the games' real logic, and
 * the state of the porting campaign.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { games, tags, applets, bySlug, json, fail, gameMarkdown, haystack, manifest } from "../core/content.js";
import { ACTIONS, actionCatalogue, runGameLogic } from "../games/registry.js";

export function registerPublicTools(server: McpServer): void {
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
}
