// ATMOSFERA: transforma a qualidade do ar de uma cidade numa composição de partículas.
// Fonte dos dados: Open-Meteo / Copernicus CAMS.

// ===== 1. CONFIGURAÇÃO =====
const CIDADES = [
  { nome: 'Lisboa',      lat: 38.72, lon: -9.14 },
  { nome: 'Nova Iorque', lat: 40.71, lon: -74.01 },
  { nome: 'Nova Deli',   lat: 28.61, lon: 77.21 }
];
const CLASSES = [[20, 'Boa'], [40, 'Razoável'], [60, 'Moderada'], [80, 'Fraca'], [100, 'Muito fraca'], [Infinity, 'Extremamente fraca']];
const POLUENTES = { pm25: 'PM2.5', pm10: 'PM10', no2: 'NO₂', o3: 'O₃', so2: 'SO₂' };
const MAXIMO = { pm25: 120, pm10: 200, no2: 80, o3: 120, so2: 20 };   // valor que enche a barra

// Três paletas de 5 cores (R, G, B): uma para cada estado do ar
const PALETAS = {
  bom:   [[246,172,192], [252,196,210], [238,150,182], [250,214,224], [226,138,172]],  // rosas
  medio: [[250,200,100], [246,160,70],  [252,224,130], [240,130,60],  [250,184,90]],   // laranjas e amarelos
  mau:   [[40,80,172],   [204,40,52],   [64,112,204],  [150,30,62],   [30,52,124]]     // azuis e vermelhos
};
const MAX_PARTICULAS = 9000;
const MIN_PARTICULAS = 6000;

// ===== 2. ESTADO (o que vai mudando) =====
let poluicao = 0.2, poluicaoAlvo = 0.2;   // 0 = ar limpo, 1 = ar muito poluído
let pm = 0.1, pmAlvo = 0.1;               // quantidade de PM2.5 (também de 0 a 1)
let tempo = 0, limpeza = 0, lugarAtual, fundo;
const particulas = [];

const $ = id => document.getElementById(id);

// ===== 3. DADOS: pedir à Open-Meteo =====
async function carregarDados(lugar) {
  lugarAtual = lugar;
  $('src').textContent = 'A obter dados…';
  try {
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lugar.lat + '&longitude=' + lugar.lon +
      '&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide';
    const resposta = await fetch(url);
    const dados = (await resposta.json()).current;
    if (lugar === lugarAtual) mostrar(lugar.nome, dados);   // ignora respostas antigas
  } catch (erro) {
    $('src').textContent = 'Não foi possível obter dados (' + erro.message + ').';
  }
}

// ===== 4. TEXTO NO ECRÃ + ligação dados → visual =====
function mostrar(nome, d) {
  const indice = d.european_aqi;
  const valores = { pm25: d.pm2_5, pm10: d.pm10, no2: d.nitrogen_dioxide, o3: d.ozone, so2: d.sulphur_dioxide };

  $('city').textContent = nome;
  $('aqi').textContent = Math.round(indice);
  $('cls').textContent = 'Qualidade do ar: ' + CLASSES.find(c => indice < c[0])[1].toLowerCase();
  $('grid').innerHTML = Object.keys(POLUENTES).map(k =>
    '<div class="m">' + POLUENTES[k] + '<b>' + Math.round(valores[k]) + '</b><div class="bar"><i style="width:' +
    Math.min(100, valores[k] / MAXIMO[k] * 100) + '%"></i></div></div>').join('');
  $('src').textContent = 'Fonte: Open-Meteo / Copernicus CAMS · índice europeu, µg/m³ · ' + d.time.replace('T', ' ');

  // O PASSO CENTRAL: o índice vira um número entre 0 e 1 que controla todo o visual
  poluicaoAlvo = Math.min(1, indice / 90);       // 90 ou mais = máximo
  pmAlvo = Math.min(1, valores.pm25 / 60);
}

function escolherLugar(lugar) {
  document.querySelectorAll('#chips button').forEach(b => b.setAttribute('aria-pressed', b.dataset.n === lugar.nome));
  $('city').textContent = lugar.nome;
  limpeza = 70;            // durante 70 imagens, apaga mais depressa o desenho anterior
  carregarDados(lugar);
}

