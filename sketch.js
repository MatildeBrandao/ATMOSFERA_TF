// ATMOSFERA: dados reais de qualidade do ar (Open-Meteo, sem chave) → composição generativa.
// Ar bom = cores quentes e pastel. Ar mau = cores frias e escuras.
// Fonte dos dados: Open-Meteo / Copernicus CAMS.

const CITIES = [
  {n:'Lisboa',la:38.72,lo:-9.14},
  {n:'Nova Iorque',la:40.71,lo:-74.01}
];
const CLS = [[20,'Boa'],[40,'Razoável'],[60,'Moderada'],[80,'Fraca'],[100,'Muito fraca'],[1e9,'Extremamente fraca']];
const LBL = {pm25:'PM2.5',pm10:'PM10',no2:'NO₂',o3:'O₃',so2:'SO₂'};
const MAXV = {pm25:120,pm10:200,no2:80,o3:120,so2:20};
const PAL = {
  bom:[[246,172,168],[250,205,140],[192,215,128],[244,150,108],[200,170,225]],
  med:[[250,200,130],[200,212,140],[140,190,205],[226,160,190],[176,168,218]],
  mau:[[62,96,160],[108,84,172],[48,140,172],[36,56,112],[124,146,194]]
};
const N = 9000;      // máximo de partículas
const MIN_N = 6000;  // mínimo de partículas
const BINS = 64;     // níveis de cor
const GRAIN = [-34, -12, 12, 34];
const BW = 40, BH = 24; // resolução do campo de cor do fundo
const pts = [];
let S = 0.2, TS = 0.2, PM = 0.1, TPM = 0.1, t = 0, gen = 0, wipe = 0, bgG;

const $ = id => document.getElementById(id);
window.addEventListener('error', e => { const el = $('src'); if (el) el.textContent = 'Erro no código: ' + e.message; });

// ---------- dados ----------
async function getJSON(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
function estimateAqi(pm25) { // só se a API não devolver o índice
  const bp = [[0,0],[10,20],[20,40],[25,60],[50,80],[75,100],[150,200]];
  for (let i = 1; i < bp.length; i++) if (pm25 <= bp[i][0]) {
    const [x0,y0] = bp[i-1], [x1,y1] = bp[i];
    return y0 + (y1 - y0) * (pm25 - x0) / (x1 - x0);
  }
  return 200;
}
async function loadAir(place) {
  const id = ++gen;
  $('src').textContent = 'A obter dados…';
  try {
    const d = await getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + place.la +
      '&longitude=' + place.lo + '&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide');
    if (id !== gen) return;
    const c = d.current;
    if (!c) throw new Error('resposta sem dados');
    const data = { n: place.n, pm25: c.pm2_5, pm10: c.pm10, no2: c.nitrogen_dioxide, o3: c.ozone, so2: c.sulphur_dioxide,
      aqi: c.european_aqi != null ? c.european_aqi : (c.pm2_5 != null ? estimateAqi(c.pm2_5) : null) };
    if (data.aqi == null) throw new Error('sem dados para esta localização');
    show(data, c.time);
  } catch (e) {
    if (id !== gen) return;
    $('src').textContent = 'Não foi possível obter dados (' + e.message + '). Verifica a ligação e tenta outra vez.';
  }
}

// ---------- interface ----------
function classify(a) { return CLS.find(c => a < c[0])[1]; }
function fmt(v) { return v == null ? '–' : Math.round(v); }
function show(c, time) {
  $('city').textContent = c.n;
  $('aqi').textContent = Math.round(c.aqi);
  $('cls').textContent = 'Qualidade do ar: ' + classify(c.aqi).toLowerCase();
  $('grid').innerHTML = Object.keys(LBL).map(k =>
    '<div class="m">' + LBL[k] + '<b>' + fmt(c[k]) + '</b><div class="bar"><i style="width:' +
    Math.min(100, (c[k] || 0) / MAXV[k] * 100) + '%"></i></div></div>').join('');
  $('src').textContent = 'Fonte: Open-Meteo / Copernicus CAMS · índice europeu, µg/m³ · ' + (time || '').replace('T', ' ');
  TS = Math.min(1, c.aqi / 90);            // escala sensível: 90 já é o máximo visual
  TPM = Math.min(1, (c.pm25 || 0) / 60);
}
function escolherLocal(place) {
  document.querySelectorAll('#chips button').forEach(b => b.setAttribute('aria-pressed', b.dataset.n === place.n));
  $('city').textContent = place.n;
  wipe = 70; // apaga mais depressa a textura anterior
  loadAir(place);
}
function buildChips() {
  const el = $('chips');
  CITIES.forEach(c => {
    const b = document.createElement('button');
    b.textContent = c.n; b.dataset.n = c.n;
    b.onclick = () => escolherLocal(c);
    el.appendChild(b);
  });
}

