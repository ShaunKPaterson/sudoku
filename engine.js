/* Sudoku engine: brute-force solver, human-technique solver and grader, puzzle generator, and
   grade-preserving transforms. Loaded by the page and, as a background worker, by itself.

   Grading follows the sudoku.coach / SukakuExplainer approach: solve the way a person would,
   always trying the easiest technique first; the puzzle's level is the hardest technique the
   solve path needs. Work points (after SudokuWiki's grader) and a pace measure are recorded too. */
'use strict';
(function (global) {

// ---------- geometry ----------
const RO = [], CO = [], BO = [];
for (let i = 0; i < 81; i++) { RO[i] = i / 9 | 0; CO[i] = i % 9; BO[i] = (RO[i] / 3 | 0) * 3 + (CO[i] / 3 | 0); }
const UNITS = []; // 0-8 rows, 9-17 columns, 18-26 boxes
for (let k = 0; k < 9; k++) UNITS.push([...Array(9).keys()].map(j => k * 9 + j));
for (let k = 0; k < 9; k++) UNITS.push([...Array(9).keys()].map(j => j * 9 + k));
for (let k = 0; k < 9; k++) {
  const r0 = (k / 3 | 0) * 3, c0 = (k % 3) * 3;
  UNITS.push([...Array(9).keys()].map(j => (r0 + (j / 3 | 0)) * 9 + c0 + j % 3));
}
const PEERS = [], SEE = new Uint8Array(81 * 81);
for (let i = 0; i < 81; i++) {
  const p = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (RO[j] === RO[i] || CO[j] === CO[i] || BO[j] === BO[i])) { p.push(j); SEE[i * 81 + j] = 1; }
  }
  PEERS.push(p);
}
const sees = (a, b) => SEE[a * 81 + b] === 1;
const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const digitsOf = m => { const r = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) r.push(d); return r; };
const lowDigit = m => 31 - Math.clz32(m & -m);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function combos(arr, k, start = 0, acc = [], out = []) {
  if (acc.length === k) { out.push(acc.slice()); return out; }
  for (let i = start; i <= arr.length - (k - acc.length); i++) { acc.push(arr[i]); combos(arr, k, i + 1, acc, out); acc.pop(); }
  return out;
}

