/* =====================================================================
   ANÁLISIS — equilibrios, jacobiano, autovalores, Fourier y métricas
   ===================================================================== */
'use strict';

const Analisis = (() => {

  /* Equilibrio del sistema autónomo (I = 0):
       0 = −αx − βx³ − θ   → única raíz real (la función es estrictamente decreciente)
       y* = −κx* + (μ/3)x*³                                                     */
  function equilibrio(p) {
    let x = -p.theta / p.alpha;
    for (let k = 0; k < 50; k++) {
      const g = -p.alpha * x - p.beta * x ** 3 - p.theta, dg = -p.alpha - 3 * p.beta * x * x;
      const dx = g / dg; x -= dx; if (Math.abs(dx) < 1e-14) break;
    }
    return { x, y: -p.kappa * x + (p.mu / 3) * x ** 3 };
  }

  // J = (1/r)·[[κ − μx², 1], [−α − 3βx² − ρI, 0]]
  function jacobiano(p, x, I = 0, r = 1) {
    return [[(p.kappa - p.mu * x * x) / r, 1 / r],
            [(-p.alpha - 3 * p.beta * x * x - p.rho * I) / r, 0]];
  }

  function autovalores(J) {
    const tr = J[0][0] + J[1][1], det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    const disc = tr * tr / 4 - det;
    if (disc >= 0) { const s = Math.sqrt(disc); return { tr, det, disc, re: [tr / 2 + s, tr / 2 - s], im: [0, 0] }; }
    const s = Math.sqrt(-disc); return { tr, det, disc, re: [tr / 2, tr / 2], im: [s, -s] };
  }

  function clasificar(ev) {
    if (ev.det < 0) return 'punto de silla';
    const tipo = ev.disc < 0 ? 'foco' : 'nodo';
    if (Math.abs(ev.tr) < 1e-12) return 'centro (caso límite: bifurcación de Hopf)';
    return tipo + (ev.tr > 0 ? ' inestable (repulsor)' : ' estable (atractor)');
  }

  // Bifurcación de Hopf: traza(J*) = κ − μx*² = 0 → κ_c = μ·x*²  (x* no depende de κ)
  function kappaHopf(p) { const e = equilibrio(p); return p.mu * e.x * e.x; }

  /* ---------- FFT radix-2 (Cooley-Tukey) ---------- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  /* Periodograma: quita la media, ventana de Hann, relleno con ceros.
     serie muestreada cada dt kyr. Devuelve períodos y potencia normalizada. */
  function periodograma(serie, dt = 1, pad = 8) {
    const v = Array.from(serie).filter(Number.isFinite); const N = v.length;
    if (N < 8) return { periodo: [], potencia: [] };
    const media = v.reduce((a, b) => a + b, 0) / N;
    let M = 1; while (M < N * pad) M <<= 1;
    const re = new Float64Array(M), im = new Float64Array(M);
    for (let i = 0; i < N; i++) re[i] = (v[i] - media) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
    fft(re, im);
    const periodo = [], potencia = []; let mx = 0;
    for (let k = 1; k < M / 2; k++) {
      const f = k / (M * dt), P = re[k] * re[k] + im[k] * im[k];
      periodo.push(1 / f); potencia.push(P); if (P > mx) mx = P;
    }
    return { periodo, potencia: potencia.map(P => P / (mx || 1)), maxAbs: mx };
  }

  function periodoDominante(serie, dt = 1, pmin = 10, pmax = 400) {
    const { periodo, potencia } = periodograma(serie, dt);
    let best = NaN, bp = -1;
    for (let i = 0; i < periodo.length; i++) if (periodo[i] >= pmin && periodo[i] <= pmax && potencia[i] > bp) { bp = potencia[i]; best = periodo[i]; }
    return best;
  }

  /* Período por cruces ascendentes de la media (útil sin forzamiento) */
  function periodoPorCruces(t, v, descarte = 0.3) {
    const i0 = Math.floor(v.length * descarte), sub = v.slice(i0), ts = t.slice(i0);
    const m = sub.reduce((a, b) => a + b, 0) / sub.length, cruces = [];
    for (let i = 1; i < sub.length; i++) if (sub[i - 1] < m && sub[i] >= m)
      cruces.push(ts[i - 1] + (m - sub[i - 1]) / (sub[i] - sub[i - 1]) * (ts[i] - ts[i - 1]));
    if (cruces.length < 2) return NaN;
    return (cruces[cruces.length - 1] - cruces[0]) / (cruces.length - 1);
  }

  function pearson(a, b) {
    let n = 0, sa = 0, sb = 0;
    for (let i = 0; i < a.length; i++) if (isFinite(a[i]) && isFinite(b[i])) { n++; sa += a[i]; sb += b[i]; }
    const ma = sa / n, mb = sb / n; let c = 0, va = 0, vb = 0;
    for (let i = 0; i < a.length; i++) if (isFinite(a[i]) && isFinite(b[i])) { const da = a[i] - ma, db = b[i] - mb; c += da * db; va += da * da; vb += db * db; }
    return c / Math.sqrt(va * vb);
  }
  function rmse(a, b) {
    let n = 0, s = 0; for (let i = 0; i < a.length; i++) if (isFinite(a[i]) && isFinite(b[i])) { n++; s += (a[i] - b[i]) ** 2; }
    return Math.sqrt(s / n);
  }

  // Pendiente de la recta log(error) vs log(h) por mínimos cuadrados → orden observado
  function pendienteLogLog(hs, errs) {
    const P = hs.map((h, i) => [Math.log10(h), Math.log10(errs[i])]).filter(q => isFinite(q[1]));
    if (P.length < 2) return NaN;
    const mx = P.reduce((a, q) => a + q[0], 0) / P.length, my = P.reduce((a, q) => a + q[1], 0) / P.length;
    let num = 0, den = 0; P.forEach(q => { num += (q[0] - mx) * (q[1] - my); den += (q[0] - mx) ** 2; });
    return num / den;
  }

  return { equilibrio, jacobiano, autovalores, clasificar, kappaHopf, periodograma, periodoDominante, periodoPorCruces, pearson, rmse, pendienteLogLog };
})();
window.Analisis = Analisis;
