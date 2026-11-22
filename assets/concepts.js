"use strict";

/*
 * The concept graph: which ideas come before which.
 *
 * This is where a tag is defined: its label, as shown on the site, and its
 * prerequisites, the concepts a player should have met first. A game's
 * meta.json may only use tags listed here. The edges are on concepts, not on
 * games, so a new game joins the order through its tags alone.
 *
 * The edges are editorial: they say what makes a good learning order on this
 * site, not what mathematics strictly depends on. Keep the graph shallow and
 * acyclic; porting/check-concepts.mjs checks both.
 *
 * assets/recommend.js turns this graph plus a player's progress into a
 * "what to play next" list, on the profile page and in the MCP server.
 */

window.COOLMATHS_CONCEPTS = {
  // Starting points: nothing is needed first.
  "arithmetic": { label: "Arithmetic", prereqs: [] },
  "counting": { label: "Counting", prereqs: [] },
  "logic": { label: "Logic", prereqs: [] },
  "game-strategy": { label: "Game Strategy", prereqs: [] },

  // Number.
  "mental-math": { label: "Mental Math", prereqs: ["arithmetic"] },
  "place-value": { label: "Place Value", prereqs: ["arithmetic"] },
  "parity": { label: "Parity", prereqs: ["arithmetic"] },
  "divisibility": { label: "Divisibility", prereqs: ["arithmetic"] },
  "fractions": { label: "Fractions", prereqs: ["arithmetic"] },
  "coordinates": { label: "Coordinates", prereqs: ["arithmetic"] },
  "curves": { label: "Curves", prereqs: ["algebra"] },
  "number-theory": { label: "Number Theory", prereqs: ["divisibility"] },
  "sequences": { label: "Sequences", prereqs: ["arithmetic"] },
  "series": { label: "Infinite Series", prereqs: ["sequences", "algebra"] },

  // Structure and proof.
  "algebra": { label: "Algebra", prereqs: ["arithmetic"] },
  "invariants": { label: "Invariants", prereqs: ["parity"] },
  "induction": { label: "Induction", prereqs: ["counting"] },
  "algorithms": { label: "Algorithms", prereqs: ["counting"] },
  "graph-theory": { label: "Graph Theory", prereqs: ["counting"] },

  // Shape.
  "area": { label: "Area", prereqs: ["arithmetic"] },
  "paradoxes": { label: "Paradoxes", prereqs: ["area"] },

  // Continuous mathematics.
  "limits": { label: "Limits", prereqs: ["area", "series"] },
  "physics": { label: "Physics", prereqs: ["algebra"] },
  "complex-analysis": { label: "Complex Analysis", prereqs: ["algebra"] },
  "riemann-hypothesis": { label: "Riemann Hypothesis", prereqs: ["number-theory", "series", "complex-analysis"] },
  "differential-equations": { label: "Differential Equations", prereqs: ["algebra", "series"] },
  "fluid-dynamics": { label: "Fluid Dynamics", prereqs: ["differential-equations", "physics"] },
};
