"use strict";

/*
 * Four Pegs That Form a Square -- pure logic, no DOM. Ported from Alexander
 * Bogomolny's FourPegs applet
 * (cut-the-knot.org/Curriculum/Algebra/FourPegs.shtml). classes.zip holds only
 * bytecode, so the rule below was read off `javap -c -p` on FourPegsCanvas.
 *
 * The board is a square grid and the pegs sit on its points. VerifyDrop() is
 * the whole rule, in three steps: Round() snaps the dropped peg to the nearest
 * grid point; IsAvailable() rejects a point another peg already holds; and
 * GetPossibleMiddle() -- the midpoint of where the peg came from and where it
 * landed -- has to coincide with some other peg. So:
 *
 *   a peg may jump over another peg and land the same distance beyond it,
 *   on the far side. The peg jumped over does not move.
 *
 * The question the page asks is whether the four pegs can ever form a square
 * LARGER than the one they started in. They cannot, and they cannot form a
 * smaller or a tilted one either, which is why this port has no win state: the
 * status line just names the shape the four pegs are making.
 *
 * The applet's controls are all here: four pegs or five (the fifth may be
 * dropped anywhere once, Id == NP-1 with FirstOut set, and then jumps like the
 * rest), a grid toggle, and the side of the starting square measured in grid
 * steps. Two numbers are scaled down from the applet: its grid is 30 x 30 with
 * sides up to 20, which is far too fine to tap on a phone, so this uses 12 x 12
 * with sides up to 4. The puzzle does not notice -- shrinking the grid is just
 * a change of unit -- except that a side of 1 makes the fifth peg pointless,
 * since every grid point is then already in the pegs' own lattice.
 */
