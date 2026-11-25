/* =====================================================================
   MOTOR MATEMÁTICO — "El enigma de los 100.000 años"
   Modelo SO (Self-sustained Oscillator) de Mitsui, Ditlevsen, Boers y
   Crucifix (2025), Earth System Dynamics 16, 1569–1584.

     r·dx/dt = y + κx − (μ/3)x³
     r·dy/dt = −αx − βx³ − θ − (ν + ρx)·A·I(t) − η·(A·I(t))²

     δ18O_modelo(t) = y(t) + 4 + δ

   t en miles de años (kyr), negativo = pasado (t = −1100 … 0; hasta −2100 en el experimento de la Transición del Pleistoceno Medio).
   r = escala temporal interna (r = 1 → modelo original).
   A = intensidad del forzamiento orbital (A = 1 → insolación real).
   Este archivo no depende de la interfaz: solo matemáticas.
   ===================================================================== */
'use strict';

const PARAMS_ARTICULO = Object.freeze({
  kappa: 1.0536394044, mu: 2.9662458029, alpha: 0.0356079021,
  beta: 0.0001000922, theta: 0.0180996836, nu: 0.0514402004,
  rho: 0.0189082535, eta: 0.0049923333, delta: 0.1801349684
});

/* ---------- 1. Órbita terrestre La2004 (tabla cada 1 kyr) ----------
   Igual que la función la04() del paquete palinsol (Crucifix), que usan
   los autores: interpolación lineal de e, ε y ϖ entre milenios.        */
const Orbita = (() => {
  const L = window.DATOS.la04;
  function en(t) {                       // t en kyr
    const tka = t - 0.1;                 // misma convención que el código de los autores (época 1950 vs J2000)
    const F = Math.floor(tka), i = Math.min(-F, L.ecc.length - 1), D = tka - F;
    const j = Math.max(i - 1, 0);
    let dv = L.varpi[j] - L.varpi[i];
    if (dv > Math.PI) dv -= 2 * Math.PI;
    if (dv < -Math.PI) dv += 2 * Math.PI;
    return {
      ecc: L.ecc[i] + D * (L.ecc[j] - L.ecc[i]),
      eps: L.eps[i] + D * (L.eps[j] - L.eps[i]),
      varpi: L.varpi[i] + D * dv
    };
  }
  return { en };
})();

/* ---------- 2. Insolación diaria media (Berger, 1978) ----------
   long = longitud solar verdadera (π/2 = solsticio boreal), lat en rad. */
function insolacionDiaria(orb, long = Math.PI / 2, lat = 65 * Math.PI / 180, S0 = 1368) {
  const nu = long - orb.varpi;
  const rho = (1 - orb.ecc ** 2) / (1 + orb.ecc * Math.cos(nu));
  const sd = Math.sin(orb.eps) * Math.sin(long), cd = Math.sqrt(1 - sd * sd);
  const ss = Math.sin(lat) * sd, cc = Math.cos(lat) * cd;
  const cH = Math.min(Math.max(-ss / cc, -1), 1), H0 = Math.acos(cH);
  return S0 / (Math.PI * rho * rho) * (H0 * ss + cc * Math.sqrt(1 - cH * cH));
}

/* ---------- 3. Forzamientos precalculados ----------
   Se tabula I(t) cada 0.025 kyr para que los integradores sean rápidos.
   Variantes para experimentos: sin precesión (e = 0) y sin oblicuidad
   (ε fija en su valor medio).                                          */
const Forzamiento = (() => {
  const T0 = -2100, T1 = 0, DT = 0.025, N = Math.round((T1 - T0) / DT) + 1;
  const EPS_MEDIA = (() => { let s = 0; const e = window.DATOS.la04.eps; for (let k = 0; k <= 2100; k++) s += e[k]; return s / 2101; })();
  const tablas = {};
  function construir(tipo) {
    const F = new Float64Array(N), I = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      const t = T0 + k * DT, o = Orbita.en(t);
      if (tipo === 'sinPrecesion') o.ecc = 0;
      if (tipo === 'sinOblicuidad') o.eps = EPS_MEDIA;
      F[k] = insolacionDiaria(o);
      I[k] = (F[k] - 495.7) / 24;          // normalización del artículo
    }
    return { F, I };
  }
  function tabla(tipo) {
    if (tipo === 'cero') return null;
    if (!tablas[tipo]) tablas[tipo] = construir(tipo);
    return tablas[tipo];
  }
  // Interpolación lineal F(t) = F_i + (F_{i+1} − F_i)(t − t_i)/Δt
  function I(tipo, t) {
    if (tipo === 'exacta') return (insolacionDiaria(Orbita.en(t)) - 495.7) / 24;   // sin tabla (para estudiar convergencia)
    const tb = tabla(tipo); if (!tb) return 0;
    let u = (t - T0) / DT; if (u <= 0) return tb.I[0]; if (u >= N - 1) return tb.I[N - 1];
    const k = Math.floor(u), f = u - k; return tb.I[k] + f * (tb.I[k + 1] - tb.I[k]);
  }
  function F(tipo, t) {
    const tb = tabla(tipo || 'real'); let u = (t - T0) / DT;
    u = Math.min(Math.max(u, 0), N - 1.000001); const k = Math.floor(u), f = u - k;
    return tb.F[k] + f * (tb.F[k + 1] - tb.F[k]);
  }
  return { I, F, tabla, T0, T1, DT, N, EPS_MEDIA };
})();

