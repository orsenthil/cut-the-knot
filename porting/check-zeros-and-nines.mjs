#!/usr/bin/env node
"use strict";

/*
 * Logic test for zeros-and-nines/zeros-and-nines-core.js.
 *
 *   node porting/check-zeros-and-nines.mjs
 *
 * 1. The applet's options and defaults: base 3..36 (10 to start), 1..18
 *    digits (6 to start), a random number with a nonzero leading digit.
 * 2. Every column of every one of the ten rows S, 2S, ..., 10S contains a
 *    0 or a 9: checked exhaustively for all S <= 20000 in base 10, and for
 *    all S <= 150 in every base 3..36 (the analogue is 0 or base-1).
 * 3. The page's warning is about the nine rows 2S..10S only: their hundreds
 *    column lacks both 0 and 9 for S = 1050..1089 and 2050..2089 (and for
 *    every other such S <= 20000); adding the blue S row, whose hundreds
 *    digit is 0 or 9 there, restores the claim.
 * 4. The digit edits (autonomous, or with the applet's carry and borrow)
 *    and the table are compared with a second transcription of the Java
 *    bytecode over all small digit strings, positions and directions.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("zeros-and-nines/zeros-and-nines-core.js", "ZerosAndNinesCore");
const D = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* --------------------------------- a second transcription of the bytecode */

// BaseSys.ConvertNum and IntegerString.toString, straight from the classes.
function appletString(ds, base) {
  let s = "";
  for (let i = ds.length - 1; i >= 0; i--) s += D[ds[i] % base];
  return s;
}

// ZerosAndNinesCanvas.GetRandomNumber: first digit 1..base-1, rest 0..base-1.
function appletRandom(base, length, rand) {
  const ds = [1 + Math.floor(rand() * (base - 1))];
  for (let i = 1; i < length; i++) ds.push(Math.floor(rand() * base));
  return ds;
}

// ZerosAndNinesCanvas.Compute: rows[i-1] = (i+1) * S, i = 1 .. base-1,
// written in base r; the blue first row is the edited number itself.
function appletRows(ds, base) {
  let s = 0n;
  for (const c of appletString(ds, base)) s = s * BigInt(base) + BigInt(D.indexOf(c));
  const out = [appletString(ds, base)];
  for (let i = 1; i < base; i++) {
    let n = s * BigInt(i + 1);
    let text = "";
    while (n > 0n) { text = D[Number(n % BigInt(base))] + text; n /= BigInt(base); }
    out.push(text || "0");
  }
  return out;
}

// IntegerStringVariedLength.Update + CTKNumber.UpdateSlow, transcribed as a
// mutable object: right half -> up, left half -> down; Connected is the
// opposite of the "Autonomous digits" checkbox.
function appletEdit(ds, base, index, up, connected) {
  const ns = ds.slice();
  const size = ns.length;
  const old = ns[index];
  ns[index] = up ? (old + 1) % base : (base + old - 1) % base;
  const now = ns[index];
  if (!connected) return ns;
  if (old === 1 && now === 0 && index === size - 1 && size > 1) { ns.splice(index, 1); return ns; }
  if ((old === 0 && now === base - 1) || (old === base - 1 && now === 0)) {
    if (old === base - 1 && index < size) {
      if (index === size - 1) {
        ns.push(1); // PrependOne
      } else {
        for (let j = index + 1; j < size; j++) {
          const v = ns[j] + 1;
          if (v === base) {
            ns[j] = 0;
            if (j === size - 1) { ns.push(1); break; }
          } else { ns[j] = v; break; }
        }
      }
    } else if (old === 0 && index < size) {
      for (let j = index + 1; j < size; j++) {
        if (ns[j] === 0) {
          ns[j] = base - 1;
          if (j === size - 1 && size > 1) { ns.splice(j, 1); break; }
        } else { ns[j] -= 1; break; }
      }
    }
  }
  return ns;
}

/* ------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  equal("defaults: base 10, six digits", `${s.base} ${s.digits.length}`, "10 6");
  equal("base held to 3..36", `${C.start({ base: 2 }).base} ${C.start({ base: 99 }).base}`, "3 36");
  equal("length held to 1..18", `${C.start({ digits: 0 }).digits.length} ${C.start({ digits: 99 }).digits.length}`, "1 18");
  check("a new number has a nonzero leading digit", C.start().digits.at(-1) >= 1);
  check("a new number is not a finished exploration", C.result(s) === null);

  let same = true;
  for (let base = 3; base <= 36; base++) {
    for (const length of [1, 2, 6, 18]) {
      const r = rng(base * 100 + length);
      const r2 = rng(base * 100 + length);
      const got = C.start({ base, digits: length, rng: r }).digits;
      const want = appletRandom(base, length, r2).reverse(); // the applet parses its string into Nums, least digit first
      if (got.join(",") !== want.join(",")) same = false;
    }
  }
  check("random numbers match GetRandomNumber in every base and length", same);
}

/* ----------------------------------------- 2. values, rows and conversions */