const PegsCore = (() => {
  const GRID = 12; // cells across; points are 0..GRID in each direction
  const SIDE_MIN = 1;
  const SIDE_MAX = 4;
  const SIDE_DEFAULT = 1; // FourPegsCanvas: Coef
  const PEGS_DEFAULT = 4; // FourPegsCanvas: NP

  const key = (p) => `${p.x},${p.y}`;
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const onGrid = (p) => p.x >= 0 && p.x <= GRID && p.y >= 0 && p.y <= GRID;

  /** Reset(): the square centred on the grid, with the given side. */
  function start(side) {
    const lo = Math.round((GRID - side) / 2);
    const hi = lo + side;
    return [
      { x: lo, y: lo },
      { x: hi, y: lo },
      { x: hi, y: hi },
      { x: lo, y: hi },
    ];
  }

  /** Where the fifth peg is parked before the player places it. */
  const spare = () => ({ x: 0, y: 0, loose: true });

  /**
   * VerifyDrop(): peg `i` may land on `to` when the point is on the grid, no
   * peg is there already, and the midpoint of the move holds another peg.
   */
  function canMove(pegs, i, to) {
    if (!onGrid(to)) return false;
    const from = pegs[i];
    if (same(from, to)) return false;
    if (pegs.some((p, j) => j !== i && same(p, to))) return false;
    const mx = from.x + to.x;
    const my = from.y + to.y;
    if (mx % 2 || my % 2) return false; // the midpoint is not a grid point
    return pegs.some((p, j) => j !== i && p.x * 2 === mx && p.y * 2 === my);
  }

  /** Every point peg `i` can jump to: one per other peg, when it is free. */
  function legalMoves(pegs, i) {
    const out = [];
    const seen = new Set();
    for (let j = 0; j < pegs.length; j++) {
      if (j === i) continue;
      const to = { x: 2 * pegs[j].x - pegs[i].x, y: 2 * pegs[j].y - pegs[i].y };
      if (seen.has(key(to))) continue;
      if (!canMove(pegs, i, to)) continue;
      seen.add(key(to));
      out.push(to);
    }
    return out;
  }

  /** The move as a new set of pegs, or null when it is not legal. */
  function move(pegs, i, to) {
    if (!canMove(pegs, i, to)) return null;
    const next = pegs.map((p) => ({ x: p.x, y: p.y }));
    next[i] = { x: to.x, y: to.y };
    return next;
  }

  /**
   * The shape of four points: a square's six squared distances are four equal
   * sides and two diagonals of twice that. Integer arithmetic, so exact.
   */
  function squareOf(points) {
    if (points.length !== 4) return null;
    const d2 = [];
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        const dx = points[a].x - points[b].x;
        const dy = points[a].y - points[b].y;
        d2.push({ v: dx * dx + dy * dy, a, b });
      }
    }
    const sorted = d2.map((e) => e.v).sort((p, q) => p - q);
    const s = sorted[0];
    if (!s) return null; // two pegs on the same point
    const isSquare =
      sorted[0] === s && sorted[1] === s && sorted[2] === s && sorted[3] === s &&
      sorted[4] === 2 * s && sorted[5] === 2 * s;
    if (!isSquare) return null;
    // Axis-aligned when one of the sides is horizontal.
    const side = d2.find((e) => e.v === s);
    const dx = points[side.a].x - points[side.b].x;
    const dy = points[side.a].y - points[side.b].y;
    return { side2: s, side: Math.sqrt(s), axisAligned: dx === 0 || dy === 0 };
  }

  /** The area of the quadrilateral the pegs make, by the shoelace formula. */
  function area(points) {
    const hull = convexOrder(points);
    let twice = 0;
    for (let i = 0; i < hull.length; i++) {
      const p = hull[i];
      const q = hull[(i + 1) % hull.length];
      twice += p.x * q.y - q.x * p.y;
    }
    return Math.abs(twice) / 2;
  }

  /** The points sorted by angle about their centroid, so they form a polygon. */
  function convexOrder(points) {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    return points.slice().sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
  }

  /**
   * The lattice the points generate, as its Hermite normal form
   * `{ a, c, b }`, meaning the basis (a, 0) and (c, b). This is the quantity
   * the proof on cut-the-knot.org turns on: a jump replaces one point by
   * `2q - p`, which is already an integer combination of the others, and the
   * jump can be undone, so the lattice before and after contain each other and
   * are equal. The pegs therefore never leave the grid they started in, and
   * `a` and `b` stay exactly the side of the opening square.
   */
  function latticeBasis(points) {
    const base = points[0];
    const vs = points.slice(1).map((p) => [p.x - base.x, p.y - base.y]);

    // A vector w in the lattice whose x component is the gcd of all the x
    // components, built by running the extended Euclidean algorithm over them.
    let w = [0, 0];
    for (const v of vs) {
      const [g, s, t] = egcd(w[0], v[0]);
      w = [g, s * w[1] + t * v[1]];
    }

    // Clearing that x component from every vector leaves a vertical lattice.
    let b = 0;
    for (const v of vs) {
      const k = w[0] ? v[0] / w[0] : 0;
      b = gcd(b, v[1] - k * w[1]);
    }

    const a = Math.abs(w[0]);
    // Only the class of w's y component modulo b is meaningful, so pin it down.
    const c = b ? ((w[1] % b) + b) % b : Math.abs(w[1]);
    return { a, c, b };
  }

  /** Extended Euclid: returns [g, s, t] with s*a + t*b = g = gcd(a, b). */
  function egcd(a, b) {
    if (!b) return [Math.abs(a), a < 0 ? -1 : 1, 0];
    if (!a) return [Math.abs(b), 0, b < 0 ? -1 : 1];
    let [old_r, r] = [a, b];
    let [old_s, s] = [1, 0];
    let [old_t, t] = [0, 1];
    while (r) {
      const q = Math.trunc(old_r / r);
      [old_r, r] = [r, old_r - q * r];
      [old_s, s] = [s, old_s - q * s];
      [old_t, t] = [t, old_t - q * t];
    }
    if (old_r < 0) return [-old_r, -old_s, -old_t];
    return [old_r, old_s, old_t];
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }

  return {
    GRID, SIDE_MIN, SIDE_MAX, SIDE_DEFAULT, PEGS_DEFAULT,
    start, spare, onGrid, same, canMove, legalMoves, move,
    squareOf, area, convexOrder, latticeBasis, egcd, gcd,
  };
})();
