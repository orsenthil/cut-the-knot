"use strict";

/*
 * Lewis Carroll's Game of Logic (Bogomolny's LCGame applet) - the diagrams.
 *
 * Carroll's method for syllogisms. A bilateral diagram is a square of four
 * cells for two attributes (rows a / not-a, columns b / not-b). A red counter
 * in a cell says "some things are like this"; a grey one says "none are"; a
 * red counter on the line between two cells says "at least one of these".
 * Two premises - one about x and m, one about y and m - go into a trilateral
 * diagram, which has the m cells inside an inner square and the not-m cells
 * around it. Reading that diagram while ignoring m gives the conclusion, a
 * bilateral diagram about x and y: m has been eliminated.
 *
 * Read off the bytecode:
 *   - BSmartDiagram: positions 0-3 are the cells (top-left, top-right,
 *     bottom-right, bottom-left), 4-7 the four inner lines (left 0|3, top 0|1,
 *     right 1|2, bottom 3|2); 0 empty, 1 red, 2 grey. A counter goes only on an
 *     empty place, and MakesSense / CheckConflict / CheckConsistency /
 *     CheckSuperfluous decide what happens: grey never goes on a line; grey in
 *     a cell pushes a red line counter into the cell's neighbour (or removes it
 *     if that is red already); red on a line between two grey cells is refused,
 *     beside one grey cell it goes into the other cell instead, and between two
 *     cells that are both taken it "does not make sense"; red in a cell clears
 *     red line counters that it makes superfluous.
 *   - TDumbDiagram: 16 places, the even ones cells (0, 2, 4, 6 the not-m parts
 *     of the quadrants x y, x y', x' y', x' y; 8, 10, 12, 14 the m parts), the
 *     odd ones lines between neighbouring quadrants. Received() carries a
 *     premise's four cells in (grey: both halves grey; red: red on the line
 *     between the halves - line counters in a premise are not carried), with
 *     the same push / clear rules. The conclusion's cells are CheckReturn() of
 *     each quadrant's two halves: grey if both grey, red if either is red.
 *
 * Two differences: the applet silently lets a later premise overwrite an
 * earlier one when they contradict each other; here that is reported. And its
 * "All ... are ..." sentence needed a red line or two red cells; the sentences
 * here are read from the cells directly (red in a b and grey in a b').
 */

