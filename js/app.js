/* =====================================================================
   INTERFAZ — las 5 pantallas del laboratorio
   (usa Modelo, Analisis y Graf; ninguna fórmula del modelo vive aquí)
   ===================================================================== */
'use strict';
const M = window.Modelo, An = window.Analisis, P0 = M.PARAMS_ARTICULO;
const $ = id => document.getElementById(id);
const COL = { cian: '#3fd0ff', blanco: 'rgba(233,242,251,0.72)', ambar: '#ffb454', rojo: '#ff6b6b', verde: '#5be37d', lila: '#b48ead', euler: '#ff9f43', heun: '#5be37d', rk4: '#3fd0ff' };
const T1K = Array.from({ length: 1101 }, (_, j) => -1100 + j);
const fmtKyr = v => (v < 0 ? '−' : '') + Math.abs(Math.round(v));
const fmtAnios = t => (Math.round(Math.abs(t) * 1000) + 0).toLocaleString('es-BO');
const fmtP = p => isFinite(p) ? p.toFixed(1) + ' kyr' : '—';
const ejeT = { fmtX: v => fmtKyr(v), xLabel: 'Tiempo (kyr)' };
const tooltip = $('tooltip');
const E = { pantalla: 'planeta', r: 1, A: 1, forz: 'real', lr: 'tuned', t: -20, play: false, vel: 1.5, giro: 0 };

/* ---------------- utilidades de la interfaz ---------------- */
function pintarRango(el) { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); }
document.querySelectorAll('input[type=range]').forEach(el => { pintarRango(el); el.addEventListener('input', () => pintarRango(el)); });
function fijarRango(id, v) { const el = $(id); el.value = v; pintarRango(el); }
function segmentado(id, alCambiar) {
  const cont = $(id);
  cont.querySelectorAll('button').forEach(b => b.onclick = () => {
    cont.querySelectorAll('button').forEach(x => x.classList.toggle('activo', x === b)); alCambiar(b.dataset.v);
  });
}
function marcarSegmento(id, v) { $(id).querySelectorAll('button').forEach(x => x.classList.toggle('activo', x.dataset.v === v)); }

/* ---------------- navegación ---------------- */
const ORDEN = ['planeta', 'orbita', 'reloj', 'mapa', 'metodos'];
document.querySelectorAll('#pestanas button').forEach(b => b.onclick = () => irA(b.dataset.p));
function irA(p) {
  E.pantalla = p;
  document.querySelectorAll('#pestanas button').forEach(b => b.classList.toggle('activa', b.dataset.p === p));
  document.querySelectorAll('.pantalla').forEach(s => s.classList.toggle('activa', s.id === p));
  requestAnimationFrame(() => ({ planeta: dibujarPlaneta, orbita: entrarOrbita, reloj: entrarReloj, mapa: entrarMapa, metodos: calcularMetodos })[p]());
}
let tRedim; window.addEventListener('resize', () => { clearTimeout(tRedim); tRedim = setTimeout(() => { decorar(); S3.fondo = null; irA(E.pantalla); }, 120); });
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  const i = ORDEN.indexOf(E.pantalla);
  if (e.key === 'ArrowRight' && e.target.type !== 'range') irA(ORDEN[(i + 1) % 5]);
  else if (e.key === 'ArrowLeft' && e.target.type !== 'range') irA(ORDEN[(i + 4) % 5]);
  else if (e.code === 'Space' && (E.pantalla === 'planeta' || E.pantalla === 'orbita')) { e.preventDefault(); alternarPlay(); }
  else if (e.key === 'f' || e.key === 'F') alternarPresentacion();
});
function alternarPresentacion() {
  document.body.classList.toggle('presentacion');
  if (document.body.classList.contains('presentacion')) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen?.();
  setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
}
$('btnPresentacion').onclick = alternarPresentacion;

function decorar() { Escenario.hielo($('cvHielo'), 3); if ($('cvIcebergs')) Escenario.hielo($('cvIcebergs'), 9); }

/* =====================================================================
   1. EL PLANETA
   ===================================================================== */
const S1 = {};
function recalcPlaneta() {
  S1.sim = Array.from(M.simularRapido({ r: E.r, A: E.A, forz: E.forz }));
  S1.obs = T1K.map(t => M.LR04.en(E.lr, t));
  S1.ins = T1K.map(t => M.Forzamiento.F('real', t));
  const m = S1.sim.slice(100), o = S1.obs.slice(100);
  S1.espM = An.periodograma(m); S1.espO = An.periodograma(o); S1.espI = An.periodograma(S1.ins.slice(100));
  $('mR').textContent = An.pearson(m, o).toFixed(3);
  $('mRMSE').innerHTML = An.rmse(m, o).toFixed(3) + '<small> ‰</small>';
  const pm = An.periodoDominante(m), po = An.periodoDominante(o);
  $('mPm').innerHTML = isFinite(pm) ? pm.toFixed(1) + '<small> kyr</small>' : '—';
  $('mPo').innerHTML = isFinite(po) ? po.toFixed(1) + '<small> kyr</small>' : '—';
  dibujarPlaneta();
}
const enT = (arr, t) => { const u = t + 1100, j = Math.max(0, Math.min(1099, Math.floor(u))), f = u - j; return arr[j] + f * (arr[j + 1] - arr[j]); };
function picos(esp, objetivos, color) {     // etiqueta el máximo local más cercano a cada período objetivo
  return objetivos.map(P => {
    let best = -1, bi = -1;
    esp.periodo.forEach((p, i) => { if (p > P * 0.94 && p < P * 1.07 && esp.potencia[i] > best) { best = esp.potencia[i]; bi = i; } });
    return bi >= 0 && best > 0.08 ? { x: esp.periodo[bi], y: best, texto: Math.round(esp.periodo[bi]) + ' kyr', color } : null;
  }).filter(Boolean);
}
function dibujarPlaneta() {
  if (!S1.sim) return;
  Graf.linea($('cvSerie'), {
    series: [{ x: T1K, y: S1.obs, color: COL.blanco, ancho: 1.2 },
             { x: T1K, y: S1.sim, color: COL.cian, ancho: 2.2, brillo: true }],
    xlim: [-1100, 0], ylim: [2.9, 5.4], invertirY: true, yLabel: 'δ¹⁸O (‰)', cursorX: E.t, margen: { t: 6, b: 30 }, ...ejeT
  });
  dibujarEspectroPlaneta(); dibujarGlobo();
  const d = enT(S1.sim, E.t), o = enT(S1.obs, E.t), F = M.Forzamiento.F('real', E.t), g = hieloRelativo(d);
  $('lecEdad').textContent = fmtAnios(E.t);
  $('lecMod').innerHTML = d.toFixed(2) + '<small>‰</small>';
  $('lecObs').innerHTML = o.toFixed(2) + '<small>‰</small>';
  $('lecIns').innerHTML = F.toFixed(0) + '<small>W/m²</small>';
  $('lecMar').innerHTML = (g < 0.03 ? '0' : '−' + Math.round(120 * g)) + '<small>m</small>';
  $('lecT').textContent = fmtKyr(E.t) + ' kyr';
  const est = d > 4.45 ? ['Glacial', '#d9f3ff'] : d < 3.75 ? ['Interglacial', COL.verde] : (enT(S1.sim, Math.min(0, E.t + 2)) < d ? ['Deglaciación', COL.ambar] : ['Enfriamiento', COL.cian]);
  $('lecEstado').textContent = '● ' + est[0]; $('lecEstado').style.color = est[1];
}
function dibujarEspectroPlaneta() {
  const pk = picos(S1.espM, [23, 41, 100], COL.cian);
  Graf.linea($('cvEspectro'), {
    series: [{ x: S1.espO.periodo, y: S1.espO.potencia, color: 'rgba(233,242,251,0.35)', ancho: 1 },
             { x: S1.espM.periodo, y: S1.espM.potencia, color: COL.cian, ancho: 2.2, brillo: true }],
    xlim: [10, 400], ylim: [0, 1.1], logX: true, ticksX: [10, 23, 41, 100, 400], xLabel: 'Período (kyr)', margen: { t: 18, l: 44 },
    marcasX: pk.map(p => ({ x: p.x, texto: '', color: 'rgba(214,232,248,0.35)' })), rotulosX: pk.map(p => ({ x: p.x, texto: String(Math.round(p.x)) }))
  });
}
const hieloRelativo = d => Math.min(1, Math.max(0, (d - 3.25) / (5.0 - 3.25)));