// ---------- wording ----------
const cellName = i => `R${RO[i] + 1}C${CO[i] + 1}`;
const unitName = u => u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`;
const cap = s => s[0].toUpperCase() + s.slice(1);
const list = a => a.length < 2 ? String(a[0] ?? '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const cells = a => list(a.map(cellName));
const digs = m => list(digitsOf(m));
const unitsOf = (a, base) => [...new Set(a)].sort((x, y) => x - y).map(n => unitName(base + n));

// ---------- brute-force solver (uniqueness checks and generation) ----------
// Counts solutions up to `limit`; with randomize, the first solution found is a random full grid.
function solveCount(grid, limit, randomize) {
  const g = grid.slice(), R = Array(9).fill(0), C = Array(9).fill(0), B = Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (!v) continue;
    const m = 1 << v;
    if ((R[RO[i]] | C[CO[i]] | B[BO[i]]) & m) return {count: 0, solution: null};
    R[RO[i]] |= m; C[CO[i]] |= m; B[BO[i]] |= m;
  }
  let count = 0, first = null;
  (function rec() {
    let best = -1, bm = 0, bc = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = ~(R[RO[i]] | C[CO[i]] | B[BO[i]]) & 0x3FE, n = popcount(m);
      if (n === 0) return;
      if (n < bc) { bc = n; best = i; bm = m; if (n === 1) break; }
    }
    if (best < 0) { count++; if (!first) first = g.slice(); return; }
    const ds = digitsOf(bm);
    if (randomize) shuffle(ds);
    const r = RO[best], c = CO[best], b = BO[best];
    for (const d of ds) {
      const m = 1 << d;
      g[best] = d; R[r] |= m; C[c] |= m; B[b] |= m;
      rec();
      g[best] = 0; R[r] &= ~m; C[c] &= ~m; B[b] &= ~m;
      if (count >= limit) return;
    }
  })();
  return {count, solution: first};
}

// ---------- candidate state ----------
function makeState(grid) {
  const g = grid.slice(), c = Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    let m = 0x3FE;
    for (const p of PEERS[i]) if (g[p]) m &= ~(1 << g[p]);
    c[i] = m;
  }
  return {g, c};
}
function applyStep(s, step) {
  for (const {i, d} of step.place || []) {
    s.g[i] = d; s.c[i] = 0;
    for (const p of PEERS[i]) s.c[p] &= ~(1 << d);
  }
  for (const {i, m} of step.elim || []) s.c[i] &= ~m;
}
const positions = (s, u, bit) => UNITS[u].filter(i => s.c[i] & bit);
const placedIn = (s, u) => { let m = 0; for (const i of UNITS[u]) if (s.g[i]) m |= 1 << s.g[i]; return m; };
const elimDigit = (targets, bit) => targets.map(i => ({i, m: bit}));
const othersSeeing = (s, bit, pattern, ...ends) => {
  const out = [];
  for (let i = 0; i < 81; i++) {
    if (!(s.c[i] & bit) || pattern.includes(i)) continue;
    if (ends.every(e => sees(i, e))) out.push(i);
  }
  return out;
};

// ---------- techniques ----------
// Each returns a step {place, elim, area, focus, focusB, digits, nudge, text} or null.
// area: cells to shade for the nudge; focus/focusB: the pattern cells; digits: candidates to emphasise.

function fullHouse(s) {
  for (let u = 0; u < 27; u++) {
    let empty = -1, n = 0;
    for (const i of UNITS[u]) if (!s.g[i]) { empty = i; n++; }
    if (n !== 1 || !s.c[empty]) continue;
    const d = lowDigit(s.c[empty]);
    return {place: [{i: empty, d}], area: UNITS[u], focus: [], digits: 1 << d,
      nudge: `${cap(unitName(u))} is almost full.`,
      text: `${cap(unitName(u))} has just one empty square left, ${cellName(empty)}. It must be the one missing number: ${d}.`};
  }
  return null;
}

function hiddenSingle(from, to) {
  return s => {
    for (let u = from; u < to; u++) {
      const placed = placedIn(s, u);
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        if (placed & bit) continue;
        const pos = positions(s, u, bit);
        if (pos.length !== 1) continue;
        const i = pos[0], blockers = new Set();
        for (const j of UNITS[u]) {
          if (j === i || s.g[j]) continue;
          const b = PEERS[j].find(p => s.g[p] === d);
          if (b !== undefined) blockers.add(b);
        }
        return {place: [{i, d}], area: UNITS[u], focus: [...blockers], digits: bit,
          nudge: `Look at where ${d} can go in ${unitName(u)}.`,
          text: `In ${unitName(u)}, every empty square except ${cellName(i)} is ruled out for ${d}` +
            (blockers.size ? ` — each already sees a ${d} (highlighted)` : '') + `. So ${cellName(i)} must be ${d}.`};
      }
    }
    return null;
  };
}

function nakedSingle(s) {
  for (let i = 0; i < 81; i++) {
    if (s.g[i] || popcount(s.c[i]) !== 1) continue;
    const d = lowDigit(s.c[i]);
    return {place: [{i, d}], area: [...PEERS[i]], focus: [], digits: 1 << d,
      nudge: `One square in ${unitName(RO[i])} has only one number that fits.`,
      text: `${cellName(i)}: its row, column and box already rule out every number except ${d}. So it must be ${d}.`};
  }
  return null;
}

function pointing(s) {
  for (let b = 18; b < 27; b++) for (let d = 1; d <= 9; d++) {
    const bit = 1 << d, pos = positions(s, b, bit);
    if (pos.length < 2) continue;
    for (const [lineOf, base] of [[RO, 0], [CO, 9]]) {
      if (!pos.every(i => lineOf[i] === lineOf[pos[0]])) continue;
      const line = base + lineOf[pos[0]];
      const targets = UNITS[line].filter(i => BO[i] !== b - 18 && (s.c[i] & bit));
      if (!targets.length) continue;
      return {elim: elimDigit(targets, bit), area: UNITS[b], focus: pos, digits: bit,
        nudge: `Look at where ${d} can go in ${unitName(b)}.`,
        text: `In ${unitName(b)}, ${d} can only go in ${cells(pos)} — all in ${unitName(line)}. ` +
          `So the ${d} for ${unitName(line)} must be inside ${unitName(b)}, and ${d} can be removed from the rest of ${unitName(line)}: ${cells(targets)}.`};
    }
  }
  return null;
}

function claiming(s) {
  for (let line = 0; line < 18; line++) for (let d = 1; d <= 9; d++) {
    const bit = 1 << d, pos = positions(s, line, bit);
    if (pos.length < 2 || !pos.every(i => BO[i] === BO[pos[0]])) continue;
    const box = 18 + BO[pos[0]];
    const targets = UNITS[box].filter(i => !UNITS[line].includes(i) && (s.c[i] & bit));
    if (!targets.length) continue;
    return {elim: elimDigit(targets, bit), area: UNITS[line], focus: pos, digits: bit,
      nudge: `Look at where ${d} can go in ${unitName(line)}.`,
      text: `In ${unitName(line)}, ${d} can only go in ${cells(pos)} — all inside ${unitName(box)}. ` +
        `So ${unitName(box)}'s ${d} must be one of those, and ${d} can be removed from the rest of ${unitName(box)}: ${cells(targets)}.`};
  }
  return null;
}

