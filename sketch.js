
// ATMOSFERA: dados reais de qualidade do ar (Open-Meteo, sem chave) → composição generativa.

const CITIES = [
  {n:'Lisboa',la:38.72,lo:-9.14},
  {n:'Nova Iorque',la:40.71,lo:-74.01}
];
const CLS = [[20,'Boa'],[40,'Razoável'],[60,'Moderada'],[80,'Fraca'],[100,'Muito fraca'],[1e9,'Extremamente fraca']];
const LBL = {pm25:'PM2.5',pm10:'PM10',no2:'NO₂',o3:'O₃',so2:'SO₂'};
const MAXV = {pm25:120,pm10:200,no2:80,o3:120,so2:20};
const PAL = {
  bom:[[120,225,235],[150,200,255],[190,170,255],[160,240,200],[255,190,220]],
  med:[[250,205,120],[238,150,165],[170,205,120],[242,170,90],[205,160,205]],
  mau:[[195,50,40],[232,110,40],[125,40,65],[95,62,42],[212,150,70]]
};
const N = 5000;
const pts = [];
let S = 0.2, TS = 0.2, PM = 0.1, TPM = 0.1, t = 0, gen = 0;

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
  $('src').textContent = 'Dados ao vivo · Open-Meteo · índice europeu, µg/m³ · ' + (time || '').replace('T', ' ');
  TS = Math.min(1, c.aqi / 110);
  TPM = Math.min(1, (c.pm25 || 0) / 80);
}
function escolherLocal(place) {
  document.querySelectorAll('#chips button').forEach(b => b.setAttribute('aria-pressed', b.dataset.n === place.n));
  $('city').textContent = place.n;
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
  for (let i = 0; i < N; i++) pts.push({ x: random(width), y: random(height), k: random(.3, 1), h: random() });
  background(8, 14, 22);
  buildChips();
  escolherLocal(CITIES[0]);
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); background(8, 14, 22); }

function curPal() {
  const o = [];
  for (let j = 0; j < 5; j++) {
    let a, b, u;
    if (S < .5) { a = PAL.bom[j]; b = PAL.med[j]; u = constrain((S - .2) / .3, 0, 1); }
    else { a = PAL.med[j]; b = PAL.mau[j]; u = constrain((S - .5) / .35, 0, 1); }
    o.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
  }
  return o;
}
function draw() {
  S += (TS - S) * .02; PM += (TPM - PM) * .02; t += .003 + S * .004;
  noStroke();
  fill(lerp(10, 38, S), lerp(16, 20, S), lerp(30, 16, S), 24);
  rect(0, 0, width, height);
  const pal = curPal();
  const ns = 0.0014 + S * 0.008, turb = 2 + S * 4.5, spd = 0.6 + S * 2.2;
  const n = Math.floor(1800 + S * (N - 1800) * (.6 + PM * .4));
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = noise(p.x * ns, p.y * ns, t) * TWO_PI * turb;
    let vx = cos(a) * spd * p.k, vy = sin(a) * spd * p.k;
    const dx = p.x - mouseX, dy = p.y - mouseY, d2 = dx * dx + dy * dy;
    if (d2 < 14000) { const d = Math.sqrt(d2) + 1, f = (1 - d2 / 14000) * 3; vx += dx / d * f; vy += dy / d * f; }
    if (S > .55) { vx += random(-1, 1) * (S - .5) * 2; vy += random(-1, 1) * (S - .5) * 2; }
    p.x += vx; p.y += vy;
    if (p.x < 0) p.x = width; else if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height; else if (p.y > height) p.y = 0;
    let v = noise(p.x * .0025, p.y * .0025, t * .5 + 10) * 1.6 + p.h * .35; v = ((v % 1) + 1) % 1;
    const f = v * 5, k = Math.floor(f) % 5, m = f - Math.floor(f), c0 = pal[k], c1 = pal[(k + 1) % 5];
    const g = random(-28, 28);
    stroke((c0[0] + (c1[0] - c0[0]) * m + g) * .82, (c0[1] + (c1[1] - c0[1]) * m + g) * .82, (c0[2] + (c1[2] - c0[2]) * m + g) * .82, 150);
    strokeWeight(1.1 + p.k * 1.1 + S * .8);
    point(p.x, p.y);
  }
}