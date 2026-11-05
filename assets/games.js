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
    "graph-theory": "Graph Theory",
    "series": "Infinite Series",
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
    {
      slug: "four-knights",
      title: "Four Knights",
      blurb: "Swap two red and two blue knights on a cramped 3 by 3 board using only legal chess moves. A second view of the same board makes it much easier than it looks.",
      tags: ["graph-theory", "game-strategy", "algorithms"],
    },
    {
      slug: "four-by-four",
      title: "Four By Four",
      blurb: "3D tic-tac-toe on a 4 by 4 by 4 cube against a computer that never looks ahead, just recognizes patterns. There are faults in its logic — can you find one?",
      tags: ["game-strategy", "algorithms", "counting"],
    },
    {
      slug: "circle-solitaire",
      title: "Solitaire on a Circle",
      blurb: "Counters in a ring, red on one face and green on the other. Clicking a green one removes it and turns over both its neighbours. Clear the ring \u2014 but can you tell before you start whether it is even possible?",
      tags: ["parity", "invariants", "induction"],
    },
    {
      slug: "aliquot",
      title: "Aliquot",
      blurb: "Take turns subtracting a divisor of the number; whoever is handed 1 cannot move and loses. The winner is decided before anybody plays \u2014 can you tell who, just by looking at the number?",
      tags: ["divisibility", "parity", "game-strategy"],
    },
    {
      slug: "calendar-magic",
      title: "Calendar Magic",
      blurb: "Outline a square of dates on a calendar and circle one in each row and column. The total is announced before you pick a thing \u2014 how can it already be known?",
      tags: ["arithmetic", "invariants", "algebra"],
    },
    {
      slug: "clone-escape",
      title: "Escape of the Clones",
      blurb: "A clone in the corner splits into two: one below, one to the right. Can you empty the prison it starts in? For some prisons no sequence of moves works, and a weight you write on every square says which.",
      tags: ["invariants", "series"],
    },
    {
      slug: "dawsons-chess",
      title: "Dawson's Chess",
      blurb: "Knock down a skittle in the ring and the ones on either side of it go too. Take the last skittle and you win \u2014 so which rings can you not lose from?",
      tags: ["game-strategy", "invariants", "induction"],
    },
    {
      slug: "bicolor-hanoi",
      title: "Bicolor Towers of Hanoi",
      blurb: "Two towers of disks, both striped gold and red, and one spare peg. Make each tower a single colour \u2014 and swap the two towers over. Three sizes can be done in 29 moves: can you?",
      tags: ["induction", "algorithms", "counting"],
    },
    {
      slug: "stones-in-cups",
      title: "Stones in Cups",
      blurb: "Scoop up the stones under your hand and drop them one by one round the circle, over and over. They always end up piled in a single cup \u2014 or do they?",
      tags: ["algorithms", "graph-theory", "counting"],
    },
    {
      slug: "eight-digits",
      title: "Eight Digits Puzzle",
      blurb: "Drop the digits 1 to 8 into eight circles so that no two digits in a row land in circles that touch. Two of the circles decide almost everything \u2014 which two?",
      tags: ["graph-theory", "counting"],
    },
    {
      slug: "dawsons-kayles",
      title: "Dawson's Kayles",
      blurb: "Skittles stand in a ring and each move knocks down two that are side by side. Take the last pair to win \u2014 but the ring quietly breaks into separate games, and only their XOR tells you who is winning.",
      tags: ["game-strategy", "invariants", "algorithms"],
    },
    {
      slug: "domino-faults",
      title: "Dominoes on a Chessboard",
      blurb: "Cover the board with dominoes so that no straight line runs clean across it. On a 6 by 6 board it cannot be done, however you try \u2014 can you see what stops you?",
      tags: ["parity", "counting"],
    },
    {
      slug: "full-house",
      title: "Full House",
      blurb: "Draw one path through every white square. The snag: once it is moving it cannot stop or turn until something gets in its way.",
      tags: ["graph-theory", "parity", "algorithms"],
    },
    {
      slug: "diagonals",
      title: "Diagonal Count",
      blurb: "Join corners of a polygon with lines that never cross, until no more will fit. However you do it you always draw the same number of them \u2014 can you work out what it is before you start?",
      tags: ["counting", "induction", "invariants"],
    },
  ],
};
