/**
 * AI Sentinel — Particle System
 * Ember-toned canvas particles with connections
 */

class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.colors = ['#FF6B35', '#F7C59F', '#FCDE9C', '#C3423F', '#FF8C5A', '#2DC78A'];
    this.mouse = { x: -9999, y: -9999 };
    this._resize();
    this._init();
    this._bindEvents();
    this._animate();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _init() {
    const count = Math.min(90, Math.floor(window.innerWidth / 14));
    this.particles = Array.from({ length: count }, () => this._make());
  }

  _make() {
    return {
      x:      Math.random() * this.canvas.width,
      y:      Math.random() * this.canvas.height,
      vx:     (Math.random() - 0.5) * 0.45,
      vy:     (Math.random() - 0.5) * 0.45,
      r:      Math.random() * 2.4 + 0.8,
      color:  this.colors[Math.floor(Math.random() * this.colors.length)],
      alpha:  Math.random() * 0.5 + 0.1,
      phase:  Math.random() * Math.PI * 2,
    };
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this._resize();
      this._init();
    });
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  _update() {
    const W = this.canvas.width, H = this.canvas.height;
    this.particles.forEach(p => {
      p.phase += 0.018;
      p.alpha  = 0.15 + Math.abs(Math.sin(p.phase)) * 0.35;

      // Slight repulsion from mouse
      const dx  = p.x - this.mouse.x;
      const dy  = p.y - this.mouse.y;
      const d   = Math.hypot(dx, dy);
      if (d < 100 && d > 0) {
        const force = (100 - d) / 100 * 0.6;
        p.vx += (dx / d) * force;
        p.vy += (dy / d) * force;
      }

      // Damping
      p.vx *= 0.99;
      p.vy *= 0.99;

      p.x += p.vx;
      p.y += p.vy;

      // Wrap edges
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
  }

  _draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const ps = this.particles;
    const LINK_DIST = 130;

    // Draw connections
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const dist = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
        if (dist < LINK_DIST) {
          const opacity = (1 - dist / LINK_DIST) * 0.18;
          this.ctx.beginPath();
          this.ctx.strokeStyle = `rgba(255,107,53,${opacity})`;
          this.ctx.lineWidth   = 0.6;
          this.ctx.moveTo(ps[i].x, ps[i].y);
          this.ctx.lineTo(ps[j].x, ps[j].y);
          this.ctx.stroke();
        }
      }
    }

    // Draw particles
    ps.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur  = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  _animate() {
    this._update();
    this._draw();
    requestAnimationFrame(() => this._animate());
  }
}

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ParticleSystem('particle-canvas');
});