const SUBSET_NAME = {2: 'pair', 3: 'triple', 4: 'quad'};

function nakedSubset(k) {
  return s => {
    for (let u = 0; u < 27; u++) {
      const empties = UNITS[u].filter(i => !s.g[i]);
      if (empties.length <= k) continue;
      const pool = empties.filter(i => popcount(s.c[i]) >= 2 && popcount(s.c[i]) <= k);
      for (const set of combos(pool, k)) {
        let m = 0;
        for (const i of set) m |= s.c[i];
        if (popcount(m) !== k) continue;
        const elim = empties.filter(i => !set.includes(i) && (s.c[i] & m)).map(i => ({i, m: s.c[i] & m}));
        if (!elim.length) continue;
        return {elim, area: UNITS[u], focus: set, digits: m,
          nudge: `Look for ${k} squares in ${unitName(u)} that share the same ${k} candidates.`,
          text: `In ${unitName(u)}, ${cells(set)} can only hold ${digs(m)}. Those ${k} numbers must fill those ${k} squares, ` +
            `so they can be removed from every other square in ${unitName(u)}: ${cells(elim.map(e => e.i))}.`};
      }
    }
    return null;
  };
}

function hiddenSubset(k) {
  return s => {
    for (let u = 0; u < 27; u++) {
      const placed = placedIn(s, u), pool = [];
      for (let d = 1; d <= 9; d++) {
        if (placed & (1 << d)) continue;
        const n = positions(s, u, 1 << d).length;
        if (n >= 2 && n <= k) pool.push(d);
      }
      for (const set of combos(pool, k)) {
        let dm = 0;
        for (const d of set) dm |= 1 << d;
        const where = UNITS[u].filter(i => s.c[i] & dm);
        if (where.length !== k) continue;
        const elim = where.filter(i => s.c[i] & ~dm).map(i => ({i, m: s.c[i] & ~dm}));
        if (!elim.length) continue;
        return {elim, area: UNITS[u], focus: where, digits: dm,
          nudge: `In ${unitName(u)}, look for ${k} numbers that can only go in the same ${k} squares.`,
          text: `In ${unitName(u)}, ${digs(dm)} can only go in ${cells(where)}. Those squares must hold exactly those numbers, ` +
            `so every other candidate can be removed from them.`};
      }
    }
    return null;
  };
}

const FISH_NAME = {2: 'X-Wing', 3: 'Swordfish', 4: 'Jellyfish'};

function fish(k) {
  return s => {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      for (const byCol of [false, true]) {
        const lines = [];
        for (let l = 0; l < 9; l++) {
          const pos = positions(s, (byCol ? 9 : 0) + l, bit);
          if (pos.length >= 2 && pos.length <= k) lines.push({l, pos});
        }
        for (const set of combos(lines, k)) {
          const cover = new Set(), baseSet = new Set(set.map(x => x.l));
          for (const x of set) for (const i of x.pos) cover.add(byCol ? RO[i] : CO[i]);
          if (cover.size !== k) continue;
          const targets = [];
          for (const c of cover) {
            for (const i of UNITS[(byCol ? 0 : 9) + c]) {
              if ((s.c[i] & bit) && !baseSet.has(byCol ? CO[i] : RO[i])) targets.push(i);
            }
          }
          if (!targets.length) continue;
          const focus = set.flatMap(x => x.pos);
          const base = unitsOf(set.map(x => x.l), byCol ? 9 : 0), covers = unitsOf([...cover], byCol ? 0 : 9);
          return {elim: elimDigit(targets, bit), area: set.flatMap(x => UNITS[(byCol ? 9 : 0) + x.l]), focus, digits: bit,
            nudge: `Look at the ${d}s: there's a ${FISH_NAME[k]} pattern.`,
            text: `In ${list(base)}, ${d} can only go in ${list(covers)}. However it falls, each of ${list(covers)} gets its ${d} ` +
              `inside this pattern, so ${d} can be removed from the rest of ${list(covers)}: ${cells(targets)}.`};
        }
      }
    }
    return null;
  };
}

