"use strict";

/*
 * What to play next.
 *
 * Inputs, all plain data:
 *   concepts  assets/concepts.js   { tag: { prereqs: [tag, ...] } }
 *   games     assets/games.js      [{ slug, tags, level?, kind? }, ...]
 *   progress  a player's record    { slug: { opens, completed, lastAt }, ... }
 *             (see docs/contracts.md; assets/progress.js writes it)
 *
 * The idea: every game played earns points for each of its concepts, more
 * for a harder game and more for finishing than for only trying. A concept
 * with enough points is "practised". A game is ready when the prerequisites
 * of its concepts are practised; the recommendation is the ready games the
 * player has not tried, easiest and most basic first.
 *
 * One rule keeps this from deadlocking on a small catalogue: a prerequisite
 * that the game itself also teaches does not count against it. The times
 * tables quiz is tagged arithmetic and mental-math, and mental-math needs
 * arithmetic, but the quiz is exactly where arithmetic gets practised.
 *
 * No DOM and no storage, so the same file runs on the profile page, in the
 * MCP server and in porting/check-concepts.mjs. It defines one global.
 */

const Recommend = (() => {
  /** Points a concept needs before it counts as practised. */
  const PRACTISED = 1;
  /** Share of a game's points earned by trying it without finishing. */
  const TRIED_SHARE = 0.5;

  const levelOf = (game) => (game.level >= 1 && game.level <= 3 ? game.level : 2);
  const wasTried = (doc) => Boolean(doc) && ((doc.opens || 0) > 0 || (doc.completed || 0) > 0);
  const wasCompleted = (doc) => Boolean(doc) && (doc.completed || 0) > 0;

  /**
   * Concepts in an order where every prerequisite comes before what needs it
   * (Kahn's algorithm). Ties keep the order of the concepts object, so the
   * result is stable. Throws on an unknown prerequisite or a cycle.
   */
  function topoOrder(concepts) {
    const names = Object.keys(concepts);
    const waiting = new Map(names.map((name) => [name, 0]));
    const dependents = new Map(names.map((name) => [name, []]));

    for (const name of names) {
      for (const pre of concepts[name].prereqs || []) {
        if (!waiting.has(pre)) throw new Error(`concept "${name}" needs unknown concept "${pre}"`);
        waiting.set(name, waiting.get(name) + 1);
        dependents.get(pre).push(name);
      }
    }

    const order = [];
    const ready = names.filter((name) => waiting.get(name) === 0);
    while (ready.length) {
      const name = ready.shift();
      order.push(name);
      for (const next of dependents.get(name)) {
        waiting.set(next, waiting.get(next) - 1);
        if (waiting.get(next) === 0) ready.push(next);
      }
    }

    if (order.length !== names.length) {
      const stuck = names.filter((name) => !order.includes(name));
      throw new Error(`the concept graph has a cycle through: ${stuck.join(", ")}`);
    }
    return order;
  }

  /** How many prerequisite steps lie under each concept (0 for a starting point). */
  function depths(concepts) {
    const depth = {};
    for (const name of topoOrder(concepts)) {
      const pres = concepts[name].prereqs || [];
      depth[name] = pres.length ? 1 + Math.max(...pres.map((p) => depth[p])) : 0;
    }
    return depth;
  }

  /**
   * Per concept: points earned, and how many of its games exist, were tried
   * and were completed. `practised` is points >= PRACTISED.
   */
  function mastery(progress, games, concepts) {
    const out = {};
    for (const name of Object.keys(concepts)) {
      out[name] = { points: 0, total: 0, tried: 0, completed: 0, practised: false };
    }
    for (const game of games) {
      const doc = progress[game.slug];
      for (const tag of game.tags) {
        const m = out[tag];
        if (!m) continue;
        m.total++;
        if (!wasTried(doc)) continue;
        m.tried++;
        if (wasCompleted(doc)) {
          m.completed++;
          m.points += levelOf(game);
        } else {
          m.points += levelOf(game) * TRIED_SHARE;
        }
      }
    }
    for (const m of Object.values(out)) m.practised = m.points >= PRACTISED;
    return out;
  }

  /**
   * The prerequisites a player still lacks for one game: prerequisites of its
   * concepts that are not practised, that the game does not itself teach, and
   * that some game in the catalogue could teach.
   */
  function missingFor(game, concepts, masteryByConcept) {
    const missing = new Set();
    for (const tag of game.tags) {
      for (const pre of (concepts[tag] && concepts[tag].prereqs) || []) {
        const m = masteryByConcept[pre];
        if (game.tags.includes(pre)) continue;
        if (!m || m.total === 0 || m.practised) continue;
        missing.add(pre);
      }
    }
    return [...missing];
  }

  /** Concepts of the most recently played games, newest first. */
  function recentConcepts(progress, games, howMany = 3) {
    const bySlug = new Map(games.map((g) => [g.slug, g]));
    const recent = Object.entries(progress)
      .filter(([slug, doc]) => bySlug.has(slug) && wasTried(doc))
      .sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0))
      .slice(0, howMany);
    return new Set(recent.flatMap(([slug]) => bySlug.get(slug).tags));
  }

  /**
   * Up to `count` games to play next, best first. Each entry is
   * { game, missing, why }: `missing` lists prerequisite concepts not yet
   * practised (empty when the game is ready) and `why` is a code the caller
   * turns into words: "start", "builds-on", "new" or "stretch".
   */
  function next(progress, games, concepts, count = 3) {
    const m = mastery(progress, games, concepts);
    const depth = depths(concepts);
    const recent = recentConcepts(progress, games);
    const anyProgress = games.some((g) => wasTried(progress[g.slug]));

    const candidates = games
      .map((game, index) => ({ game, index }))
      .filter(({ game }) => !wasTried(progress[game.slug]))
      .map(({ game, index }) => {
        const missing = missingFor(game, concepts, m);
        const known = game.tags.filter((t) => m[t] && m[t].practised);
        return {
          game,
          missing,
          known,
          why: missing.length ? "stretch" : !anyProgress ? "start" : known.length ? "builds-on" : "new",
          // Sort key, smallest first.
          key: [
            missing.length,
            levelOf(game),
            Math.max(0, ...game.tags.map((t) => depth[t] || 0)),
            -game.tags.filter((t) => recent.has(t)).length,
            index,
          ],
        };
      });

    candidates.sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) {
        if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
      }
      return 0;
    });

    return candidates.slice(0, count).map(({ game, missing, known, why }) => ({ game, missing, known, why }));
  }

  /** One plain sentence for a suggestion from next(). `label` turns a tag into its name. */
  function explain(suggestion, label) {
    const list = (tags) => tags.map(label).join(" and ");
    switch (suggestion.why) {
      case "start":
        return "A good place to start.";
      case "builds-on":
        return `Uses ${list(suggestion.known)}, which you have practised.`;
      case "stretch":
        return `Easier after some ${list(suggestion.missing)}.`;
      default:
        return "Something new, and nothing is needed first.";
    }
  }

  return { PRACTISED, TRIED_SHARE, topoOrder, depths, mastery, missingFor, next, explain };
})();
