// Orchestrates the lesson flow: swaps the sphere layout, wires buttons
// to each lesson's "action", keeps track of which lessons are done,
// and talks to the tutor.

import { BlochSphere } from './bloch.js';
import {
  KET_0, KET_00, GATES_1Q, GATES_2Q,
  blochVector, probs1, measure1,
  probs2, measure2, marginalBloch,
  estimateCHSH, estimateE,
  rotY, rotY0, rotY1,
  c,
} from './quantum.js';
import { LESSONS } from './lessons.js';
import { askTutor } from './tutor.js';

const STORAGE_KEY = 'qubits_progress_v1';

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const dotsEl = $('lesson-dots');
const stageEl = $('stage');
const sphereAEl = $('sphere-a');
const sphereBEl = $('sphere-b');
const wrapEl = $('sphere-wrap');
const overlayEl = $('stage-overlay');
const numEl = $('lesson-num');
const titleEl = $('lesson-title');
const subEl = $('lesson-sub');
const bodyEl = $('lesson-body');
const probsEl = $('probs');
const prob0 = $('prob0'), prob1 = $('prob1');
const prob0Val = $('prob0-val'), prob1Val = $('prob1-val');
const controlsEl = $('controls');
const prevBtn = $('prev-btn');
const nextBtn = $('next-btn');
const tutorLog = $('tutor-log');
const tutorForm = $('tutor-form');
const tutorInput = $('tutor-input');
const tutorSend = $('tutor-send');
const homeEl = $('home');
const homeGridEl = $('home-grid');
const layoutEl = $('layout');
const brandBtn = $('brand-btn');
const tutorFab = $('tutor-fab');
const tutorPanel = $('tutor-panel');
const tutorClose = $('tutor-close');

// ---------- Progress ----------
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { done: [], current: 0 };
    return JSON.parse(raw);
  } catch {
    return { done: [], current: 0 };
  }
}
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch {}
}
let progress = loadProgress();

// ---------- Spheres ----------
const sphereA = new BlochSphere(sphereAEl, { accent: '#a78bfa' });
const sphereB = new BlochSphere(sphereBEl, { accent: '#f87171' });

// ---------- Context passed to each lesson ----------
const ctx = {
  state: KET_0,
  state2: KET_00,
  counts: [0, 0],
  counts2: [0, 0, 0, 0],
  sphere: sphereA,
  sphereA,
  sphereB,
  sValue: null,

  setSingle() {
    wrapEl.classList.remove('twin-mode');
    sphereAEl.classList.add('single');
    sphereAEl.classList.remove('twin');
    sphereBEl.hidden = true;
  },
  setTwin() {
    wrapEl.classList.add('twin-mode');
    sphereAEl.classList.remove('single');
    sphereAEl.classList.add('twin');
    sphereBEl.classList.add('twin');
    sphereBEl.hidden = false;
  },
  updateProbs() {
    if (!this._showProbs) return;
    const p = probs1(this.state);
    prob0.style.width = `${(p[0] * 100).toFixed(1)}%`;
    prob1.style.width = `${(p[1] * 100).toFixed(1)}%`;
    prob0Val.textContent = p[0].toFixed(3);
    prob1Val.textContent = p[1].toFixed(3);
  },
  syncTwin() {
    const bA = marginalBloch(this.state2, 1);
    const bB = marginalBloch(this.state2, 0);
    this.sphereA.setTarget(bA);
    this.sphereB.setTarget(bB);
  },
  updateHistogram() {
    if (!this._histEl) return;
    const total = Math.max(1, this.counts[0] + this.counts[1]);
    const cols = this._histEl.querySelectorAll('.hist-bar');
    cols[0].style.height = `${(this.counts[0] / total * 100).toFixed(1)}%`;
    cols[1].style.height = `${(this.counts[1] / total * 100).toFixed(1)}%`;
    const labels = this._histEl.querySelectorAll('.hist-count');
    labels[0].textContent = this.counts[0];
    labels[1].textContent = this.counts[1];
  },
  updateHistogram2() {
    if (!this._hist2El) return;
    const total = Math.max(1, this.counts2.reduce((a, b) => a + b, 0));
    const cols = this._hist2El.querySelectorAll('.hist-bar');
    const labels = this._hist2El.querySelectorAll('.hist-count');
    for (let i = 0; i < 4; i++) {
      cols[i].style.height = `${(this.counts2[i] / total * 100).toFixed(1)}%`;
      labels[i].textContent = this.counts2[i];
    }
  },
  updateCHSH() {
    if (!this._chshEl) return;
    const v = this.sValue;
    const valEl = this._chshEl.querySelector('.chsh-s-val');
    const subEl = this._chshEl.querySelector('.chsh-s-sub');
    if (v == null) {
      valEl.textContent = '—';
      subEl.textContent = 'Press "Run" to compute S from 400×4 shots.';
    } else {
      valEl.textContent = v.toFixed(3);
      const verdict = v > 2.0
        ? `Classical bound broken by ${(v - 2).toFixed(3)}. Quantum confirmed.`
        : `S = ${v.toFixed(3)} — try running again, noise can land you just under.`;
      subEl.innerHTML = `S = E(a₀,b₀) − E(a₀,b₁) + E(a₁,b₀) + E(a₁,b₁)<br/>${verdict}`;
    }
  },
  animateSphereBell() {
    // Spin the sphere to hint "we ran many measurements".
    let t = 0;
    const base = { x: 0, y: 1, z: 0 };
    const spin = () => {
      t += 0.3;
      this.sphere.setTarget({
        x: Math.cos(t) * Math.sin(t * 0.5),
        y: Math.sin(t),
        z: Math.cos(t * 0.7),
      });
      if (t < 6) requestAnimationFrame(spin);
      else this.sphere.setTarget(base);
    };
    spin();
  },
  checkGatePuzzle() {
    const p = probs1(this.state);
    if (p[1] > 0.99) this.complete();
  },
  complete() {
    if (!progress.done.includes(progress.current)) {
      progress.done.push(progress.current);
      saveProgress();
      renderDots();
    }
    nextBtn.disabled = false;
  },
};