/* ---- Globo polar ---- */

const IMG_TIERRA = Object.assign(new Image(), { src: 'assets/tierra_polar.jpg' });
IMG_TIERRA.onload = () => E.pantalla === 'planeta' && dibujarGlobo();
// Posiciones en la foto polar (fracción del radio, desde el centro) de cada capa de hielo
const CAPAS = [
  { n: 'Laurentino',   x: -0.40, y: 0.30, rmax: 0.33, g0: 0.10, rot: { dx: -1.02, dy: 0.62, al: 'left' } },
  { n: 'Cordillerano', x: -0.52, y: -0.18, rmax: 0.17, g0: 0.35, rot: { dx: -1.05, dy: -0.52, al: 'left' } },
  { n: 'Fenoscandia',  x: 0.56, y: 0.24, rmax: 0.21, g0: 0.22, rot: { dx: 0.92, dy: -0.78, al: 'left' } },
  { n: 'Groenlandia',  x: 0.07, y: 0.27, rmax: 0.08, g0: 0.0, rot: { dx: 0.92, dy: 0.80, al: 'left' } },
  { n: '', x: 0.33, y: -0.20, rmax: 0.16, g0: 0.40 },
  { n: '', x: 0.50, y: 0.58, rmax: 0.07, g0: 0.50 }
];
function dibujarGlobo() {
  if (!S1.sim) return;
  const cv = $('cvGlobo'), { ctx, w, h } = Graf.preparar(cv);
  const R = Math.min(h * 0.42, w * 0.29), cx = w * 0.55, cy = h * 0.53;
  const d = enT(S1.sim, E.t), g = hieloRelativo(d), F = M.Forzamiento.F('real', E.t);
  // halo exterior (anillo orbital) que se calienta con la insolación
  const calor = Math.min(1, Math.max(0, (F - 430) / 140));
  ctx.strokeStyle = `rgba(${90 + 140 * calor},${200 - 20 * calor},${255 - 150 * calor},0.35)`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(63,208,255,0.18)'; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, 7); ctx.stroke();
  const at = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.16);
  at.addColorStop(0, 'rgba(80,200,255,0.85)'); at.addColorStop(0.3, 'rgba(60,170,255,0.30)'); at.addColorStop(1, 'rgba(40,140,255,0)');
  ctx.fillStyle = at; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, 7); ctx.fill();
  // la Tierra (foto) + capas de hielo según δ18O del modelo
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
  if (IMG_TIERRA.complete && IMG_TIERRA.naturalWidth) { const k = R / 0.485; ctx.drawImage(IMG_TIERRA, cx - k * 0.5, cy - k * 0.5, k, k); }
  else { ctx.fillStyle = '#0b3354'; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R); }
  // hielo marino en el océano Ártico
  const rMar = R * (0.18 + 0.2 * g), hm = ctx.createRadialGradient(cx, cy - R * 0.08, 0, cx, cy - R * 0.08, rMar);
  hm.addColorStop(0, `rgba(235,248,255,${0.25 + 0.5 * g})`); hm.addColorStop(1, 'rgba(235,248,255,0)');
  ctx.fillStyle = hm; ctx.beginPath(); ctx.arc(cx, cy - R * 0.08, rMar, 0, 7); ctx.fill();
  CAPAS.forEach((c, k) => {
    const s = c.rmax * Math.max(0, (g - c.g0) / (1 - c.g0)) ** 0.75; if (s < 0.01) return;
    const x = cx + c.x * R, y = cy + c.y * R, rp = s * R; ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = i / 72 * 2 * Math.PI, ru = 1 + 0.12 * Math.sin(3 * a + k) + 0.07 * Math.sin(7 * a + 2 * k) + 0.04 * Math.sin(13 * a + k);
      const px = x + rp * ru * Math.cos(a), py = y + rp * ru * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rp * 1.12);
    gr.addColorStop(0, 'rgba(250,253,255,0.92)'); gr.addColorStop(0.55, 'rgba(232,246,255,0.78)'); gr.addColorStop(0.9, 'rgba(210,236,252,0.35)'); gr.addColorStop(1, 'rgba(210,236,252,0)');
    ctx.fillStyle = gr; ctx.fill();
  });
  const sh = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.3, cx, cy, R);
  sh.addColorStop(0, 'rgba(255,255,255,0.06)'); sh.addColorStop(0.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,10,30,0.45)');
  ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,220,255,0.95)'; ctx.lineWidth = 2; ctx.shadowColor = '#3fd0ff'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.font = '11.5px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(214,232,248,0.85)'; ctx.textAlign = 'center'; ctx.fillText('N · 90°', cx, cy - R * 1.12 - 6);
  // rótulos con líneas guía (como en el diseño)
  CAPAS.filter(c => c.n).forEach(c => {
    const x = cx + c.x * R, y = cy + c.y * R, lx = cx + c.rot.dx * R, ly = cy + c.rot.dy * R, izq = c.rot.dx < 0;
    const tx = izq ? lx - 4 : lx + 4;
    ctx.strokeStyle = 'rgba(230,244,255,0.75)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.lineTo(lx + (izq ? -70 : 70), ly); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx, ly, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = COL.cian; ctx.shadowColor = COL.cian; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.stroke();
    ctx.font = '600 12.5px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = izq ? 'right' : 'left';
    ctx.fillText(c.n, izq ? lx - 6 : lx + 6, ly - 5);
  });
}

