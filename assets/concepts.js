"use strict";

/*
 * The concept graph: which ideas come before which.
 *
 * Every tag in assets/games.js has an entry here naming its prerequisites,
 * the concepts a player should have met first. The edges are on concepts,
 * not on games, so a new game joins the order through its tags alone.
 *
 * The edges are editorial: they say what makes a good learning order on this
 * site, not what mathematics strictly depends on. Keep the graph shallow and
 * acyclic; porting/check-concepts.mjs checks both, and that every tag is here.
 *
 * assets/recommend.js turns this graph plus a player's progress into a
 * "what to play next" list, on the profile page and in the MCP server.
 */

window.COOLMATHS_CONCEPTS = {
  // Starting points: nothing is needed first.
  "arithmetic": { prereqs: [] },
  "counting": { prereqs: [] },
  "logic": { prereqs: [] },
  "game-strategy": { prereqs: [] },

  // Number.
  "mental-math": { prereqs: ["arithmetic"] },
  "place-value": { prereqs: ["arithmetic"] },
  "parity": { prereqs: ["arithmetic"] },
  "divisibility": { prereqs: ["arithmetic"] },
  "number-theory": { prereqs: ["divisibility"] },
  "sequences": { prereqs: ["arithmetic"] },
  "series": { prereqs: ["sequences", "algebra"] },

  // Structure and proof.
  "algebra": { prereqs: ["arithmetic"] },
  "invariants": { prereqs: ["parity"] },
  "induction": { prereqs: ["counting"] },
  "algorithms": { prereqs: ["counting"] },
  "graph-theory": { prereqs: ["counting"] },

  // Shape.
  "area": { prereqs: ["arithmetic"] },
  "paradoxes": { prereqs: ["area"] },

  // Continuous mathematics.
  "physics": { prereqs: ["algebra"] },
  "complex-analysis": { prereqs: ["algebra"] },
  "differential-equations": { prereqs: ["algebra", "series"] },
  "fluid-dynamics": { prereqs: ["differential-equations", "physics"] },
};
