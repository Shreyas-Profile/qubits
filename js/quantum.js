// Quantum math — 1-qubit and 2-qubit states, gates, measurement.
// A 1-qubit state is [a, b] (both complex) with |a|² + |b|² = 1,
// representing |ψ⟩ = a|0⟩ + b|1⟩.
// A 2-qubit state is [a00, a01, a10, a11] in the |q1 q0⟩ basis.

export const c = (re, im = 0) => ({ re, im });
export const cAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul = (a, b) => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const cConj = a => ({ re: a.re, im: -a.im });
export const cAbs2 = a => a.re * a.re + a.im * a.im;
export const cScale = (a, s) => ({ re: a.re * s, im: a.im * s });

const INV_SQRT2 = 1 / Math.sqrt(2);

// --- 1-qubit states and gates ---

export const KET_0 = [c(1), c(0)];
export const KET_1 = [c(0), c(1)];
export const KET_PLUS = [c(INV_SQRT2), c(INV_SQRT2)];

export const GATES_1Q = {
  H: s => [
    cScale(cAdd(s[0], s[1]), INV_SQRT2),
    cScale(cSub(s[0], s[1]), INV_SQRT2),
  ],
  X: s => [s[1], s[0]],
  Y: s => [cMul(c(0, -1), s[1]), cMul(c(0, 1), s[0])],
  Z: s => [s[0], cScale(s[1], -1)],
  S: s => [s[0], cMul(c(0, 1), s[1])],
  T: s => [s[0], cMul(c(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)), s[1])],
};

// Bloch vector (x, y, z) for a 1-qubit pure state.
export function blochVector(state) {
  const [a, b] = state;
  const ab = cMul(cConj(a), b);
  return {
    x: 2 * ab.re,
    y: 2 * ab.im,
    z: cAbs2(a) - cAbs2(b),
  };
}

export function probs1(state) {
  return [cAbs2(state[0]), cAbs2(state[1])];
}

// Collapse a 1-qubit state on measurement in the computational basis.
export function measure1(state) {
  const [p0] = probs1(state);
  const outcome = Math.random() < p0 ? 0 : 1;
  return {
    outcome,
    state: outcome === 0 ? [c(1), c(0)] : [c(0), c(1)],
  };
}

// --- 2-qubit states and gates ---
// Ordering: index = (q1 << 1) | q0.

export const KET_00 = [c(1), c(0), c(0), c(0)];

export const GATES_2Q = {
  H0: s => [
    cScale(cAdd(s[0], s[1]), INV_SQRT2),
    cScale(cSub(s[0], s[1]), INV_SQRT2),
    cScale(cAdd(s[2], s[3]), INV_SQRT2),
    cScale(cSub(s[2], s[3]), INV_SQRT2),
  ],
  H1: s => [
    cScale(cAdd(s[0], s[2]), INV_SQRT2),
    cScale(cAdd(s[1], s[3]), INV_SQRT2),
    cScale(cSub(s[0], s[2]), INV_SQRT2),
    cScale(cSub(s[1], s[3]), INV_SQRT2),
  ],
  X0: s => [s[1], s[0], s[3], s[2]],
  X1: s => [s[2], s[3], s[0], s[1]],
  Z0: s => [s[0], cScale(s[1], -1), s[2], cScale(s[3], -1)],
  Z1: s => [s[0], s[1], cScale(s[2], -1), cScale(s[3], -1)],
  // CNOT with q1 as control and q0 as target: swap |10⟩ and |11⟩.
  CNOT_1_to_0: s => [s[0], s[1], s[3], s[2]],
  // CNOT with q0 as control and q1 as target: swap |01⟩ and |11⟩.
  CNOT_0_to_1: s => [s[0], s[3], s[2], s[1]],
};

export function probs2(state) {
  return state.map(cAbs2);
}

export function measure2(state) {
  const p = probs2(state);
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < 4; i++) {
    cum += p[i];
    if (r < cum || i === 3) {
      const collapsed = [c(0), c(0), c(0), c(0)];
      collapsed[i] = c(1);
      return {
        outcome: i,
        bits: [(i >> 1) & 1, i & 1],
        state: collapsed,
      };
    }
  }
}