var CarrollLogicCore = (function () {
  const EMPTY = 0;
  const RED = 1;
  const GREY = 2;

  /* ------------------------------------------------- bilateral diagrams */

  const blank = (n) => new Array(n).fill(EMPTY);

  // Line -> the two cells it separates, as CheckConsistency is called in MakesSense.
  const BI_LINE_CELLS = { 4: [3, 0], 5: [0, 1], 6: [1, 2], 7: [2, 3] };

  /** BSmartDiagram.CheckHit + MakesSense: put `chip` on place p. Returns { ok, note }. */
  function biPlace(pos, p, chip) {
    if (pos[p] !== EMPTY) return { ok: false, note: "" };
    let note = "";
    const conflict = (line, cell) => {
      if (pos[line] !== RED) return;
      if (pos[cell] === RED) note = "Removed red chip";
      else { pos[cell] = RED; note = "Moved red chip"; }
      pos[line] = EMPTY;
    };
    if (chip === GREY) {
      if (p >= 4) return { ok: false, note: "Does not make sense" };
      ({ 0: () => { conflict(5, 1); conflict(4, 3); }, 1: () => { conflict(5, 0); conflict(6, 2); },
         2: () => { conflict(6, 1); conflict(7, 3); }, 3: () => { conflict(4, 0); conflict(7, 2); } })[p]();
    } else if (p >= 4) {
      const [a, b] = BI_LINE_CELLS[p];
      if (pos[a] === GREY && pos[b] === GREY) return { ok: false, note: "Causes conflict" };
      if (pos[a] > 0 && pos[b] > 0) return { ok: false, note: "Does not make sense" };
      if (pos[a] === GREY) { pos[b] = RED; return { ok: false, note: "Moved red chip" }; }
      if (pos[b] === GREY) { pos[a] = RED; return { ok: false, note: "Moved red chip" }; }
    } else {
      const sup = (l1, c1, l2, c2) => {
        if (pos[l1] && pos[c1]) { pos[l1] = EMPTY; note = "Removed red chip"; }
        if (pos[l2] && pos[c2]) { pos[l2] = EMPTY; note = "Removed red chip"; }
      };
      ({ 0: () => sup(4, 3, 5, 1), 1: () => sup(5, 0, 6, 2), 2: () => sup(6, 1, 7, 3), 3: () => sup(7, 2, 4, 0) })[p]();
    }
    pos[p] = chip;
    return { ok: true, note };
  }

  /* ------------------------------------------------ trilateral diagram */

  // Each line's neighbouring cells on its ring (m_Adjunct).
  const ADJ = [[1, 7], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 0],
    [9, 15], [8, 10], [9, 11], [10, 12], [11, 13], [12, 14], [13, 15], [14, 8]];
  // For each cell: [line, cell beyond it] twice (PerhapsMoveRed / CheckSuperfluity pairs).
  const TRI_NEIGHBOURS = {
    0: [[1, 2], [7, 6]], 2: [[1, 0], [3, 4]], 4: [[3, 2], [5, 6]], 6: [[5, 4], [7, 0]],
    8: [[9, 10], [15, 14]], 10: [[9, 8], [11, 12]], 12: [[11, 10], [13, 14]], 14: [[13, 12], [15, 8]],
  };

  function triAdd(pos, p, chip) {
    const conflict = (line, cell) => {
      if (pos[line] !== RED) return;
      if (pos[cell] !== RED) pos[cell] = RED;
      pos[line] = EMPTY;
    };
    const superfluity = (cell) => {
      for (const [line, other] of TRI_NEIGHBOURS[cell]) if (pos[line] && pos[other]) pos[line] = EMPTY;
    };
    if (chip === GREY) {
      if (p % 2 === 1) return false;
      for (const [line, other] of TRI_NEIGHBOURS[p]) conflict(line, other);
    } else if (chip === RED) {
      if (p % 2 === 1) {
        const [a, b] = ADJ[p];
        // CheckConsistency on the line's two cells
        if (pos[a] === GREY && pos[b] === GREY) return false;
        if (pos[a] > 0 && pos[b] > 0) return false;
        if (pos[a] === GREY) { pos[b] = RED; return false; }
        if (pos[b] === GREY) { pos[a] = RED; return false; }
      } else {
        superfluity(p);
      }
      for (let c = 0; c < 16; c += 2) superfluity(c); // PerhapsRemoveRed
    }
    pos[p] = chip;
    return true;
  }

  // Received(): premise cell -> [grey halves..., red line].
  const RECEIVE = [
    [[8, 10, 9], [0, 2, 1], [4, 6, 5], [12, 14, 13]], // premise about x and m
    [[8, 14, 15], [0, 6, 7], [2, 4, 3], [10, 12, 11]], // premise about y and m
  ];

  /** The trilateral diagram for two premise diagrams (each 8 places; only cells are used). */
  function trilateral(premA, premB) {
    const pos = blank(16);
    [premA, premB].forEach((prem, k) => {
      for (let c = 0; c < 4; c++) {
        const [g1, g2, line] = RECEIVE[k][c];
        if (prem[c] === GREY) { triAdd(pos, g1, GREY); triAdd(pos, g2, GREY); }
        else if (prem[c] === RED) triAdd(pos, line, RED);
      }
    });
    return pos;
  }

  /** GetNW/NE/SE/SW(): the conclusion's four cells (x y, x y', x' y', x' y). */
  function conclusion(tri) {
    const ret = (a, b) => (tri[a] === GREY && tri[b] === GREY ? GREY : tri[a] === RED || tri[b] === RED ? RED : EMPTY);
    return [ret(0, 8), ret(2, 10), ret(4, 12), ret(6, 14)];
  }

  /* --------------------------------------------- meaning, and sentences */

  // Which of the 8 kinds of thing (bit 0: x, bit 1: y, bit 2: m) each place covers.
  const kind = (x, y, m) => (x ? 1 : 0) | (y ? 2 : 0) | (m ? 4 : 0);
  // Premise A: rows x / x', columns m / m'. Premise B: rows y / y', columns m / m'.
  const PREMISE_CELLS = [
    [[kind(1, 0, 1), kind(1, 1, 1)], [kind(1, 0, 0), kind(1, 1, 0)], [kind(0, 0, 0), kind(0, 1, 0)], [kind(0, 0, 1), kind(0, 1, 1)]],
    [[kind(0, 1, 1), kind(1, 1, 1)], [kind(0, 1, 0), kind(1, 1, 0)], [kind(0, 0, 0), kind(1, 0, 0)], [kind(0, 0, 1), kind(1, 0, 1)]],
  ];
  // Trilateral cells and conclusion cells, for the test and the drawing.
  const TRI_CELL_KIND = { 0: kind(1, 1, 0), 2: kind(1, 0, 0), 4: kind(0, 0, 0), 6: kind(0, 1, 0),
    8: kind(1, 1, 1), 10: kind(1, 0, 1), 12: kind(0, 0, 1), 14: kind(0, 1, 1) };
  const CONCLUSION_CELLS = [[kind(1, 1, 0), kind(1, 1, 1)], [kind(1, 0, 0), kind(1, 0, 1)], [kind(0, 0, 0), kind(0, 0, 1)], [kind(0, 1, 0), kind(0, 1, 1)]];

  /** Is there any world of things in which both premises hold? */
  function consistent(premA, premB) {
    for (let world = 0; world < 256; world++) {
      if (satisfies(world, premA, PREMISE_CELLS[0]) && satisfies(world, premB, PREMISE_CELLS[1])) return true;
    }
    return false;
  }
  // world: bit k set means things of kind k exist.
  function satisfies(world, pos, cells) {
    const has = (k) => (world >> k) & 1;
    for (let c = 0; c < 4; c++) {
      const [k1, k2] = cells[c];
      if (pos[c] === RED && !has(k1) && !has(k2)) return false;
      if (pos[c] === GREY && (has(k1) || has(k2))) return false;
    }
    for (const [line, [a, b]] of Object.entries(BI_LINE_CELLS)) {
      if (pos[line] !== RED) continue;
      if (![...cells[a], ...cells[b]].some(has)) return false;
    }
    return true;
  }

  /**
   * Sentences a bilateral diagram says, for row attribute a and column
   * attribute b (cells: a b, a b', a' b', a' b).
   */
  function sentences(cells, a, b) {
    const not = (s) => "non-" + s;
    const names = [[a, b], [a, not(b)], [not(a), not(b)], [not(a), b]];
    const out = [];
    names.forEach(([p, q], i) => {
      if (cells[i] === RED) out.push(`Some ${p} are ${q}`);
      if (cells[i] === GREY) out.push(`No ${p} are ${q}`);
    });
    // All p are q: some p q, and no p q'. Rows: cells (0,1) and (3,2); columns: (0,3) and (1,2).
    const all = (has, none, p, q) => { if (cells[has] === RED && cells[none] === GREY) out.push(`All ${p} are ${q}`); };
    all(0, 1, a, b); all(1, 0, a, not(b)); all(3, 2, not(a), b); all(2, 3, not(a), not(b));
    all(0, 3, b, a); all(3, 0, b, not(a)); all(1, 2, not(b), a); all(2, 1, not(b), not(a));
    return out;
  }

  return {
    EMPTY, RED, GREY, BI_LINE_CELLS, PREMISE_CELLS, TRI_CELL_KIND, CONCLUSION_CELLS,
    blank, biPlace, triAdd, trilateral, conclusion, consistent, satisfies, sentences,
  };
})();
