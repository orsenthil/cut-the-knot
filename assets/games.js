"use strict";

/*
 * The catalogue of games. The home page builds its grid and tag filter from
 * this list, and each game page shows its own concept tags from it (matched by
 * the <body data-game="..."> slug, which is also the game's folder name).
 * Tags are URL-friendly slugs, so /#number-theory lists every game with that tag.
 */

window.COOLMATHS = {
  tags: {
    "arithmetic": "Arithmetic",
    "mental-math": "Mental Math",
    "parity": "Parity",
    "invariants": "Invariants",
    "game-strategy": "Game Strategy",
    "number-theory": "Number Theory",
    "place-value": "Place Value",
    "divisibility": "Divisibility",
    "induction": "Induction",
    "counting": "Counting",
    "algorithms": "Algorithms",
    "algebra": "Algebra",
    "area": "Area",
    "paradoxes": "Paradoxes",
    "differential-equations": "Differential Equations",
    "fluid-dynamics": "Fluid Dynamics",
    "complex-analysis": "Complex Analysis",
    "physics": "Physics",
  },

  games: [
    {
      slug: "rfwh",
      title: "Rooster, Hen, Farmer and Wife",
      blurb: "A Sam Loyd chase on a checkerboard, with a surprising parity argument hiding behind it.",
      tags: ["parity", "invariants", "game-strategy"],
    },
    {
      slug: "flipthem",
      title: "Flip Them",
      blurb: "Flip any M of N triangles at a time and turn them all downward. Some combinations are impossible, and a simple invariant proves it.",
      tags: ["invariants", "parity", "number-theory"],
    },
    {
      slug: "vanishing-digit",
      title: "The Vanishing Digit",
      blurb: "Reverse a 3-digit number, subtract, and tell me two digits of the answer. I'll name the third.",
      tags: ["place-value", "divisibility", "number-theory"],
    },
    {
      slug: "coins",
      title: "Coins in a Row",
      blurb: "Take turns grabbing a coin from either end of a row. Can you beat the computer, and does going first help?",
      tags: ["game-strategy", "parity", "algorithms"],
    },
    {
      slug: "chocolate",
      title: "Breaking Chocolate Bars",
      blurb: "Snap a chocolate bar into single squares however you like. The number of snaps is fixed before you start.",
      tags: ["invariants", "induction", "counting"],
    },
    {
      slug: "hourglass",
      title: "The Hourglass Puzzle",
      blurb: "Boil an egg for exactly 15 minutes with only a 7-minute and an 11-minute sand timer, in as few flips as you can.",
      tags: ["number-theory", "algorithms", "invariants"],
    },
    {
      slug: "maths-quiz",
      title: "Cool Maths Quiz",
      blurb: "Quick-fire practice with adding, taking away, times tables and sharing. How long a streak can you build?",
      tags: ["arithmetic", "mental-math"],
    },
    {
      slug: "eye-opener",
      title: "The Eye Opener: 99 = 100",
      blurb: "Slide one piece of a 9 by 11 rectangle and it fills a 10 by 10 square. Where did the extra square come from?",
      tags: ["paradoxes", "area", "algebra"],
    },
    {
      slug: "mind-reader",
      title: "The Mind Reader",
      blurb: "Pick a number, do a little subtraction, and think hard about a shape. How can the computer possibly know which one?",
      tags: ["place-value", "divisibility", "algebra"],
    },
    {
      slug: "euler2d",
      title: "Euler 2D Fluid Flow",
      blurb: "Watch a cloud of points swirl through a perfectly incompressible fluid, stirred by a few hidden vortices. What happens if you change the power law?",
      tags: ["fluid-dynamics", "differential-equations", "complex-analysis"],
    },
    {
      slug: "torque",
      title: "Torque",
      blurb: "Hang weights and balloons on a beam so it balances perfectly level. Every round includes one item worth exactly 1 — can you see why that always helps?",
      tags: ["arithmetic", "algebra", "physics"],
    },
  ],
};