/* ---- Controles 1 ---- */
function sincronizarControles() {
  fijarRango('slA', E.A); $('vA').textContent = E.A.toFixed(2);
  fijarRango('slR', E.r); $('vR').textContent = E.r.toFixed(2);
  $('selForz').value = E.forz; marcarSegmento('segLR', E.lr);
}
$('slA').oninput = e => { E.A = +e.target.value; $('vA').textContent = E.A.toFixed(2); recalcPlaneta(); };
$('slR').oninput = e => { E.r = +e.target.value; $('vR').textContent = E.r.toFixed(2); recalcPlaneta(); };
$('selForz').onchange = e => { E.forz = e.target.value; recalcPlaneta(); };
segmentado('segLR', v => { E.lr = v; recalcPlaneta(); });
$('btnArticulo').onclick = () => { Object.assign(E, { r: 1, A: 1, forz: 'real' }); sincronizarControles(); recalcPlaneta(); };
$('selVel').onchange = e => E.vel = +e.target.value;
function fijarTiempo(t) {
  E.t = Math.max(-1100, Math.min(0, t)); fijarRango('slTiempo', E.t); fijarRango('slTiempo2', E.t);
  if (E.pantalla === 'planeta') dibujarPlaneta(); else if (E.pantalla === 'orbita') dibujarOrbitaDatos();
}
$('slTiempo').oninput = e => fijarTiempo(+e.target.value);
$('slTiempo2').oninput = e => fijarTiempo(+e.target.value);
$('btnInicio').onclick = () => fijarTiempo(-1100);
function alternarPlay() {
  if (!E.play && E.t >= 0) fijarTiempo(-1100);
  E.play = !E.play;
  ['btnPlay', 'btnPlay2'].forEach(b => $(b).innerHTML = `<svg><use href="#i-${E.play ? 'pausa' : 'play'}"/></svg>`);
}
$('btnPlay').onclick = alternarPlay; $('btnPlay2').onclick = alternarPlay;

/* =====================================================================
   2. LA ÓRBITA
   ===================================================================== */
const IMG_EMBLEMA = Object.assign(new Image(), { src: 'assets/emblema.png' });
const S2 = (() => {
  const s = { ecc: [], obl: [], prec: [], F: [], lambda: 0, senal: 'F' };
  T1K.forEach(t => { const o = M.Orbita.en(t); s.ecc.push(o.ecc); s.obl.push(o.eps * 180 / Math.PI); s.prec.push(o.ecc * Math.sin(o.varpi)); s.F.push(M.Forzamiento.F('real', t)); });
  s.esp = An.periodograma(s.F.slice(100)); return s;
})();
const SENALES = { F: ['Insolación 65°N (W/m²)', COL.ambar], ecc: ['Excentricidad', COL.cian], obl: ['Oblicuidad (°)', COL.lila], prec: ['e · sen ϖ', COL.rojo] };
segmentado('segSenal', v => { S2.senal = v; dibujarOrbitaDatos(); });
function entrarOrbita() {
  Graf.linea($('cvEspIns'), {
    series: [{ x: S2.esp.periodo, y: S2.esp.potencia, color: COL.ambar, ancho: 2, brillo: true, relleno: true }], xlim: [10, 500], ylim: [0, 1.3], logX: true,
    xLabel: 'Período (kyr)', yLabel: 'Potencia (rel.)', margen: { t: 6 }, etiquetas: picos(S2.esp, [19, 23, 41], COL.ambar)
  });
  dibujarOrbitaDatos();
}
function dibujarOrbitaDatos() {
  const [nom, col] = SENALES[S2.senal];
  Graf.linea($('cvSenal'), { series: [{ x: T1K, y: S2[S2.senal], color: col, ancho: 1.8, brillo: true }], xlim: [-1100, 0], cursorX: E.t, yLabel: nom, margen: { t: 6 }, ...ejeT });
  const o = M.Orbita.en(E.t);
  $('oEdad').textContent = fmtAnios(E.t); $('oE').textContent = o.ecc.toFixed(4);
  $('oEps').textContent = (o.eps * 180 / Math.PI).toFixed(2) + '°';
  $('oVarpi').textContent = (((o.varpi * 180 / Math.PI) % 360 + 360) % 360).toFixed(0) + '°';
  $('oF').textContent = M.Forzamiento.F('real', E.t).toFixed(0) + ' W/m²';
  $('lecT2').textContent = fmtKyr(E.t) + ' kyr';
}
function tierrita(ctx, x, y, r, brillo = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(170,225,255,${brillo})`); g.addColorStop(0.5, '#2a7cc0'); g.addColorStop(1, '#0b2c50');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(110,160,110,0.65)'; ctx.beginPath(); ctx.ellipse(x - r * 0.2, y + r * 0.1, r * 0.35, r * 0.22, 0.6, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.75, r * 0.45, r * 0.18, 0, 0, 7); ctx.fill();
}
function sol(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, '#fffbe6'); g.addColorStop(0.18, '#ffd36b'); g.addColorStop(0.35, 'rgba(255,150,40,0.55)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 7); ctx.fill();
}
function dibujarOrbita() {
  const cv = $('cvOrbita'), { ctx, w, h } = Graf.preparar(cv), o = M.Orbita.en(E.t);
  const rnd = (i => () => (i = (i * 16807) % 2147483647) / 2147483647)(42);
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(220,235,255,${0.1 + rnd() * 0.45})`; ctx.fillRect(rnd() * w, rnd() * h, 1.2, 1.2); }
  // zona de la órbita (izquierda) con perspectiva
  const ow = w * 0.64, cx = ow * 0.53, cy = h * 0.5, a = Math.min(ow * 0.36, h * 0.75), inc = 0.42;
  const e = Math.min(0.6, o.ecc * 8), fp = o.varpi + Math.PI;
  const sx = cx + a * e * Math.cos(fp), sy = cy - a * e * Math.sin(fp) * inc;
  const pos = ang => { const r = a * (1 - e * e) / (1 + e * Math.cos(ang - fp)); return [sx + r * Math.cos(ang), sy - r * Math.sin(ang) * inc]; };
  ctx.strokeStyle = 'rgba(143,227,255,0.75)'; ctx.lineWidth = 1.6; ctx.shadowColor = '#3fd0ff'; ctx.shadowBlur = 8; ctx.beginPath();
  for (let i = 0; i <= 240; i++) { const [x, y] = pos(i / 240 * 2 * Math.PI); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.shadowBlur = 0;
  // flechas de sentido
  [0.2, 0.7].forEach(f => { const A = f * 2 * Math.PI, [x1, y1] = pos(A), [x2, y2] = pos(A + 0.05); const an = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = '#8fe3ff'; ctx.beginPath(); ctx.moveTo(x2 + 7 * Math.cos(an), y2 + 7 * Math.sin(an)); ctx.lineTo(x2 + 6 * Math.cos(an + 2.5), y2 + 6 * Math.sin(an + 2.5)); ctx.lineTo(x2 + 6 * Math.cos(an - 2.5), y2 + 6 * Math.sin(an - 2.5)); ctx.fill(); });
  // ápsides
  const [px, py] = pos(fp), [ax, ay] = pos(fp + Math.PI);
  ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,180,84,0.4)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
  sol(ctx, sx, sy, Math.min(w, h) * 0.06);
  const rotulo = (x, y, t1, t2, col = '#fff') => { ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = '600 12.5px "Segoe UI", sans-serif'; ctx.fillText(t1, x, y); if (t2) { ctx.fillStyle = 'rgba(214,232,248,0.7)'; ctx.font = '11px "Segoe UI", sans-serif'; ctx.fillText(t2, x, y + 14); } };
  // estaciones (posición de la Tierra = λ + π)
  [[0, 'Equinoccio de marzo', '~20 de marzo'], [90, 'Solsticio de junio', '~21 de junio'], [180, 'Equinoccio de septiembre', '~22 de septiembre'], [270, 'Solsticio de diciembre', '~21 de diciembre']].forEach(([l, t1, t2]) => {
    const A = l * Math.PI / 180 + Math.PI, [x, y] = pos(A);
    tierrita(ctx, x, y, 9, 0.8);
    const dy = y < cy ? -22 : 26; rotulo(x, y + dy, t1, t2);
  });
  rotulo(px + 30 * Math.cos(fp), py - 26 * Math.sin(fp) * inc - 4, 'Perihelio', '(mínima distancia)', COL.ambar);
  rotulo(ax - 30 * Math.cos(fp), ay + 26 * Math.sin(fp) * inc - 4, 'Afelio', '(máxima distancia)', COL.ambar);
  // Tierra en movimiento
  S2.lambda = (S2.lambda + 0.018) % (2 * Math.PI);
  const [ex, ey] = pos(S2.lambda + Math.PI); ctx.shadowColor = '#3fd0ff'; ctx.shadowBlur = 16; tierrita(ctx, ex, ey, 12); ctx.shadowBlur = 0;
  // Tierra grande con su eje (derecha)
  const gx = w * 0.84, gy = h * 0.46, gr = Math.min(w * 0.12, h * 0.26), eps = o.eps;
  const at = ctx.createRadialGradient(gx, gy, gr * 0.9, gx, gy, gr * 1.25); at.addColorStop(0, 'rgba(90,200,255,0.5)'); at.addColorStop(1, 'rgba(40,140,255,0)');
  ctx.fillStyle = at; ctx.beginPath(); ctx.arc(gx, gy, gr * 1.25, 0, 7); ctx.fill();
  if (IMG_EMBLEMA.complete && IMG_EMBLEMA.naturalWidth) ctx.drawImage(IMG_EMBLEMA, gx - gr * 1.22, gy - gr * 1.22, gr * 2.44, gr * 2.44); else tierrita(ctx, gx, gy, gr);
  ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(gx, gy - gr * 1.5); ctx.lineTo(gx, gy + gr * 1.5); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ff9f43'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(gx - gr * 1.55 * Math.sin(eps), gy + gr * 1.55 * Math.cos(eps)); ctx.lineTo(gx + gr * 1.55 * Math.sin(eps), gy - gr * 1.55 * Math.cos(eps)); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#8fe3ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(gx, gy, gr * 1.3, -Math.PI / 2, -Math.PI / 2 + eps); ctx.stroke();
  ctx.fillStyle = '#8fe3ff'; ctx.font = '700 15px "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillText((eps * 180 / Math.PI).toFixed(2) + '°', gx + gr * 0.35, gy - gr * 1.38);
  // distancia en el solsticio de junio
  const dJ = (1 - o.ecc ** 2) / (1 + o.ecc * Math.cos(Math.PI / 2 - o.varpi));
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillText('Distancia al Sol el 21 de junio: ' + dJ.toFixed(4) + ' UA', gx, gy + gr * 1.75);
  ctx.fillStyle = dJ < 1 ? COL.ambar : '#8fe3ff'; ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillText(dJ < 1 ? 'verano boreal cerca del perihelio → veranos intensos' : 'verano boreal cerca del afelio → veranos suaves', gx, gy + gr * 1.75 + 17);
  ctx.fillStyle = 'rgba(214,232,248,0.5)'; ctx.font = '10.5px "Segoe UI", sans-serif'; ctx.fillText('excentricidad exagerada ×8 · el Sol está en un foco', cx, h - 8);
  dibujarMinis(o);
}
function dibujarMinis(o) {
  // excentricidad
  let { ctx, w, h } = Graf.preparar($('cvMiniEcc')); const e = Math.min(0.7, o.ecc * 10), a = w * 0.42, b = a * Math.sqrt(1 - e * e);
  ctx.strokeStyle = '#d9f3ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, a, b * 0.55, 0, 0, 7); ctx.stroke(); sol(ctx, w / 2 + a * e, h / 2, 4);
  // oblicuidad
  ({ ctx, w, h } = Graf.preparar($('cvMiniObl'))); tierrita(ctx, w / 2, h / 2, h * 0.32);
  const vis = (23.3 + 4 * (o.eps * 180 / Math.PI - 23.3)) * Math.PI / 180;
  ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2 - h * 0.5 * Math.sin(vis), h / 2 + h * 0.5 * Math.cos(vis)); ctx.lineTo(w / 2 + h * 0.5 * Math.sin(vis), h / 2 - h * 0.5 * Math.cos(vis)); ctx.stroke();
  // precesión: el eje describe un cono
  ({ ctx, w, h } = Graf.preparar($('cvMiniPrec')));
  const cx = w / 2, top = h * 0.2, bot = h * 0.88, ang = o.varpi;
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(217,243,255,0.6)'; ctx.beginPath(); ctx.ellipse(cx, top, w * 0.3, h * 0.1, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  const tx = cx + w * 0.3 * Math.cos(ang), ty = top + h * 0.1 * Math.sin(ang);
  ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, bot); ctx.lineTo(tx, ty); ctx.stroke();
  tierrita(ctx, cx, bot - 4, 7); ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.arc(tx, ty, 3, 0, 7); ctx.fill();
}

