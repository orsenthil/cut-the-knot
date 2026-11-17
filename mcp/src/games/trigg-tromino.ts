/*
 * Tutor actions and position reader for Trigg Tromino.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

function restore(state: Json) {
  const T = cores["trigg-tromino"].TriggTrominoCore;
  const game = T.start() as {
    size: number;
    owner: number[][];
    pieces: number[][][];
    building: number[][];
  };
  if (Array.isArray(state.pieces)) {
    for (const p of state.pieces as number[][][]) {
      T.placePiece(game, p);
    }
  }
  if (Array.isArray(state.building)) {
    game.building = (state.building as number[][]).map((c) => c.slice());
  }
  return game;
}

export function actions(): GameActions {
  const T = cores["trigg-tromino"].TriggTrominoCore;
  return {
    find_covering: {
      describe:
        "Find one L-tromino covering of the 8×8 board with the centre hole. Pass wantFaults (0–3) for a covering with that many fault lines, or omit it for any covering.",
      args: '{ "wantFaults": 0 }',
      run: (args) => {
        const want =
          args.wantFaults === undefined || args.wantFaults === null
            ? null
            : Number(args.wantFaults);
        const pieces = T.findCovering(Number.isFinite(want as number) ? (want as number) : null);
        if (!pieces) return { found: false, wantFaults: want };
        const s = T.start();
        for (const p of pieces) T.placePiece(s, p);
        const f = T.faults(s);
        return {
          found: true,
          pieceCount: pieces.length,
          faultCount: T.faultCount(s),
          faults: f,
          pieces,
        };
      },
    },
    fault_count: {
      describe: "Count fault lines in a position given by its pieces (list of three-cell L's).",
      args: '{ "pieces": [[[0,0],[0,1],[1,1]]] }',
      run: (args) => {
        const s = T.start();
        const pieces = (args.pieces as number[][][]) || [];
        for (const p of pieces) {
          if (!T.placePiece(s, p)) return { ok: false, reason: "could not place a piece" };
        }
        const f = T.faults(s);
        return {
          ok: true,
          finished: T.finished(s),
          pieceCount: s.pieces.length,
          faultCount: T.faultCount(s),
          faults: f,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const T = cores["trigg-tromino"].TriggTrominoCore;
  const game = restore(state);
  const done = T.finished(game);
  const f = done ? T.faults(game) : null;
  const empty = (() => {
    let n = 0;
    for (let r = 0; r < T.SIZE; r++) {
      for (let c = 0; c < T.SIZE; c++) if (T.free(game, r, c)) n++;
    }
    return n;
  })();
  return {
    finished: done,
    piecesPlaced: game.pieces.length,
    building: game.building.length,
    emptySquares: empty,
    faultCount: done ? T.faultCount(game) : null,
    faults: f,
    note: done
      ? `Covered with ${T.faultCount(game)} fault line${T.faultCount(game) === 1 ? "" : "s"}.`
      : game.building.length
        ? `Building a piece (${game.building.length}/3). ${empty} squares left.`
        : `${game.pieces.length} pieces placed, ${empty} squares left.`,
  };
}
