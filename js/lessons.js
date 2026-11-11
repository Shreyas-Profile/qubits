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
      <p>A classical bit is a switch — 0 or 1. Nothing in between. Your laptop stores billions of them.</p>
      <p>A <em>qubit</em> is also a real physical thing, usually a single electron, atom, or photon. But quantum mechanics lets it be a specific <strong>blend</strong> of 0 and 1 at the same time — with an exact "how much" of each.</p>
      <p>Describing that blend takes <strong>two angles</strong>: how much it tilts toward 0 vs 1, and a rotation around the vertical axis (called the <em>phase</em>). Two angles trace out the surface of a sphere — so every possible qubit state becomes a point on this sphere. Physicists call it the <em>Bloch sphere</em>. It's just a map.</p>
      <p>Top pole = pure <code>|0⟩</code>. Bottom pole = pure <code>|1⟩</code>. Equator = exactly 50/50. Everywhere else = some tilted mix.</p>
      <p><strong>Try it:</strong> drag the arrow around the sphere. The bars below show the chance of each outcome if you measured the qubit right now.</p>
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
      <p>The qubit starts at <code>|0⟩</code> — the top of the sphere. If you measured it now, you'd get 0 every single time, with no randomness.</p>
      <p>Press the <em>Hadamard gate</em> (<code>H</code>). It's a rotation: the arrow swings from the top pole down to the <strong>equator</strong>. Both probability bars jump to 50%.</p>
      <p>That new state has a name: <em>superposition</em>. The qubit is genuinely 0 and 1 at the same time, with equal weight. Press H again and it swings back to <code>|0⟩</code> — superposition is reversible.</p>
      <p>Here's the point that hurts the brain: this is <strong>not</strong> "we just don't know yet". A hidden coin flip would behave differently. The qubit is really <strong>both</strong> values — an actual, measurable blend — right up until you look at it. This is what lets quantum computers explore many answers at once.</p>
      <p><strong>Try it:</strong> press H, see the arrow move, read the probabilities. Press H again, watch it un-mix.</p>
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
      <p>We've set the qubit on the equator — a perfect 50/50 superposition. Now the big question: what actually happens when you <em>look</em>?</p>
      <p>Press <em>Measure</em>. The arrow snaps violently to either the top pole (<code>|0⟩</code>) or the bottom pole (<code>|1⟩</code>) — and that's it. The superposition is gone. Measure again and it stays at that pole.</p>
      <p>This snap has a name: <strong>wavefunction collapse</strong>. The result is genuinely random — no hidden mechanism decides it in advance. But the <strong>probabilities</strong> are set by the arrow's direction: the closer to the top pole, the more likely 0.</p>
      <p>Measurement is the one place quantum weirdness forces a definite answer. Before you look: both. After you look: one. And the choice of "look" matters — these rules only apply when something irreversible (a photon hitting a detector, for example) interacts with the qubit.</p>
      <p><strong>Try it:</strong> press Measure 10+ times. The histogram should land near 50/50 — the geometry on the sphere becoming the physics of outcomes.</p>
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
      <p>Classical computers run on logic gates — <code>AND</code>, <code>OR</code>, <code>NOT</code>. Flip bits in predictable ways. Quantum computers have gates too, but with a twist: <strong>every gate is a rotation of the arrow on the sphere</strong>. That's it. All of quantum computing is rotating arrows around until the one you want is pointing where you want.</p>
      <p>The single-qubit gates you've got:</p>
      <ul>
        <li><code>X</code> — the quantum NOT. Flips <code>|0⟩</code> ↔ <code>|1⟩</code> by rotating 180° around the x axis.</li>
        <li><code>Z</code> — 180° rotation around the z (vertical) axis. Doesn't change the probabilities of 0 vs 1, but it flips the <em>phase</em>, which matters when gates stack up later.</li>
        <li><code>Y</code> — 180° around the y axis. Combines flip + phase.</li>
        <li><code>H</code> — Hadamard. Turns <code>|0⟩</code> into a 50/50 superposition, and back again.</li>
      </ul>
      <p>Two neat facts: every gate is <em>reversible</em> (apply it twice and you're back where you started, for these ones), and this tiny set is enough to build any quantum program.</p>
      <p><strong>Puzzle:</strong> starting from <code>|0⟩</code>, get the arrow to <code>|1⟩</code>. One gate solves it. More than one combination works — can you find a two-gate path too?</p>
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
      <p>Two qubits now — qubit A on the left, qubit B on the right. Each starts at <code>|0⟩</code>.</p>
      <p>Press <em>H on A</em> to put A in superposition, then <em>CNOT A→B</em>. CNOT is a two-qubit gate: it flips B <strong>if</strong> A is 1. Since A is "half 0, half 1", B inherits the uncertainty — but locked to A's.</p>
      <p>Now look at both spheres. The arrows have <strong>shrunk into the middle</strong>. That's not a glitch. It means neither qubit alone has a definite state on the Bloch sphere anymore — the information isn't inside A or inside B, it's in the <em>link between them</em>. You don't have two qubits; you have one joined-up system.</p>
      <p>Press <em>Measure both</em>. The arrows snap to the poles — and always to the <strong>same</strong> outcome (<code>00</code> or <code>11</code>, never <code>01</code> or <code>10</code>), even though which one happens is random.</p>
      <p>This is <strong>entanglement</strong>. The spooky part: it would work even if A and B were a lightyear apart. Measure A here, and B instantly shows the matching outcome. Einstein hated this and called it "spooky action at a distance". He thought it meant quantum mechanics was incomplete. In Lesson 6, you'll prove with your own hands that he was wrong.</p>
      <p>Entanglement is the engine behind quantum teleportation, quantum cryptography (you can detect eavesdroppers by breaking it), and the speedup that makes quantum computers interesting at all.</p>
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
      <p>Lesson 5 showed entangled qubits always matching. That's weird — but maybe not <em>magic</em>. Maybe each qubit was secretly stamped "0" or "1" when they were created, like a pair of coins hidden in boxes, and measurement just reveals the stamp. Einstein believed something like this: <em>local hidden variables</em>.</p>
      <p>In 1964, John Bell found a test that could tell the two worlds apart. Measure each qubit along four different angle choices, build a number called <code>S</code> from the correlations, and watch where it lands.</p>
      <ul>
        <li><strong>Any</strong> hidden-coin theory, no matter how clever, is stuck with <code>S ≤ 2</code>. This is the <em>Bell inequality</em> — pure maths, no physics.</li>
        <li>Quantum mechanics predicts you can reach <code>S = 2√2 ≈ 2.83</code>.</li>
      </ul>
      <p>Press <em>Run CHSH test</em>. The simulator prepares a Bell pair 400 times at each of 4 angle choices, counts up the correlations, and prints <code>S</code>. If the bar lands above 2.0, you've just shown — on your own machine — that the universe cannot be a box of hidden coins.</p>
      <p>Real labs have done this experiment with photons kilometres apart (closing every loophole). They always get ~2.83. The 2022 Nobel Prize in Physics went to Alain Aspect, John Clauser and Anton Zeilinger for exactly this.</p>
      <p>That's as weird as it gets. You can't explain entanglement by anything the qubits "carry" with them. The correlation lives in the system itself.</p>
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
