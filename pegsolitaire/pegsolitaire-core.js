"use strict";

/*
 * Peg Solitaire (Hi-Q), from Alexander Bogomolny's applet pegsolitaire.
 *
 * English 7×7 board (corners cut). A peg jumps orthogonally over a neighbour
 * into an empty hole; the jumped peg is removed. Ten starting layouts match
 * the applet's SetCross…SetDesignOwn. A layout either asks for a single peg
 * at the centre, or (Skewed / Double goal) that every starting peg is gone —
 * the applet's CheckPos, which does not also require empties to be filled.
 */
const PegsolitaireCore = (() => {
  const N = 7;
  const OUT = 0;
  const PEG = 1;
  const EMPTY = 2;
  const SELECTED = 3;

  const NAMES = [
    "Cross", "Plus", "Fireplace", "Pyramid", "Arrow",
    "Diamond", "Central solitaire", "Skewed", "Double goal", "Design your own",
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

  function buildPuzzles() {
    const puzzles = [];

    // 0 Cross
    {
      const board = fill(EMPTY);
      board[3][1] = PEG; board[2][2] = PEG; board[3][2] = PEG;
      board[4][2] = PEG; board[3][3] = PEG; board[3][4] = PEG;
      outsides(board);
      puzzles.push({ name: NAMES[0], centerGoal: true, board });
    }
    // 1 Plus
    {
      const board = fill(EMPTY);
      for (let i = 1; i < 6; i++) { board[i][3] = PEG; board[3][i] = PEG; }
      outsides(board);
      puzzles.push({ name: NAMES[1], centerGoal: true, board });
    }
    // 2 Fireplace
    {
      const board = fill(EMPTY);
      for (let i = 2; i < 5; i++) for (let j = 0; j < 4; j++) board[i][j] = PEG;
      outsides(board);
      board[3][3] = EMPTY;
      puzzles.push({ name: NAMES[2], centerGoal: true, board });
    }
    // 3 Pyramid
    {
      const board = fill(EMPTY);
      for (let i = 0; i < N; i++) board[i][4] = PEG;
      for (let i = 1; i < N - 1; i++) board[i][3] = PEG;
      for (let i = 2; i < N - 2; i++) board[i][2] = PEG;
      for (let i = 3; i < N - 3; i++) board[i][1] = PEG;
      outsides(board);
      puzzles.push({ name: NAMES[3], centerGoal: true, board });
    }
    // 4 Arrow
    {
      const board = fill(EMPTY);
      for (let i = 2; i < N - 2; i++) {
        board[i][N - 1] = PEG; board[i][N - 2] = PEG; board[i][1] = PEG;
      }
      for (let i = 1; i < N - 1; i++) board[i][2] = PEG;
      board[3][3] = PEG; board[3][4] = PEG; board[3][0] = PEG;
      outsides(board);
      puzzles.push({ name: NAMES[4], centerGoal: true, board });
    }
    // 5 Diamond
    {
      const board = fill(PEG);
      board[2][0] = EMPTY; board[4][0] = EMPTY;
      board[2][N - 1] = EMPTY; board[4][N - 1] = EMPTY;
      board[0][2] = EMPTY; board[0][4] = EMPTY;
      board[N - 1][2] = EMPTY; board[N - 1][4] = EMPTY;
      outsides(board);
      board[3][3] = EMPTY;
      puzzles.push({ name: NAMES[5], centerGoal: true, board });
    }
    // 6 Central solitaire (default)
    {
      const board = fill(PEG);
      outsides(board);
      board[3][3] = EMPTY;
      puzzles.push({ name: NAMES[6], centerGoal: true, board });
    }
    // 7 Skewed — reverse goal
    {
      const board = fill(PEG);
      outsides(board);
      board[2][2] = EMPTY;
      puzzles.push({ name: NAMES[7], centerGoal: false, board });
    }
    // 8 Double goal — reverse goal
    {
      const board = fill(PEG);
      outsides(board);
      board[2][2] = EMPTY; board[4][4] = EMPTY;
      puzzles.push({ name: NAMES[8], centerGoal: false, board });
    }
    // 9 Design your own (starts like central; centerGoal follows the checkbox)
    {
      const board = fill(PEG);
      outsides(board);
      board[3][3] = EMPTY;
      puzzles.push({ name: NAMES[9], centerGoal: true, board });
    }
    return puzzles;
  }

  const PUZZLES = buildPuzzles();

  function start(options) {
    const gameNo = Number.isInteger(options && options.gameNo) ? options.gameNo : 6;
    const idx = Math.max(0, Math.min(PUZZLES.length - 1, gameNo));
    const puzzle = PUZZLES[idx];
    let centerGoal = puzzle.centerGoal;
    if (idx === 9 && options && typeof options.centerGoal === "boolean") {
      centerGoal = options.centerGoal;
    }
    const board = copyBoard(puzzle.board);
    return {
      gameNo: idx,
      name: puzzle.name,
      centerGoal,
      board,
      starting: copyBoard(board),
      selected: null,
      history: [],
      designing: false,
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

  /** Orthogonal jump of exactly two squares over a peg into an empty hole. */
  function canJump(state, fromI, fromJ, toI, toJ) {
    if (!isPeg(cell(state, fromI, fromJ))) return false;
    if (cell(state, toI, toJ) !== EMPTY) return false;
    const di = toI - fromI;
    const dj = toJ - fromJ;
    if (di * di + dj * dj !== 4) return false; // Math.sqrt == 2
    if (di !== 0 && dj !== 0) return false; // orthogonal only (sqrt 2 diagonal would be 2,2)
    // di*di+dj*dj===4 with orthogonal ⇒ |di|==2 or |dj|==2
    const midI = (fromI + toI) >> 1;
    const midJ = (fromJ + toJ) >> 1;
    return cell(state, midI, midJ) === PEG || cell(state, midI, midJ) === SELECTED;
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

  /** Applet CheckPos. */
  function isWon(state) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const pos = state.board[i][j];
        if (pos === OUT) continue;
        if (state.centerGoal) {
          if (i === 3 && j === 3) continue;
          if (pos === PEG || pos === SELECTED) return false;
        } else {
          if ((pos === PEG || pos === SELECTED) && state.starting[i][j] === PEG) return false;
          if (pos === OUT && state.starting[i][j] === OUT) return false; // unreachable; kept for fidelity
        }
      }
    }
    return true;
  }

  function clearSelection(state) {
    if (!state.selected) return;
    const [i, j] = state.selected;
    if (state.board[i][j] === SELECTED) state.board[i][j] = PEG;
    state.selected = null;
  }

  /**
   * Click cell (i, j). Returns a new state, or the same reference when the
   * click does nothing. Design mode toggles pegs via ResetPos rules.
   */
  function click(state, i, j) {
    if (i < 0 || j < 0 || i >= N || j >= N) return state;
    if (state.won) return state;

    if (state.designing) {
      const next = {
        ...state,
        board: copyBoard(state.board),
        starting: copyBoard(state.starting),
        history: [],
        selected: null,
        won: false,
      };
      const pos = next.board[i][j];
      if (pos === PEG || pos === SELECTED) {
        next.board[i][j] = EMPTY;
        next.starting[i][j] = EMPTY;
        return next;
      }
      if (next.starting[i][j] === EMPTY || pos === EMPTY) {
        // Applet: only places a peg if starting was EMPTY (a hole).
        if (next.board[i][j] === OUT) return state;
        next.board[i][j] = PEG;
        next.starting[i][j] = PEG;
        return next;
      }
      return state;
    }

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
      next.board[midI][midJ] = EMPTY;
      next.history.push({ from: [si, sj], to: [i, j] });
      next.selected = null;
      next.won = isWon(next);
      return next;
    }

    // Invalid target: deselect (applet sets the selected cell back to peg).
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
    clearSelection(next);
    const move = next.history.pop();
    const [fi, fj] = move.from;
    const [ti, tj] = move.to;
    const midI = (fi + ti) >> 1;
    const midJ = (fj + tj) >> 1;
    next.board[ti][tj] = EMPTY;
    next.board[fi][fj] = PEG;
    next.board[midI][midJ] = PEG;
    return next;
  }

  function pegCount(state) {
    let n = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) if (isPeg(state.board[i][j])) n++;
    }
    return n;
  }

  function snapshot(state) {
    return {
      gameNo: state.gameNo,
      name: state.name,
      centerGoal: state.centerGoal,
      board: copyBoard(state.board),
      starting: copyBoard(state.starting),
      selected: state.selected ? state.selected.slice() : null,
      historyLength: state.history.length,
      designing: state.designing,
      won: state.won,
      pegs: pegCount(state),
    };
  }

  return {
    N, OUT, PEG, EMPTY, SELECTED, NAMES, PUZZLES,
    start, legalMoves, canJump, click, undo, isWon, pegCount, snapshot, copyBoard,
  };
})();
