/* =====================================================================
   ESCENARIO — fondos decorativos dibujados con código (cielo, montañas,
   icebergs). No contienen datos: son solo ambientación.
   ===================================================================== */
'use strict';
const Escenario = (() => {
  function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // Perfil de cordillera por desplazamiento del punto medio
  function cordillera(n, rugosidad, rnd) {
    let p = [0.5, 0.5]; let amp = 0.5;
    while (p.length < n) {
      const q = [];
      for (let i = 0; i < p.length - 1; i++) { q.push(p[i]); q.push((p[i] + p[i + 1]) / 2 + (rnd() - 0.5) * amp); }
      q.push(p[p.length - 1]); p = q; amp *= rugosidad;
    }
    return p;
  }

  function preparar(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
  }

  function montana(ctx, w, h, base, alto, rug, semilla, colPico, colBase, nieve) {
    const rnd = azar(semilla), perfil = cordillera(257, rug, rnd);
    const ys = perfil.map(v => base - alto * Math.max(0, Math.min(1, v + 0.15)));
    const gr = ctx.createLinearGradient(0, base - alto, 0, base);
    gr.addColorStop(0, colPico); gr.addColorStop(1, colBase);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, h);
    ys.forEach((y, i) => ctx.lineTo(i / (ys.length - 1) * w, y)); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    if (nieve && false) {   // (desactivado) vetas de nieve
      ctx.save(); ctx.clip(); ctx.strokeStyle = nieve; ctx.lineWidth = 1;
      for (let i = 2; i < ys.length - 2; i += 2) {
        if (ys[i] < ys[i - 2] && ys[i] < ys[i + 2]) {
          const x = i / (ys.length - 1) * w, L = 6 + rnd() * 22;
          for (let k = -2; k <= 2; k++) { ctx.globalAlpha = 0.25 + rnd() * 0.35; ctx.beginPath(); ctx.moveTo(x + k * 2, ys[i] + 2); ctx.lineTo(x + k * 5 + (rnd() - 0.5) * 6, ys[i] + L); ctx.stroke(); }
        }
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }

  function cielo(cv) {
    const { ctx, w, h } = preparar(cv);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#081a33'); g.addColorStop(0.55, '#173a63'); g.addColorStop(1, '#2a4f7a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const sol = ctx.createRadialGradient(w * 0.86, h * 0.82, 0, w * 0.86, h * 0.82, w * 0.32);
    sol.addColorStop(0, 'rgba(255,196,140,0.95)'); sol.addColorStop(0.25, 'rgba(240,140,120,0.55)'); sol.addColorStop(0.6, 'rgba(150,100,160,0.18)'); sol.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sol; ctx.fillRect(0, 0, w, h);
    const rnd = azar(7); for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(230,240,255,${0.15 + rnd() * 0.5})`; ctx.fillRect(rnd() * w, rnd() * h * 0.5, 1.2, 1.2); }
    montana(ctx, w, h, h * 1.0, h * 1.15, 0.6, 11, '#eef7ff', '#4f7fb3', 1);
    montana(ctx, w, h, h * 1.0, h * 0.62, 0.55, 23, '#b9dcf7', '#1f4a78', 1);
    montana(ctx, w, h, h * 1.0, h * 0.34, 0.5, 41, '#2f5e8f', '#0a1f3a', 0);
    // velo oscuro a la izquierda para que el título se lea
    const v = ctx.createLinearGradient(0, 0, w * 0.6, 0); v.addColorStop(0, 'rgba(4,12,26,0.92)'); v.addColorStop(0.55, 'rgba(4,12,26,0.6)'); v.addColorStop(1, 'rgba(4,12,26,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    const v2 = ctx.createLinearGradient(0, h - 50, 0, h); v2.addColorStop(0, 'rgba(4,12,26,0)'); v2.addColorStop(1, 'rgba(4,12,26,0.7)');
    ctx.fillStyle = v2; ctx.fillRect(0, h - 50, w, 50);
  }

  function iceberg(ctx, x, base, ancho, alto, rnd) {
    const n = 10 + Math.floor(rnd() * 8), pts = [[x, base]];
    for (let i = 1; i < n; i++) { const t = i / n; pts.push([x + t * ancho + (rnd() - 0.5) * ancho * 0.06, base - alto * Math.sin(Math.PI * t) ** 0.6 * (0.55 + rnd() * 0.45)]); }
    pts.push([x + ancho, base]);
    const g = ctx.createLinearGradient(0, base - alto, 0, base);
    g.addColorStop(0, 'rgba(235,248,255,0.95)'); g.addColorStop(0.5, 'rgba(150,205,240,0.85)'); g.addColorStop(1, 'rgba(40,100,160,0.8)');
    ctx.fillStyle = g; ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fill();
    // reflejo
    ctx.globalAlpha = 0.18; ctx.save(); ctx.translate(0, 2 * base); ctx.scale(1, -0.35); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
  }

  function hielo(cv, semilla = 3) {
    const { ctx, w, h } = preparar(cv), rnd = azar(semilla), base = h * 0.78;
    const agua = ctx.createLinearGradient(0, base, 0, h); agua.addColorStop(0, 'rgba(20,70,120,0.5)'); agua.addColorStop(1, 'rgba(4,14,28,0.9)');
    ctx.fillStyle = agua; ctx.fillRect(0, base, w, h - base);
    for (let x = -40; x < w; x += 90 + rnd() * 180) {
      const a = 60 + rnd() * 200, alt = h * (0.12 + rnd() * 0.42);
      iceberg(ctx, x, base, a, alt, rnd);
    }
    ctx.strokeStyle = 'rgba(143,227,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(w, base); ctx.stroke();
  }

  function carambanos(cv) {
    const { ctx, w, h } = preparar(cv), rnd = azar(5);
    for (let x = 0; x < w; x += 6 + rnd() * 10) {
      const L = h * (0.2 + rnd() * 0.8) * (1 - x / w) ** 1.4, an = 3 + rnd() * 6;
      const g = ctx.createLinearGradient(0, 0, 0, L); g.addColorStop(0, 'rgba(220,245,255,0.95)'); g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + an, 0); ctx.lineTo(x + an / 2, L); ctx.closePath(); ctx.fill();
    }
  }

  return { cielo, hielo, carambanos };
})();
window.Escenario = Escenario;
