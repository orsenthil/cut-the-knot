/*
 * run_game_logic actions and saved-position reader for Zeros and Nines. The
 * core lives in zeros-and-nines/ and is copied into src/generated/cores/ at
 * build time; every table, column and verdict below comes from it. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

interface ZNState {
  base: number;
  digits: number[];
  autonomous: boolean;
  showColumns: boolean;
  checkedColumn: number | null;
}

interface ColumnCheck {
  column: number;
  digits: number[];
  base: number;
  hasZero: boolean;
  hasTop: boolean;
  ok: boolean;
}

interface Core {
  DIGITS: string;
  BASE: { min: number; max: number; def: number };
  LENGTH: { min: number; max: number; def: number };
  start: (options: Json) => ZNState;
  rows: (state: ZNState) => string[];
  format: (state: ZNState) => string;
  value: (state: ZNState) => bigint;
  convert: (n: bigint | number, base: number) => string;
  checkColumn: (state: ZNState, column: number, options?: Json) => ColumnCheck;
  columnName: (column: number) => string;
  result: (state: ZNState) => string | null;
}

const core = () => cores["zeros-and-nines"].ZerosAndNinesCore as Core;

/** The base is a whole number in the applet's option range. */
function readBase(args: Json): number {
  const C = core();
  const base = Math.round(num(args, "base", C.BASE.def));
  if (base < C.BASE.min || base > C.BASE.max) {
    throw new Error(`base must be a whole number from ${C.BASE.min} to ${C.BASE.max}`);
  }
  return base;
}

/**
 * A number to tabulate: either `value`, written in the base (letters past 9),
 * or `digits`, a list of digit values in writing order. Both go through the
 * core's own parser so the table is exactly the page's table.
 */
function readState(args: Json): ZNState {
  const C = core();
  const base = readBase(args);
  let digits: number[] | undefined;
  if (args.digits !== undefined) {
    digits = numArray(args, "digits").map(Math.round);
    if (digits.length < C.LENGTH.min || digits.length > C.LENGTH.max) {
      throw new Error(`digits must have ${C.LENGTH.min} to ${C.LENGTH.max} entries`);
    }
    if (digits.some((d) => !Number.isInteger(d) || d < 0 || d >= base)) {
      throw new Error(`every digit must be a whole number from 0 to ${base - 1} in base ${base}`);
    }
  }
  const text = args.value === undefined ? undefined : String(args.value).toUpperCase();
  if (digits && text !== undefined) throw new Error('give either "digits" or "value", not both');
  if (!digits && text === undefined) {
    throw new Error('give "value" (the number written in the base) or "digits" (a list of digit values)');
  }
  return C.start({ base, value: digits ? digits.map((d) => C.DIGITS[d]).join("") : text });
}

/** A column read both ways: all rows S..base*S, and only the multiples. */
function describeColumn(C: Core, s: ZNState, column: number) {
  const glyphs = (ds: number[]) => ds.map((d) => C.DIGITS[d]).join(" ");
  const withS = C.checkColumn(s, column);
  const multiples = C.checkColumn(s, column, { includeSource: false });
  return {
    column,
    name: C.columnName(column),
    digits: glyphs(withS.digits),
    hasZero: withS.hasZero,
    hasTop: withS.hasTop,
    ok: withS.ok,
    multiplesDigits: glyphs(multiples.digits),
    multiplesOk: multiples.ok,
    rescuedBySRow: withS.ok && !multiples.ok,
  };
}

