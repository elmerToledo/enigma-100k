/* =====================================================================
   GRÁFICOS — mini librería de gráficas en canvas (sin dependencias)
   ===================================================================== */
'use strict';

const Graf = (() => {
  const C = {
    fondo: 'rgba(0,0,0,0)', eje: 'rgba(120,200,255,0.28)', grilla: 'rgba(120,200,255,0.07)',
    texto: 'rgba(214,232,248,0.78)', fuente: '11.5px "Segoe UI", system-ui, sans-serif'
  };

  function preparar(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function ticks(a, b, n = 6) {
    const span = Math.abs(b - a) || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= n) || mag * 10;
    const lo = Math.ceil(Math.min(a, b) / step) * step, out = [];
    for (let v = lo; v <= Math.max(a, b) + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function fmt(v) {
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1000) return v.toLocaleString('es-BO', { maximumFractionDigits: 0 });
    if (a >= 10) return (+v.toFixed(1)).toString();
    if (a >= 0.01) return (+v.toFixed(3)).toString();
    return v.toExponential(0);
  }

  /* opciones:
     series: [{x:[], y:[], color, ancho, guiones, alfa, nombre, puntos}]
     xlim, ylim, invertirY, logX, logY, xLabel, yLabel, fmtX, cursorX,
     bandas: [{x0,x1,color}], marcasX:[{x,texto,color}], margen            */
  function linea(cv, o) {
    const { ctx, w, h } = preparar(cv);
    const m = Object.assign({ l: 52, r: 14, t: 12, b: 34 }, o.margen || {});
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const tx = v => o.logX ? Math.log10(v) : v, ty = v => o.logY ? Math.log10(v) : v;
    let [x0, x1] = o.xlim || rango(o.series, 'x'), [y0, y1] = o.ylim || pad(rango(o.series, 'y'));
    const X = v => m.l + (tx(v) - tx(x0)) / (tx(x1) - tx(x0)) * pw;
    const Y = v => o.invertirY ? m.t + (ty(v) - ty(y0)) / (ty(y1) - ty(y0)) * ph : m.t + ph - (ty(v) - ty(y0)) / (ty(y1) - ty(y0)) * ph;
    ctx.font = C.fuente;
    (o.bandas || []).forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(X(b.x0), m.t, X(b.x1) - X(b.x0), ph); });
    // grilla y ejes
    const tX = o.ticksX ? o.ticksX : o.logX ? decadas(x0, x1) : ticks(x0, x1, Math.max(3, Math.floor(pw / 80)));
    const tY = o.logY ? decadasY(y0, y1, ph) : ticks(y0, y1, Math.max(3, Math.floor(ph / 40)));
    ctx.strokeStyle = C.grilla; ctx.lineWidth = 1; ctx.fillStyle = C.texto;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    tX.forEach(v => { const px = X(v); if (px < m.l - 1 || px > m.l + pw + 1) return; ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke(); ctx.fillText(o.fmtX ? o.fmtX(v) : (o.logX ? sup(v) : fmt(v)), px, m.t + ph + 5); });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    tY.forEach(v => { const py = Y(v); if (py < m.t - 1 || py > m.t + ph + 1) return; ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke(); ctx.fillText(o.logY ? sup(v) : fmt(v), m.l - 6, py); });
    ctx.strokeStyle = C.eje; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
    if (o.xLabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(o.xLabel, m.l + pw / 2, h - 1); }
    if (o.yLabel) { ctx.save(); ctx.translate(11, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.yLabel, 0, 0); ctx.restore(); }
    // series
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    (o.marcasX || []).forEach(mk => {
      const px = X(mk.x); ctx.strokeStyle = mk.color || 'rgba(255,255,255,0.3)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      if (mk.texto) { ctx.fillStyle = mk.color || C.texto; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(mk.texto, px + 3, m.t + 3); }
    });
    o.series.forEach(s => {
      if (s.relleno) {                                   // área degradada bajo la curva
        const base = o.invertirY ? m.t : m.t + ph, gr = ctx.createLinearGradient(0, m.t, 0, m.t + ph);
        gr.addColorStop(o.invertirY ? 1 : 0, s.color.startsWith('#') ? s.color + '55' : s.color); gr.addColorStop(o.invertirY ? 0 : 1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); let first = true, lastX = 0;
        for (let i = 0; i < s.x.length; i++) { if (!isFinite(s.y[i])) continue; const px = X(s.x[i]), py = Y(s.y[i]); if (first) { ctx.moveTo(px, base); ctx.lineTo(px, py); first = false; } else ctx.lineTo(px, py); lastX = px; }
        ctx.lineTo(lastX, base); ctx.closePath(); ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      }
      if (s.brillo) { ctx.shadowColor = s.color; ctx.shadowBlur = 8; }
      ctx.globalAlpha = s.alfa ?? 1; ctx.strokeStyle = s.color; ctx.lineWidth = s.ancho || 1.6; ctx.setLineDash(s.guiones || []);
      ctx.beginPath(); let on = false;
      for (let i = 0; i < s.x.length; i++) {
        const xv = s.x[i], yv = s.y[i];
        if (!isFinite(yv) || !isFinite(xv) || (o.logY && yv <= 0)) { on = false; continue; }
        const px = X(xv), py = Y(yv); if (on) ctx.lineTo(px, py); else { ctx.moveTo(px, py); on = true; }
      }
      if (!s.soloPuntos) ctx.stroke();
      if (s.puntos) { ctx.fillStyle = s.color; for (let i = 0; i < s.x.length; i++) if (isFinite(s.y[i]) && (!o.logY || s.y[i] > 0)) { ctx.beginPath(); ctx.arc(X(s.x[i]), Y(s.y[i]), s.puntos, 0, 7); ctx.fill(); } }
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    });
    // etiquetas tipo "píldora" (p. ej. picos del espectro)
    (o.etiquetas || []).forEach(e => {
      const px = X(e.x), py = Y(e.y); if (!isFinite(px) || !isFinite(py)) return;
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif'; const tw = ctx.measureText(e.texto).width + 14, bx = px - tw / 2, by = Math.max(m.t + 2, py - 30);
      ctx.fillStyle = 'rgba(8,22,36,0.92)'; ctx.strokeStyle = e.color || '#ffb454'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(bx, by, tw, 19, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.texto, px, by + 10);
      ctx.fillStyle = e.color || '#ffb454'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill();
    });
    if (o.cursorX !== undefined && o.cursorX !== null) {
      const px = X(o.cursorX); ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
    }
    ctx.restore();
    (o.rotulosX || []).forEach(r => { ctx.font = '700 11.5px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(r.texto, X(r.x), m.t - 3); });
    // leyenda
    const ley = o.series.filter(s => s.nombre); if (ley.length) {
      ctx.font = C.fuente; let lx = m.l + 10, ly = m.t + 10; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (o.leyenda === 'arriba') ly = Math.max(8, m.t - 12);
      if (o.leyenda === 'derecha' || o.leyenda === 'arriba') { const ancho = ley.reduce((a, s) => a + ctx.measureText(s.nombre).width + 34, 0); lx = m.l + pw - ancho - 4; }
      ley.forEach(s => { ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.setLineDash(s.guiones || []); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 16, ly); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(232,242,252,0.92)'; ctx.fillText(s.nombre, lx + 21, ly); lx += ctx.measureText(s.nombre).width + 34; });
    }
    return { X, Y, m, pw, ph, xlim: [x0, x1], ylim: [y0, y1] };
  }

  function rango(series, k) {
    let a = Infinity, b = -Infinity;
    series.forEach(s => s[k].forEach(v => { if (isFinite(v)) { if (v < a) a = v; if (v > b) b = v; } }));
    if (!isFinite(a)) return [0, 1]; if (a === b) return [a - 1, b + 1]; return [a, b];
  }
  function pad([a, b], f = 0.06) { const d = (b - a) * f; return [a - d, b + d]; }
  function decadas(a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b), e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi)), out = [];
    const mult = e1 - e0 <= 3 ? [1, 2, 5] : [1];
    for (let e = e0; e <= e1; e++) mult.forEach(k => { const v = k * 10 ** e; if (v >= lo * 0.999 && v <= hi * 1.001) out.push(+v.toPrecision(3)); });
    return out;
  }
  function decadasY(a, b, ph) { const d = decadas(a, b).filter(v => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9); const paso = Math.max(1, Math.ceil(d.length / Math.max(3, ph / 26))); return d.filter((_, i) => i % paso === 0); }
  function sup(v) { const e = Math.round(Math.log10(v)); if (e >= -2 && e <= 3) return fmt(v); return '1e' + e; }

  return { linea, preparar, ticks, fmt };
})();
window.Graf = Graf;
