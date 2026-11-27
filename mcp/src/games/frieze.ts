/*
 * run_game_logic actions and saved-position reader for Frieze.
 *
 * Every number below comes from the game's real core (frieze/frieze-core.js,
 * copied into src/generated/cores/ at build time). A frieze is a staggered
 * lattice filled one diamond at a time: with left a, middle b and right c the
 * full rules are d = a + c - b + 1 (additive) and d = trunc((a·c + 1)/b), or 0
 * when b = 0 (multiplicative); "Simple" leaves out the 1. The modulo only
 * recolours a value (its remainder, with negatives wrapped), never changes it.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Frieze = typeof cores.frieze.FriezeCore;
type State = ReturnType<Frieze["start"]>;
const core = (): Frieze => cores.frieze.FriezeCore;

/** A required JSON integer, with optional bounds. */
function asInteger(raw: unknown, label: string, min?: number, max?: number): number {
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new Error(`argument "${label}" must be an integer, got ${JSON.stringify(raw)}`);
  }
  const v = Number(raw);
  if (!Number.isInteger(v)) {
    throw new Error(`argument "${label}" must be an integer, got ${JSON.stringify(raw)}`);
  }
  if (min !== undefined && v < min) throw new Error(`argument "${label}" must be at least ${min}, got ${v}`);
  if (max !== undefined && v > max) throw new Error(`argument "${label}" must be at most ${max}, got ${v}`);
  return v;
}

/** An integer argument, required unless a fallback is supplied. */
function intArg(args: Json, key: string, opts: { fallback?: number; min?: number; max?: number } = {}): number {
  const raw = args[key];
  if (raw === undefined || raw === null) {
    if (opts.fallback !== undefined) return opts.fallback;
    throw new Error(`missing required argument "${key}"`);
  }
  return asInteger(raw, key, opts.min, opts.max);
}

