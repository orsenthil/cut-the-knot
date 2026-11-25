"use strict";

/*
 * Modular Arithmetic Tables, from Alexander Bogomolny's applet Modulo.
 *
 * Numbers a and b are congruent modulo N when N divides a - b, i.e. they have
 * the same remainder. The remainders 0 .. N-1 can be added, subtracted and
 * multiplied (mod N); division is possible, and unique, only when N is prime.
 * The applet draws the table of one of the four operations for a modulus N
 * from 2 to 30 (10 to begin with). Addition and subtraction tables have N
 * rows and N columns (headers 0 .. N-1); multiplication and division tables
 * leave out the row and column of 0 (headers 1 .. N-1). Division is offered only
 * for a prime N. In the division table the entry in row r and column b is the
 * a with a * b = r (mod N), that is r divided by b.
 *
 * The position is plain data: { n, op, mark } with op 0 plus, 1 times, 2 minus,
 * 3 divide, and mark the remainder the player has picked out (or null).
 */
const ModularCore = (() => {
  const MIN_N = 2, MAX_N = 30, DEFAULT_N = 10;
  const OPS = [{ id: "plus", sign: "+" }, { id: "times", sign: "×" }, { id: "minus", sign: "−" }, { id: "divide", sign: ":" }];

  const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || DEFAULT_N));

  const start = () => ({ n: DEFAULT_N, op: 0, mark: null });

  /** Is this operation offered for this modulus? (Division only for primes.) */
  const available = (n, op) => op >= 0 && op <= 3 && (op !== 3 || isPrime(n));

  /** Change the modulus. Division is dropped for a composite N (the applet would draw nothing). */
  function setModulus(state, n) {
    n = clampN(n);
    return { n, op: available(n, state.op) ? state.op : 0, mark: null };
  }

  /** Change the operation, or null if it is not offered. */
  const setOp = (state, op) => (available(state.n, op) ? { ...state, op, mark: null } : null);

  /** Pick out a remainder (or clear with null): its occurrences are highlighted. */
  const setMark = (state, m) => (m === null || (Number.isInteger(m) && m >= 0 && m < state.n) ? { ...state, mark: m } : null);

  /**
   * The table: { headers, cells } with cells[row][col] the entry for row header
   * headers[row] and column header headers[col], as the applet computes it.
   */
  function table(n, op) {
    if (!available(n, op)) return null;
    const lo = op % 2 === 1 ? 1 : 0;
    const headers = []; for (let v = lo; v < n; v++) headers.push(v);
    const size = headers.length;
    const cells = Array.from({ length: size }, () => Array(size).fill(0));
    if (op !== 3) {
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
        const a = headers[r], b = headers[c];
        cells[r][c] = op === 0 ? (a + b) % n : op === 1 ? (a * b) % n : (n + a - b) % n;
      }
    } else {
      // the applet fills the quotient table from products: a * b = r puts a in row r, column b
      for (let a = 1; a < n; a++) for (let b = 1; b < n; b++) cells[((a * b) % n) - 1][b - 1] = a;
    }
    return { headers, cells };
  }

  return { MIN_N, MAX_N, DEFAULT_N, OPS, isPrime, clampN, start, available, setModulus, setOp, setMark, table };
})();