{
  let exact = true;
  for (let base = 3; base <= 36; base++) {
    for (const n of [0n, 1n, 35n, 1050n, 10n ** 18n, (10n ** 18n) * 35n]) {
      const s = C.convert(n, base);
      let back = 0n;
      for (const c of s) back = back * BigInt(base) + BigInt(D.indexOf(c));
      if (back !== n) exact = false;
    }
  }
  check("BaseSys.ConvertNum round-trips in every base, up to 10^18 * 35", exact);
  equal("base 36 writes 35 as Z", C.convert(35n, 36), "Z");
  equal("invalid digits fall back to 0 like BaseSys.Check", C.parseDigits("1K", 10).join(""), "01");

  let rows = true;
  let nrows = 0;
  for (let base = 3; base <= 36; base++) {
    for (let S = 1; S <= 60; S++) {
      const state = C.start({ base, value: S.toString(base).toUpperCase(), autonomous: true });
      const got = C.rows(state);
      const want = appletRows(state.digits, base);
      nrows += got.length;
      if (got.join("|") !== want.join("|")) rows = false;
    }
  }
  check(`the table matches Compute in every base for S = 1..60 (${nrows} rows)`, rows);

  const st = C.start({ value: "1050", autonomous: true });
  equal("the table starts with S and ends with base*S", `${st.base} ${C.rows(st).length}`, "10 10");
  equal("S and its multiples in base 10", C.rows(st).slice(0, 4).join(" "), "1050 2100 3150 4200");
}

/* --------------------------------------- 3. edits: autonomous and connected */

{
  let edits = 0, same = true;
  for (const base of [3, 10, 36]) {
    const maxLen = base === 3 ? 4 : 2;
    for (let len = 1; len <= maxLen; len++) {
      const total = base ** len;
      for (let code = 0; code < total; code++) {
        let x = code;
        const ds = [];
        for (let i = 0; i < len; i++) { ds.push(x % base); x = Math.floor(x / base); }
        if (ds[len - 1] === 0) continue; // a written number has no leading zero
        for (let index = 0; index < len; index++) {
          for (const up of [true, false]) {
            for (const connected of [true, false]) {
              const state = { base, digits: ds, autonomous: !connected, showColumns: false, checkedColumn: null };
              const got = C.editDigit(state, index, up ? 1 : -1).digits;
              const want = appletEdit(ds, base, index, up, connected);
              edits++;
              if (got.join(",") !== want.join(",")) same = false;
            }
          }
        }
      }
    }
  }
  check(`every digit edit matches IntegerStringVariedLength.Update (${edits} cases)`, same);

  const S = (v, base = 10, autonomous = false) => C.start({ value: v, base, autonomous });
  equal("carry: 199 -> 200", C.format(C.editDigit(S("199"), 0, 1)), "200");
  equal("borrow: 200 -> 199", C.format(C.editDigit(S("200"), 0, -1)), "199");
  equal("carry through 9s: 999 -> 1000", C.format(C.editDigit(S("999"), 0, 1)), "1000");
  equal("a leading 1 reduced to 0 drops off: 100 -> 00", C.format(C.editDigit(S("100"), 2, -1)), "00");
  equal("the same applet quirk: 199 -> 99", C.format(C.editDigit(S("199"), 2, -1)), "99");
  equal("autonomous 199 -> 190 (no carry)", C.format(C.editDigit(S("199", 10, true), 0, 1)), "190");
  equal("autonomous 200 -> 209 (no borrow)", C.format(C.editDigit(S("200", 10, true), 0, -1)), "209");
  equal("base 3 carry: 122 -> 200", C.format(C.editDigit(S("122", 3), 0, 1)), "200");
  equal("base 36 carry: ZZ -> 100", C.format(C.editDigit(S("ZZ", 36), 0, 1)), "100");
  check("an out-of-range digit leaves the position alone", C.editDigit(S("1050"), 99, 1).digits.join("") === "0501");

  let byOne = true;
  for (let S0 = 1; S0 < 2000; S0++) {
    for (const dir of [1, -1]) {
      const s = C.start({ value: String(S0) });
      const next = C.editDigit(s, 0, dir); // the units digit
      const want = BigInt(S0) + BigInt(dir);
      if (C.value(next) !== want) byOne = false;
    }
  }
  check("editing the units digit of a connected number changes it by exactly one", byOne);
}