function boolArg(args: Json, key: string, fallback = false): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`argument "${key}" must be true or false, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function opArg(C: Frieze, args: Json, key = "op"): number {
  return intArg(args, key, { fallback: C.ADD, min: C.ADD, max: C.MUL });
}

function moduloArg(C: Frieze, args: Json, fallback = C.MOD_MIN): number {
  return intArg(args, "modulo", { fallback, min: C.MOD_MIN, max: C.MOD_MAX });
}

/** The core's diamond formula in words, for the chosen operation and Simple flag. */
function rule(C: Frieze, op: number, simple: boolean): string {
  if (op === C.ADD) return simple ? "d = a + c - b" : "d = a + c - b + 1";
  return simple
    ? "d = trunc(a·c / b), or 0 when b = 0"
    : "d = trunc((a·c + 1) / b), or 0 when b = 0";
}

/** The same formula with a, b, c substituted in, for a worked diamond. */
function arithmetic(C: Frieze, op: number, simple: boolean, a: number, b: number, c: number): string {
  if (op === C.ADD) return simple ? `${a} + ${c} - ${b}` : `${a} + ${c} - ${b} + 1`;
  if (b === 0) return `${a} × ${c} over ${b}: the zero guard gives 0`;
  return simple ? `trunc((${a} × ${c}) / ${b})` : `trunc((${a} × ${c} + 1) / ${b})`;
}

function colourGrid(C: Frieze, rows: number[][], modulo: number): number[][] {
  return rows.map((row) => row.map((v) => C.colorIndex(v, modulo)));
}

/** The saved rows, checked against the lattice shape the core expects. */
function rowsArg(C: Frieze, args: Json, key: string, n: number): number[][] {
  const raw = args[key];
  if (!Array.isArray(raw) || raw.length !== n) {
    throw new Error(`argument "${key}" must be an array of ${n} rows`);
  }
  return raw.map((row, i) => {
    const len = C.rowLength(n, i);
    if (!Array.isArray(row) || row.length !== len) {
      throw new Error(`argument "${key}[${i}]" must hold ${len} dots`);
    }
    return row.map((v, j) => asInteger(v, `${key}[${i}][${j}]`));
  });
}

/** [row, dot, value] seed placements; without any, seed dot 1 of every row. */
function seedsArg(C: Frieze, args: Json, n: number, op: number): Array<[number, number, number]> {
  const raw = args.seeds;
  if (raw === undefined || raw === null) {
    return Array.from({ length: n }, (_, i): [number, number, number] => [
      i, 0, (op === C.ADD ? 1 : 2) + (i % 3),
    ]);
  }
  if (!Array.isArray(raw)) {
    throw new Error('argument "seeds" must be an array of [row, dot, value] triples');
  }
  return raw.map((entry, k) => {
    if (!Array.isArray(entry) || entry.length !== 3) {
      throw new Error(`seeds[${k}] must be [row, dot, value]`);
    }
    const i = asInteger(entry[0], `seeds[${k}][0]`, 0, n - 1);
    const j = asInteger(entry[1], `seeds[${k}][1]`, 0, C.rowLength(n, i) - 1);
    const v = asInteger(entry[2], `seeds[${k}][2]`);
    return [i, j, v] as [number, number, number];
  });
}

/** Check every dot Compute filled against the core's own one-diamond rule. */
function diamondAudit(C: Frieze, initial: number[][], result: State) {
  const n = result.n;
  let checked = 0;
  let obeyed = 0;
  const samples: Json[] = [];
  for (let k = 1; k < n - 1; k++) {
    const limit = C.rowLength(n, k);
    let start = 0;
    while (start < limit && initial[k][start] === result.op) start++;
    if (start === limit) start = limit - 1;
    const through = Math.min(Number(result.processed[k]), limit - 1);
    for (let j = start + 1; j <= through; j++) {
      const a = k % 2 === 0 ? result.rows[k - 1][j - 1] : result.rows[k - 1][j];
      const b = result.rows[k][j - 1];
      const c = k % 2 === 0 ? result.rows[k + 1][j - 1] : result.rows[k + 1][j];
      const d = result.rows[k][j];
      const expected = C.computeValue(result.op, result.simple, a, b, c);
      checked++;
      if (d === expected) obeyed++;
      if (samples.length < 3) {
        samples.push({
          row: k + 1, dot: j + 1, a, b, c, d, expected,
          arithmetic: arithmetic(C, result.op, result.simple, a, b, c),
        });
      }
    }
  }
  return { checked, obeyed, allObey: checked > 0 && obeyed === checked, samples };
}

/** CheckIfFinished's condition from the applet, applied to a saved cursor set. */
function cursorsComplete(n: number, processed: number[]): boolean {
  for (let i = 0; i < n; i++) {
    if (processed[i] !== (i % 2 === 0 ? n : n - 1)) return false;
  }
  return true;
}

export function actions(): GameActions {
  return {
    diamond: {
      describe:
        "Fill one diamond from its left (a), middle (b) and right (c) dots. The additive answer is a + c - b + 1 and the multiplicative one is trunc((a·c + 1)/b), or 0 when b = 0; ticking Simple drops the 1. The real core gives all four answers and the modulo colour slot of each, including the wrap of negative values.",
      args: '{ "a": 4, "b": 3, "c": 5, "modulo": 5 }',
      run: (args) => {
        const C = core();
        const a = intArg(args, "a");
        const b = intArg(args, "b");
        const c = intArg(args, "c");
        const modulo = moduloArg(C, args, 2);
        const variants = [
          { op: C.ADD, simple: false },
          { op: C.ADD, simple: true },
          { op: C.MUL, simple: false },
          { op: C.MUL, simple: true },
        ].map((v) => {
          const value = C.computeValue(v.op, v.simple, a, b, c);
          return {
            mode: v.op === C.ADD ? "additive" : "multiplicative",
            simple: v.simple,
            rule: rule(C, v.op, v.simple),
            arithmetic: arithmetic(C, v.op, v.simple, a, b, c),
            value,
            colour: C.colorIndex(value, modulo),
          };
        });
        return {
          a, b, c, modulo,
          variants,
          invariant: {
            additiveFull: "d + b = a + c + 1",
            additiveSimple: "d + b = a + c",
            multiplicativeFull: "b·d = a·c + 1 when the division is exact, otherwise the fraction is dropped toward zero",
            multiplicativeSimple: "b·d = a·c when the division is exact",
          },
          note:
            "Simple removes the +1 in both modes; a zero middle dot makes the multiplicative answer 0. " +
            "The colour is value mod modulo, with negative values wrapped into 0..modulo-1 as the page's Dot.Draw does.",
        };
      },
    },

    pattern: {
      describe:
        "Compute a whole frieze with the game's real core: seed one dot in each row, run Compute, then check every filled diamond against the core's formula and show the modulo colour class of every dot. A second run with the next modulo confirms that colours change while the numbers stay put.",
      args: '{ "n": 6, "modulo": 3, "op": 0, "simple": false, "seeds": [[0,0,1],[1,0,2],[2,0,3],[3,0,1],[4,0,2],[5,0,3]] }',
      run: (args) => {
        const C = core();
        const n = intArg(args, "n", { fallback: C.ROW_MIN, min: C.ROW_MIN, max: C.ROW_MAX });
        const op = opArg(C, args);
        const simple = boolArg(args, "simple");
        const modulo = moduloArg(C, args);
        const digits = boolArg(args, "digits", true);
        const seeds = seedsArg(C, args, n, op);
        const state = C.start({ rows: n, modulo, op, simple, digits });
        const initial = (state.rows as number[][]).map((r) => r.slice());
        for (const [i, j, v] of seeds) initial[i][j] = v;
        state.rows = initial;
        const result = C.compute(state);

        const otherModulo = modulo === C.MOD_MAX ? C.MOD_MIN : modulo + 1;
        const other = C.start({ rows: n, modulo: otherModulo, op, simple, digits });
        other.rows = initial.map((r) => r.slice());
        const otherResult = C.compute(other);

        return {
          options: {
            n, modulo, op,
            opName: op === C.ADD ? "additive" : "multiplicative",
            simple, digits,
          },
          rule: rule(C, op, simple),
          seeds,
          initialRows: initial,
          computedRows: result.rows,
          processed: result.processed,
          done: result.done,
          note: result.note,
          colours: colourGrid(C, result.rows, modulo),
          diamondAudit: diamondAudit(C, initial, result),
          moduloOnlyRecolours: {
            otherModulo,
            otherColours: colourGrid(C, otherResult.rows, otherModulo),
            numbersUnchanged: JSON.stringify(otherResult.rows) === JSON.stringify(result.rows),
          },
        };
      },
    },
  };
}

/**
 * Echo the fields Track.state saved (the page saves the whole core state) and
 * re-read the picture with the real core: recompute the diamonds from the saved
 * seed dots, audit each filled value against the core's formula, and map every
 * saved number to its modulo colour slot.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Frieze state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Frieze position must be an object");
  }
  const C = core();
  const n = intArg(state, "n", { min: C.ROW_MIN, max: C.ROW_MAX });
  const op = opArg(C, state);
  const simple = boolArg(state, "simple");
  const modulo = moduloArg(C, state);
  const digits = boolArg(state, "digits", true);
  const rows = rowsArg(C, state, "rows", n);

  const processedRaw = state.processed;
  if (!Array.isArray(processedRaw) || processedRaw.length !== n + 1) {
    throw new Error(`argument "processed" must hold ${n + 1} integers`);
  }
  const processed = processedRaw.map((v, i) => asInteger(v, `processed[${i}]`));

  const stackRaw = state.stack;
  if (!Array.isArray(stackRaw)) throw new Error('argument "stack" must be an array');
  const stack = stackRaw.map((entry, k) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`stack[${k}] must be an object`);
    }
    const item = entry as Json;
    const i = intArg(item, "i", { min: 0, max: n - 1 });
    return {
      i,
      j: intArg(item, "j", { min: 0, max: C.rowLength(n, i) - 1 }),
      v: intArg(item, "v"),
    };
  });

  const saved: State = {
    // The core infers its empty initial stack as never[]; the saved undo
    // entries are the same plain {i, j, v} objects the core pushes.
    n, modulo, op, simple, digits, rows, processed,
    stack: stack as unknown as State["stack"],
    clicks: intArg(state, "clicks", { fallback: 0, min: 0 }),
    computes: intArg(state, "computes", { fallback: 0, min: 0 }),
    done: boolArg(state, "done"),
    note: typeof state.note === "string" ? state.note : "",
  };
  const result = C.compute(saved);

  return {
    ...state,
    stateVersion,
    saved: {
      n, modulo, op,
      opName: op === C.ADD ? "additive" : "multiplicative",
      simple, digits, rows, processed, stack,
      clicks: saved.clicks, computes: saved.computes, done: saved.done, note: saved.note,
    },
    core: {
      n,
      rowLengths: Array.from({ length: n }, (_, i) => C.rowLength(n, i)),
      rule: rule(C, op, simple),
      colours: colourGrid(C, rows, modulo),
      computed: {
        rows: result.rows,
        processed: result.processed,
        done: result.done,
        note: result.note,
        computes: result.computes,
      },
      diamondAudit: diamondAudit(C, rows, result),
      savedDoneMatchesCursors: saved.done === cursorsComplete(n, processed),
    },
    note:
      "Track.state saves the whole core position: row count, modulo, operation, Simple, the dot values, the per-row cursors, the undo stack and the click/compute counters. " +
      "The real core recomputes the lattice from those dots, checks each filled diamond against the formula and maps each value to its modulo colour slot; recomputing deliberately resets the saved cursors.",
  };
}
