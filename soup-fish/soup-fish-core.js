"use strict";

/*
 * Fish Soup (SoupFish applet), from Alexander Bogomolny with thanks to
 * Arthur van Hoff's TicTacToe demo — the same engine as The Game of Jam.
 *
 * Nine four-letter words sit in a row. Players claim words; the first to own
 * three that share a common letter wins. The secret: those nine words are the
 * squares of a tic-tac-toe board, and each shared letter is a winning line.
 *
 * Bitmasks and bestMove match SoupFishCanvas (and JamCanvas): winning masks
 * 7, 56, 448, 73, 146, 292, 273, 84; move order centre, corners, edges; a
 * 1-in-10 random "mistake"; computer is white (red), you are black (blue).
 */
const SoupFishCore = (() => {
  const FULL = 511;
  const LINES = [7, 56, 448, 73, 146, 292, 273, 84];
  const ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  const WORDS = ["FISH", "SOUP", "SWAN", "GIRL", "HORN", "ARMY", "KNIT", "VOTE", "CHAT"];
  const COMMON = ["S", "R", "T", "I", "O", "A", "H", "N"];
  const MISTAKE = 0.1; // (int)(random * 10) === 7

  const isWon = (mask) => LINES.some((l) => (mask & l) === l);
  const bit = (i) => 1 << i;

  /** Precompute won[0..511] as in InitWons / isWon. */
  const WON = (() => {
    const w = new Array(512).fill(false);
    for (let m = 0; m < 512; m++) if (isWon(m)) w[m] = true;
    return w;
  })();

  function shufflePerm(rnd) {
    const p = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    return p;
  }

  function start(options = {}) {
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const perm = options.perm ? options.perm.slice() : shufflePerm(rnd);
    return {
      you: 0,
      computer: 0,
      over: false,
      result: null,
      perm,
      computerFirst: Boolean(options.computerFirst),
      winsYou: 0,
      winsComputer: 0,
      winLetter: null,
    };
  }

  function restore(partial) {
    return {
      ...start({
        perm: partial.perm,
        computerFirst: partial.computerFirst,
      }),
      you: Number(partial.you) || 0,
      computer: Number(partial.computer) || 0,
      over: Boolean(partial.over),
      result: partial.result ?? null,
      winsYou: Number(partial.winsYou) || 0,
      winsComputer: Number(partial.winsComputer) || 0,
      winLetter: partial.winLetter ?? null,
    };
  }

  function status(s) {
    if (WON[s.computer]) return "computer";
    if (WON[s.you]) return "you";
    if ((s.you | s.computer) === FULL) return "stalemate";
    return null;
  }

  function free(s, i) {
    return !((s.you | s.computer) & bit(i));
  }

  /** Display slot → logical index (Permutation.InverseAt). */
  function translate(s, displayIndex) {
    if (displayIndex < 0 || displayIndex > 8) return displayIndex;
    return s.perm.indexOf(displayIndex);
  }

  /** Logical index → display slot (Permutation.at). */
  function translateback(s, logical) {
    return s.perm[logical];
  }

  function wordAtLogical(i) {
    return WORDS[i];
  }

  function winningLetter(mask) {
    for (let i = 0; i < LINES.length; i++) {
      if ((mask & LINES[i]) === LINES[i]) return COMMON[i];
    }
    return null;
  }

  function finish(s) {
    const r = status(s);
    if (r) {
      s.over = true;
      s.result = r;
      s.winLetter = r === "stalemate" ? null : winningLetter(r === "you" ? s.you : s.computer);
      if (r === "you") s.winsYou++;
      else if (r === "computer") s.winsComputer++;
    }
    return r;
  }

  /** bestMove(white, black) from SoupFishCanvas / JamCanvas. */
  function bestMove(s, rnd = Math.random) {
    const me = s.computer;
    const them = s.you;
    let best = -1;
    for (const m of ORDER) {
      if ((me | them) & bit(m)) continue;
      if (Math.trunc(rnd() * 10) === 7) return m;
      const pw = me | bit(m);
      if (WON[pw]) return m;
      let safe = true;
      for (let j = 0; j < 9; j++) {
        if ((pw | them) & bit(j)) continue;
        if (WON[them | bit(j)]) {
          safe = false;
          break;
        }
      }
      if (safe && best === -1) best = m;
    }
    if (best !== -1) return best;
    for (const m of ORDER) if (!((me | them) & bit(m))) return m;
    return -1;
  }

  function playYou(s, logical) {
    if (s.over || logical < 0 || logical > 8 || !free(s, logical)) return null;
    const next = {
      ...s,
      you: s.you | bit(logical),
      winLetter: null,
    };
    if (finish(next)) return next;
    const m = bestMove(next);
    if (m >= 0) next.computer |= bit(m);
    finish(next);
    return next;
  }

  /** Computer opens on a random free cell (Start()). */
  function computerOpen(s, rnd = Math.random) {
    if (s.over || s.computer || s.you) return s;
    const cell = Math.floor(rnd() * 9);
    const next = { ...s, computer: bit(cell), winLetter: null };
    finish(next);
    return next;
  }

  function result(s) {
    if (!s.over) return null;
    if (s.result === "you") return "win";
    if (s.result === "computer") return "lose";
    return "done";
  }

  function legalMoves(s) {
    if (s.over) return [];
    const out = [];
    for (let i = 0; i < 9; i++) if (free(s, i)) out.push(i);
    return out;
  }

  return {
    FULL,
    LINES,
    ORDER,
    WORDS,
    COMMON,
    WON,
    start,
    restore,
    status,
    free,
    translate,
    translateback,
    wordAtLogical,
    winningLetter,
    bestMove,
    playYou,
    computerOpen,
    result,
    legalMoves,
    isWon,
  };
})();
