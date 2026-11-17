/*
 * Tutor actions and position reader for Another Sticky Problem.
 *
 * The page saves the starting side N and the sticks left. The core knows Li
 * Zhou's two sets: A (even number of sticks, at most one even) is losing for
 * the player to move, B (odd number of sticks, at most two even) is winning,
 * and every move from A lands in B while every B position has a move back to
 * A. The tutor can classify a position, list the legal breaks and removals,
 * find the move back to A, and play the applet's own computer move.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Position = { n: number; sticks: number[] };

const core = () => cores["another-sticky-problem"].AnotherStickyProblemCore as any;

/** A position from the arguments: "sticks" given, or the start for N. */
function fromArgs(args: Json): Position {
  const C = core();
  const n = C.clampN(num(args, "n", C.DEFAULT_N));
  if (args.sticks === undefined || args.sticks === null) return C.start({ n });
  const raw = args.sticks;
  if (!Array.isArray(raw)) throw new Error('"sticks" must be an array of stick lengths');
  const sticks = raw.map(Number);
  if (!C.validSticks(sticks, n)) {
    throw new Error(
      `[${sticks.join(", ")}] is not a legal position for N = ${n}: every stick is 1..${n + 1} ` +
        `and their total is at most ${2 * n + 1}`,
    );
  }
  return { n, sticks };
}

function describeMove(move: any): string {
  if (move.type === "break") {
    return `break the length ${move.length} stick into ${move.at} and ${move.length - move.at}`;
  }
  return `remove ${move.length} stick${move.length === 1 ? "" : "s"} of length ${move.length}`;
}

function classNote(cls: string | null, sticks: number[]): string {
  if (sticks.length === 0) return "The board is empty: the player who made the last move won.";
  if (cls === "A") {
    return "Set A: an even number of sticks and at most one even stick. With perfect play, the player to move loses.";
  }
  if (cls === "B") {
    return "Set B: an odd number of sticks and at most two even sticks. The player to move can win by moving back to A.";
  }
  return "Neither A nor B: the two-set strategy does not apply here, though the game is still won or lost.";
}

function view(position: Position) {
  const C = core();
  const cls = C.classOf(position);
  const moves = C.legalMoves(position);
  return {
    n: position.n,
    sticks: position.sticks.slice(),
    totalSticks: C.totalSticks(position),
    totalLength: C.totalLength(position),
    evenSticks: C.evenSticks(position),
    counts: C.counts(position),
    set: cls,
    removableLengths: C.removableLengths(position),
    legalMoves: moves.length,
    finished: C.isOver(position),
    note: classNote(cls, position.sticks),
  };
}

export function actions(): GameActions {
  return {
    classify: {
      describe:
        "Classify a stick position into set A (losing for the player to move), set B (winning, with a move back to A), or neither. Omit sticks for the start of side N.",
      args: '{ "n": 10, "sticks": [10, 11] }',
      run: (args) => view(fromArgs(args)),
    },
    legal_moves: {
      describe:
        "List every legal move: each break of a stick at a cut, and each removal of k sticks of length k. Sticks are indexed from 0 in the order given.",
      args: '{ "n": 3, "sticks": [3, 4] }',
      run: (args) => {
        const C = core();
        const position = fromArgs(args);
        const moves = C.legalMoves(position).map((m: any) => ({
          ...m,
          text: describeMove(m),
        }));
        return {
          ...view(position),
          moves,
        };
      },
    },
    move_to_a: {
      describe:
        "Find a move from set B back to set A - the second player's reply. From a set-A position, say that no such move exists (every move leaves A).",
      args: '{ "n": 3, "sticks": [3, 4, 3] }',
      run: (args) => {
        const C = core();
        const position = fromArgs(args);
        const cls = C.classOf(position);
        const moves = C.legalMoves(position);
        const found = moves.find((m: any) => C.classOf(C.move(position, m)) === "A");
        if (!found) {
          return {
            set: cls,
            found: false,
            note: C.isOver(position)
              ? "The board is empty; there is nothing to move."
              : cls === "A"
                ? "This is set A: every legal move lands in B, so there is no move back to A."
                : `No legal move from this position lands in A (it has ${moves.length} legal move${moves.length === 1 ? "" : "s"}).`,
          };
        }
        const after = C.move(position, found);
        return {
          set: cls,
          found: true,
          move: { ...found, text: describeMove(found) },
          sticksAfter: after.sticks,
          setAfter: C.classOf(after),
          note: `From ${cls ?? "neither set"}, ${describeMove(found)} gives set A.`,
        };
      },
    },
    computer_move: {
      describe:
        "Make the applet's own computer move from a position, using its Play method: split even sticks oddly, remove k sticks of length k, or take a random legal move as its branches do. An optional seed in [0,1) makes the choice repeatable.",
      args: '{ "n": 10, "sticks": [10, 11], "seed": 0.5 }',
      run: (args) => {
        const C = core();
        const position = fromArgs(args);
        const seed = Number(args.seed);
        const rnd = Number.isFinite(seed) ? () => seed : Math.random;
        const before = C.classOf(position);
        const move = C.computerMove(position, rnd);
        if (!move) {
          return {
            set: before,
            moved: false,
            note: C.isOver(position)
              ? "The board is empty; the computer has no move."
              : "The applet's Play method has no move here.",
          };
        }
        const after = C.move(position, move);
        return {
          set: before,
          moved: true,
          move: { ...move, text: describeMove(move) },
          sticksAfter: after.sticks,
          setAfter: C.classOf(after),
          finished: C.isOver(after),
          note: `From ${before ?? "neither set"}, ${describeMove(move)} gives ${C.classOf(after) ?? "neither set"}.`,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const n = C.clampN(state.n == null ? C.DEFAULT_N : Number(state.n));
  const sticks = Array.isArray(state.sticks) ? (state.sticks as unknown[]).map(Number) : null;
  if (!sticks || !C.validSticks(sticks, n)) {
    throw new Error("a saved position needs the sticks of a game of side N");
  }
  const saved = { n, sticks };
  const moves = C.legalMoves(saved);
  const reply =
    C.classOf(saved) === "B"
      ? moves.find((m: any) => C.classOf(C.move(saved, m)) === "A")
      : null;
  return {
    ...view(saved),
    winningReply: reply ? { ...reply, text: describeMove(reply) } : null,
  };
}