/* ---------- 4. Registro LR04 ---------- */
const LR04 = (() => {
  function serie(cual) {                 // devuelve arreglos ordenados por t creciente
    const d = (cual === 'untuned' ? window.DATOS.lr04u : window.DATOS.lr04).slice().sort((a, b) => b[0] - a[0]);
    return { t: d.map(r => -r[0]), v: d.map(r => r[1]) };
  }
  const cache = {};
  function en(cual, t) {
    const s = cache[cual] || (cache[cual] = serie(cual));
    const T = s.t, V = s.v;
    if (t <= T[0]) return V[0]; if (t >= T[T.length - 1]) return V[V.length - 1];
    let lo = 0, hi = T.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    return V[lo] + (V[hi] - V[lo]) * (t - T[lo]) / (T[hi] - T[lo]);
  }
  return { en, serie: c => cache[c] || (cache[c] = serie(c)) };
})();

/* ---------- 5. El sistema de EDO ---------- */
function crearSistema({ p = PARAMS_ARTICULO, r = 1, rFun = null, A = 1, forz = 'real' } = {}) {
  const { kappa, mu, alpha, beta, theta, nu, rho, eta } = p;
  return function f(t, x, y) {
    const i = A * Forzamiento.I(forz, t);
    const ir = 1 / (rFun ? rFun(t) : r);
    return [
      (y + kappa * x - (mu / 3) * x * x * x) * ir,
      (-alpha * x - beta * x * x * x - theta - (nu + rho * x) * i - eta * i * i) * ir
    ];
  };
}

/* ---------- 6. Métodos numéricos ---------- */
const Metodos = {
  // Euler: u_{n+1} = u_n + h f(t_n, u_n)                     (orden 1)
  euler(f, t, x, y, h) { const k = f(t, x, y); return [x + h * k[0], y + h * k[1]]; },
  // Heun: predictor de Euler + corrector trapezoidal          (orden 2)
  heun(f, t, x, y, h) {
    const k1 = f(t, x, y), xs = x + h * k1[0], ys = y + h * k1[1], k2 = f(t + h, xs, ys);
    return [x + h / 2 * (k1[0] + k2[0]), y + h / 2 * (k1[1] + k2[1])];
  },
  // Runge-Kutta clásico de 4 etapas                            (orden 4)
  rk4(f, t, x, y, h) {
    const k1 = f(t, x, y);
    const k2 = f(t + h / 2, x + h / 2 * k1[0], y + h / 2 * k1[1]);
    const k3 = f(t + h / 2, x + h / 2 * k2[0], y + h / 2 * k2[1]);
    const k4 = f(t + h, x + h * k3[0], y + h * k3[1]);
    return [x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
            y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
  }
};

/* Integra de t0 a t1 y guarda una muestra cada `cada` kyr (por defecto 1 kyr). */
function simular({ metodo = 'rk4', h = 0.05, t0 = -1100, t1 = 0, x0 = 0, y0 = null,
                   cada = 1, p = PARAMS_ARTICULO, r = 1, rFun = null, A = 1, forz = 'real' } = {}) {
  if (y0 === null) y0 = LR04.en('tuned', t0) - 4;      // como los autores: y inicial desde LR04
  const f = crearSistema({ p, r, rFun, A, forz }), paso = Metodos[metodo];
  const n = Math.round((t1 - t0) / h), salto = Math.max(1, Math.round(cada / h));
  const T = [], X = [], Y = [], D = [];
  let x = x0, y = y0, divergio = false;
  for (let k = 0; k <= n; k++) {
    const t = t0 + k * h;
    if (k % salto === 0) { T.push(t); X.push(x); Y.push(y); D.push(y + 4 + p.delta); }
    if (k === n) break;
    [x, y] = paso(f, t, x, y, h);
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e6) { divergio = true; break; }
  }
  return { t: T, x: X, y: Y, d18O: D, divergio, h, metodo };
}

/* Versión rápida (Heun, igual al código de los autores) para barridos de
   parámetros: usa la tabla de insolación directamente. Devuelve δ18O cada 1 kyr. */
function simularRapido({ r = 1, A = 1, p = PARAMS_ARTICULO, forz = 'real', h = 0.05, rFun = null, t0 = -1100 }) {
  const tb = Forzamiento.tabla(forz), DT = Forzamiento.DT, paso = Math.round(h / DT);
  const off = Math.round((t0 - Forzamiento.T0) / DT);          // índice de t0 en la tabla
  const { kappa: k, mu, alpha: al, beta: be, theta: th, nu, rho: rh, eta: et, delta } = p;
  const L = Math.round(-t0), n = Math.round(L / h), salto = Math.round(1 / h), out = new Float64Array(L + 1);
  let x = 0, y = LR04.en('tuned', t0) - 4;
  const m3 = mu / 3;
  for (let i = 0; i <= n; i++) {
    if (i % salto === 0) out[i / salto] = y + delta;
    if (i === n) break;
    const I0 = tb ? A * tb.I[off + i * paso] : 0, I1 = tb ? A * tb.I[off + (i + 1) * paso] : 0;
    const hr = h / (rFun ? rFun(t0 + i * h) : r);
    const fx = y + k * x - m3 * x * x * x, fy = -al * x - be * x * x * x - th - (nu + rh * x) * I0 - et * I0 * I0;
    const xa = x + fx * hr, ya = y + fy * hr;
    const gx = ya + k * xa - m3 * xa * xa * xa, gy = -al * xa - be * xa * xa * xa - th - (nu + rh * xa) * I1 - et * I1 * I1;
    x += 0.5 * (fx + gx) * hr; y += 0.5 * (fy + gy) * hr;
    if (!isFinite(x)) { out.fill(NaN); break; }
  }
  for (let j = 0; j < out.length; j++) out[j] += 4;   // δ18O = y + 4 + δ
  return out;   // índice j ↔ t = t0 + j
}

window.Modelo = { PARAMS_ARTICULO, Orbita, insolacionDiaria, Forzamiento, LR04, crearSistema, Metodos, simular, simularRapido };