// ---------- Lesson render ----------
let currentLesson = null;
function renderLesson(index) {
  progress.current = index;
  saveProgress();
  const lesson = LESSONS[index];
  currentLesson = lesson;

  numEl.textContent = lesson.num;
  titleEl.textContent = lesson.title;
  subEl.textContent = lesson.sub;
  bodyEl.innerHTML = lesson.body;

  // Probability panel visibility
  ctx._showProbs = !!lesson.showProbs;
  probsEl.style.display = lesson.showProbs ? '' : 'none';

  // Overlay chips
  overlayEl.innerHTML = '';
  (lesson.overlay || []).forEach(o => {
    const el = document.createElement('span');
    el.className = o.class;
    el.textContent = o.text;
    overlayEl.appendChild(el);
  });

  // Insert optional widgets (histogram, CHSH) into the body
  ctx._histEl = null;
  ctx._hist2El = null;
  ctx._chshEl = null;
  if (lesson.showHistogram) {
    const el = document.createElement('div');
    el.className = 'histogram';
    el.innerHTML = `
      <div class="hist-col">
        <div class="hist-count" style="color:var(--accent);">0</div>
        <div class="hist-bar" style="height:0%"></div>
        <div class="hist-label">|0⟩</div>
      </div>
      <div class="hist-col">
        <div class="hist-count" style="color:var(--red);">0</div>
        <div class="hist-bar red" style="height:0%"></div>
        <div class="hist-label">|1⟩</div>
      </div>`;
    bodyEl.appendChild(el);
    ctx._histEl = el;
  }
  if (lesson.showHistogram2) {
    const el = document.createElement('div');
    el.className = 'histogram';
    const labels = ['|00⟩', '|01⟩', '|10⟩', '|11⟩'];
    const cls = ['', '', '', ''];
    el.innerHTML = labels.map((l, i) => `
      <div class="hist-col">
        <div class="hist-count">0</div>
        <div class="hist-bar ${(i === 0 || i === 3) ? '' : 'red'}" style="height:0%"></div>
        <div class="hist-label">${l}</div>
      </div>`).join('');
    bodyEl.appendChild(el);
    ctx._hist2El = el;
  }
  if (lesson.showCHSH) {
    const el = document.createElement('div');
    el.className = 'chsh-s';
    el.innerHTML = `
      <div class="chsh-s-val">—</div>
      <div class="chsh-s-sub">Press "Run" to compute S from 400×4 shots.</div>`;
    bodyEl.appendChild(el);
    ctx._chshEl = el;
  }

  // Controls
  controlsEl.innerHTML = '';
  (lesson.controls || []).forEach(ctl => {
    const btn = document.createElement('button');
    btn.className = ctl.class || 'action-btn';
    btn.textContent = ctl.label;
    // Compile action as a function with ctx + quantum helpers in scope.
    const fn = new Function(
      'ctx', 'KET_0', 'KET_00', 'GATES_1Q', 'GATES_2Q',
      'blochVector', 'probs1', 'measure1',
      'probs2', 'measure2', 'marginalBloch',
      'estimateCHSH', 'estimateE', 'c',
      ctl.action,
    );
    btn.addEventListener('click', () => {
      try {
        fn(ctx, KET_0, KET_00, GATES_1Q, GATES_2Q,
           blochVector, probs1, measure1,
           probs2, measure2, marginalBloch,
           estimateCHSH, estimateE, c);
      } catch (e) {
        console.error('control action failed', e);
      }
    });
    controlsEl.appendChild(btn);
  });

  // Nav state — always enabled; dots show progress.
  prevBtn.disabled = index === 0;
  nextBtn.disabled = false;
  nextBtn.textContent = index < LESSONS.length - 1 ? 'Next lesson →' : 'Back to home →';

  // Reset per-lesson transient state
  ctx._dragCount = 0;

  // Boot the lesson
  lesson.init(ctx);
}

