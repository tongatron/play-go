// Renderer della goban su Canvas. Disegna griglia, hoshi e pietre; mappa i click
// sull'intersezione più vicina. Indipendente dalla logica di rete.

export class Goban {
  constructor(canvas, { size = 9, onPoint } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = size;
    this.onPoint = onPoint;
    this.position = null; // matrice [size][size] di 0/1/2
    this.dead = new Set(); // indici marcati morti (fase scoring)
    canvas.addEventListener('click', (e) => this._handleClick(e));
  }

  setSize(size) { this.size = size; this.dead.clear(); this._resize(); }

  setPosition(grid) { this.position = grid; this.draw(); }

  toggleDead(i) { this.dead.has(i) ? this.dead.delete(i) : this.dead.add(i); this.draw(); }
  deadList() { return [...this.dead]; }
  clearDead() { this.dead.clear(); }

  _resize() {
    const wrap = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    // Fallback se il contenitore è (ancora) a larghezza 0 (es. sezione nascosta).
    const avail = wrap.clientWidth || Math.min(window.innerWidth - 32, 560);
    const px = Math.min(avail, 560);
    this.px = px;
    this.canvas.style.width = px + 'px';
    this.canvas.style.height = px + 'px';
    this.canvas.width = px * dpr;
    this.canvas.height = px * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  _coords() {
    const m = this.px * 0.06; // margine
    const span = this.px - 2 * m;
    const step = span / (this.size - 1);
    return { m, step };
  }

  draw() {
    const ctx = this.ctx;
    const { m, step } = this._coords();
    ctx.clearRect(0, 0, this.px, this.px);
    // sfondo legno
    ctx.fillStyle = '#e2b96f';
    ctx.fillRect(0, 0, this.px, this.px);
    // griglia
    ctx.strokeStyle = '#5a4326';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.size; i++) {
      const p = m + i * step;
      ctx.beginPath(); ctx.moveTo(m, p); ctx.lineTo(m + (this.size - 1) * step, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, m); ctx.lineTo(p, m + (this.size - 1) * step); ctx.stroke();
    }
    // hoshi
    ctx.fillStyle = '#5a4326';
    for (const [hx, hy] of this._hoshi()) {
      ctx.beginPath(); ctx.arc(m + hx * step, m + hy * step, 3, 0, 2 * Math.PI); ctx.fill();
    }
    // pietre
    if (!this.position) return;
    const r = step * 0.46;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const v = this.position[y][x];
        if (!v) continue;
        const cx = m + x * step, cy = m + y * step;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fillStyle = v === 1 ? '#101010' : '#f7f7f7';
        ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
        if (this.dead.has(y * this.size + x)) { // pietra marcata morta
          ctx.fillStyle = v === 1 ? '#f7f7f7' : '#101010';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, 2 * Math.PI); ctx.fill();
        }
      }
    }
  }

  _hoshi() {
    if (this.size === 9) return [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
    if (this.size === 13) return [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
    return [];
  }

  _handleClick(e) {
    if (!this.onPoint) return;
    const rect = this.canvas.getBoundingClientRect();
    const { m, step } = this._coords();
    const x = Math.round((e.clientX - rect.left - m) / step);
    const y = Math.round((e.clientY - rect.top - m) / step);
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.onPoint(x, y);
  }
}