// Two lines with exactly two spots each; one spot of each shares a cross line, so one of the other two ends must be the digit.
function skyscraper(s) {
  for (let d = 1; d <= 9; d++) {
    const bit = 1 << d;
    for (const byCol of [false, true]) {
      const X = byCol ? RO : CO, base = byCol ? 9 : 0;
      const lines = [];
      for (let l = 0; l < 9; l++) { const pos = positions(s, base + l, bit); if (pos.length === 2) lines.push({l, pos}); }
      for (const [A, B] of combos(lines, 2)) {
        for (const a of A.pos) for (const b of B.pos) {
          if (X[a] !== X[b]) continue;
          const e1 = A.pos.find(i => i !== a), e2 = B.pos.find(i => i !== b);
          if (X[e1] === X[e2]) continue; // that would be an X-Wing
          const pattern = [a, b, e1, e2], targets = othersSeeing(s, bit, pattern, e1, e2);
          if (!targets.length) continue;
          return {elim: elimDigit(targets, bit), area: [...UNITS[base + A.l], ...UNITS[base + B.l]], focus: [a, b], focusB: [e1, e2], digits: bit,
            nudge: `Look at the ${d}s in ${unitName(base + A.l)} and ${unitName(base + B.l)}: there's a Skyscraper.`,
            text: `${cap(unitName(base + A.l))} and ${unitName(base + B.l)} each have only two spots for ${d}, and ${cellName(a)} and ${cellName(b)} line up. ` +
              `Only one of those two can be ${d}, so one of the other ends — ${cellName(e1)} or ${cellName(e2)} — must be ${d}. ` +
              `Squares that see both ends can't be ${d}: ${cells(targets)}.`};
        }
      }
    }
  }
  return null;
}

// A row and a column with exactly two spots each, joined through one box: one of the free ends must be the digit.
function twoStringKite(s) {
  for (let d = 1; d <= 9; d++) {
    const bit = 1 << d, rows = [], cols = [];
    for (let l = 0; l < 9; l++) {
      const r = positions(s, l, bit), c = positions(s, 9 + l, bit);
      if (r.length === 2) rows.push({l, pos: r});
      if (c.length === 2) cols.push({l, pos: c});
    }
    for (const R of rows) for (const C of cols) {
      for (const x of R.pos) for (const y of C.pos) {
        if (x === y || BO[x] !== BO[y]) continue;
        const rx = R.pos.find(i => i !== x), cy = C.pos.find(i => i !== y);
        if (BO[rx] === BO[x] || BO[cy] === BO[x] || rx === cy) continue;
        const t = RO[cy] * 9 + CO[rx];
        if (!(s.c[t] & bit) || [x, y, rx, cy].includes(t)) continue;
        return {elim: [{i: t, m: bit}], area: [...UNITS[R.l], ...UNITS[9 + C.l]], focus: [x, y], focusB: [rx, cy], digits: bit,
          nudge: `Look at the ${d}s in ${unitName(R.l)} and ${unitName(9 + C.l)}: there's a Two-String Kite.`,
          text: `${cap(unitName(R.l))} and ${unitName(9 + C.l)} each have only two spots for ${d}, and they meet in ${unitName(18 + BO[x])} ` +
            `(${cellName(x)}, ${cellName(y)}), where only one can be ${d}. So one of the free ends — ${cellName(rx)} or ${cellName(cy)} — must be ${d}, ` +
            `and ${cellName(t)}, which sees both, can't be ${d}.`};
      }
    }
  }
  return null;
}

