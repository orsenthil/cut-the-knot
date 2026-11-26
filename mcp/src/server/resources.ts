/*
 * Resources: the site as documents a client can attach.
 *
 *   coolmaths://catalogue      every game with its blurb and tags
 *   coolmaths://game/{slug}    rules, the maths section, concepts, source
 *   coolmaths://tag/{tag}      every game that uses a concept
 *   coolmaths://manifest       the porting manifest
 */

import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { content, manifest, games, tags, allTags, findGame, findTag, gameMarkdown, unknownGame } from "../core/content.js";
import { ACTIONS } from "../games/registry.js";

export function registerResources(server: McpServer): void {
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
                hiddenTags: g.hiddenTags,
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
          // Each game's own title: without it a client shows the template's
          // title on every row, and the list is one line repeated.
          title: g.title,
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
      // A client lets a person type the slug, so a miss is an answer, not an error.
      const g = findGame(decodeURIComponent(String(slug)));
      const text = g ? gameMarkdown(g, { withSource: true }) : `# Not found\n\n${unknownGame(decodeURIComponent(String(slug)))}`;
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text }] };
    },
  );

  server.registerResource(
    "tag",
    new ResourceTemplate("coolmaths://tag/{tag}", {
      list: async () => ({
        resources: Object.entries(tags).map(([slug, label]) => ({
          uri: `coolmaths://tag/${slug}`,
          name: label,
          title: `Concept: ${label}`,
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
      const typed = decodeURIComponent(String(tag));
      const t = findTag(typed) ?? typed;
      const matching = games.filter((g) => allTags(g).includes(t));
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
}