/* =====================================================================
   3. EL RELOJ INTERNO
   ===================================================================== */
const S3 = { k: P0.kappa, forz: 'cero', trays: [], fondo: null, bif: null, frame: 0, vista: { x0: -1.8, x1: 1.8, y0: -0.95, y1: 0.95 }, colores: ['#3fd0ff', '#ffb454', '#5be37d', '#ff6b6b', '#b48ead', '#ffffff', '#ffd36b', '#ff9de2'] };
const pS3 = () => ({ ...P0, kappa: S3.k });
function entrarReloj() {
  if (!S3.bif) calcularBifurcacion();
  S3.fondo = null; if (!S3.trays.length) trayectoriasIniciales();
  actualizarEstabilidad(); dibujarBif(); dibujarCanard();
}
function trayectoriasIniciales() { const eq = An.equilibrio(pS3()); S3.trays = []; nuevaTray(eq.x + 0.02, eq.y); nuevaTray(-1.6, -0.85); }
function nuevaTray(x, y) {
  if (S3.trays.length >= 8) S3.trays.shift();
  S3.cont = (S3.cont || 0) + 1;
  S3.trays.push({ x, y, t: -1100, rastro: [[x, y]], ts: [], ys: [], color: S3.colores[S3.cont % S3.colores.length] });
}
function mapaFase(w, h) {
  const v = S3.vista, ml = 40, mb = 30, mt = 10, mr = 12;
  return { X: x => ml + (x - v.x0) / (v.x1 - v.x0) * (w - ml - mr), Y: y => h - mb - (y - v.y0) / (v.y1 - v.y0) * (h - mt - mb),
           iX: px => v.x0 + (px - ml) / (w - ml - mr) * (v.x1 - v.x0), iY: py => v.y0 + (h - mb - py) / (h - mt - mb) * (v.y1 - v.y0), ml, mb, mt, mr };
}
function construirFondo(w, h) {
  const dpr = window.devicePixelRatio || 1, off = document.createElement('canvas'); off.width = w * dpr; off.height = h * dpr;
  const ctx = off.getContext('2d'); ctx.scale(dpr, dpr); const { X, Y, ml, mb, mt, mr } = mapaFase(w, h), p = pS3(), v = S3.vista;
  ctx.font = '11.5px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(214,232,248,0.75)';
  ctx.strokeStyle = 'rgba(120,200,255,0.07)';
  Graf.ticks(v.x0, v.x1, 5).forEach(x => { ctx.beginPath(); ctx.moveTo(X(x), mt); ctx.lineTo(X(x), h - mb); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(x, X(x), h - mb + 15); });
  Graf.ticks(v.y0, v.y1, 5).forEach(y => { ctx.beginPath(); ctx.moveTo(ml, Y(y)); ctx.lineTo(w - mr, Y(y)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(y.toFixed(1), ml - 6, Y(y) + 4); });
  ctx.strokeStyle = 'rgba(214,232,248,0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(ml, Y(0)); ctx.lineTo(w - mr, Y(0)); ctx.moveTo(X(0), mt); ctx.lineTo(X(0), h - mb); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'italic 14px "Cambria Math", serif'; ctx.fillText('x', w - mr - 4, Y(0) - 6); ctx.fillText('y', X(0) + 12, mt + 12);
  // campo de direcciones
  const f = M.crearSistema({ p, forz: 'cero' });
  for (let i = 0; i <= 22; i++) for (let j = 0; j <= 13; j++) {
    const x = v.x0 + (i + 0.5) / 23 * (v.x1 - v.x0), y = v.y0 + (j + 0.5) / 14 * (v.y1 - v.y0), [dx, dy] = f(0, x, y);
    const vx = dx * (w / (v.x1 - v.x0)), vy = -dy * (h / (v.y1 - v.y0)), n = Math.hypot(vx, vy) || 1, L = 6.5;
    const x1 = X(x), y1 = Y(y), ux = vx / n, uy = vy / n;
    ctx.strokeStyle = 'rgba(63,160,255,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x1 - L * ux, y1 - L * uy); ctx.lineTo(x1 + L * ux, y1 + L * uy); ctx.stroke();
    ctx.fillStyle = 'rgba(63,160,255,0.7)'; ctx.beginPath(); ctx.moveTo(x1 + (L + 3) * ux, y1 + (L + 3) * uy); ctx.lineTo(x1 + L * ux - 3 * uy, y1 + L * uy + 3 * ux); ctx.lineTo(x1 + L * ux + 3 * uy, y1 + L * uy - 3 * ux); ctx.fill();
  }
  ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, w - ml - mr, h - mt - mb); ctx.clip();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,180,84,0.85)'; ctx.setLineDash([7, 5]); ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const x = v.x0 + i / 300 * (v.x1 - v.x0), y = -p.kappa * x + p.mu / 3 * x ** 3; i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); } ctx.stroke();
  const eq = An.equilibrio(p); ctx.strokeStyle = 'rgba(91,227,125,0.75)'; ctx.beginPath(); ctx.moveTo(X(eq.x), mt); ctx.lineTo(X(eq.x), h - mb); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = '600 11.5px "Segoe UI", sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = COL.ambar; ctx.fillText('dx/dt = 0', X(1.3), Y(-p.kappa * 1.3 + p.mu / 3 * 1.3 ** 3) + 4);
  ctx.fillStyle = COL.verde; ctx.fillText('dy/dt = 0', X(eq.x) + 5, mt + 26);
  ctx.restore();
  return off;
}
function dibujarFase() {
  const cv = $('cvFase'), { ctx, w, h } = Graf.preparar(cv);
  if (!S3.fondo || S3.fondo.w !== w) S3.fondo = { img: construirFondo(w, h), w };
  ctx.drawImage(S3.fondo.img, 0, 0, w, h);
  const { X, Y } = mapaFase(w, h), p = pS3(), f = M.crearSistema({ p, forz: S3.forz }), hh = 0.05, pasos = 12;
  S3.trays.forEach(tr => {
    for (let k = 0; k < pasos; k++) { [tr.x, tr.y] = M.Metodos.rk4(f, tr.t, tr.x, tr.y, hh); tr.t += hh; if (tr.t >= 0) tr.t = -1100; }
    tr.rastro.push([tr.x, tr.y]); if (tr.rastro.length > 900) tr.rastro.shift();
    tr.ts.push(tr.t); tr.ys.push(tr.y); if (tr.ys.length > 600) { tr.ts.shift(); tr.ys.shift(); }
  });
  S3.trays.forEach(tr => {
    const n = tr.rastro.length, bloque = 30; ctx.shadowColor = tr.color; ctx.shadowBlur = 6;
    for (let s = 0; s < n - 1; s += bloque) {
      ctx.globalAlpha = 0.06 + 0.94 * (s / n); ctx.strokeStyle = tr.color; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let i = s; i <= Math.min(n - 1, s + bloque); i++) { const [x, y] = tr.rastro[i]; i === s ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 14; ctx.fillStyle = tr.color; ctx.beginPath(); ctx.arc(X(tr.x), Y(tr.y), 5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  });
  const eq = An.equilibrio(p), ev = An.autovalores(An.jacobiano(p, eq.x));
  ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(X(eq.x), Y(eq.y), 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = ev.tr > 0 ? COL.rojo : COL.verde; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(eq.x), Y(eq.y), 9, 0, 7); ctx.stroke();
  ctx.font = '600 11.5px "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = ctx.strokeStyle;
  ctx.fillText('equilibrio ' + (ev.tr > 0 ? 'inestable' : 'estable'), X(eq.x) + 13, Y(eq.y) - 8);
  if (S3.forz === 'real') { ctx.fillStyle = COL.ambar; ctx.fillText('t = ' + Math.round(S3.trays[0]?.t ?? 0) + ' kyr · el campo dibujado es el de I = 0', 48, 24); }
  if (S3.frame++ % 3 === 0) {
    const series = S3.trays.map(tr => ({ x: tr.ys.map((_, i) => i * hh * pasos), y: tr.ys, color: tr.color, ancho: 2, brillo: true }));
    Graf.linea($('cvFaseSerie'), { series, ylim: [-1.1, 0.8], xlim: [0, 600 * hh * pasos], xLabel: 'Tiempo transcurrido (kyr)', yLabel: 'y(t)', margen: { t: 6 } });
  }
}
$('cvFase').addEventListener('click', ev => {
  const rc = $('cvFase').getBoundingClientRect(), { iX, iY } = mapaFase(rc.width, rc.height);
  nuevaTray(iX(ev.clientX - rc.left), iY(ev.clientY - rc.top));
});
function cambiarK(k) { S3.k = k; fijarRango('slK', k); $('vK').textContent = k.toFixed(3); S3.fondo = null; actualizarEstabilidad(); dibujarBif(); }
$('slK').oninput = e => cambiarK(+e.target.value);
$('btnKArt').onclick = () => cambiarK(P0.kappa);
segmentado('segForzF', v => { S3.forz = v; trayectoriasIniciales(); });
$('btnLimpiar').onclick = () => { S3.trays = []; };

function cicloLimite(p, t1 = 3000) {
  const eq = An.equilibrio(p);
  return M.simular({ metodo: 'heun', h: 0.05, t0: 0, t1, x0: eq.x + 0.02, y0: eq.y, forz: 'cero', p, cada: 0.5 });
}
function actualizarEstabilidad() {
  const p = pS3(), eq = An.equilibrio(p), J = An.jacobiano(p, eq.x), ev = An.autovalores(J), kc = An.kappaHopf(p), cl = An.clasificar(ev);
  const s = cicloLimite(p), xs = s.x.slice(-2000), amp = (Math.max(...xs) - Math.min(...xs)) / 2, Pc = An.periodoPorCruces(s.t, s.y, 0.5);
  const f4 = v => v.toFixed(4).replace('-', '−'), inest = ev.tr > 0;
  $('panelEstab').innerHTML = `
    <div class="fila-dato"><span>Equilibrio (x*, y*)</span><b class="caja">(${f4(eq.x)}, ${f4(eq.y)})</b></div>
    <div class="fila-dato"><span>Jacobiano J(x*, y*)</span><b><span class="matriz"><span>${f4(J[0][0])}</span><span>${f4(J[0][1])}</span><span>${f4(J[1][0])}</span><span>${f4(J[1][1])}</span></span></b></div>
    <div class="fila-dato"><span>Traza · Determinante</span><b>${f4(ev.tr)} · ${f4(ev.det)}</b></div>
    <div class="fila-dato"><span>Autovalores</span><b class="caja">λ₁,₂ = ${ev.re[0].toFixed(4).replace('-', '−')} ± ${Math.abs(ev.im[0]).toFixed(4)} i</b></div>
    <div class="etiqueta-estado" style="color:${inest ? COL.rojo : COL.verde};border:1px solid ${inest ? COL.rojo : COL.verde};background:${inest ? 'rgba(255,107,107,0.15)' : 'rgba(91,227,125,0.13)'};box-shadow:0 0 16px ${inest ? 'rgba(255,107,107,0.35)' : 'rgba(91,227,125,0.3)'}">
      <svg><use href="#i-espiral"/></svg>${cl.charAt(0).toUpperCase() + cl.slice(1)}</div>`;
  $('dPlin').innerHTML = ev.im[0] ? (2 * Math.PI / Math.abs(ev.im[0])).toFixed(1) + '<small> kyr</small>' : '—';
  $('dPsim').innerHTML = amp > 0.003 && isFinite(Pc) ? Pc.toFixed(1) + '<small> kyr</small>' : 'sin ciclo';
  $('dKc').textContent = kc.toFixed(4); $('kcForm').textContent = kc.toFixed(4);
}
function calcularBifurcacion() {
  const ks = [];
  for (let k = 0.4; k < 0.76; k += 0.01) ks.push(k);
  for (let k = 0.76; k < 0.785; k += 0.0005) ks.push(k);
  for (let k = 0.79; k <= 1.5; k += 0.01) ks.push(k);
  S3.bif = ks.map(k => { const s = cicloLimite({ ...P0, kappa: k }, 2500), xs = s.x.slice(-1600); return [k, (Math.max(...xs) - Math.min(...xs)) / 2]; });
}
function dibujarBif() {
  const kc = An.kappaHopf(P0), salto = S3.bif.find(q => q[1] > 0.5);
  Graf.linea($('cvBif'), {
    series: [{ x: S3.bif.map(q => q[0]), y: S3.bif.map(q => q[1]), color: COL.cian, ancho: 2.4, brillo: true, relleno: true }],
    xlim: [0.4, 1.5], ylim: [0, 1.6], xLabel: 'κ', yLabel: 'Amplitud', margen: { t: 6 },
    marcasX: [{ x: kc, texto: 'κc', color: 'rgba(255,107,107,0.8)' }, { x: S3.k, texto: 'κ actual', color: 'rgba(255,214,120,0.9)' }],
    etiquetas: salto ? [{ x: salto[0], y: 0.02, texto: 'κ ≈ ' + salto[0].toFixed(3), color: '#ffd36b' }] : []
  });
}
function dibujarCanard() {
  [['cvCanardA', 0.772], ['cvCanardB', 0.78]].forEach(([id, k]) => {
    const s = cicloLimite({ ...P0, kappa: k }, 2500), xs = s.x.slice(-400), ys = s.y.slice(-400);
    const { ctx, w, h } = Graf.preparar($(id)), X = x => w / 2 + x / 1.5 * (w / 2 - 6), Y = y => h / 2 - y / 0.75 * (h / 2 - 6);
    ctx.strokeStyle = 'rgba(214,232,248,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6, h / 2); ctx.lineTo(w - 6, h / 2); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4); ctx.stroke();
    ctx.strokeStyle = COL.cian; ctx.lineWidth = 2; ctx.shadowColor = COL.cian; ctx.shadowBlur = 10; ctx.beginPath();
    xs.forEach((x, i) => i ? ctx.lineTo(X(x), Y(ys[i])) : ctx.moveTo(X(x), Y(ys[i]))); ctx.stroke(); ctx.shadowBlur = 0;
  });
  document.querySelectorAll('.dos-mini span')[0].textContent = 'κ = 0.772 · ciclo pequeño';
  document.querySelectorAll('.dos-mini span')[1].textContent = 'κ = 0.780 · ciclo de relajación';
}

/* =====================================================================
   4. SINCRONIZACIÓN
   ===================================================================== */
const S4 = { rs: [], As: [], celdas: null, sel: { r: 1, A: 1 }, modo: 'periodo', obs: T1K.map(t => M.LR04.en('tuned', t)) };
const DR = 0.025, DA = 0.1;
for (let i = 0; i <= Math.round(1.7 / DR); i++) S4.rs.push(+(0.3 + i * DR).toFixed(3));
for (let j = 0; j <= Math.round(2 / DA); j++) S4.As.push(+(j * DA).toFixed(2));
const BANDAS = [
  { max: 30, color: '#ffd36b', txt: '~23 kyr · precesión' }, { max: 52, color: '#ff7a7a', txt: '~41 kyr · oblicuidad' },
  { max: 80, color: '#b48ead', txt: '52–80 kyr · mixta' }, { max: 125, color: '#3fd0ff', txt: '~100 kyr ★' }, { max: 1e9, color: '#24468f', txt: '> 125 kyr · lentos' }
];
const colorPeriodo = P => isFinite(P) ? BANDAS.find(b => P <= b.max).color : '#333';
function colorCorr(c) {
  const u = Math.max(0, Math.min(1, (c + 0.2) / 1.1)), st = [[10, 24, 44], [30, 78, 150], [63, 208, 255], [235, 250, 255]];
  const s = u * (st.length - 1), i = Math.min(st.length - 2, Math.floor(s)), f = s - i;
  return `rgb(${st[i].map((v, k) => Math.round(v + f * (st[i + 1][k] - v))).join(',')})`;
}
segmentado('segModo', v => { S4.modo = v; dibujarMapa(); });
function entrarMapa() { if (!S4.celdas) calcularMapa(); else dibujarMapa(); dibujarSeleccion(); calcularMPT(); }
function calcularMapa() {
  S4.celdas = []; const total = S4.rs.length * S4.As.length; let k = 0;
  const lote = () => {
    const fin = Math.min(total, k + 70);
    for (; k < fin; k++) {
      const i = k % S4.rs.length, j = Math.floor(k / S4.rs.length), r = S4.rs[i], A = S4.As[j];
      const s = Array.from(M.simularRapido({ r, A })).slice(100);
      S4.celdas.push({ i, j, r, A, P: An.periodoDominante(s, 1, 10, 400), c: An.pearson(s, S4.obs.slice(100)) });
    }
    $('barraMapa').style.width = (100 * k / total) + '%'; $('nSim').textContent = k.toLocaleString('es-BO');
    if (E.pantalla === 'mapa') dibujarMapa();
    if (k < total) setTimeout(lote, 0);
  };
  lote();
}
function geomMapa() { const cv = $('cvMapa'), w = cv.clientWidth, h = cv.clientHeight, m = { l: 44, r: 6, t: 8, b: 40 }; return { w, h, m, cw: (w - m.l - m.r) / S4.rs.length, ch: (h - m.t - m.b) / S4.As.length }; }
function dibujarMapa() {
  const { ctx } = Graf.preparar($('cvMapa')), { w, h, m, cw, ch } = geomMapa();
  S4.celdas.forEach(c => { ctx.fillStyle = S4.modo === 'periodo' ? colorPeriodo(c.P) : colorCorr(c.c); ctx.fillRect(m.l + c.i * cw, h - m.b - (c.j + 1) * ch, cw + 0.5, ch + 0.5); });
  const px = r => m.l + ((r - 0.3) / DR + 0.5) * cw, py = A => h - m.b - (A / DA + 0.5) * ch;
  ctx.font = '11.5px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(214,232,248,0.8)';
  ctx.textAlign = 'center'; [0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9].forEach(r => ctx.fillText(r.toFixed(1), px(r), h - m.b + 15));
  ctx.fillText('Escala temporal r  (más lento →)', m.l + (w - m.l - m.r) / 2, h - 5);
  ctx.textAlign = 'right'; [0, 0.5, 1, 1.5, 2].forEach(A => ctx.fillText(A.toFixed(1), m.l - 6, py(A) + 4));
  ctx.save(); ctx.translate(11, m.t + (h - m.t - m.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('Amplitud A', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(px(1), py(1)); ctx.rotate(Math.PI / 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-6, -6, 12, 12); ctx.restore();
  ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10; ctx.strokeRect(px(S4.sel.r) - cw / 2 - 1, py(S4.sel.A) - ch / 2 - 1, cw + 2, ch + 2); ctx.shadowBlur = 0;
  $('leyendaMapa').innerHTML = S4.modo === 'periodo'
    ? BANDAS.map(b => `<div><i style="background:${b.color};box-shadow:0 0 6px ${b.color}"></i>${b.txt}</div>`).join('')
    : [[0.9, 'r ≥ 0.9 · casi igual a LR04'], [0.6, 'r ≈ 0.6'], [0.3, 'r ≈ 0.3'], [-0.2, 'r ≤ −0.2']].map(([c, t]) => `<div><i style="background:${colorCorr(c)}"></i>${t}</div>`).join('');
}
function celdaEn(ev) {
  const rc = $('cvMapa').getBoundingClientRect(), { h, m, cw, ch } = geomMapa();
  const i = Math.floor((ev.clientX - rc.left - m.l) / cw), j = Math.floor((h - m.b - (ev.clientY - rc.top)) / ch);
  return S4.celdas?.find(c => c.i === i && c.j === j);
}
$('cvMapa').addEventListener('mousemove', ev => {
  const c = celdaEn(ev); if (!c) { tooltip.style.display = 'none'; return; }
  tooltip.style.display = 'block'; tooltip.style.left = ev.clientX + 14 + 'px'; tooltip.style.top = ev.clientY + 12 + 'px';
  tooltip.innerHTML = `r = <b>${c.r.toFixed(3)}</b> · A = <b>${c.A.toFixed(1)}</b><br>período dominante: <b>${fmtP(c.P)}</b><br>correlación con LR04: <b>${c.c.toFixed(3)}</b>`;
});
$('cvMapa').addEventListener('mouseleave', () => tooltip.style.display = 'none');
$('cvMapa').addEventListener('click', ev => { const c = celdaEn(ev); if (c) { S4.sel = { r: c.r, A: c.A }; dibujarMapa(); dibujarSeleccion(); } });
$('btnVerPlaneta').onclick = () => { Object.assign(E, { r: S4.sel.r, A: S4.sel.A, forz: 'real' }); sincronizarControles(); recalcPlaneta(); fijarTiempo(-1100); irA('planeta'); };
function dibujarSeleccion() {
  const s = Array.from(M.simularRapido(S4.sel)), m = s.slice(100), P = An.periodoDominante(m), c = An.pearson(m, S4.obs.slice(100)), col = colorPeriodo(P);
  $('selR').textContent = S4.sel.r.toFixed(3); $('selA').textContent = S4.sel.A.toFixed(2);
  $('selP').textContent = fmtP(P); $('selP').style.color = col; $('selP').style.borderColor = col;
  $('selC').textContent = c.toFixed(3);
  Graf.linea($('cvMapaSerie'), { series: [{ x: T1K, y: S4.obs, color: COL.blanco, ancho: 1 }, { x: T1K, y: s, color: col, ancho: 1.8, brillo: true }], xlim: [-1100, 0], ylim: [2.7, 5.5], invertirY: true, yLabel: 'δ¹⁸O', margen: { t: 4, b: 26 }, fmtX: v => fmtKyr(v) });
  const e = An.periodograma(m), o = An.periodograma(S4.obs.slice(100));
  Graf.linea($('cvMapaEsp'), { series: [{ x: o.periodo, y: o.potencia, color: COL.blanco, ancho: 1.1 }, { x: e.periodo, y: e.potencia, color: col, ancho: 2, brillo: true, relleno: true }], xlim: [10, 400], ylim: [0, 1.3], logX: true, xLabel: 'Período (kyr)', margen: { t: 4 }, etiquetas: picos(e, [23, 41, 100], col) });
}
/* ---- Transición del Pleistoceno Medio ---- */
const T2M = Array.from({ length: 2001 }, (_, j) => -2000 + j), OBS2M = T2M.map(t => M.LR04.en('tuned', t));
['slR0', 'slR1', 'slRa', 'slRb'].forEach(id => $(id).addEventListener('input', () => calcularMPT()));
function calcularMPT() {
  const r0 = +$('slR0').value, r1 = +$('slR1').value, Ta = -$('slRa').value; let Tb = -$('slRb').value; if (Tb <= Ta) Tb = Ta + 10;
  $('vR0').textContent = r0.toFixed(2); $('vR1').textContent = r1.toFixed(2); $('vRa').textContent = fmtKyr(Ta) + ' kyr'; $('vRb').textContent = fmtKyr(Tb) + ' kyr';
  const rFun = t => t <= Ta ? r0 : t >= Tb ? r1 : r0 + (r1 - r0) * (t - Ta) / (Tb - Ta);
  const s = Array.from(M.simularRapido({ rFun, t0: -2000 })), banda = [{ x0: Ta, x1: Tb, color: 'rgba(255,180,84,0.10)' }];
  Graf.linea($('cvMPT'), { series: [{ x: T2M, y: OBS2M, color: COL.blanco, ancho: 1 }, { x: T2M, y: s, color: COL.cian, ancho: 1.7, brillo: true }], xlim: [-2000, 0], ylim: [2.6, 5.6], invertirY: true, bandas: banda, yLabel: 'δ¹⁸O (‰)', margen: { t: 4 }, marcasX: [{ x: Ta, texto: fmtKyr(Ta) + ' kyr' }, { x: Tb, texto: fmtKyr(Tb) + ' kyr' }], ...ejeT });
  const cs = [], pm = [], po = [];
  for (let c = 150; c <= 1850; c += 10) { cs.push(-2000 + c); pm.push(An.periodoDominante(s.slice(c - 150, c + 150), 1, 15, 250)); po.push(An.periodoDominante(OBS2M.slice(c - 150, c + 150), 1, 15, 250)); }
  const media = (a, b) => { const v = pm.filter((_, i) => cs[i] >= a && cs[i] <= b); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
  const antes = media(-1850, Ta - 150), despues = media(Tb + 150, -150);
  const et = [];
  if (isFinite(antes)) et.push({ x: (Math.max(-1850, -2000 + 150) + Ta) / 2, y: antes, texto: 'Ritmo de ~' + Math.round(antes) + ' kyr', color: COL.ambar });
  et.push({ x: (Ta + Tb) / 2, y: 20, texto: 'Transición', color: COL.ambar });
  if (isFinite(despues)) et.push({ x: (Tb - 150) / 2, y: despues, texto: 'Ritmo de ~' + Math.round(despues) + ' kyr', color: COL.ambar });
  Graf.linea($('cvMPTper'), { series: [{ x: cs, y: po, color: COL.blanco, ancho: 1.3 }, { x: cs, y: pm, color: COL.ambar, ancho: 2.2, brillo: true }], xlim: [-2000, 0], ylim: [0, 170], bandas: banda, yLabel: 'Período (kyr)', margen: { t: 4, b: 22 }, fmtX: v => fmtKyr(v), etiquetas: et });
  $('notaMPT').innerHTML = `<svg><use href="#i-info"/></svg><span>Línea ámbar: período dominante del modelo en ventanas de 300 kyr (blanca: LR04). Con r ≈ 0,5 el clima se engancha a la oblicuidad; al hacerse más lento aparecen los ciclos de ~100 kyr.</span>`;
}

/* =====================================================================
   5. MÉTODOS NUMÉRICOS
   ===================================================================== */
const HS = [1, 0.5, 0.25, 0.1, 0.05, 0.025], MET = [['euler', 'Euler', COL.euler], ['heun', 'Heun', COL.heun], ['rk4', 'RK4', COL.rk4]];
['selH', 'selVentana', 'selForzM'].forEach(id => $(id).onchange = calcularMetodos);
function calcularMetodos() {
  const W = +$('selVentana').value, forz = $('selForzM').value, hSel = +$('selH').value, t0 = -1100, t1 = -1100 + W;
  const ref = M.simular({ metodo: 'rk4', h: 0.0025, t0, t1, forz, cada: 1 });
  const refFino = M.simular({ metodo: 'rk4', h: 0.0025, t0, t1, forz, cada: 0.25 });
  const errs = {};
  MET.forEach(([m]) => errs[m] = HS.map(h => {
    const s = M.simular({ metodo: m, h, t0, t1, forz, cada: 1 });
    if (s.divergio || s.y.length < ref.y.length) return NaN;
    let e = 0; for (let i = 0; i < ref.y.length; i++) e = Math.max(e, Math.abs(s.y[i] - ref.y[i])); return e;
  }));
  const sols = MET.map(([m, nom, col]) => ({ m, nom, col, s: M.simular({ metodo: m, h: hSel, t0, t1, forz, cada: Math.max(hSel, 0.25) }) }));
  Graf.linea($('cvMet'), {
    series: [{ x: refFino.t, y: refFino.y, color: '#ffffff', ancho: 4, alfa: 0.25 }, ...sols.map(q => ({ x: q.s.t, y: q.s.y, color: q.col, ancho: 2, brillo: true }))],
    xlim: [t0, t1], ylim: [-1.1, 0.9], yLabel: 'y(t)', margen: { t: 6 }, ...ejeT
  });
  const errT = sols.map(q => { const a = M.simular({ metodo: q.m, h: hSel, t0, t1, forz, cada: 1 }); return { x: ref.t, y: ref.y.map((v, i) => a.y[i] === undefined ? NaN : Math.max(1e-16, Math.abs(a.y[i] - v))), color: q.col, ancho: 1.8, brillo: true }; });
  Graf.linea($('cvMetErr'), { series: errT, xlim: [t0, t1], ylim: [1e-12, 10], logY: true, yLabel: 'Error', margen: { t: 6 }, ...ejeT });
  const orden = m => { const hs = [], es = []; HS.forEach((h, i) => { if (isFinite(errs[m][i]) && errs[m][i] > 1e-11 && h <= 0.5) { hs.push(h); es.push(errs[m][i]); } }); return An.pendienteLogLog(hs, es); };
  Graf.linea($('cvConv'), {
    series: MET.map(([m, nom, col]) => ({ x: HS, y: errs[m], color: col, ancho: 2, puntos: 4, brillo: true, nombre: `${nom} (p ≈ ${isFinite(orden(m)) ? orden(m).toFixed(1) : '—'})` })),
    xlim: [0.02, 1.2], ylim: [1e-11, 10], logX: true, logY: true, xLabel: 'Paso h (kyr)', yLabel: 'Error máx.', leyenda: 'derecha', margen: { t: 6 }
  });
  const fe = v => isFinite(v) ? v.toExponential(3).replace('e', 'e') : '<span class="rojo">✕ diverge</span>';
  $('tablaErr').innerHTML = `<tr><th>h (kyr)</th>${MET.map(q => `<th style="color:${q[2]}">${q[1]}</th>`).join('')}</tr>` +
    HS.map((h, i) => `<tr><td>${h.toFixed(h < 0.1 ? 3 : 2)}</td>${MET.map(([m]) => `<td>${fe(errs[m][i])}</td>`).join('')}</tr>`).join('') +
    `<tr class="orden"><td>Orden observado p</td>${MET.map(([m]) => `<td>${isFinite(orden(m)) ? orden(m).toFixed(2) : '—'}</td>`).join('')}</tr>`;
  const xmax = Math.max(...refFino.x.map(Math.abs)), lam = P0.kappa - P0.mu * xmax * xmax;
  $('panelEstabNum').innerHTML = `
    <div class="fila-dato"><span>|x| máximo en la ventana</span><b>${xmax.toFixed(3)}</b></div>
    <div class="fila-dato"><span>λ = κ − μx²</span><b class="caja">${lam.toFixed(3).replace('-', '−')}</b></div>
    <div class="fila-dato"><span>h máx. Euler / Heun ≈ 2/|λ|</span><b class="cian">${lam < 0 ? (2 / -lam).toFixed(2) + ' kyr' : '—'}</b></div>
    <div class="fila-dato"><span>h máx. RK4 ≈ 2.785/|λ|</span><b class="cian">${lam < 0 ? (2.785 / -lam).toFixed(2) + ' kyr' : '—'}</b></div>
    <p class="nota"><svg><use href="#i-info"/></svg>Estimación lineal local: la trayectoria pasa poco tiempo en la zona más rígida, así que el umbral real puede ser algo mayor.</p>`;
}

/* =====================================================================
   BUCLE DE ANIMACIÓN
   ===================================================================== */
function bucle() {
  if (E.play && (E.pantalla === 'planeta' || E.pantalla === 'orbita')) { fijarTiempo(E.t + E.vel); if (E.t >= 0) alternarPlay(); }
  if (E.pantalla === 'planeta' && (E.play || !S1.globoListo)) { dibujarGlobo(); S1.globoListo = IMG_TIERRA.complete; }
  if (E.pantalla === 'orbita') dibujarOrbita();
  if (E.pantalla === 'reloj') dibujarFase();
  requestAnimationFrame(bucle);
}
decorar(); sincronizarControles(); recalcPlaneta(); fijarTiempo(-20); requestAnimationFrame(bucle);
