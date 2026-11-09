// Three.js Bloch sphere renderer. One instance per qubit shown in the UI.
// The visible scene: translucent sphere, three faint equatorial/polar rings,
// three axis arrows, |0⟩ and |1⟩ labels at the poles, and a thick coloured
// Bloch vector whose tip animates smoothly to the target.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const EASE = 0.14; // closer to 1 = snappier animation

export class BlochSphere {
  constructor(canvasEl, { accent = '#a78bfa' } = {}) {
    this.canvas = canvasEl;
    this.accent = accent;

    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this.camera.position.set(2.6, 1.6, 3.0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 0);

    this._buildSphere();
    this._buildAxes();
    this._buildLabels();
    this._buildVector();

    this.target = new THREE.Vector3(0, 1, 0);   // |0⟩ at top
    this.current = new THREE.Vector3(0, 1, 0);
    this.vectorLength = 1;
    this.targetLength = 1;

    this._dragging = false;
    this._dragStart = null;
    this._onInteract = null;
    this._interactive = false;

    this._loop();
    this._attachResize();
  }

  _buildSphere() {
    const geo = new THREE.SphereGeometry(1, 48, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8a7bff,
      transparent: true,
      opacity: 0.07,
    });
    this.sphereMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.sphereMesh);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 20, 14)),
      new THREE.LineBasicMaterial({ color: 0x5a5a68, transparent: true, opacity: 0.18 }),
    );
    this.scene.add(wire);

    // Equator + meridian rings
    const ringMat = new THREE.LineBasicMaterial({ color: 0x8a86a8, transparent: true, opacity: 0.35 });
    const ringPts = (axis) => {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        if (axis === 'xy') pts.push(new THREE.Vector3(Math.cos(t), 0, Math.sin(t)));
        if (axis === 'xz') pts.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0));
        if (axis === 'yz') pts.push(new THREE.Vector3(0, Math.cos(t), Math.sin(t)));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
    };
    this.scene.add(ringPts('xy'));
    this.scene.add(ringPts('xz'));
    this.scene.add(ringPts('yz'));
  }

  _buildAxes() {
    const axisMat = new THREE.LineBasicMaterial({ color: 0x6b6b7a });
    const axis = (v) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        v.clone().multiplyScalar(1.35),
      ]);
      return new THREE.Line(geo, axisMat);
    };
    this.scene.add(axis(new THREE.Vector3(1, 0, 0)));
    this.scene.add(axis(new THREE.Vector3(-1, 0, 0)));
    this.scene.add(axis(new THREE.Vector3(0, 1, 0)));
    this.scene.add(axis(new THREE.Vector3(0, -1, 0)));
    this.scene.add(axis(new THREE.Vector3(0, 0, 1)));
    this.scene.add(axis(new THREE.Vector3(0, 0, -1)));
  }

  _buildLabels() {
    const mk = (text, color = '#e6e9f0') => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.font = '600 56px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 72);
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.5, 0.5, 1);
      return sp;
    };
    const top = mk('|0⟩', '#dfe3ee');
    top.position.set(0, 1.5, 0);
    this.scene.add(top);
    const bot = mk('|1⟩', '#dfe3ee');
    bot.position.set(0, -1.5, 0);
    this.scene.add(bot);

    const axisLbl = (text, pos) => {
      const s = mk(text, '#8a86a8');
      s.position.copy(pos);
      s.scale.set(0.35, 0.35, 1);
      this.scene.add(s);
    };
    axisLbl('x', new THREE.Vector3(1.55, 0, 0));
    axisLbl('y', new THREE.Vector3(0, 0, 1.55));
  }

  _buildVector() {
    const color = new THREE.Color(this.accent);

    // Arrow shaft as a thick line
    this.arrowGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]);
    const shaft = new THREE.Line(
      this.arrowGeom,
      new THREE.LineBasicMaterial({ color, linewidth: 3 }),
    );
    this.scene.add(shaft);

    // Cone head
    const headGeo = new THREE.ConeGeometry(0.06, 0.16, 20);
    headGeo.translate(0, -0.08, 0); // base at origin, tip along +Y
    const headMat = new THREE.MeshBasicMaterial({ color });
    this.arrowHead = new THREE.Mesh(headGeo, headMat);
    this.arrowHead.position.set(0, 1, 0);
    this.scene.add(this.arrowHead);

    // Tip sphere so the thing reads as a vector even edge-on
    const tipGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const tipMat = new THREE.MeshBasicMaterial({ color });
    this.tip = new THREE.Mesh(tipGeo, tipMat);
    this.tip.position.set(0, 1, 0);
    this.scene.add(this.tip);
  }

  // target: { x, y, z } with length <= 1. Length = state purity (1 = pure).
  setTarget(bloch) {
    // Three.js convention: y is "up", but our Bloch z axis is vertical.
    // Map { x, y, z } (quantum) → ( x, z, y ) in Three.js world.
    const v = new THREE.Vector3(bloch.x, bloch.z, bloch.y);
    const len = Math.min(1, Math.hypot(v.x, v.y, v.z));
    this.targetLength = len;
    if (len > 1e-6) {
      v.normalize();
    } else {
      v.set(0, 0, 0);
    }
    this.target.copy(v);
  }

  // One-shot: no animation, snap immediately.
  snapTo(bloch) {
    this.setTarget(bloch);
    this.current.copy(this.target);
    this.vectorLength = this.targetLength;
    this._updateVector();
  }

  _updateVector() {
    const tip = this.current.clone().multiplyScalar(this.vectorLength);
    const pos = this.arrowGeom.attributes.position;
    pos.setXYZ(1, tip.x, tip.y, tip.z);
    pos.needsUpdate = true;

    this.arrowHead.position.copy(tip);
    this.tip.position.copy(tip);

    if (tip.lengthSq() > 1e-6) {
      const up = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, tip.clone().normalize());
      this.arrowHead.quaternion.copy(q);
    }
    // Shrink the head when the vector shortens (mixed/entangled state look).
    const scale = Math.max(0.35, this.vectorLength);
    this.arrowHead.scale.setScalar(scale);
    this.tip.scale.setScalar(scale);
  }

  _loop = () => {
    this.current.lerp(this.target, EASE);
    this.vectorLength += (this.targetLength - this.vectorLength) * EASE;
    this._updateVector();

    // Gentle auto-rotate when not being dragged
    if (!this._dragging) {
      this.scene.rotation.y += 0.0015;
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  };

  _attachResize() {
    const ro = new ResizeObserver(() => {
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    });
    ro.observe(this.canvas);
  }

  // Enable drag-to-rotate the arrow. The caller receives each new state
  // via onChange({x,y,z}) so it can update the probability display.
  enableDrag(onChange) {
    this._interactive = true;
    this._onInteract = onChange;
    const canvas = this.canvas;

    const toSphere = (e) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      // Treat (nx, ny) as the Bloch (x, z) components (vertical is Bloch z).
      const x = nx * 1.0;
      const z = ny * 1.0;
      const r2 = x * x + z * z;
      let y;
      if (r2 >= 1) {
        const r = Math.sqrt(r2);
        return { x: x / r, y: 0, z: z / r };
      }
      y = Math.sqrt(1 - r2);
      // Front hemisphere by default.
      return { x, y, z };
    };

    canvas.addEventListener('pointerdown', (e) => {
      this._dragging = true;
      canvas.setPointerCapture(e.pointerId);
      const b = toSphere(e);
      this.snapTo(b);
      this._onInteract?.(b);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const b = toSphere(e);
      this.snapTo(b);
      this._onInteract?.(b);
    });
    const end = (e) => {
      if (this._dragging) {
        this._dragging = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.style.cursor = 'grab';
  }

  disableDrag() {
    this._interactive = false;
    this._onInteract = null;
    this.canvas.style.cursor = 'default';
  }

  // Flash the tip briefly on a measurement event.
  flash() {
    const start = performance.now();
    const base = this.accent;
    const flashColor = new THREE.Color('#fff');
    const origColor = new THREE.Color(base);
    const dur = 420;
    const tick = () => {
      const t = (performance.now() - start) / dur;
      if (t >= 1) {
        this.tip.material.color.copy(origColor);
        this.arrowHead.material.color.copy(origColor);
        return;
      }
      const k = 1 - t;
      const col = origColor.clone().lerp(flashColor, k);
      this.tip.material.color.copy(col);
      this.arrowHead.material.color.copy(col);
      requestAnimationFrame(tick);
    };
    tick();
  }
}