// ===== 5. CORES =====
// Mistura as 3 paletas conforme a poluição: bom → médio → mau
function paletaAtual() {
  const c = constrain((poluicao - .25) / .5, 0, 1);   // faixa estreita, para a mudança ser evidente
  return PALETAS.bom.map((_, j) => {
    const [de, para, u] = c < .5 ? [PALETAS.bom[j], PALETAS.medio[j], c * 2] : [PALETAS.medio[j], PALETAS.mau[j], (c - .5) * 2];
    return de.map((v, i) => v + (para[i] - v) * u);
  });
}
// Escolhe uma cor da paleta: v (0 a 1) percorre as 5 cores, misturando as vizinhas
function cor(paleta, v) {
  const f = v * 5, k = Math.floor(f) % 5, m = f - Math.floor(f);
  return paleta[k].map((x, i) => x + (paleta[(k + 1) % 5][i] - x) * m);
}

// ===== 6. DESENHO =====
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noiseDetail(2, 0.5);
  fundo = createGraphics(40, 24);          // imagem minúscula que será esticada para o fundo
  fundo.pixelDensity(1);
  for (let i = 0; i < MAX_PARTICULAS; i++) {
    particulas.push({ x: random(width), y: random(height), forca: random(.3, 1), tom: random(), grao: random(-34, 34) });
  }
  background(244, 238, 230);
  CIDADES.forEach(c => {                   // um botão por cidade
    const b = document.createElement('button');
    b.textContent = c.nome; b.dataset.n = c.nome;
    b.onclick = () => escolherLugar(c);
    $('chips').appendChild(b);
  });
  escolherLugar(CIDADES[0]);
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); background(244, 238, 230); }

function draw() {
  // 6.1 Suaviza a mudança entre cidades (aproxima 2% por imagem)
  poluicao += (poluicaoAlvo - poluicao) * .02;
  pm += (pmAlvo - pm) * .02;
  tempo += .003 + poluicao * .004;
  const paleta = paletaAtual();

  // 6.2 Fundo: campo de cor suave que se move devagar
  fundo.loadPixels();
  const forcaCor = .22 + poluicao * .12;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 40; x++) {
    const c = cor(paleta, noise(x * .07 + 20, y * .09 + 20, tempo * .5));
    const i = (y * 40 + x) * 4;
    fundo.pixels[i]     = lerp(lerp(246, 214, poluicao), c[0], forcaCor);
    fundo.pixels[i + 1] = lerp(lerp(240, 220, poluicao), c[1], forcaCor);
    fundo.pixels[i + 2] = lerp(lerp(232, 232, poluicao), c[2], forcaCor);
    fundo.pixels[i + 3] = 255;
  }
  fundo.updatePixels();
  tint(255, limpeza > 0 ? 70 : 16);        // fundo semitransparente: apaga o rasto aos poucos
  image(fundo, 0, 0, width, height);
  noTint();
  if (limpeza > 0) limpeza--;

  // 6.3 Partículas: mais poluição = mais partículas, mais turbulência, mais velocidade
  const escala = 0.0012 + poluicao * 0.008;          // quão "irregular" é o fluxo
  const voltas = 1.6 + poluicao * 4.5;               // quanto as partículas giram
  const velocidade = 0.5 + poluicao * 2.2;
  const quantas = Math.floor(MIN_PARTICULAS + poluicao * (MAX_PARTICULAS - MIN_PARTICULAS) * (.6 + pm * .4));
  const ctx = drawingContext;

  for (let i = 0; i < quantas; i++) {
    const p = particulas[i];

    // direção dada pelo ruído de Perlin (campo de fluxo)
    const ruido = noise(p.x * escala, p.y * escala, tempo);
    const angulo = ruido * TWO_PI * voltas;
    let vx = Math.cos(angulo) * velocidade * p.forca;
    let vy = Math.sin(angulo) * velocidade * p.forca;

    // o rato afasta as partículas
    const dx = p.x - mouseX, dy = p.y - mouseY, d2 = dx * dx + dy * dy;
    if (d2 < 14000) { const d = Math.sqrt(d2) + 1, f = (1 - d2 / 14000) * 3; vx += dx / d * f; vy += dy / d * f; }

    // ar muito poluído: movimento tremido
    if (poluicao > .5) { vx += random(-1, 1) * (poluicao - .45) * 2; vy += random(-1, 1) * (poluicao - .45) * 2; }

    // move e reaparece do lado oposto ao sair do ecrã
    p.x = (p.x + vx + width) % width;
    p.y = (p.y + vy + height) % height;

    // cor: depende do ruído e do "tom" próprio; o grão dá o efeito granulado
    const c = cor(paleta, (ruido * 1.4 + p.tom * .45) % 1);
    ctx.fillStyle = 'rgba(' + (c[0] + p.grao) + ',' + (c[1] + p.grao) + ',' + (c[2] + p.grao) + ',.75)';
    const tamanho = 1.2 + p.forca * 1.1 + poluicao * .6;
    ctx.fillRect(p.x, p.y, tamanho, tamanho);
  }
}