// ---------- Nav ----------
function renderDots() {
  dotsEl.innerHTML = '';
  LESSONS.forEach((l, i) => {
    const d = document.createElement('span');
    d.className = 'dot' + (i === progress.current ? ' active' : '') + (progress.done.includes(i) ? ' done' : '');
    d.title = `${l.num} · ${l.title}`;
    d.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(d);
  });
}
function goTo(index) {
  if (index < 0 || index >= LESSONS.length) return;
  hideHome();
  renderLesson(index);
  renderDots();
  tutorLog.innerHTML = `<div class="tutor-msg system">Ask anything about <em>${LESSONS[index].title}</em>. "What just happened?", "Why did the arrow move?", "Explain in one sentence."</div>`;
}

prevBtn.addEventListener('click', () => goTo(progress.current - 1));
nextBtn.addEventListener('click', () => {
  if (progress.current >= LESSONS.length - 1) {
    showHome();
    return;
  }
  goTo(progress.current + 1);
});

// ---------- Home ----------
function renderHome() {
  homeGridEl.innerHTML = '';
  LESSONS.forEach((l, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'home-card' + (progress.done.includes(i) ? ' done' : '');
    card.innerHTML = `
      <div class="card-done">✓ done</div>
      <div class="card-num">${l.num}</div>
      <div class="card-title">${l.title}</div>
      <div class="card-sub">${l.sub}</div>
    `;
    card.addEventListener('click', () => goTo(i));
    homeGridEl.appendChild(card);
  });
}
function showHome() {
  renderHome();
  homeEl.hidden = false;
  layoutEl.style.display = 'none';
  tutorFab.hidden = true;
  tutorPanel.hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideHome() {
  homeEl.hidden = true;
  layoutEl.style.display = '';
  tutorFab.hidden = false;
}
brandBtn.addEventListener('click', showHome);

// ---------- Floating tutor ----------
function openTutor() {
  tutorPanel.hidden = false;
  tutorFab.hidden = true;
  setTimeout(() => $('tutor-input').focus(), 100);
}
function closeTutor() {
  tutorPanel.hidden = true;
  tutorFab.hidden = false;
}
tutorFab.addEventListener('click', openTutor);
tutorClose.addEventListener('click', closeTutor);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !tutorPanel.hidden) closeTutor();
});

// ---------- Tutor ----------
tutorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = tutorInput.value.trim();
  if (!q) return;
  tutorInput.value = '';
  appendTutor('user', q);
  tutorSend.disabled = true;
  const thinking = appendTutor('assistant', '…');
  try {
    const reply = await askTutor({
      question: q,
      lesson: {
        id: currentLesson.id,
        title: currentLesson.title,
        sub: currentLesson.sub,
      },
      state: describeState(),
    });
    thinking.textContent = reply;
  } catch (err) {
    thinking.remove();
    const msg = /rate-limited/i.test(err.message)
      ? 'Rate-limited by the model. Try again in a moment.'
      : err.message;
    appendTutor('error', msg);
  } finally {
    tutorSend.disabled = false;
  }
});
function appendTutor(kind, text) {
  const div = document.createElement('div');
  div.className = `tutor-msg ${kind}`;
  div.textContent = text;
  tutorLog.appendChild(div);
  tutorLog.scrollTop = tutorLog.scrollHeight;
  return div;
}
function describeState() {
  if (currentLesson.kind === 'twin') {
    const p = probs2(ctx.state2);
    return {
      kind: 'two-qubit',
      probs: {
        '|00>': p[0].toFixed(3),
        '|01>': p[1].toFixed(3),
        '|10>': p[2].toFixed(3),
        '|11>': p[3].toFixed(3),
      },
      counts: ctx.counts2,
    };
  }
  return {
    kind: 'one-qubit',
    probs: {
      '|0>': probs1(ctx.state)[0].toFixed(3),
      '|1>': probs1(ctx.state)[1].toFixed(3),
    },
    bloch: blochVector(ctx.state),
    counts: ctx.counts,
    sValue: ctx.sValue,
  };
}

// ---------- Boot ----------
renderDots();
showHome();

// Debug handle
window.__qubits = { ctx, LESSONS, goTo, showHome };
