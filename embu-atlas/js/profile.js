/**
 * profile.js — Perfil topográfico N-S Centro–Mananciais (valores estáticos versionados).
 * Fontes: data/transectos.geojson (linha) + data/perfil_n_s.geojson (60 amostras SRTM90m).
 * Gráfico em SVG vanilla (sem dependências); hover sincroniza mini-mapa e mapa principal.
 */

let perfilPromise = null;

/** Formata número no padrão pt-BR (vírgula decimal). */
const br = (v, c = 2) => Number(v).toFixed(c).replace('.', ',');

/**
 * Inicializa a aba de perfil (idempotente; nova tentativa se falhar).
 * @param {L.Map} mapPrincipal Mapa da aba principal (para linha do transecto + marcador móvel).
 * @returns {Promise<void>}
 */
export function initProfile(mapPrincipal) {
  if (!perfilPromise) perfilPromise = montar(mapPrincipal).catch((e) => { perfilPromise = null; throw e; });
  return perfilPromise;
}

/**
 * Monta mini-mapa, gráfico, stats e tabela.
 * @param {L.Map} mapPrincipal Mapa principal.
 */
async function montar(mapPrincipal) {
  const [tr, pf] = await Promise.all([
    fetch('data/transectos.geojson').then((r) => { if (!r.ok) throw new Error('transectos HTTP ' + r.status); return r.json(); }),
    fetch('data/perfil_n_s.geojson').then((r) => { if (!r.ok) throw new Error('perfil_n_s HTTP ' + r.status); return r.json(); })
  ]);
  const amostras = pf.features
    .map((f) => ({
      seq: f.properties.seq,
      dist: f.properties.dist_km,
      ele: f.properties.ele_m,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0]
    }))
    .sort((a, b) => a.seq - b.seq)
    .filter((a) => a.ele != null);
  const meta = pf.metadata || {};

  // Linha do transecto no mapa principal
  const linhaLatLng = tr.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const linha = L.polyline(linhaLatLng, { color: '#0f2a44', weight: 4, dashArray: '8 5' })
    .bindPopup('<b>Transecto N-S Centro–Mananciais</b><br><small>Ver aba Perfil Topográfico</small>')
    .addTo(mapPrincipal);
  const movel = L.circleMarker(linhaLatLng[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#b71c1c', fillOpacity: 1 }).addTo(mapPrincipal);

  // Mini-mapa
  const mini = L.map('mini-map', { zoomControl: false, attributionControl: true }).setView([-23.669, -46.831], 12);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: '© Esri, HERE, Garmin, OpenStreetMap contributors | IBGE'
  }).addTo(mini);
  L.polyline(linhaLatLng, { color: '#b71c1c', weight: 4 }).addTo(mini);
  L.marker(linhaLatLng[0], { title: 'Centro (0 km)' }).addTo(mini).bindPopup('Centro — 0 km');
  L.marker(linhaLatLng[linhaLatLng.length - 1], { title: 'Mananciais' }).addTo(mini).bindPopup('Sul/mananciais');
  mini.fitBounds(L.latLngBounds(linhaLatLng).pad(0.2));
  L.control.scale({ imperial: false }).addTo(mini);
  const miniMovel = L.circleMarker(linhaLatLng[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#b71c1c', fillOpacity: 1 }).addTo(mini);

  // Estatísticas (decl. máx sobre série suavizada p/ não amplificar ruído do SRTM90m)
  const dist = amostras[amostras.length - 1].dist;
  const eles = amostras.map((a) => a.ele);
  const zmin = Math.min(...eles), zmax = Math.max(...eles);
  const suav = eles.map((_, i) => {
    const w = eles.slice(Math.max(0, i - 1), i + 2);
    return w.reduce((s, v) => s + v, 0) / w.length;
  });
  let dmax = 0;
  for (let i = 1; i < amostras.length; i++) {
    const dd = Math.abs(suav[i] - suav[i - 1]) / Math.max(1e-6, (amostras[i].dist - amostras[i - 1].dist) * 1000) * 100;
    if (dd > dmax) dmax = dd;
  }
  const dmed = Math.abs(eles[eles.length - 1] - eles[0]) / (dist * 1000) * 100;
  document.getElementById('perfil-stats').innerHTML =
    `<table class="stats-tabela"><tbody>
      <tr><th>Extensão</th><td>${br(dist)} km</td><th>Cota mín–máx</th><td>${br(zmin, 0)}–${br(zmax, 0)} m</td></tr>
      <tr><th>Δh</th><td>${br(zmax - zmin, 0)} m</td><th>Decl. ponta a ponta</th><td>${br(dmed, 1)}%</td></tr>
      <tr><th>Decl. máx (trecho ~105 m)</th><td>${br(dmax, 1)}%</td><th>Exagero vertical</th><td><span id="ev">…</span></td></tr>
    </tbody></table>
    <p class="fonte">Fonte: ${meta.fonte_elevacao || 'SRTM90m'} · vertical ${meta.datum_vertical || 'EGM96'} · ` +
    `${amostras.length} amostras · linha esquemática, não usar para obra.</p>`;

  const coordBR = (a) => `${a.lat.toFixed(5).replace('.', ',')} · ${a.lng.toFixed(5).replace('.', ',')}`;
  desenharGrafico(amostras, { onHover: (a) => {
    movel.setLatLng([a.lat, a.lng]);
    miniMovel.setLatLng([a.lat, a.lng]);
    document.getElementById('perfil-leitura').textContent =
      `km ${br(a.dist)} · ${br(a.ele, 0)} m · ${coordBR(a)}`;
  }});

  // Tabela acessível + CSV (padrão Excel-BR: separador ; e vírgula decimal, com BOM)
  const tb = document.getElementById('perfil-tbody');
  tb.innerHTML = amostras.map((a) =>
    `<tr><td>${a.seq}</td><td>${br(a.dist)}</td><td>${br(a.ele, 0)}</td><td>${coordBR(a)}</td></tr>`
  ).join('');
  document.getElementById('b-csv').onclick = () => {
    const csv = 'seq;dist_km;lat;lng;ele_m\n' + amostras.map((a) =>
      `${a.seq};${a.dist.toFixed(4).replace('.', ',')};${a.lat.toFixed(6).replace('.', ',')};${a.lng.toFixed(6).replace('.', ',')};${a.ele}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'perfil_n_s_embu.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Expõe para invalidateSize no chaveamento de abas
  window.__perfilMini = mini;
}

/**
 * Renderiza o gráfico SVG com área, linha, marcos Centro/Sul e hover/teclado/touch.
 * @param {Array} amostras [{seq, dist, ele}]
 * @param {object} opts {onHover}
 */
function desenharGrafico(amostras, opts = {}) {
  const svg = document.getElementById('chart');
  const W = 760, H = 290, P = { l: 56, r: 14, t: 16, b: 48 };
  const xs = amostras.map((a) => a.dist), ys = amostras.map((a) => a.ele);
  const x0 = 0, x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(5, (y1 - y0) * 0.15);
  y0 -= pad; y1 += pad;
  const X = (v) => P.l + (v - x0) / (x1 - x0) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const ev = ((W - P.l - P.r) / (x1 * 1000)) / ((H - P.t - P.b) / (y1 - y0));
  const evEl = document.getElementById('ev');
  if (evEl) evEl.textContent = `≈ ${ev.toFixed(1).replace('.', ',')}×`;

  const ticksX = 6, ticksY = 5;
  let grid = '';
  for (let i = 0; i <= ticksX; i++) {
    const v = x0 + (x1 - x0) * i / ticksX, x = X(v);
    grid += `<line x1="${x}" y1="${P.t}" x2="${x}" y2="${H - P.b}" class="grid"/><text x="${x}" y="${H - 28}" class="tick">${br(v, 1)}</text>`;
  }
  for (let i = 0; i <= ticksY; i++) {
    const v = y0 + (y1 - y0) * i / ticksY, y = Y(v);
    grid += `<line x1="${P.l}" y1="${y}" x2="${W - P.r}" y2="${y}" class="grid"/><text x="${P.l - 6}" y="${y + 4}" class="tick end">${br(v, 0)}</text>`;
  }
  const pts = amostras.map((a) => `${X(a.dist).toFixed(1)},${Y(a.ele).toFixed(1)}`).join(' ');
  const area = `${P.l},${H - P.b} ${pts} ${W - P.r},${H - P.b}`;
  const xEnd = X(x1);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('tabindex', '0');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Perfil topográfico de 0 a ${br(x1)} km, cotas entre ${br(Math.min(...ys), 0)} e ${br(Math.max(...ys), 0)} metros. Use as setas do teclado para percorrer.`);
  svg.innerHTML = `${grid}
    <polygon points="${area}" class="area"/>
    <polyline points="${pts}" class="line"/>
    <line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${H - P.b}" class="marco"/>
    <text x="${P.l + 4}" y="${P.t + 12}" class="marco-lab">Centro · 0 km</text>
    <line x1="${xEnd}" y1="${P.t}" x2="${xEnd}" y2="${H - P.b}" class="marco"/>
    <text x="${xEnd - 4}" y="${P.t + 12}" class="marco-lab end">Sul · ${br(x1)} km</text>
    <text x="${P.l}" y="${H - 8}" class="axis">Distância (km) — Centro → Sul</text>
    <text x="14" y="${(H - P.b + P.t) / 2}" class="axis-y" transform="rotate(-90 14 ${(H - P.b + P.t) / 2})">Elevação (m, EGM96)</text>
    <circle id="chart-dot" r="5" class="dot"/>
    <rect id="chart-hit" x="${P.l}" y="${P.t}" width="${W - P.l - P.r}" height="${H - P.t - P.b}" class="hit"/>`;
  const dot = svg.querySelector('#chart-dot');
  const hit = svg.querySelector('#chart-hit');
  let idx = 0;
  const selecionar = (i) => {
    idx = Math.max(0, Math.min(amostras.length - 1, i));
    const a = amostras[idx];
    dot.setAttribute('cx', X(a.dist));
    dot.setAttribute('cy', Y(a.ele));
    dot.style.display = 'block';
    opts.onHover?.(a);
  };
  const porPixel = (clientX) => {
    const r = svg.getBoundingClientRect();
    const px = (clientX - r.left) * (W / r.width);
    let best = 0, bd = Infinity;
    amostras.forEach((a, i) => {
      const d = Math.abs(X(a.dist) - px);
      if (d < bd) { bd = d; best = i; }
    });
    selecionar(best);
  };
  hit.addEventListener('mousemove', (e) => porPixel(e.clientX));
  hit.addEventListener('click', (e) => porPixel(e.clientX));
  hit.addEventListener('touchstart', (e) => porPixel(e.touches[0].clientX), { passive: true });
  hit.addEventListener('touchmove', (e) => porPixel(e.touches[0].clientX), { passive: true });
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { selecionar(idx + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { selecionar(idx - 1); e.preventDefault(); }
    else if (e.key === 'Home') { selecionar(0); e.preventDefault(); }
    else if (e.key === 'End') { selecionar(amostras.length - 1); e.preventDefault(); }
  });
  selecionar(0);
}