// ---------- visual ----------
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noiseDetail(2, 0.5);
  bgG = createGraphics(BW, BH);
  bgG.pixelDensity(1);
  for (let i = 0; i < N; i++) pts.push({ x: random(width), y: random(height), k: random(.3, 1), h: random(), g: Math.floor(random(4)) });
  background(244, 238, 230);
  buildChips();
  escolherLocal(CITIES[0]);
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); background(244, 238, 230); }

function curPal() {
  const C = constrain((S - .25) / .5, 0, 1); // faixa estreita: quente → frio
  const o = [];
  for (let j = 0; j < 5; j++) {
    let a, b, u;
    if (C < .5) { a = PAL.bom[j]; b = PAL.med[j]; u = C * 2; }
    else { a = PAL.med[j]; b = PAL.mau[j]; u = (C - .5) * 2; }
    o.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
  }
  return o;
}
function buildStyles(pal) { // cores pré-calculadas: BINS níveis × 4 graus de grão
  const st = [];
  for (let b = 0; b < BINS; b++) {
    const f = b / BINS * 5, k = Math.floor(f) % 5, m = f - Math.floor(f), c0 = pal[k], c1 = pal[(k + 1) % 5];
    const r = c0[0] + (c1[0] - c0[0]) * m, g = c0[1] + (c1[1] - c0[1]) * m, bl = c0[2] + (c1[2] - c0[2]) * m;
    for (let q = 0; q < 4; q++) {
      const o = GRAIN[q];
      st.push('rgba(' + Math.round(r + o) + ',' + Math.round(g + o) + ',' + Math.round(bl + o) + ',.75)');
    }
  }
  return st;
}
function updateBg(pal) { // campo de cor suave que se move devagar por baixo das partículas
  bgG.loadPixels();
  const mix = .22 + S * .12;
  const base = [lerp(246, 214, S), lerp(240, 220, S), lerp(232, 232, S)];
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const v = noise(x * .07 + 20, y * .09 + 20, t * .5);
    const f = constrain((v - .2) / .6, 0, .999) * 4, k = Math.floor(f), m = f - k;
    const c0 = pal[k], c1 = pal[k + 1], i = (y * BW + x) * 4;
    bgG.pixels[i]     = base[0] * (1 - mix) + (c0[0] + (c1[0] - c0[0]) * m) * mix;
    bgG.pixels[i + 1] = base[1] * (1 - mix) + (c0[1] + (c1[1] - c0[1]) * m) * mix;
    bgG.pixels[i + 2] = base[2] * (1 - mix) + (c0[2] + (c1[2] - c0[2]) * m) * mix;
    bgG.pixels[i + 3] = 255;
  }
  bgG.updatePixels();
}
function draw() {
  S += (TS - S) * .02; PM += (TPM - PM) * .02; t += .003 + S * .004;
  const pal = curPal();
  updateBg(pal);
  tint(255, wipe > 0 ? 70 : 16);
  image(bgG, 0, 0, width, height);
  noTint();
  if (wipe > 0) wipe--;
  const styles = buildStyles(pal);
  const ctx = drawingContext;
  const ns = 0.0012 + S * 0.008, turb = 1.6 + S * 4.5, spd = 0.5 + S * 2.2;
  const n = Math.floor(MIN_N + S * (N - MIN_N) * (.6 + PM * .4));
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const nv = noise(p.x * ns, p.y * ns, t);
    const a = nv * TWO_PI * turb;
    let vx = Math.cos(a) * spd * p.k, vy = Math.sin(a) * spd * p.k;
    const dx = p.x - mouseX, dy = p.y - mouseY, d2 = dx * dx + dy * dy;
    if (d2 < 14000) { const d = Math.sqrt(d2) + 1, f = (1 - d2 / 14000) * 3; vx += dx / d * f; vy += dy / d * f; }
    if (S > .5) { vx += (Math.random() * 2 - 1) * (S - .45) * 2; vy += (Math.random() * 2 - 1) * (S - .45) * 2; }
    p.x += vx; p.y += vy;
    if (p.x < 0) p.x = width; else if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height; else if (p.y > height) p.y = 0;
    let v = nv * 1.4 + p.h * .45; v = v - Math.floor(v);
    ctx.fillStyle = styles[Math.floor(v * BINS) * 4 + p.g];
    const sz = 1.2 + p.k * 1.1 + S * .6;
    ctx.fillRect(p.x, p.y, sz, sz);
  }
}
