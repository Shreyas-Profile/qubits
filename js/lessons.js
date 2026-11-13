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
      <p>A normal computer stores information as bits — switches that are either 0 or 1. A <em>qubit</em> is the quantum version. Like a bit, it can be 0 or 1. Unlike a bit, it can also be a specific <strong>mix</strong> of both at the same time.</p>
      <p>Because there are many possible mixes, we draw the qubit as a point on a sphere — called the <em>Bloch sphere</em>. The top of the sphere is pure <code>|0⟩</code>. The bottom is pure <code>|1⟩</code>. The equator is a 50/50 mix. Anywhere else is some tilted version in between.</p>
      <p>The bars under the sphere show the chance of getting 0 or 1 if you looked at the qubit right now.</p>
      <p><strong>Buttons:</strong></p>
      <ul>
        <li><em>Drag on the sphere</em> — rotate the arrow to any point and watch the bars update.</li>
        <li><em>Reset to |0⟩</em> — snap the arrow back to the top of the sphere.</li>
      </ul>
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
      <p>A <em>superposition</em> is when a qubit is in both <code>|0⟩</code> and <code>|1⟩</code> at the same time. The arrow sits somewhere between the poles — most often on the equator, which is an exact 50/50 mix.</p>
      <p>This isn't the qubit being "we don't know which one it is". It's genuinely both at once. Only when you measure it does it pick a side.</p>
      <p>The easiest way to create a superposition is a special gate called <em>Hadamard</em>, written <code>H</code>. Apply H to <code>|0⟩</code> and it swings the arrow from the top of the sphere straight down to the equator — perfect 50/50. Apply H <strong>again</strong> and the arrow swings back up to <code>|0⟩</code>. It's reversible.</p>
      <p><strong>Buttons:</strong></p>
      <ul>
        <li><em>H</em> — apply the Hadamard gate. Puts the qubit into (or out of) superposition.</li>
        <li><em>Reset</em> — snap back to <code>|0⟩</code>.</li>
      </ul>
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
      <p>Measuring a qubit means looking at it to get an answer: 0 or 1. The moment you measure, the arrow snaps to one of the two poles and the superposition is gone. The one you get is picked randomly, with the bars telling you how likely each one is.</p>
      <p>Measurement is also final. Once the qubit snaps to <code>|0⟩</code>, it stays at <code>|0⟩</code> — any more measurements give the same answer until you reset or apply a new gate.</p>
      <p>The qubit here starts in a 50/50 superposition, so you should get 0 about half the time and 1 about half the time. The histogram below keeps a running count.</p>
      <p><strong>Buttons:</strong></p>
      <ul>
        <li><em>Measure</em> — look at the qubit. It collapses to 0 or 1.</li>
        <li><em>Reset to superposition</em> — put the qubit back into the 50/50 state to measure again.</li>
        <li><em>Clear counts</em> — reset the histogram.</li>
      </ul>
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
      <p>A <em>gate</em> is an operation you apply to a qubit to move the arrow on the sphere. Every quantum gate is some kind of rotation. A quantum program is just a sequence of gates that ends with the arrow pointing where you want.</p>
      <p>The four single-qubit gates here:</p>
      <ul>
        <li><em>X</em> — the quantum NOT. Flips the arrow upside-down: <code>|0⟩</code> ↔ <code>|1⟩</code>.</li>
        <li><em>Y</em> — flips the arrow in a different direction (rotation around the y axis).</li>
        <li><em>Z</em> — leaves <code>|0⟩</code> and <code>|1⟩</code> alone on the poles, but rotates things sitting on the equator.</li>
        <li><em>H</em> — Hadamard. Moves a pole to the equator (creates superposition) and back.</li>
      </ul>
      <p>Every gate is reversible — apply the same one twice and you end up back where you started.</p>
      <p><strong>Puzzle:</strong> starting at <code>|0⟩</code>, get the arrow down to <code>|1⟩</code>. The simplest answer is one button. Can you find a two-button path too?</p>
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
      <p>Two qubits are <em>entangled</em> when they're so linked that neither one has a definite state on its own — only the pair does. If you measure one, the other is instantly decided too, even if they're far apart.</p>
      <p>Two qubits now: A (purple, left) and B (red, right). Both start at <code>|0⟩</code>. Follow the steps in order:</p>
      <ol>
        <li>Press <em>H on A</em>. Qubit A goes into a 50/50 superposition. B is still <code>|0⟩</code>.</li>
        <li>Press <em>CNOT A→B</em>. This is a two-qubit gate that flips B whenever A is 1. The result: both arrows shrink into the middle of their spheres. They now have no individual state — the state lives in the <em>pair</em>.</li>
        <li>Press <em>Measure both</em>. Both qubits snap to the same outcome — always <code>00</code> or <code>11</code>, never <code>01</code> or <code>10</code>. Random, but always matching.</li>
      </ol>
      <p><em>Reset to |00⟩</em> puts both qubits back to the start so you can try again.</p>
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
      <p>Entangled qubits always give matching answers. One obvious explanation: maybe each qubit was secretly stamped "0" or "1" when it was created, and measuring just reveals the stamp. Einstein thought something like this — called <em>local hidden variables</em>.</p>
      <p>In 1964, John Bell proved this idea is <strong>testable</strong>. Measure entangled qubits at four different angle pairs, count how often they match, and combine the results into a single number called <code>S</code>.</p>
      <ul>
        <li>Any "hidden-stamp" theory can only reach <code>S ≤ 2</code>.</li>
        <li>Quantum mechanics predicts up to <code>S ≈ 2.83</code>.</li>
      </ul>
      <p>If the real number is above 2, hidden stamps are ruled out. Real labs have done this with photons kilometres apart — they get ~2.83. The 2022 Nobel Prize in Physics went to the people who proved it.</p>
      <p><strong>Buttons:</strong></p>
      <ul>
        <li><em>Run CHSH test</em> — the simulator prepares entangled pairs 400 times at 4 different angle pairs and prints <code>S</code>. Watch it land above 2.</li>
        <li><em>Run again</em> — rerun with fresh random outcomes.</li>
      </ul>
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
