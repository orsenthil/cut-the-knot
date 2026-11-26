/*
 * run_game_logic actions and saved-position reader for Arith Magic.
 * The core lives in arith-magic/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * The trick: every square is its row number plus (or times) its column
 * number. Choosing one square in every row and every column uses each row
 * number and each column number exactly once, so the running total is always
 * the sum (or product) of all the row and column numbers, whatever the choice.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arith-magic"].ArithMagicCore;

type Operation = "sum" | "product";
type Board = { size: number; operation: Operation; v: number[]; h: number[]; selected: number[][] };

function readOperation(args: Json): Operation {
  const op = String(args.operation ?? "sum");
  if (op === "sum" || op === "+" || op === "add") return "sum";
  if (op === "product" || op === "x" || op === "multiply") return "product";
  throw new Error('operation must be "sum" or "product"');
}

/** Validate the row numbers v and column numbers h, and the optional size. */
function readBoard(args: Json): Board {
  const C = core();
  const v = numArray(args, "v");
  const h = numArray(args, "h");
  if (v.length !== h.length) {
    throw new Error(`v and h must have the same length (got ${v.length} row numbers and ${h.length} column numbers)`);
  }
  const size = v.length;
  if (size < C.MIN_SIZE || size > C.MAX_SIZE) {
    throw new Error(`size must be ${C.MIN_SIZE} to ${C.MAX_SIZE}, got ${size}`);
  }
  if (Math.round(num(args, "size", size)) !== size) {
    throw new Error(`size must match the length of v and h (${size})`);
  }
  for (const [key, values] of [["v", v], ["h", h]] as const) {
    values.forEach((x, i) => {
      if (!Number.isInteger(x)) throw new Error(`${key}[${i}] must be an integer, got ${x}`);
    });
  }
  return { size, operation: readOperation(args), v, h, selected: [] };
}

/** Read [row, column] index pairs, as the page saves them (0-based). */
function readSelection(args: Json, size: number): number[][] {
  const raw = args.selected;
  if (!Array.isArray(raw)) throw new Error('"selected" must be an array of [row, column] pairs');
  const seen = new Set<string>();
  return raw.map((pair, i) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new Error(`selected[${i}] must be a [row, column] pair`);
    }
    const [r, c] = numArray({ pair }, "pair");
    if (!Number.isInteger(r) || !Number.isInteger(c)) {
      throw new Error(`selected[${i}] must hold integer indices, got ${JSON.stringify(pair)}`);
    }
    if (r < 0 || r >= size || c < 0 || c >= size) {
      throw new Error(`selected[${i}] = [${r}, ${c}] is outside the ${size} by ${size} table`);
    }
    const key = `${r},${c}`;
    if (seen.has(key)) throw new Error(`selected[${i}] repeats square [${r}, ${c}]`);
    seen.add(key);
    return [r, c];
  });
}

export function actions(): GameActions {
  return {
    invariant: {
      describe:
        "For row numbers v and column numbers h (equally long lists, 2 to 10 numbers) with operation 'sum' or 'product', give the fixed total the trick predicts: add all the row and column numbers, or multiply them all. Also show the table of cell values, each a row number plus (or times) a column number: picking one square in every row and every column always gives exactly this total.",
      args: '{ "v": [19, 15, 15, 24, 14], "h": [5, 7, 14, 12, 9], "operation": "sum" }',
      run: (args) => {
        const C = core();
        const board = readBoard(args);
        const grid: number[][] = [];
        for (let r = 0; r < board.size; r++) {
          const row: number[] = [];
          for (let c = 0; c < board.size; c++) row.push(C.cellValue(board, r, c));
          grid.push(row);
        }
        return {
          size: board.size,
          operation: board.operation,
          rowNumbers: board.v,
          columnNumbers: board.h,
          invariantTotal: C.predictedTotal(board),
          grid,
          note: board.operation === "sum"
            ? "Every square is its row number plus its column number. One square in each row and column uses each row number and each column number once, so the sum is always the same: add the row numbers and the column numbers."
            : "Every square is its row number times its column number. One square in each row and column uses each number once, so the product is always the same: multiply the row numbers and the column numbers.",
        };
      },
    },
    check: {
      describe:
        "Check a supplied selection of squares against the invariant. 'v', 'h' and 'operation' set the controls; 'selected' is a list of [row, column] pairs with indices starting at 0 (as the page saves them). Returns each chosen square's value, the invariant total, the running total of the chosen squares, whether they use every row and column exactly once (a transversal), and whether the two totals match.",
      args: '{ "v": [19, 15, 15, 24, 14], "h": [5, 7, 14, 12, 9], "operation": "sum", "selected": [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] }',
      run: (args) => {
        const C = core();
        const board = readBoard(args);
        const pairs = readSelection(args, board.size);
        let state = board;
        for (const [r, c] of pairs) state = C.toggle(state, r, c); // the core's own toggle
        const invariantTotal = C.predictedTotal(state);
        const runningTotal = C.runningTotal(state);
        const isTransversal = C.isTransversal(state);
        const squares = pairs.map(([r, c]) => ({ row: r + 1, column: c + 1, value: C.cellValue(state, r, c) }));
        return {
          size: board.size,
          operation: board.operation,
          selected: pairs,
          squares,
          invariantTotal,
          runningTotal,
          full: C.isFull(state),
          isTransversal,
          matchesInvariant: runningTotal === invariantTotal,
          coreResult: C.result(state),
          message: C.resultMessage(state),
          note: isTransversal
            ? `The ${pairs.length} squares use every row and column once, so their total ${runningTotal} equals the invariant ${invariantTotal}.`
            : "These squares do not use every row and column exactly once, so their total need not match the invariant; the trick only works for a transversal.",
        };
      },
    },
  };
}

/** What the core says about the controls and crosses the page saved. */
export function position(st: Json, stateVersion: number): unknown {
  const C = core();
  const seed = C.start({ size: Math.round(num(st, "size", C.DEFAULT_SIZE)), operation: st.operation ?? "sum" });
  const board = readBoard({
    size: st.size ?? seed.size,
    operation: st.operation ?? seed.operation,
    v: st.v ?? seed.v,
    h: st.h ?? seed.h,
  });
  const pairs = Array.isArray(st.selected) ? readSelection(st, board.size) : [];
  let state = board;
  for (const [r, c] of pairs) state = C.toggle(state, r, c);
  const invariantTotal = C.predictedTotal(state);
  const runningTotal = C.runningTotal(state);
  const isTransversal = C.isTransversal(state);
  return {
    stateVersion,
    size: board.size,
    operation: board.operation,
    v: board.v.slice(),
    h: board.h.slice(),
    selected: pairs.map((p) => p.slice()),
    hint: st.hint === true,
    invariantTotal,
    runningTotal,
    full: C.isFull(state),
    isTransversal,
    coreResult: C.result(state),
    message: C.resultMessage(state),
    note: isTransversal
      ? `One square in every row and column: the running total ${runningTotal} equals the total ${invariantTotal} predicted from the row and column numbers.`
      : pairs.length
        ? `${pairs.length} of ${board.size} squares are crossed, but they are not one in every row and column yet, so the trick's total ${invariantTotal} is not reached.`
        : `No squares are crossed yet. Pick one in every row and column to reach the predicted total ${invariantTotal}.`,
  };
}