export function actions(): GameActions {
  return {
    check_table: {
      describe:
        "Write S and its multiples 2S, 3S, ... up to base*S beneath it, then check every column for a 0 or the largest digit (base-1). Shows the columns where the nine multiples have neither but the blue S row rescues them: the warning for S = 1050..1089 is about the multiples only, while the proof needs the S row too. Digits may be given in writing order or as a number written in the base (letters past 9).",
      args: '{ "value": "1050", "base": 10 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const rows = C.rows(s);
        const cols = rows[rows.length - 1].length;
        const checks = Array.from({ length: cols }, (_, c) => describeColumn(C, s, c));
        const top = C.DIGITS[s.base - 1];
        const sDigitAt = (c: number) => {
          const i = rows[0].length - 1 - c;
          return i >= 0 ? rows[0][i] : "0"; // the page pads short rows with a zero
        };
        const exceptions = checks.filter((check) => check.rescuedBySRow).map((check) => ({
          column: check.column,
          name: check.name,
          multiplesDigits: check.multiplesDigits,
          sDigit: sDigitAt(check.column),
        }));
        const failures = checks.filter((check) => !check.ok).map((check) => check.column);
        return {
          base: s.base,
          S: C.format(s),
          value: C.value(s).toString(),
          digits: s.digits,
          rows,
          topDigit: top,
          columns: cols,
          checks,
          exceptions,
          failuresWithSRow: failures,
          note: failures.length
            ? `${failures.length} column(s) still lack both a 0 and a ${top} even with the S row.`
            : exceptions.length
              ? `Every column of S, 2S, ..., ${s.base}S holds a 0 or a ${top}; ${exceptions.length} need the S row because the multiples alone do not.`
              : `Every column holds a 0 or a ${top} even counting only the multiples.`,
        };
      },
    },
    scan_range: {
      describe:
        "Check one column of the multiples table for every S in a decimal range, both without and with the blue S row. Reports which S defeat the page's warning in the multiples yet are rescued by S (in base 10, column 2 is S = 1050..1089, then 2050..2089, and so on) and whether any S fails even with the S row. At most 5000 values per call.",
      args: '{ "base": 10, "column": 2, "from": 1040, "to": 1100 }',
      run: (args) => {
        const C = core();
        const base = readBase(args);
        const from = Math.round(num(args, "from"));
        const to = Math.round(num(args, "to"));
        const column = Math.round(num(args, "column", 0));
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
          throw new Error('"from" and "to" must be whole numbers with from <= to and from >= 0');
        }
        if (to - from + 1 > 5000) throw new Error("scan at most 5000 numbers at a time");
        if (!Number.isInteger(column) || column < 0 || column > 64) {
          throw new Error('"column" must be a whole number from 0 to 64, counted from the right');
        }
        const exceptions: number[] = [];
        const unrescued: number[] = [];
        for (let n = from; n <= to; n++) {
          const s = C.start({ base, value: C.convert(BigInt(n), base) });
          const multiples = C.checkColumn(s, column, { includeSource: false });
          if (multiples.ok) continue;
          if (C.checkColumn(s, column).ok) exceptions.push(n);
          else unrescued.push(n);
        }
        const top = C.DIGITS[base - 1];
        return {
          base,
          column,
          name: C.columnName(column),
          topDigit: top,
          from,
          to,
          scanned: to - from + 1,
          exceptionCount: exceptions.length,
          firstException: exceptions[0] ?? null,
          lastException: exceptions[exceptions.length - 1] ?? null,
          exceptions: exceptions.slice(0, 100),
          unrescuedCount: unrescued.length,
          unrescued: unrescued.slice(0, 20),
          note: unrescued.length
            ? `${unrescued.length} value(s) still lack a 0 and a ${top} even with the S row.`
            : exceptions.length
              ? `${exceptions.length} value(s) have neither 0 nor ${top} in the multiples' ${C.columnName(column)} column, but all are rescued by the S row, as the proof requires.`
              : `No value in this range fails the warning in column ${column}.`,
        };
      },
    },
  };
}

/** Explain the position the page saved with Track.state (see zeros-and-nines.js). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Zeros and Nines state version ${stateVersion}`);
  const C = core();
  const base = Math.round(num(state, "base", C.BASE.def));
  if (base < C.BASE.min || base > C.BASE.max) {
    throw new Error(`base must be a whole number from ${C.BASE.min} to ${C.BASE.max}`);
  }
  const digits = numArray(state, "digits").map(Math.round);
  if (digits.length < C.LENGTH.min || digits.length > C.LENGTH.max) {
    throw new Error(`digits must have ${C.LENGTH.min} to ${C.LENGTH.max} entries`);
  }
  if (digits.some((d) => !Number.isInteger(d) || d < 0 || d >= base)) {
    throw new Error(`every digit must be a whole number from 0 to ${base - 1} in base ${base}`);
  }
  const rows = C.rows({ base, digits, autonomous: false, showColumns: false, checkedColumn: null });
  const cols = rows[rows.length - 1].length;
  const rawColumn = state.checkedColumn === null || state.checkedColumn === undefined
    ? null
    : Math.round(num(state, "checkedColumn"));
  const checkedColumn = rawColumn !== null && rawColumn >= 0 && rawColumn < cols ? rawColumn : null;
  const here: ZNState = {
    base,
    digits,
    autonomous: state.autonomous === true,
    showColumns: state.showColumns === true,
    checkedColumn,
  };
  const check = checkedColumn === null ? null : C.checkColumn(here, checkedColumn);
  const multiples = checkedColumn === null ? null : C.checkColumn(here, checkedColumn, { includeSource: false });
  const top = C.DIGITS[base - 1];
  const figures = check ? check.digits.map((d) => C.DIGITS[d]).join(" ") : null;
  return {
    base,
    digits,
    autonomous: here.autonomous,
    showColumns: here.showColumns,
    checkedColumn,
    S: C.format(here),
    value: C.value(here).toString(),
    rows,
    topDigit: top,
    columns: cols,
    checked: check && {
      column: check.column,
      name: C.columnName(check.column),
      digits: figures,
      hasZero: check.hasZero,
      hasTop: check.hasTop,
      ok: check.ok,
    },
    multiplesOnly: multiples && {
      digits: multiples.digits.map((d) => C.DIGITS[d]).join(" "),
      ok: multiples.ok,
    },
    rescuedBySRow: !!check?.ok && !!multiples && !multiples.ok,
    result: C.result(here),
    note: check === null
      ? `S is ${C.format(here)} in base ${base}; no column has been checked yet. Every column of S, 2S, ..., ${base}S must hold a 0 or a ${top}.`
      : `Column ${check.column} (${C.columnName(check.column)}) reads ${figures} across S, 2S, ..., ${base}S — ${check.ok ? `it contains ${check.hasZero && check.hasTop ? `a 0 and a ${top}` : check.hasZero ? "a 0" : `a ${top}`}` : `it has neither 0 nor ${top}`}${check.ok && multiples && !multiples.ok ? ", but only because the blue S row is included" : ""}.`,
  };
}