function xyWing(s) {
  const bi = [];
  for (let i = 0; i < 81; i++) if (!s.g[i] && popcount(s.c[i]) === 2) bi.push(i);
  for (const p of bi) for (const q of bi) {
    if (!sees(p, q) || s.c[q] === s.c[p]) continue;
    const x = s.c[p] & s.c[q];
    if (popcount(x) !== 1) continue;
    const z = s.c[q] & ~x, want = (s.c[p] & ~x) | z;
    for (const r of bi) {
      if (r === q || !sees(p, r) || s.c[r] !== want) continue;
      const targets = othersSeeing(s, z, [p, q, r], q, r);
      if (!targets.length) continue;
      const zd = lowDigit(z), xd = lowDigit(x), yd = lowDigit(s.c[p] & ~x);
      return {elim: elimDigit(targets, z), area: [p, q, r], focus: [p], focusB: [q, r], digits: z | s.c[p],
        nudge: `Look for an XY-Wing: a two-number square with two partners.`,
        text: `${cellName(p)} is ${xd} or ${yd}. If it's ${xd}, ${cellName(q)} must be ${zd}; if it's ${yd}, ${cellName(r)} must be ${zd}. ` +
          `Either way one of them is ${zd}, so squares that see both can't be ${zd}: ${cells(targets)}.`};
    }
  }
  return null;
}

function xyzWing(s) {
  for (let p = 0; p < 81; p++) {
    if (s.g[p] || popcount(s.c[p]) !== 3) continue;
    const qs = PEERS[p].filter(q => !s.g[q] && popcount(s.c[q]) === 2 && !(s.c[q] & ~s.c[p]));
    for (const [q, r] of combos(qs, 2)) {
      if ((s.c[q] | s.c[r]) !== s.c[p]) continue;
      const z = s.c[q] & s.c[r];
      if (popcount(z) !== 1) continue;
      const targets = othersSeeing(s, z, [p, q, r], p, q, r);
      if (!targets.length) continue;
      const zd = lowDigit(z);
      return {elim: elimDigit(targets, z), area: [p, q, r], focus: [p], focusB: [q, r], digits: s.c[p],
        nudge: `Look for an XYZ-Wing: a three-number square with two partners.`,
        text: `${cellName(p)} holds ${digs(s.c[p])}; ${cellName(q)} and ${cellName(r)} each share ${zd} with it. Whatever ${cellName(p)} turns out to be, ` +
          `one of the three squares must be ${zd}. So squares that see all three can't be ${zd}: ${cells(targets)}.`};
    }
  }
  return null;
}

// Simple colouring on conjugate pairs of one digit: colour trap and colour wrap.
function simpleColouring(s) {
  for (let d = 1; d <= 9; d++) {
    const bit = 1 << d, adj = new Map();
    for (let u = 0; u < 27; u++) {
      const pos = positions(s, u, bit);
      if (pos.length !== 2) continue;
      for (const [a, b] of [pos, [pos[1], pos[0]]]) { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); }
    }
    const colour = new Map();
    for (const start of adj.keys()) {
      if (colour.has(start)) continue;
      const comp = [start];
      colour.set(start, 0);
      for (let k = 0; k < comp.length; k++) {
        for (const n of adj.get(comp[k])) if (!colour.has(n)) { colour.set(n, 1 - colour.get(comp[k])); comp.push(n); }
      }
      if (comp.length < 3) continue;
      const A = comp.filter(i => colour.get(i) === 0), B = comp.filter(i => colour.get(i) === 1);
      for (const [same, other] of [[A, B], [B, A]]) {
        if (!combos(same, 2).some(([a, b]) => sees(a, b))) continue;
        return {elim: elimDigit(same, bit), area: comp, focus: other, focusB: same, digits: bit,
          nudge: `Follow the ${d}s that come in pairs — try Simple Colouring.`,
          text: `Link the ${d}s that are the only two in a row, column or box, and colour them alternately. One colour is all ${d}s, the other none. ` +
            `Two squares of the same colour (${cells(same.filter(a => same.some(b => b !== a && sees(a, b))))}) see each other, so that colour can't be ${d}: ` +
            `remove ${d} from ${cells(same)}.`};
      }
      const targets = [];
      for (let i = 0; i < 81; i++) {
        if (!(s.c[i] & bit) || colour.has(i)) continue;
        if (A.some(a => sees(i, a)) && B.some(b => sees(i, b))) targets.push(i);
      }
      if (targets.length) {
        return {elim: elimDigit(targets, bit), area: comp, focus: A, focusB: B, digits: bit,
          nudge: `Follow the ${d}s that come in pairs — try Simple Colouring.`,
          text: `Link the ${d}s that are the only two in a row, column or box, and colour them alternately (two colours shown). ` +
            `One colour must be all ${d}s. ${cells(targets)} ${targets.length > 1 ? 'see' : 'sees'} both colours, so ${targets.length > 1 ? 'they' : 'it'} can't be ${d}.`};
      }
    }
  }
  return null;
}