/* ---------------------------------- 4. the column claim and the warning */

{
  // Every column of all ten rows. Rows shorter than a column are padded 0.
  function tenFigures(S, col) {
    const rs = Array.from({ length: 10 }, (_, k) => String((k + 1) * S));
    return rs.map((s) => { const i = s.length - 1 - col; return i >= 0 ? +s[i] : 0; });
  }
  let claim = true, cols = 0;
  for (let S = 1; S <= 20000; S++) {
    const maxCol = String(10 * S).length - 1;
    for (let col = 0; col <= maxCol; col++) {
      const ds = tenFigures(S, col);
      cols++;
      if (!ds.includes(0) && !ds.includes(9)) claim = false;
    }
  }
  check(`every column of S..10S has a 0 or a 9 (${cols} columns, S <= 20000)`, claim);

  // The page's warning, read as the nine multiples 2S..10S.
  function nineFigures(S, col) {
    const rs = Array.from({ length: 9 }, (_, k) => String((k + 2) * S));
    return rs.map((s) => { const i = s.length - 1 - col; return i >= 0 ? +s[i] : 0; });
  }
  let warned = true;
  for (let S = 1050; S <= 1089; S++) {
    if (nineFigures(S, 2).some((d) => d === 0 || d === 9)) warned = false;
  }
  for (let S = 2050; S <= 2089; S++) {
    if (nineFigures(S, 2).some((d) => d === 0 || d === 9)) warned = false;
  }
  check("the hundred's column of 2S..10S has no 0 or 9 for 1050..1089 and 2050..2089", warned);

  let rescued = true, bad = 0;
  for (let S = 1; S <= 20000; S++) {
    if (nineFigures(S, 2).some((d) => d === 0 || d === 9)) continue;
    bad++;
    const sdigit = S >= 100 ? Math.floor(S / 100) % 10 : 0;
    if (sdigit !== 0 && sdigit !== 9) rescued = false;
    if (!tenFigures(S, 2).some((d) => d === 0 || d === 9)) rescued = false;
  }
  check(`all ${bad} hundreds-column exceptions <= 20000 are rescued by the S row`, rescued);

  const st = C.start({ value: "1050", autonomous: true });
  equal("column 2 of the whole table includes the S row's 0", C.columnDigits(st, 2).join(""), "0112233445");
  equal("without S, the same column has no 0 or 9", C.columnDigits(st, 2, { includeSource: false }).join(""), "112233445");
  check("checkColumn reports both forms of column 2", C.checkColumn(st, 2).ok && !C.checkColumn(st, 2, { includeSource: false }).ok);
  equal("short rows are padded with zeros in the units column", C.columnDigits(C.start({ value: "3", autonomous: true }), 0).join(""), "3692581470");

  // The analogue in any base: among S, 2S, ..., base*S there is a 0 or base-1.
  let analogue = true, cols2 = 0;
  for (let base = 3; base <= 36; base++) {
    for (let S = 1; S <= 150; S++) {
      const st2 = C.start({ base, value: S.toString(base).toUpperCase(), autonomous: true });
      const maxCol = C.rows(st2)[base - 1].length - 1;
      for (let col = 0; col <= maxCol; col++) {
        const ds = C.columnDigits(st2, col);
        cols2++;
        if (!ds.includes(0) && !ds.includes(base - 1)) analogue = false;
      }
    }
  }
  check(`in bases 3..36 every column has a 0 or base-1 (${cols2} columns, S <= 150)`, analogue);

  let padded = true;
  for (let base = 3; base <= 36; base++) {
    for (const value0 of [1, 7, 50, 1050, 1089]) {
      const st3 = C.start({ base, value: value0.toString(base).toUpperCase(), autonomous: true });
      for (let col = 0; col < 5; col++) {
        const rs = appletRows(st3.digits, base);
        const want = rs.map((s) => { const i = s.length - 1 - col; return i >= 0 ? D.indexOf(s[i]) : 0; });
        if (C.columnDigits(st3, col).join(",") !== want.join(",")) padded = false;
      }
    }
  }
  check("columnDigits matches DrawString's row digits and leading gaps", padded);

  const doneState = { ...st, checkedColumn: 2 };
  equal("checking a column finishes the exploration", C.result(st), null);
  equal("checking a column now reports done", C.result(doneState), "done");
}

done("zeros-and-nines");