// Marginal Bloch vector of one qubit inside a 2-qubit state.
// For entangled states this vector shrinks inside the sphere,
// which is how the UI shows "the qubit alone has no definite state".
export function marginalBloch(state, qubitIdx) {
  const p = probs2(state);
  let z, x, y;
  if (qubitIdx === 0) {
    z = p[0] + p[2] - p[1] - p[3];
    const t1 = cMul(cConj(state[0]), state[1]);
    const t2 = cMul(cConj(state[2]), state[3]);
    x = 2 * (t1.re + t2.re);
    y = 2 * (t1.im + t2.im);
  } else {
    z = p[0] + p[1] - p[2] - p[3];
    const t1 = cMul(cConj(state[0]), state[2]);
    const t2 = cMul(cConj(state[1]), state[3]);
    x = 2 * (t1.re + t2.re);
    y = 2 * (t1.im + t2.im);
  }
  return { x, y, z };
}

// --- Bell / CHSH ---

// Rotate a 1-qubit state around the Y axis by angle θ.
// Used to prepare measurement bases at arbitrary angles.
export function rotY(state, theta) {
  const cs = Math.cos(theta / 2);
  const sn = Math.sin(theta / 2);
  return [
    cSub(cScale(state[0], cs), cScale(state[1], sn)),
    cAdd(cScale(state[1], cs), cScale(state[0], sn)),
  ];
}

// Apply Y-rotation to qubit 0 inside a 2-qubit state.
export function rotY0(state, theta) {
  const cs = Math.cos(theta / 2);
  const sn = Math.sin(theta / 2);
  return [
    cSub(cScale(state[0], cs), cScale(state[1], sn)),
    cAdd(cScale(state[1], cs), cScale(state[0], sn)),
    cSub(cScale(state[2], cs), cScale(state[3], sn)),
    cAdd(cScale(state[3], cs), cScale(state[2], sn)),
  ];
}

// Apply Y-rotation to qubit 1.
export function rotY1(state, theta) {
  const cs = Math.cos(theta / 2);
  const sn = Math.sin(theta / 2);
  return [
    cSub(cScale(state[0], cs), cScale(state[2], sn)),
    cSub(cScale(state[1], cs), cScale(state[3], sn)),
    cAdd(cScale(state[2], cs), cScale(state[0], sn)),
    cAdd(cScale(state[3], cs), cScale(state[1], sn)),
  ];
}

// Simulate a single CHSH-style run: prepare singlet-ish Bell state,
// rotate each qubit by the chosen measurement angle, measure, and
// return the ±1 outcomes.
export function bellRun(angleA, angleB) {
  // Prepare |Φ+⟩ = (|00⟩ + |11⟩) / √2
  let s = KET_00;
  s = GATES_2Q.H1(s);
  s = GATES_2Q.CNOT_1_to_0(s);
  s = rotY0(s, -angleB);
  s = rotY1(s, -angleA);
  const m = measure2(s);
  const a = m.bits[1] === 0 ? 1 : -1;
  const b = m.bits[0] === 0 ? 1 : -1;
  return { a, b };
}

// Expectation value E(a, b) estimated over many runs.
export function estimateE(angleA, angleB, shots = 400) {
  let sum = 0;
  for (let i = 0; i < shots; i++) {
    const { a, b } = bellRun(angleA, angleB);
    sum += a * b;
  }
  return sum / shots;
}

// Full CHSH S value with angle choices that saturate Tsirelson's bound
// for the |Φ+⟩ state and the sign pattern E(a₀,b₀) - E(a₀,b₁) + E(a₁,b₀) + E(a₁,b₁).
export function estimateCHSH(shots = 400) {
  const a0 = 0, a1 = Math.PI / 2;
  const b0 = Math.PI / 4, b1 = 3 * Math.PI / 4;
  const E = (aa, bb) => estimateE(aa, bb, shots);
  return E(a0, b0) - E(a0, b1) + E(a1, b0) + E(a1, b1);
}
