"use strict";

/*
 * Primes from the Zeros, an original demo for the Riemann Hypothesis path.
 *
 * Chebyshev's function psi(x) adds ln p for every prime power p^k up to x, so
 * it jumps at each prime and prime power and is close to x. Riemann's
 * explicit formula says exactly how it differs from x, in terms of the
 * zeros rho of the zeta function (the nontrivial ones, 1/2 + i gamma if the
 * hypothesis holds):
 *
 *   psi(x) = x - sum over zeros rho of x^rho / rho - ln(2 pi) - (1/2) ln(1 - x^-2)
 *
 * (at a jump, the average of the two sides). The zeros come in pairs
 * 1/2 +- i gamma, so each pair contributes the real wave
 *
 *   -2 Re( x^(1/2 + i gamma) / (1/2 + i gamma) )
 *     = -2 sqrt(x) ( cos(gamma ln x) / 2 + gamma sin(gamma ln x) ) / (1/4 + gamma^2).
 *
 * Each wave oscillates with frequency gamma in ln x and amplitude about
 * sqrt(x) / gamma: low zeros make big, slow waves; high zeros small, fast
 * ones. With no zeros you get a smooth curve; with enough, the staircase.
 * If some zero had real part more than 1/2, its wave would grow faster than
 * sqrt(x): that is what the hypothesis forbids.
 *
 * DOM-free; one global, PrimeWavesCore.
 */
const PrimeWavesCore = (() => {
  const MAX_ZEROS = 100, MIN_X = 2, MAX_X = 200, DEFAULT_X = 50, DEFAULT_ZEROS = 10;
  // The imaginary parts of the first 100 zeros of zeta on the critical line (checked
  // against Hardy's Z function in porting/check-prime-waves.mjs).
  const ZEROS = [
    14.134725142, 21.022039639, 25.010857580, 30.424876126, 32.935061588,
    37.586178159, 40.918719012, 43.327073281, 48.005150881, 49.773832478,
    52.970321478, 56.446247697, 59.347044003, 60.831778525, 65.112544048,
    67.079810529, 69.546401711, 72.067157674, 75.704690699, 77.144840069,
    79.337375020, 82.910380854, 84.735492981, 87.425274613, 88.809111208,
    92.491899271, 94.651344041, 95.870634228, 98.831194218, 101.317851006,
    103.725538040, 105.446623052, 107.168611184, 111.029535543, 111.874659177,
    114.320220915, 116.226680321, 118.790782866, 121.370125002, 122.946829294,
    124.256818554, 127.516683880, 129.578704200, 131.087688531, 133.497737203,
    134.756509753, 138.116042055, 139.736208952, 141.123707404, 143.111845808,
    146.000982487, 147.422765343, 150.053520421, 150.925257612, 153.024693811,
    156.112909294, 157.597591818, 158.849988171, 161.188964138, 163.030709687,
    165.537069188, 167.184439978, 169.094515416, 169.911976479, 173.411536520,
    174.754191523, 176.441434298, 178.377407776, 179.916484020, 182.207078484,
    184.874467848, 185.598783678, 187.228922584, 189.416158656, 192.026656361,
    193.079726604, 195.265396680, 196.876481841, 198.015309676, 201.264751944,
    202.493594514, 204.189671803, 205.394697202, 207.906258888, 209.576509717,
    211.690862595, 213.347919360, 214.547044783, 216.169538508, 219.067596349,
    220.714918839, 221.430705555, 224.007000255, 224.983324670, 227.421444280,
    229.337413306, 231.250188700, 231.987235253, 233.693404179, 236.524229666,
  ];

  const clampX = (x) => { x = Number(x); return Number.isFinite(x) ? Math.min(MAX_X, Math.max(MIN_X, Math.floor(x))) : DEFAULT_X; };
  const clampK = (k) => { k = Math.floor(Number(k)); return Number.isFinite(k) ? Math.min(MAX_ZEROS, Math.max(0, k)) : DEFAULT_ZEROS; };

  /** The smallest prime factor of n >= 2. */
  function spf(n) {
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
    return n;
  }

  /** If n is a power of a prime p, returns p, else 0. */
  function primePowerBase(n) {
    if (n < 2) return 0;
    const p = spf(n);
    let m = n;
    while (m % p === 0) m /= p;
    return m === 1 ? p : 0;
  }

  /** The jump of psi at the whole number n: ln p when n is a power of the prime p, else 0. */
  function jump(n) {
    const p = primePowerBase(n);
    return p ? Math.log(p) : 0;
  }

  /** Chebyshev's psi(x) with the usual convention: half a jump at a jump. */
  function psi(x) {
    const n = Math.floor(x);
    let s = 0;
    for (let k = 2; k <= n; k++) s += jump(k);
    if (Number.isInteger(x)) s -= jump(x) / 2;
    return s;
  }

  /** The wave one pair of zeros adds to the formula, at x. */
  function wave(k, x) {
    const g = ZEROS[k];
    const L = Math.log(x);
    return (-2 * Math.sqrt(x) * (0.5 * Math.cos(g * L) + g * Math.sin(g * L))) / (0.25 + g * g);
  }

  /** The formula with the first k pairs of zeros. k = 0 is the smooth part alone. */
  function approx(x, k) {
    k = clampK(k);
    let s = x - Math.log(2 * Math.PI) - 0.5 * Math.log(1 - 1 / (x * x));
    for (let i = 0; i < k; i++) s += wave(i, x);
    return s;
  }

  /** psi and the approximation sampled for the plot: x from 2 to maxX. */
  function series(maxX, k, points) {
    maxX = clampX(maxX);
    const n = points || 800;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const x = 2 + ((maxX - 2) * i) / n;
      out.push({ x, approx: approx(x, k) });
    }
    return out;
  }

  /** The exact staircase corners for x up to maxX: [x, psi just before, psi just after] at each jump. */
  function steps(maxX) {
    maxX = clampX(maxX);
    const out = [];
    let level = 0;
    for (let n = 2; n <= maxX; n++) {
      const j = jump(n);
      if (j) { out.push({ x: n, from: level, to: level + j }); level += j; }
    }
    return out;
  }

  return { MAX_ZEROS, MIN_X, MAX_X, DEFAULT_X, DEFAULT_ZEROS, ZEROS, clampX, clampK, jump, psi, wave, approx, series, steps };
})();