// Chain of two-number squares; if the first end isn't z the chain forces the last end to be z.
function xyChain(s) {
  const bi = [];
  for (let i = 0; i < 81; i++) if (!s.g[i] && popcount(s.c[i]) === 2) bi.push(i);
  const adj = new Map(bi.map(i => [i, bi.filter(j => j !== i && sees(i, j))]));
  const MAX = 9;
  for (const start of bi) {
    for (const z of digitsOf(s.c[start])) {
      const zb = 1 << z, path = [start], on = new Set([start]);
      let found = null;
      const dfs = (cur, v) => {
        for (const n of adj.get(cur)) {
          if (found || on.has(n) || !(s.c[n] & (1 << v))) continue;
          const nv = lowDigit(s.c[n] & ~(1 << v));
          path.push(n); on.add(n);
          if (nv === z && path.length >= 4) {
            const targets = othersSeeing(s, zb, path, start, n);
            if (targets.length) found = {targets, path: path.slice()};
          }
          if (!found && path.length < MAX) dfs(n, nv);
          path.pop(); on.delete(n);
        }
      };
      dfs(start, lowDigit(s.c[start] & ~zb));
      if (found) {
        const {targets, path: p} = found, end = p[p.length - 1];
        return {elim: elimDigit(targets, zb), area: p, focus: [start, end], focusB: p.slice(1, -1), digits: zb,
          nudge: `Look for a chain of two-number squares (an XY-Chain) for ${z}.`,
          text: `Follow the chain ${p.map(cellName).join(' → ')}. If ${cellName(start)} isn't ${z}, each square forces the next, ` +
            `and ${cellName(end)} ends up ${z}. So one end is always ${z}, and squares that see both ends can't be ${z}: ${cells(targets)}.`};
      }
    }
  }
  return null;
}

// ---------- technique table (order = the order a person tries them) ----------
// level: 1 Easy, 2 Medium, 3 Hard, 4 Expert, 5 Master.  se: SukakuExplainer-style rating.  pts: work points.
const TECHNIQUES = [
  {id: 'fullHouse',        name: 'Full House',         level: 1, se: 1.0, pts: 1,  fn: fullHouse},
  {id: 'hiddenSingleBox',  name: 'Hidden Single',      level: 1, se: 1.2, pts: 2,  fn: hiddenSingle(18, 27)},
  {id: 'hiddenSingleLine', name: 'Hidden Single',      level: 1, se: 1.5, pts: 2,  fn: hiddenSingle(0, 18)},
  {id: 'nakedSingle',      name: 'Naked Single',       level: 2, se: 2.3, pts: 4,  fn: nakedSingle},
  {id: 'pointing',         name: 'Pointing',           level: 3, se: 2.6, pts: 20, fn: pointing},
  {id: 'claiming',         name: 'Box/Line Reduction', level: 3, se: 2.8, pts: 20, fn: claiming},
  {id: 'nakedPair',        name: 'Naked Pair',         level: 3, se: 3.0, pts: 15, fn: nakedSubset(2)},
  {id: 'hiddenPair',       name: 'Hidden Pair',        level: 3, se: 3.4, pts: 25, fn: hiddenSubset(2)},
  {id: 'nakedTriple',      name: 'Naked Triple',       level: 3, se: 3.6, pts: 30, fn: nakedSubset(3)},
  {id: 'hiddenTriple',     name: 'Hidden Triple',      level: 3, se: 4.0, pts: 40, fn: hiddenSubset(3)},
  {id: 'xWing',            name: 'X-Wing',             level: 4, se: 3.2, pts: 50, fn: fish(2)},
  {id: 'skyscraper',       name: 'Skyscraper',         level: 4, se: 4.0, pts: 50, fn: skyscraper},
  {id: 'twoStringKite',    name: 'Two-String Kite',    level: 4, se: 4.1, pts: 50, fn: twoStringKite},
  {id: 'xyWing',           name: 'XY-Wing',            level: 4, se: 4.2, pts: 60, fn: xyWing},
  {id: 'swordfish',        name: 'Swordfish',          level: 4, se: 3.8, pts: 70, fn: fish(3)},
  {id: 'nakedQuad',        name: 'Naked Quad',         level: 4, se: 5.0, pts: 70, fn: nakedSubset(4)},
  {id: 'hiddenQuad',       name: 'Hidden Quad',        level: 4, se: 5.4, pts: 90, fn: hiddenSubset(4)},
  {id: 'xyzWing',          name: 'XYZ-Wing',           level: 5, se: 4.4, pts: 80, fn: xyzWing},
  {id: 'jellyfish',        name: 'Jellyfish',          level: 5, se: 5.2, pts: 100, fn: fish(4)},
  {id: 'simpleColouring',  name: 'Simple Colouring',   level: 5, se: 6.0, pts: 100, fn: simpleColouring},
  {id: 'xyChain',          name: 'XY-Chain',           level: 5, se: 6.6, pts: 120, fn: xyChain},
];
const TECH = Object.fromEntries(TECHNIQUES.map(t => [t.id, t]));

