// Lesson definitions. Each lesson is a small state machine the main
// controller plugs into: it knows how to set up the stage, what buttons
// to show, how to react to each one, and when the learner has done
// "enough" to unlock the next lesson.

import {
  KET_0, KET_00, GATES_1Q, GATES_2Q,
  blochVector, probs1, measure1,
  probs2, measure2, marginalBloch,
  estimateCHSH, estimateE,
  rotY, rotY0, rotY1,
  c,
} from './quantum.js';

export const LESSONS = [
  // ============================================================
  // LESSON 1 — THE QUBIT
  // ============================================================
  {
    id: 'qubit',
    num: '01',
    title: 'The qubit',
    sub: 'Drag the arrow. See how its direction becomes a probability.',
    kind: 'single',
    body: `
      <p>A classical bit is 0 or 1. A quantum bit — a <em>qubit</em> — lives on the surface of this sphere. Every point on the sphere is a possible qubit state.</p>
      <p>The top pole is <code>|0⟩</code>, the bottom is <code>|1⟩</code>. Everything in between is a mix.</p>
      <p><strong>Try it:</strong> drag anywhere on the sphere. The closer the arrow points to the top, the more likely the qubit will come out as 0 when you look at it. Watch the bars below.</p>
    `,
    showProbs: true,
    overlay: [
      { class: 'chip accent', text: '|0⟩ at top' },
      { class: 'chip red', text: '|1⟩ at bottom' },
    ],
    init(ctx) {
      ctx.setSingle();
      ctx.state = KET_0;
      ctx.sphere.snapTo(blochVector(KET_0));
      ctx.sphere.enableDrag(({ x, y, z }) => {
        // Parameterise a 1-qubit state from a Bloch vector.
        // State matching (sin θ cos φ, sin θ sin φ, cos θ) is
        // |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩.
        const theta = Math.acos(Math.max(-1, Math.min(1, z)));
        const phi = Math.atan2(y, x);
        const a = c(Math.cos(theta / 2));
        const b = { re: Math.sin(theta / 2) * Math.cos(phi), im: Math.sin(theta / 2) * Math.sin(phi) };
        ctx.state = [a, b];
        ctx.updateProbs();
        ctx._dragCount = (ctx._dragCount ?? 0) + 1;
        if (ctx._dragCount > 3) ctx.complete();
      });
      ctx.updateProbs();
    },
    controls: [
      { label: 'Reset to |0⟩', action: 'ctx.state = KET_0; ctx.sphere.snapTo(blochVector(KET_0)); ctx.updateProbs();' },
    ],
  },

  // ============================================================
  // LESSON 2 — SUPERPOSITION
  // ============================================================
  {
    id: 'superposition',
    num: '02',
    title: 'Superposition',
    sub: 'Press H. Watch the qubit become 0 and 1 at the same time.',
    kind: 'single',
    body: `
      <p>The qubit starts pointing at <code>|0⟩</code>. If you measured it now, you'd get 0 every time.</p>
      <p>Press the <em>Hadamard</em> button (<code>H</code>). The arrow swings to the equator. Both probabilities become 50%: the qubit is now in a <em>superposition</em> of 0 and 1 — both at once, with equal weight.</p>
      <p>This isn't the qubit being "we don't know yet." It's really <strong>both</strong>, until you look.</p>
    `,
    showProbs: true,
    overlay: [
      { class: 'chip accent', text: 'H puts a qubit in superposition' },
    ],
    init(ctx) {
      ctx.setSingle();
      ctx.sphere.disableDrag();
      ctx.state = KET_0;
      ctx.sphere.snapTo(blochVector(KET_0));
      ctx.updateProbs();
    },
    controls: [
      {
        label: 'H',
        class: 'gate-btn gate-h',
        action: `ctx.state = GATES_1Q.H(ctx.state);
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.updateProbs();
                 ctx.complete();`,
      },
      {
        label: 'Reset',
        class: 'action-btn',
        action: `ctx.state = KET_0; ctx.sphere.snapTo(blochVector(KET_0)); ctx.updateProbs();`,
      },
    ],
  },

  // ============================================================
  // LESSON 3 — MEASUREMENT
  // ============================================================
  {
    id: 'measurement',
    num: '03',
    title: 'Measurement',
    sub: 'Look at the qubit. Watch it collapse.',
    kind: 'single',
    body: `
      <p>We've put the qubit on the equator — a <code>50/50</code> superposition. What happens when we look?</p>
      <p>Press <em>Measure</em>. The qubit <strong>collapses</strong>: the arrow snaps to pure <code>|0⟩</code> or pure <code>|1⟩</code>, randomly, weighted by the probabilities you saw.</p>
      <p>Press Measure 20 times and watch the histogram below. The counts should split roughly 50/50. That's the geometry you saw becoming physics.</p>
    `,
    showProbs: true,
    showHistogram: true,
    overlay: [
      { class: 'chip accent', text: 'Measurement is random, weighted by geometry' },
    ],
    init(ctx) {
      ctx.setSingle();
      ctx.sphere.disableDrag();
      // Start already in superposition
      ctx.state = GATES_1Q.H(KET_0);
      ctx.sphere.snapTo(blochVector(ctx.state));
      ctx.updateProbs();
      ctx.counts = [0, 0];
      ctx.updateHistogram();
    },
    controls: [
      {
        label: 'Measure',
        class: 'action-btn primary',
        action: `const m = measure1(ctx.state);
                 ctx.state = m.state;
                 ctx.counts[m.outcome]++;
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.sphere.flash();
                 ctx.updateProbs();
                 ctx.updateHistogram();
                 if (ctx.counts[0] + ctx.counts[1] >= 10) ctx.complete();`,
      },
      {
        label: 'Reset to superposition',
        class: 'action-btn',
        action: `ctx.state = GATES_1Q.H(KET_0);
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.updateProbs();`,
      },
      {
        label: 'Clear counts',
        class: 'action-btn',
        action: `ctx.counts = [0, 0]; ctx.updateHistogram();`,
      },
    ],
  },

  // ============================================================
  // LESSON 4 — GATES
  // ============================================================
  {
    id: 'gates',
    num: '04',
    title: 'Gates',
    sub: 'Build a sequence. Get the arrow to point at |1⟩.',
    kind: 'single',
    body: `
      <p>Besides H, there are a handful of other single-qubit "gates" — operations that rotate the arrow in specific ways.</p>
      <p><code>X</code> is the quantum NOT: it flips <code>|0⟩</code> ↔ <code>|1⟩</code> by rotating 180° around the x axis.<br/>
      <code>Z</code> adds a phase: visually, it flips the arrow's horizontal direction.<br/>
      <code>Y</code> is a combination of both, rotating 180° around the y axis.</p>
      <p><strong>Puzzle:</strong> starting from <code>|0⟩</code>, get the arrow to point at <code>|1⟩</code>. There are several ways.</p>
    `,
    showProbs: true,
    overlay: [
      { class: 'chip accent', text: 'Target: get to |1⟩' },
    ],
    init(ctx) {
      ctx.setSingle();
      ctx.sphere.disableDrag();
      ctx.state = KET_0;
      ctx.sphere.snapTo(blochVector(KET_0));
      ctx.updateProbs();
      ctx.sequence = [];
    },
    controls: [
      {
        label: 'H',
        class: 'gate-btn gate-h',
        action: `ctx.state = GATES_1Q.H(ctx.state);
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.updateProbs();
                 ctx.checkGatePuzzle();`,
      },
      {
        label: 'X',
        class: 'gate-btn gate-x',
        action: `ctx.state = GATES_1Q.X(ctx.state);
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.updateProbs();
                 ctx.checkGatePuzzle();`,
      },
      {
        label: 'Y',
        class: 'gate-btn gate-y',
        action: `ctx.state = GATES_1Q.Y(ctx.state);
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.updateProbs();
                 ctx.checkGatePuzzle();`,
      },
      {
        label: 'Z',
        class: 'gate-btn gate-z',
        action: `ctx.state = GATES_1Q.Z(ctx.state);
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.updateProbs();
                 ctx.checkGatePuzzle();`,
      },
      {
        label: 'Reset',
        class: 'action-btn',
        action: `ctx.state = KET_0;
                 ctx.sphere.setTarget(blochVector(ctx.state));
                 ctx.updateProbs();`,
      },
    ],
  },

  // ============================================================
  // LESSON 5 — ENTANGLEMENT
  // ============================================================
  {
    id: 'entanglement',
    num: '05',
    title: 'Entanglement',
    sub: 'Link two qubits. Measure one. Watch the other follow.',
    kind: 'twin',
    body: `
      <p>Two qubits now, each with its own sphere. Apply <code>H</code> to the left one, then <code>CNOT</code> (controlled-NOT) between them.</p>
      <p>Look at the spheres. The arrows have <strong>shrunk into the middle</strong>. That's not a bug — it means each qubit, taken alone, has no definite state anymore. But they're linked: you don't have "two qubits", you have <em>one two-qubit system</em>.</p>
      <p>Now <em>measure qubit A</em>. Both spheres snap to the same outcome. Reset and do it again — always the same, even though each measurement outcome is random.</p>
      <p>This is <strong>entanglement</strong>. It's what makes quantum computing powerful, and it's what Einstein called "spooky action at a distance."</p>
    `,
    showProbs: false,
    overlay: [
      { class: 'chip accent', text: 'A: left sphere' },
      { class: 'chip red', text: 'B: right sphere' },
    ],
    init(ctx) {
      ctx.setTwin();
      ctx.state2 = KET_00;
      ctx.syncTwin();
      ctx.counts2 = [0, 0, 0, 0];
      ctx.updateHistogram2();
    },
    controls: [
      {
        label: 'H on A',
        class: 'gate-btn gate-h',
        action: `ctx.state2 = GATES_2Q.H1(ctx.state2);
                 ctx.syncTwin();`,
      },
      {
        label: 'CNOT  A→B',
        class: 'gate-btn gate-cnot',
        action: `ctx.state2 = GATES_2Q.CNOT_1_to_0(ctx.state2);
                 ctx.syncTwin();`,
      },
      {
        label: 'Measure both',
        class: 'action-btn primary',
        action: `const m = measure2(ctx.state2);
                 ctx.state2 = m.state;
                 ctx.counts2[m.outcome]++;
                 ctx.syncTwin();
                 ctx.sphereA.flash(); ctx.sphereB.flash();
                 ctx.updateHistogram2();
                 if (ctx.counts2[0] + ctx.counts2[3] >= 5) ctx.complete();`,
      },
      {
        label: 'Reset to |00⟩',
        class: 'action-btn',
        action: `ctx.state2 = KET_00; ctx.syncTwin(); ctx.counts2 = [0,0,0,0]; ctx.updateHistogram2();`,
      },
    ],
    showHistogram2: true,
  },

  // ============================================================
  // LESSON 6 — BELL'S THEOREM
  // ============================================================
  {
    id: 'bell',
    num: '06',
    title: "Bell's theorem",
    sub: "Prove with your own hands that quantum beats any classical theory.",
    kind: 'single',
    body: `
      <p>Entangled qubits give identical answers when measured the same way. Could it be that they just agreed in advance, like coins in a box?</p>
      <p>John Bell proved: <strong>no</strong>. If the universe worked that way, a certain measurement — the <code>CHSH</code> test — would always give a number <code>S ≤ 2</code>. Quantum mechanics predicts you can reach <code>S ≈ 2.83</code>.</p>
      <p>Press <em>Run</em>. The simulator prepares a Bell pair and measures it at four angle pairs, 400 times each, then computes <code>S</code>. Watch the bar climb past <strong>2.0</strong> — that's the moment a classical theory becomes impossible.</p>
    `,
    showProbs: false,
    showCHSH: true,
    overlay: [
      { class: 'chip accent', text: 'Classical limit S ≤ 2' },
      { class: 'chip', text: 'Quantum max S = 2√2 ≈ 2.83' },
    ],
    init(ctx) {
      ctx.setSingle();
      ctx.sphere.disableDrag();
      ctx.state = KET_0;
      ctx.sphere.snapTo(blochVector(KET_0));
      ctx.sValue = null;
      ctx.updateCHSH();
    },
    controls: [
      {
        label: 'Run CHSH test (400 shots)',
        class: 'action-btn primary',
        action: `ctx.sValue = estimateCHSH(400);
                 ctx.updateCHSH();
                 ctx.animateSphereBell();
                 if (ctx.sValue > 2.0) ctx.complete();`,
      },
      {
        label: 'Run again',
        class: 'action-btn',
        action: `ctx.sValue = estimateCHSH(400);
                 ctx.updateCHSH();`,
      },
    ],
  },
];
