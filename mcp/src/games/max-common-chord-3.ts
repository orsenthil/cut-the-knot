/*
 * run_game_logic actions and saved-position reader for Max Common Chord 3
 * (Bogomolny's MaxCommonChord3 applet, the 1975 USAMO problem about two
 * intersecting circles).
 *
 * Two circles C(E) and C(F) meet at P and Q. A variable line through P meets
 * them again at A and B, and we ask which line maximises AP·PB. The circle
 * through A, B, Q crosses PQ again at R, so intersecting chords give
 * AP·PB = PQ·PR; with S the centre of that circle and N the foot from S to
 * PQ, Q and R are one radius from S, hence QR = 2·QN (the word the live page
 * hides in its quiz). As the chord turns, S runs on the circumcircle C(O) of
 * E, Q, F, and QN — so the product — is greatest when S is the midpoint of
 * the arc from T to U (QT a diameter), where SN is tangent to C(O).
 *
 * Every number below comes from the real core, copied at build time from
 * max-common-chord-3/max-common-chord-3-core.js into src/generated/cores/.
 * Coordinates are board units of the 400 x 288 viewBox, y down. See _shared.ts
 * for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleInfo = { c: Pt; r: number };
type State = {
  P: Pt; Q: Pt; A: Pt; B: Pt;
  adjustCircles: boolean; showNames: boolean;
};
type Best = {
  S: Pt; A: Pt | null; B: Pt | null; angleDiff: number; product: number;
};
type Aux = {
  valid: boolean; E: CircleInfo | null; F: CircleInfo | null; O: CircleInfo | null;
  U: Pt | null; T: Pt | null; best: Best | null;
};
type Measure = {
  valid: boolean;
  E: CircleInfo | null; F: CircleInfo | null; O: CircleInfo | null; AB: CircleInfo | null;
  R: Pt | null; L: Pt | null; M: Pt | null; S: Pt | null; U: Pt | null; T: Pt | null; N: Pt | null;
  angleDiff: number; finished: boolean; best: Best | null;
  product: number; pqpr: number; QR: number; QN: number; SN: number; SQ: number;
};
type Claims = {
  valid: boolean; chordThroughP: boolean; qrTwiceQn: boolean; sIsCentre: boolean;
  sOnAux: boolean; intersectingChords: boolean; bestIsArcMidpoint: boolean;
  bestIsTangent: boolean; bestIsMaximum: boolean;
};

interface Core {
  start(options?: { width?: number; height?: number }): State;
  auxiliary(s: State): Aux;
  measure(s: State): Measure;
  bestPosition(g: { E: CircleInfo; F: CircleInfo; O: CircleInfo; P: Pt; Q: Pt; U: Pt; T: Pt }): Best | null;
  chordFromS(s: State, S: Pt): State | null;
  pointOnAux(s: State, radians: number): Pt | null;
  claims(s: State): Claims;
  tangentAt(s: State, S: Pt): boolean;
  withPoint(s: State, name: string, p: Pt): State;
  result(s: State): null;
  dist(p: Pt, q: Pt): number;
  angle(v: Pt, p: Pt, q: Pt): number;
}

const core = (): Core =>
  cores["max-common-chord-3"].MaxCommonChord3Core as unknown as Core;

/** The page's SVG viewBox; its Track.state payload holds no board size. */
const BOARD = { width: 400, height: 288 };
/** The four choices in the page's hidden quiz, in source order. */
const QUIZ_CHOICES = ["twice", "twice", "thrice", "four times"] as const;

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
/** JSON has no NaN or Infinity; print non-finite core values as null. */
const cnt = (v: number | undefined): number | null =>
  v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circ = (c: CircleInfo | null | undefined) =>
  c ? { center: pt(c.c), radius: cnt(c.r) } : null;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** A point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (isObj(raw)) {
    [x, y] = [Number(raw.x), Number(raw.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(raw: unknown, key: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return raw;
}

/** Rebuild a core state from four saved points, defaulting to the start picture. */
function buildState(C: Core, args: Json): State {
  if (!isObj(args)) throw new Error("arguments must be an object of points and options");
  const width = num(args, "width", BOARD.width);
  const height = num(args, "height", BOARD.height);
  if (width < 50 || width > 5000 || height < 50 || height > 5000) {
    throw new Error('"width" and "height" must each be between 50 and 5000');
  }
  const seed = C.start({ width, height });
  return {
    P: args.P === undefined || args.P === null ? seed.P : readPoint(args.P, "P"),
    Q: args.Q === undefined || args.Q === null ? seed.Q : readPoint(args.Q, "Q"),
    A: args.A === undefined || args.A === null ? seed.A : readPoint(args.A, "A"),
    B: args.B === undefined || args.B === null ? seed.B : readPoint(args.B, "B"),
    adjustCircles: readBool(args.adjustCircles, "adjustCircles", seed.adjustCircles),
    showNames: readBool(args.showNames, "showNames", seed.showNames),
  };
}

/** The hidden quiz's correct word is only right when QR really is 2·QN. */
const quizAnswer = (cl: Claims): string | null =>
  cl.valid && cl.qrTwiceQn ? "twice" : null;

/** Everything the real core can say about one chord. */
function reading(C: Core, s: State) {
  const aux = C.auxiliary(s);
  const m = C.measure(s);
  const cl = C.claims(s);
  const best = aux.best;
  return {
    points: {
      P: pt(s.P), Q: pt(s.Q), A: pt(s.A), B: pt(s.B),
      E: circ(aux.E), F: circ(aux.F), O: circ(aux.O),
      U: pt(aux.U), T: pt(aux.T),
    },
    flags: { adjustCircles: s.adjustCircles, showNames: s.showNames },
    construction: {
      valid: m.valid,
      circleABQ: circ(m.AB),
      centreOfABQ: pt(m.S),
      footN: pt(m.N),
      crossingR: pt(m.R),
      L: pt(m.L), M: pt(m.M),
    },
    lengths: {
      QR: cnt(m.QR), QN: cnt(m.QN), QRoverQN: cnt(m.QN ? m.QR / m.QN : undefined),
      APtimesPB: cnt(m.product), PQtimesPR: cnt(m.pqpr),
      SN: cnt(m.SN), SQ: cnt(m.SQ),
      productEqualsPQtimesPR: cl.intersectingChords,
      qrIsTwiceQn: cl.qrTwiceQn,
    },
    angles: {
      angleUQSminusSQT: cnt(m.angleDiff),
      equalArcs: m.finished,
      tangentAtS: m.S ? C.tangentAt(s, m.S) : null,
    },
    claims: cl,
    hiddenQuiz: {
      choices: [...QUIZ_CHOICES],
      answer: quizAnswer(cl),
      note: cl.qrTwiceQn
        ? "The choices are 'twice, twice, thrice, four times' and the core confirms the repeated first word: QR = 2·QN."
        : "The choices are 'twice, twice, thrice, four times', but this chord does not satisfy QR = 2·QN, so the quiz word is not supported here.",
    },
    best: best ? {
      S: pt(best.S), A: pt(best.A), B: pt(best.B),
      angleDiff: cnt(best.angleDiff), product: cnt(best.product),
      fractionOfCurrentProduct: cnt(m.product ? best.product / m.product : undefined),
      arcMidpoint: cl.bestIsArcMidpoint,
      tangent: cl.bestIsTangent,
      maximum: cl.bestIsMaximum,
    } : null,
    result: C.result(s),
    note:
      "The circle through A, B, Q meets PQ again at R, so intersecting chords give AP·PB = PQ·PR. " +
      "S is the centre of that circle and N the foot of its perpendicular to PQ, so Q and R are equidistant from S and QR = 2·QN (the hidden quiz word 'twice'). " +
      "S travels on the circumcircle of E, Q, F, and QN is greatest when S is the arc midpoint of T and U, where SN is tangent to that circle. " +
      (cl.valid
        ? (m.finished
          ? "This chord is drawn at that maximum, so all the page's claims check out."
          : "This chord is not at the maximum; drag A or B, or use best_chord, to make the two arcs at Q equal.")
        : "The four points are too close together (or the construction degenerates) to draw the circles, so there is no reading.") +
      " This is an illustration, so there is no win or loss.",
  };
}

/* Example args: the fixture's P and Q with the core's best chord, where the
   intersecting-chords and QR = 2·QN claims all hold. */
const READ_ARGS =
  '{"P":{"x":221.1818181818182,"y":172.8},"Q":{"x":200,"y":230.4},' +
  '"A":{"x":136.5869353498298,"y":158.4442530950277},' +
  '"B":{"x":394.67857591816346,"y":202.24239012474305}}';

/* Example args: the exact state saved in porting/live-fixtures/max-common-chord-3.json. */
const FIXTURE_ARGS =
  '{"P":{"x":221.1818181818182,"y":172.8},"Q":{"x":200,"y":230.4},' +
  '"A":{"x":150,"y":230.4},"B":{"x":239.86471648872327,"y":154.48228751032659},' +
  '"adjustCircles":false,"showNames":false}';

export function actions(): GameActions {
  return {
    read_chord: {
      describe:
        "Read the chord AB through P from four optional points P, Q, A, B (each [x, y] or { x, y }; omitted points keep the applet's 400 x 288 opening picture) and optional width, height, adjustCircles and showNames. The real core rebuilds the circles through A, P, Q and B, P, Q, the auxiliary circle through their centres and Q, the centre S of the circle through A, B, Q and the foot N on PQ; it reports QR, QN, AP×PB, PQ×PR and whether QR = 2·QN, AP×PB = PQ×PR, the equal arcs and tangency hold. The hidden quiz word 'twice' is reported only when the core confirms QR = 2·QN. The example uses the fixture's P and Q with the maximizing chord, where every claim holds.",
      args: READ_ARGS,
      run: (args) => {
        const C = core();
        return reading(C, buildState(C, args));
      },
    },

    best_chord: {
      describe:
        "From the same optional four points, let the core place S at the midpoint of arc TU of the auxiliary circle (the point where SN is tangent and the angles UQS and SQT are equal), build the chord belonging to that S, and read it back. It reports the maximal AP×PB, the new QR and QN with QR = 2·QN, the two equal angles at Q, and the hidden quiz answer 'twice'. The example starts from the chord saved in the live fixture, which does not satisfy the claims, and shows the maximum the core finds from it. The maximum statement presumes the diagram's order with P between Q and U; if P and Q are swapped the arc midpoint can give the smallest product instead.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const aux = C.auxiliary(s);
        if (!aux.valid || !aux.best || !aux.best.A || !aux.best.B) {
          throw new Error("Move P, Q, A and B at least two units apart so the core can draw the circles first");
        }
        const S = aux.best.S;
        const bestState = C.chordFromS(s, S);
        if (!bestState) throw new Error("The core could not build a chord from that point S");
        const before = C.measure(s);
        const m = C.measure(bestState);
        const cl = C.claims(bestState);
        return {
          from: { A: pt(s.A), B: pt(s.B), APtimesPB: cnt(before.product) },
          best: {
            S: pt(S), A: pt(bestState.A), B: pt(bestState.B),
            APtimesPB: cnt(m.product), PQtimesPR: cnt(m.pqpr),
            QR: cnt(m.QR), QN: cnt(m.QN), QRoverQN: cnt(m.QN ? m.QR / m.QN : undefined),
            productGain: cnt(before.product ? m.product / before.product : undefined),
          },
          angles: {
            UQS: cnt(aux.U ? C.angle(s.Q, aux.U, S) : undefined),
            SQT: cnt(aux.T ? C.angle(s.Q, S, aux.T) : undefined),
            difference: cnt(m.angleDiff),
            equalArcs: m.finished,
            tangent: C.tangentAt(s, S),
          },
          checks: {
            chordThroughP: cl.chordThroughP,
            qrIsTwiceQn: cl.qrTwiceQn,
            intersectingChords: cl.intersectingChords,
            arcMidpoint: cl.bestIsArcMidpoint,
            tangent: cl.bestIsTangent,
            maximum: cl.bestIsMaximum,
          },
          hiddenQuiz: {
            choices: [...QUIZ_CHOICES],
            answer: quizAnswer(cl),
          },
          result: C.result(bestState),
          note:
            "S was placed on the auxiliary circle at the arc midpoint of T and U, so the radius OS is parallel to PQ and SN is tangent there. " +
            "The chord through that S passes through P: the core gives AP×PB = PQ×PR = " + cnt(m.product) +
            ", with QR = " + cnt(m.QR) + " = 2 × QN = " + cnt(2 * m.QN) +
            " and equal angles at Q, so the hidden quiz word is 'twice'. " +
            "This assumes P lies between Q and U; swapping their names can make this S the minimum instead.",
        };
      },
    },
  };
}

/** Echo every field Track.state saved, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Max Common Chord 3 state version ${stateVersion}`);
  }
  if (!isObj(state)) throw new Error("saved Max Common Chord 3 position must be an object");
  const C = core();
  const s = buildState(C, state);
  return {
    ...state,
    stateVersion,
    saved: {
      P: pt(s.P), Q: pt(s.Q), A: pt(s.A), B: pt(s.B),
      adjustCircles: s.adjustCircles, showNames: s.showNames,
    },
    board: { width: num(state, "width", BOARD.width), height: num(state, "height", BOARD.height) },
    core: reading(C, s),
    note:
      "Track.state saves the four draggable points P, Q, A, B and the two display flags in the page's 400 x 288 board units; no board size is saved. " +
      "The core rebuilds the two given circles, the auxiliary circle through their centres and Q, the circle through A, B, Q, its centre S and the foot N, then reports QR, QN, AP×PB, PQ×PR, the equal-arc and tangency verdicts, the best chord and the hidden quiz word. " +
      "This illustration has no win or loss, so result is always null.",
  };
}
