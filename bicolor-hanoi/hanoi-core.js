"use strict";

/*
 * Bicolor Towers of Hanoi -- pure logic, no DOM. Ported from Alexander
 * Bogomolny's BiColorHanoi applet
 * (cut-the-knot.org/recurrence/BiColorHanoi.shtml). classes.zip has only the
 * .class files, so the setup, the move rule and the goal were read off
 * `javap -c -p BiColorHanoiCanvas.class`.
 *
 * Setup (Reset): three pegs, numbered 0, 1, 2. Pegs 0 and 1 each get one ring
 * of every size from N down to 1, biggest at the bottom. The two rings of a
 * given size are always opposite colours, and the colour alternates as you go
 * up, so the two towers are striped the opposite way round:
 *
 *   for (k = 0; k < N; k++) {                     // k = 0 is the bottom ring
 *     ring = new BiColorRing(N - k, k);
 *     ring.SetColor(color != 0 ? ChipColor1 : ChipColor2);  push on peg 0
 *     ring = new BiColorRing(N - k, k);
 *     ring.SetColor(color != 0 ? ChipColor2 : ChipColor1);  push on peg 1
 *     color = (color != 0) ? 0 : 1;
 *   }
 *
 * Move rule (CanSettle): a ring may be dropped on a peg that is empty, or
 * whose top ring is not smaller --
 *
 *   if (top.Id() < moving.Id()) return false;
 *
 * so, unlike classic Hanoi, a ring may sit on another ring of its own size.
 * That is the whole reason the bicolor puzzle is not simply two Hanois. The
 * colours never enter the rule: they only say which tower a ring came from.
 *
 * Goal (also CanSettle, after the ring is pushed):
 *
 *   if (m_Tower[m_Src].isEmpty() && m_Tower[m_Aux].isEmpty()) Approve(m_N);
 *
 * -- pegs 0 and 1 both empty, i.e. all 2N rings gathered on the free peg. The
 * cut-the-knot page poses a different and harder question (make each tower
 * monochrome); the applet asks for this one, and this is the applet's port.
 *
 * N runs from 1 to m_Max = 8, starting at 3.
 *
 * OPTIMUM holds the least number of moves for each N. Classic Hanoi needs
 * 2^N - 1 and two of them would be 2^(N+1) - 2, but the true minimums are
 * larger, because the two rings of a size start on different pegs:
 *
 *   N         1   2   3   4   5    6    7    8
 *   least     2   7  19  44  96  201  413  838
 *
 * Those come from an exhaustive breadth-first search over all 6^N positions
 * (porting/check-bicolor-hanoi.mjs recomputes every one of them), and they
 * satisfy  a(N) = 2a(N-1) + ceil(3N/2),  a(1) = 2.
 */
const HanoiCore = (() => {
  const N_MIN = 1;
  const N_MAX = 8; // the applet's m_Max
  const N_DEFAULT = 3; // the applet's m_N
  const PEGS = 3;

  /** The least number of moves, indexed by N. OPTIMUM[0] is unused. */
  const OPTIMUM = [0, 2, 7, 19, 44, 96, 201, 413, 838];

  /** The fitted recurrence, kept so the test can check it against the table. */
  const byRecurrence = (n) => (n <= 1 ? 2 : 2 * byRecurrence(n - 1) + Math.ceil((3 * n) / 2));

  /**
   * Reset(). A peg is an array of {size, color} from the bottom up; color is
   * 0 or 1 and is only ever used for drawing.
   */
  function start(n) {
    const pegs = [[], [], []];
    for (let k = 0; k < n; k++) {
      const size = n - k;
      pegs[0].push({ size, color: (k + 1) % 2 });
      pegs[1].push({ size, color: k % 2 });
    }
    return pegs;
  }

  const top = (pegs, p) => (pegs[p].length ? pegs[p][pegs[p].length - 1] : null);

  /** Why a move fails: "" means it is legal. */
  function moveProblem(pegs, from, to) {
    if (from === to) return "same";
    if (!pegs[from].length) return "empty";
    const lifted = top(pegs, from);
    const landing = top(pegs, to);
    // CanSettle: refuse only when the landing ring is strictly smaller.
    if (landing && landing.size < lifted.size) return "bigger";
    return "";
  }
  const canMove = (pegs, from, to) => moveProblem(pegs, from, to) === "";

  function move(pegs, from, to) {
    if (!canMove(pegs, from, to)) return null;
    const next = pegs.map((p) => p.slice());
    next[to].push(next[from].pop());
    return next;
  }

  function legalMoves(pegs) {
    const out = [];
    for (let f = 0; f < PEGS; f++) for (let t = 0; t < PEGS; t++) if (canMove(pegs, f, t)) out.push([f, t]);
    return out;
  }

  /** Pegs 0 and 1 empty: every ring is on the free peg. */
  const isWon = (pegs) => pegs[0].length === 0 && pegs[1].length === 0;

  return {
    N_MIN, N_MAX, N_DEFAULT, PEGS, OPTIMUM, byRecurrence,
    start, top, moveProblem, canMove, move, legalMoves, isWon,
  };
})();