// Technique families a player can favour in settings.
const FAMILIES = [
  {id: 'intersections', name: 'Pointing & Box/Line', techs: ['pointing', 'claiming']},
  {id: 'subsets',       name: 'Pairs, Triples & Quads', techs: ['nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple', 'nakedQuad', 'hiddenQuad']},
  {id: 'fish',          name: 'X-Wing, Swordfish & Jellyfish', techs: ['xWing', 'swordfish', 'jellyfish']},
  {id: 'singleDigit',   name: 'Skyscraper, Kite & Colouring', techs: ['skyscraper', 'twoStringKite', 'simpleColouring']},
  {id: 'wings',         name: 'XY-Wing & XYZ-Wing', techs: ['xyWing', 'xyzWing']},
  {id: 'chains',        name: 'XY-Chains', techs: ['xyChain']},
];

function findStep(s, maxLevel = 5) {
  for (const t of TECHNIQUES) {
    if (t.level > maxLevel) continue;
    const st = t.fn(s);
    if (st) { st.tech = t.id; st.name = t.name; st.level = t.level; return st; }
  }
  return null;
}

// How many squares could be filled right now with a single — the "pace" of the position.
function countSingles(s) {
  const found = new Set();
  for (let i = 0; i < 81; i++) if (!s.g[i] && popcount(s.c[i]) === 1) found.add(i);
  for (let u = 0; u < 27; u++) {
    const placed = placedIn(s, u);
    for (let d = 1; d <= 9; d++) {
      if (placed & (1 << d)) continue;
      let pos = -1, n = 0;
      for (const i of UNITS[u]) if (s.c[i] & (1 << d)) { pos = i; n++; }
      if (n === 1) found.add(pos);
    }
  }
  return found.size;
}

function grade(puzzle, maxLevel = 5) {
  const s = makeState(puzzle);
  const used = {};
  let empty = s.g.filter(v => !v).length, level = 0, se = 0, work = 0, singleSteps = 0, singleOpts = 0;
  while (empty > 0) {
    for (let i = 0; i < 81; i++) if (!s.g[i] && !s.c[i]) return {solved: false};
    const st = findStep(s, maxLevel);
    if (!st) return {solved: false};
    const t = TECH[st.tech];
    if (t.level <= 2) { singleSteps++; singleOpts += countSingles(s); }
    used[t.id] = (used[t.id] || 0) + 1;
    level = Math.max(level, t.level); se = Math.max(se, t.se); work += t.pts;
    empty -= (st.place || []).length;
    applyStep(s, st);
  }
  return {solved: true, level, se, work, used, pace: singleSteps ? +(singleOpts / singleSteps).toFixed(2) : 0};
}

// ---------- generation ----------
const toStr = g => g.join('');
const fromStr = s => [...s].map(Number);

// Removes clues (in 180°-symmetric pairs if asked) while the puzzle stays unique and, if
// maxLevel is set, still solvable using techniques up to that level.
function dig(solution, {symmetric = true, maxLevel = 0, minClues = 17} = {}) {
  const p = solution.slice();
  let clues = 81;
  for (const i of shuffle([...Array(symmetric ? 41 : 81).keys()])) {
    const j = 80 - i, pair = symmetric && j !== i, need = pair ? 2 : 1;
    if (clues - need < minClues) continue;
    const a = p[i], b = p[j];
    p[i] = 0; if (pair) p[j] = 0;
    let ok = solveCount(p, 2, false).count === 1;
    if (ok && maxLevel) ok = grade(p, maxLevel).solved;
    if (ok) clues -= need; else { p[i] = a; if (pair) p[j] = b; }
  }
  return p;
}

// Minimum clue counts for the gentler levels by pace preference (more clues = more to find at once).
const MIN_CLUES = {1: {flowing: 36, any: 32, tight: 28}, 2: {flowing: 30, any: 27, tight: 24}};

