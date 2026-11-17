"use strict";

/*
 * Trigg Tromino (Bogomolny's TriggTromino applet).
 *
 * An 8 by 8 board with the centre four squares removed (60 left). Cover it
 * with L-trominoes — three squares in an L. Charles W. Trigg asked which
 * fault-line counts are possible: a fault line is an interior grid line that
 * no tromino crosses, so one half of the tiling can slide past the other.
 *
 * The applet (sibling of LminoRect) only lets you place pieces: click three
 * free squares in order, the middle one the corner of the L; "Remove last"
 * pops a piece; Wire/Blocks switches the drawing. Size spinners exist in the
 * bytecode but are never added to the panel, so the board stays 8 by 8 with
 * the hole fixed at rows/cols 3 and 4. CheckFinished() celebrates when no
 * square is still "available"; here finished means every non-hole square is
 * covered, which is the puzzle the page states.
 *
 * Fault counting is not in the applet — the page poses Trigg's question and
 * Benjamin Schwartz's solution answers it — so the core adds it so the page
 * can report how many fault lines a covering has, and the logic test can
 * check the claims (0, 1, 2 and 3 are possible; 4 is not).
 */

var TriggTrominoCore = (function () {
  const SIZE = 8;
  const HOLE = new Set(["3,3", "3,4", "4,3", "4,4"]);
  const isHole = (r, c) => HOLE.has(r + "," + c);

  const SHAPES = [
    [[0, 0], [0, 1], [1, 0]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, -1]],
  ];

  function start() {
    const owner = Array.from({ length: SIZE }, () => new Array(SIZE).fill(-1));
    for (const key of HOLE) {
      const [r, c] = key.split(",").map(Number);
      owner[r][c] = -2; // hole: never coverable
    }
    return { size: SIZE, owner, pieces: [], building: [] };
  }

  const free = (s, r, c) =>
    r >= 0 && r < SIZE && c >= 0 && c < SIZE && s.owner[r][c] === -1;

  const touch = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

  /** TroBlock.IsConsistent(): may this square be the next one of the piece? */
  function canAdd(s, r, c) {
    if (!free(s, r, c)) return false;
    const b = s.building;
    if (b.some(([x, y]) => x === r && y === c)) return false;
    if (b.length === 0) return true;
    if (!touch(b[b.length - 1], [r, c])) return false;
    if (b.length === 2) {
      const [p, q] = b;
      if ((p[0] === q[0] && q[0] === r) || (p[1] === q[1] && q[1] === c)) return false;
    }
    return true;
  }

  /**
   * One click: add to the piece being built, or restart from this square if it
   * does not fit (the applet drops an inconsistent Block). Returns "placed",
   * "added", or "refused".
   */
  function click(s, r, c) {
    if (isHole(r, c) || (r >= 0 && r < SIZE && c >= 0 && c < SIZE && s.owner[r][c] >= 0)) {
      s.building = [];
      return "refused";
    }
    if (!canAdd(s, r, c)) s.building = [];
    if (!canAdd(s, r, c)) return "refused";
    s.building.push([r, c]);
    if (s.building.length < 3) return "added";
    const id = s.pieces.length;
    for (const [x, y] of s.building) s.owner[x][y] = id;
    s.pieces.push(s.building.map((cell) => cell.slice()));
    s.building = [];
    return "placed";
  }

  function removeLast(s) {
    const p = s.pieces.pop();
    if (!p) return false;
    for (const [x, y] of p) s.owner[x][y] = -1;
    s.building = [];
    return true;
  }

  const finished = (s) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!isHole(r, c) && s.owner[r][c] < 0) return false;
      }
    }
    return true;
  };

  /**
   * Interior grid lines no tromino crosses. Line h (1..7) lies between rows
   * h-1 and h; line v between columns v-1 and v. A piece crosses a line when
   * it has a square on each side — the hole does not itself cross anything.
   */
  function faults(s) {
    const horizontal = [];
    const vertical = [];
    for (let h = 1; h < SIZE; h++) {
      const crossed = s.pieces.some(
        (p) => p.some(([r]) => r === h - 1) && p.some(([r]) => r === h)
      );
      if (!crossed) horizontal.push(h);
    }
    for (let v = 1; v < SIZE; v++) {
      const crossed = s.pieces.some(
        (p) => p.some(([, c]) => c === v - 1) && p.some(([, c]) => c === v)
      );
      if (!crossed) vertical.push(v);
    }
    return { horizontal, vertical };
  }

  const faultCount = (s) => {
    const f = faults(s);
    return f.horizontal.length + f.vertical.length;
  };

  /** Place a finished L given as three cells (any order with corner in middle optional). */
  function placePiece(s, cells) {
    if (cells.length !== 3) return false;
    if (!cells.every(([r, c]) => free(s, r, c))) return false;
    const touchCount = (a) => cells.filter((b) => b !== a && touch(a, b)).length;
    const corner = cells.find((a) => touchCount(a) === 2);
    if (!corner) return false;
    const ends = cells.filter((a) => a !== corner);
    if (!touch(ends[0], corner) || !touch(ends[1], corner)) return false;
    if (ends[0][0] === ends[1][0] || ends[0][1] === ends[1][1]) return false; // straight
    const id = s.pieces.length;
    const piece = [ends[0], corner, ends[1]].map((cell) => cell.slice());
    for (const [r, c] of piece) s.owner[r][c] = id;
    s.pieces.push(piece);
    s.building = [];
    return true;
  }

  /**
   * Exact search: first empty non-hole cell in reading order, try every L that
   * covers it. Returns a list of pieces, or null. Optional `wantFaults` stops
   * at the first covering whose fault count matches (null = any covering).
   */
  function findCovering(wantFaults) {
    const used = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
    for (const key of HOLE) {
      const [r, c] = key.split(",").map(Number);
      used[r][c] = true;
    }
    const pieces = [];
    function next() {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (!used[r][c]) return [r, c];
        }
      }
      return null;
    }
    function go() {
      const at = next();
      if (!at) {
        const s = start();
        for (const p of pieces) placePiece(s, p);
        if (wantFaults == null || faultCount(s) === wantFaults) return true;
        return false;
      }
      for (const shape of SHAPES) {
        const cells = shape.map(([dr, dc]) => [at[0] + dr, at[1] + dc]);
        if (
          cells.every(
            ([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE && !used[r][c]
          )
        ) {
          for (const [r, c] of cells) used[r][c] = true;
          pieces.push(cells);
          if (go()) return true;
          pieces.pop();
          for (const [r, c] of cells) used[r][c] = false;
        }
      }
      return false;
    }
    return go() ? pieces.map((p) => p.map((c) => c.slice())) : null;
  }

  /**
   * Schwartz's lemmas, as claims on a finished covering:
   *   - no fault next to the outer edge (lines 1 or 7)
   *   - no two adjacent fault lines
   * Candidate lines that can ever be faults: 3,4,5 horizontally and vertically.
   */
  function lemmaOk(s) {
    if (!finished(s)) return false;
    const f = faults(s);
    for (const line of [...f.horizontal, ...f.vertical]) {
      if (line === 1 || line === 7) return false;
      if (line === 2 || line === 6) return false; // 2xn with n not divisible by 3
    }
    const adj = (arr) => {
      const set = new Set(arr);
      for (const x of arr) if (set.has(x + 1)) return true;
      return false;
    };
    if (adj(f.horizontal) || adj(f.vertical)) return false;
    return true;
  }

  return {
    SIZE,
    HOLE,
    SHAPES,
    isHole,
    start,
    free,
    canAdd,
    click,
    removeLast,
    finished,
    faults,
    faultCount,
    placePiece,
    findCovering,
    lemmaOk,
  };
})();
