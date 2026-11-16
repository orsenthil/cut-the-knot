"use strict";

/*
 * Box Labels (PickLabel), from Alexander Bogomolny's applet PickLabel.
 *
 * Three boxes hold WW, WB and BB. Every label is wrong (a derangement).
 * Pick one box and see one random ball, then assign the three labels.
 * Contents are a random permutation of {WW,WB,BB}; labels are that
 * permutation composed with one of the two 3-cycles — Derange() in the
 * bytecode.
 */
const PickLabelCore = (() => {
  const WW = 0;
  const WB = 1;
  const BB = 2;
  const NAMES = ["WW", "WB", "BB"];
  const SELECT = 0;
  const LABEL = 1;
  const VERIFY = 2;
  const DONE = 3;

  const CONTENT_PERMS = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  // The two derangements of three items (3-cycles).
  const LABEL_DERANGEMENTS = [
    [1, 2, 0],
    [2, 0, 1],
  ];

  const CAPTIONS = [
    "Select a box",
    "Label boxes",
    "Click to verify",
    "Well done. Want to try again?",
    "Well, click to try again",
  ];

  function derange(random) {
    const rand = typeof random === "function" ? random : Math.random;
    const perm = CONTENT_PERMS[Math.floor(rand() * 6)];
    const d = LABEL_DERANGEMENTS[rand() < 0.5 ? 0 : 1];
    const contents = perm.slice();
    // label[i] = perm[d[i]] = content[d[i]]
    const labels = [perm[d[0]], perm[d[1]], perm[d[2]]];
    return { contents, labels };
  }

  function start(options) {
    const random = options && options.random;
    const { contents, labels } = derange(random);
    return {
      phase: SELECT,
      contents,
      labels,
      guesses: [null, null, null],
      picked: null,
      revealed: null, // { box, color: 0|1 } 0=white 1=black
      open: false,
      won: false,
      games: 0,
      wins: 0,
      announce: CAPTIONS[SELECT],
    };
  }

  /** PopOne: random ball from the chosen box. */
  function pickBox(state, box, random) {
    if (state.phase !== SELECT) return state;
    if (box < 0 || box > 2) return state;
    const rand = typeof random === "function" ? random : Math.random;
    const content = state.contents[box];
    const which = Math.floor(rand() * 2); // unused for WW/BB colour, kept for fidelity
    let color;
    if (content === WW) color = 0;
    else if (content === BB) color = 1;
    else color = which === 0 ? 0 : 1;
    return {
      ...state,
      phase: LABEL,
      picked: box,
      revealed: { box, color, which },
      announce: CAPTIONS[LABEL],
    };
  }

  /** Place guess label `type` on box `box`. Reuses a label already placed. */
  function assignGuess(state, box, type) {
    if (state.phase !== LABEL && state.phase !== VERIFY) return state;
    if (box < 0 || box > 2) return state;
    if (type !== WW && type !== WB && type !== BB) return state;
    const guesses = state.guesses.slice();
    for (let i = 0; i < 3; i++) if (guesses[i] === type) guesses[i] = null;
    guesses[box] = type;
    const all = guesses.every((g) => g !== null);
    return {
      ...state,
      guesses,
      phase: all ? VERIFY : LABEL,
      announce: all ? CAPTIONS[VERIFY] : CAPTIONS[LABEL],
    };
  }

  function clearGuess(state, box) {
    if (state.phase !== LABEL && state.phase !== VERIFY) return state;
    const guesses = state.guesses.slice();
    guesses[box] = null;
    return { ...state, guesses, phase: LABEL, announce: CAPTIONS[LABEL], open: false };
  }

  function allCorrect(state) {
    return state.guesses.every((g, i) => g === state.contents[i]);
  }

  /** VERIFY click: open boxes and score. */
  function verify(state) {
    if (state.phase !== VERIFY) return state;
    const won = allCorrect(state);
    return {
      ...state,
      phase: DONE,
      open: true,
      won,
      games: state.games + 1,
      wins: state.wins + (won ? 1 : 0),
      announce: won ? CAPTIONS[3] : CAPTIONS[4],
    };
  }

  function labelsWrong(state) {
    return state.labels.every((lab, i) => lab !== state.contents[i]);
  }

  function snapshot(state) {
    return {
      phase: state.phase,
      labels: state.labels.slice(),
      guesses: state.guesses.slice(),
      picked: state.picked,
      revealed: state.revealed ? { ...state.revealed } : null,
      open: state.open,
      won: state.won,
      contents: state.open ? state.contents.slice() : null,
      games: state.games,
      wins: state.wins,
      announce: state.announce,
    };
  }

  return {
    WW, WB, BB, NAMES, SELECT, LABEL, VERIFY, DONE, CAPTIONS,
    CONTENT_PERMS, LABEL_DERANGEMENTS,
    derange, start, pickBox, assignGuess, clearGuess, verify, allCorrect, labelsWrong, snapshot,
  };
})();