function generateOnce(level, prefs = {}) {
  const symmetric = prefs.symmetric !== false;
  const solution = solveCount(Array(81).fill(0), 1, true).solution;
  // Easy/Medium dig only while the puzzle stays that easy; harder levels dig to a minimal puzzle and
  // are kept only if the grade matches (about 1 in 10 random minimal puzzles needs Master techniques).
  const puzzle = level <= 2
    ? dig(solution, {symmetric, maxLevel: level, minClues: prefs.minClues || MIN_CLUES[level][prefs.pace || 'any']})
    : dig(solution, {symmetric});
  const meta = grade(puzzle, 5);
  return {puzzle: toStr(puzzle), solution: toStr(solution), meta};
}

// Pace thresholds (average singles available) per level, from sampling generated puzzles.
// Lower and upper thirds of the measured spread; Easy/Medium pace is set by clue count instead.
const PACE = {1: [8.3, 11], 2: [5.2, 6.0], 3: [4.7, 5.35], 4: [5.1, 5.9], 5: [5.0, 5.8]};

function matchesPrefs(meta, level, prefs = {}) {
  if (!meta || !meta.solved || meta.level !== level) return false;
  if (level >= 3 && prefs.families && prefs.families.length) {
    const techs = FAMILIES.filter(f => prefs.families.includes(f.id)).flatMap(f => f.techs).filter(t => TECH[t].level <= level);
    if (techs.length && !techs.some(t => meta.used[t])) return false;
  }
  if (level >= 3 && prefs.pace === 'flowing' && meta.pace < PACE[level][1]) return false;
  if (level >= 3 && prefs.pace === 'tight' && meta.pace > PACE[level][0]) return false;
  return true;
}

// ---------- grade-preserving transforms ----------
// Relabels digits and reorders rows/columns within the rules that keep a Sudoku valid and its
// solve path unchanged. With keepSymmetry the 180° clue symmetry is preserved too.
function linePerm(keepSymmetry) {
  const perm3 = () => shuffle([0, 1, 2]);
  if (!keepSymmetry) {
    const bands = perm3();
    return bands.flatMap(b => perm3().map(r => b * 3 + r));
  }
  const p = Array(9);
  const outer = Math.random() < .5 ? [0, 2] : [2, 0], q = perm3();
  for (let r = 0; r < 3; r++) { p[r] = outer[0] * 3 + q[r]; p[8 - r] = 8 - p[r]; }
  const mid = Math.random() < .5 ? [3, 4, 5] : [5, 4, 3];
  p[3] = mid[0]; p[4] = 4; p[5] = mid[2];
  return p;
}
function transform(puzzle, solution, keepSymmetry = true) {
  const map = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])];
  const rows = linePerm(keepSymmetry), cols = linePerm(keepSymmetry), flip = Math.random() < .5;
  const out = (src) => {
    const a = fromStr(src), b = Array(81);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const v = a[rows[r] * 9 + cols[c]];
      b[flip ? c * 9 + r : r * 9 + c] = v ? map[v] : 0;
    }
    return toStr(b);
  };
  return {puzzle: out(puzzle), solution: out(solution)};
}

const Engine = {
  RO, CO, BO, UNITS, PEERS, sees, popcount, digitsOf, shuffle, solveCount, makeState, applyStep, findStep,
  grade, dig, generateOnce, matchesPrefs, transform, toStr, fromStr, cellName, unitName,
  TECHNIQUES, TECH, FAMILIES, PACE,
};

// ---------- worker mode ----------
// Message {id, level, prefs, budgetMs}: searches for a matching puzzle, reporting progress and
// any other well-graded puzzles found on the way (the page banks those for later).
if (typeof window === 'undefined' && typeof importScripts === 'function') {
  self.onmessage = e => {
    const {id, level, prefs, budgetMs = 30000} = e.data, t0 = Date.now();
    let tries = 0;
    while (Date.now() - t0 < budgetMs) {
      tries++;
      const r = generateOnce(level, prefs);
      if (matchesPrefs(r.meta, level, prefs)) { self.postMessage({id, done: true, found: r, tries}); return; }
      if (r.meta.solved && r.meta.level >= 3) self.postMessage({id, extra: r});
      self.postMessage({id, progress: tries});
    }
    self.postMessage({id, done: true, found: null, tries});
  };
}
global.SudokuEngine = Engine;
})(typeof self !== 'undefined' ? self : this);
