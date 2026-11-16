"use strict";

/*
 * Reverse Solitaire, from Alexander Bogomolny's applet rsolitaire.
 *
 * Same English 7×7 board as Peg Solitaire, but moves run backwards: a peg
 * jumps over an empty hole into an empty hole and the middle fills with a
 * peg. You start from a Peg Solitaire ending (one or two pegs) and rebuild
 * the matching starting layout. Nine puzzles match SetCross…SetDoubleGoal;
 * there is no Design-your-own. Winning Ways notes that reverse and forward
 * play are the same game under hole/peg duality.
 */
const RsolitaireCore = (() => {
  const N = 7;
  const OUT = 0;
  const PEG = 1;
  const EMPTY = 2;
  const SELECTED = 3;

  const NAMES = [
    "Cross", "Plus", "Fireplace", "Pyramid", "Arrow",
    "Diamond", "Central solitaire", "Skewed", "Double goal",
  ];

  function outsides(board) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) board[i][j] = OUT;
      for (let j = 5; j < N; j++) board[i][j] = OUT;
    }
    for (let i = 5; i < N; i++) {
      for (let j = 0; j < 2; j++) board[i][j] = OUT;
      for (let j = 5; j < N; j++) board[i][j] = OUT;
    }
  }

  function fill(value) {
    const board = [];
    for (let i = 0; i < N; i++) {
      board[i] = [];
      for (let j = 0; j < N; j++) board[i][j] = value;
    }
    return board;
  }

  function copyBoard(board) {
    return board.map((row) => row.slice());
  }

  /** Goal layouts = forward Peg Solitaire starts (applet m_Games). */
  function buildGoals() {
    const goals = [];

    {
      const board = fill(EMPTY);
      board[3][1] = PEG; board[2][2] = PEG; board[3][2] = PEG;
      board[4][2] = PEG; board[3][3] = PEG; board[3][4] = PEG;
      outsides(board);
      goals.push(board);
    }
    {
      const board = fill(EMPTY);
      for (let i = 1; i < 6; i++) { board[i][3] = PEG; board[3][i] = PEG; }
      outsides(board);
      goals.push(board);
    }
    {
      const board = fill(EMPTY);
      for (let i = 2; i < 5; i++) for (let j = 0; j < 4; j++) board[i][j] = PEG;
      outsides(board);
      board[3][3] = EMPTY;
      goals.push(board);
    }
    {
      const board = fill(EMPTY);
      for (let i = 0; i < N; i++) board[i][4] = PEG;
      for (let i = 1; i < N - 1; i++) board[i][3] = PEG;
      for (let i = 2; i < N - 2; i++) board[i][2] = PEG;
      for (let i = 3; i < N - 3; i++) board[i][1] = PEG;
      outsides(board);
      goals.push(board);
    }
    {
      const board = fill(EMPTY);
      for (let i = 2; i < N - 2; i++) {
        board[i][N - 1] = PEG; board[i][N - 2] = PEG; board[i][1] = PEG;
      }
      for (let i = 1; i < N - 1; i++) board[i][2] = PEG;
      board[3][3] = PEG; board[3][4] = PEG; board[3][0] = PEG;
      outsides(board);
      goals.push(board);
    }
    {
      const board = fill(PEG);
      board[2][0] = EMPTY; board[4][0] = EMPTY;
      board[2][N - 1] = EMPTY; board[4][N - 1] = EMPTY;
      board[0][2] = EMPTY; board[0][4] = EMPTY;
      board[N - 1][2] = EMPTY; board[N - 1][4] = EMPTY;
      outsides(board);
      board[3][3] = EMPTY;
      goals.push(board);
    }
    {
      const board = fill(PEG);
      outsides(board);
      board[3][3] = EMPTY;
      goals.push(board);
    }
    {
      const board = fill(PEG);
      outsides(board);
      board[2][2] = EMPTY;
      goals.push(board);
    }
    {
      const board = fill(PEG);
      outsides(board);
      board[2][2] = EMPTY; board[4][4] = EMPTY;
      goals.push(board);
    }
    return goals;
  }

  const GOALS = buildGoals();

  /** Applet SetStartingPosition(gameNo). */
  function startingBoard(gameNo) {
    const board = fill(EMPTY);
    outsides(board);
    if (gameNo === 7) {
      board[2][2] = PEG;
    } else if (gameNo === 8) {
      board[2][2] = PEG;
      board[4][4] = PEG;
    } else {
      board[3][3] = PEG;
    }
    return board;
  }

  function start(options) {
    const gameNo = Number.isInteger(options && options.gameNo) ? options.gameNo : 6;
    const idx = Math.max(0, Math.min(GOALS.length - 1, gameNo));
    return {
      gameNo: idx,
      name: NAMES[idx],
      board: startingBoard(idx),
      goal: copyBoard(GOALS[idx]),
      selected: null,
      history: [],
      won: false,
    };
  }

  function cell(state, i, j) {
    if (i < 0 || j < 0 || i >= N || j >= N) return OUT;
    return state.board[i][j];
  }

  function isPeg(value) {
    return value === PEG || value === SELECTED;
  }

  /** Reverse jump: peg over empty into empty; middle fills. */
  function canJump(state, fromI, fromJ, toI, toJ) {
    if (!isPeg(cell(state, fromI, fromJ))) return false;
    if (cell(state, toI, toJ) !== EMPTY) return false;
    const di = toI - fromI;
    const dj = toJ - fromJ;
    if (di * di + dj * dj !== 4) return false;
    if (di !== 0 && dj !== 0) return false;
    const midI = (fromI + toI) >> 1;
    const midJ = (fromJ + toJ) >> 1;
    return cell(state, midI, midJ) === EMPTY;
  }

  function legalMoves(state) {
    const moves = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (!isPeg(cell(state, i, j))) continue;
        for (const [di, dj] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
          const ti = i + di;
          const tj = j + dj;
          if (canJump(state, i, j, ti, tj)) moves.push({ from: [i, j], to: [ti, tj] });
        }
      }
    }
    return moves;
  }

  /** Applet CheckPos: every non-OUT cell matches the goal (peg/empty). */
  function isWon(state) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let pos = state.board[i][j];
        if (pos === OUT) continue;
        if (pos === SELECTED) pos = PEG;
        if (pos !== state.goal[i][j]) return false;
      }
    }
    return true;
  }

  function pegCount(state) {
    let n = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (isPeg(state.board[i][j])) n++;
      }
    }
    return n;
  }

  function click(state, i, j) {
    if (i < 0 || j < 0 || i >= N || j >= N) return state;
    if (state.won) return state;
    if (state.board[i][j] === OUT) return state;

    const next = {
      ...state,
      board: copyBoard(state.board),
      history: state.history.slice(),
      selected: state.selected ? state.selected.slice() : null,
    };

    if (!next.selected) {
      if (!isPeg(cell(next, i, j))) return state;
      next.board[i][j] = SELECTED;
      next.selected = [i, j];
      return next;
    }

    const [si, sj] = next.selected;
    if (si === i && sj === j) {
      next.board[si][sj] = PEG;
      next.selected = null;
      return next;
    }

    if (canJump(next, si, sj, i, j)) {
      const midI = (si + i) >> 1;
      const midJ = (sj + j) >> 1;
      next.board[si][sj] = EMPTY;
      next.board[i][j] = PEG;
      next.board[midI][midJ] = PEG;
      next.history.push({ from: [si, sj], to: [i, j] });
      next.selected = null;
      next.won = isWon(next);
      return next;
    }

    next.board[si][sj] = PEG;
    next.selected = null;
    return next;
  }

  function undo(state) {
    if (!state.history.length) return state;
    const next = {
      ...state,
      board: copyBoard(state.board),
      history: state.history.slice(),
      selected: null,
      won: false,
    };
    if (next.selected) {
      const [si, sj] = next.selected;
      if (next.board[si][sj] === SELECTED) next.board[si][sj] = PEG;
    }
    const move = next.history.pop();
    const [fi, fj] = move.from;
    const [ti, tj] = move.to;
    const midI = (fi + ti) >> 1;
    const midJ = (fj + tj) >> 1;
    // Reverse of reverse-jump = forward solitaire jump
    next.board[ti][tj] = EMPTY;
    next.board[fi][fj] = PEG;
    next.board[midI][midJ] = EMPTY;
    return next;
  }

  function result(state) {
    return state.won || isWon(state) ? "win" : null;
  }

  function snapshot(state) {
    return {
      gameNo: state.gameNo,
      name: state.name,
      board: copyBoard(state.board).map((row) => row.map((v) => (v === SELECTED ? PEG : v))),
      historyLength: state.history.length,
      won: state.won,
    };
  }

  function restore(snap) {
    const gameNo = Math.max(0, Math.min(GOALS.length - 1, Number(snap.gameNo) || 6));
    return {
      gameNo,
      name: NAMES[gameNo],
      board: snap.board ? copyBoard(snap.board) : startingBoard(gameNo),
      goal: copyBoard(GOALS[gameNo]),
      selected: null,
      history: [],
      won: !!snap.won,
    };
  }

  return {
    N,
    OUT,
    PEG,
    EMPTY,
    SELECTED,
    NAMES,
    GOALS,
    copyBoard,
    start,
    startingBoard,
    cell,
    canJump,
    legalMoves,
    isWon,
    pegCount,
    click,
    undo,
    result,
    snapshot,
    restore,
  };
})();
