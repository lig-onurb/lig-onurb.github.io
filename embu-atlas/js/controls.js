/**
 * controls.js — Painel + sincronia bidirecional com L.control.layers.
 * Busca toponímica, opacidade da tipologia, navegação, coordenadas SIRGAS 2000.
 */

/**
 * @param {L.Map} map Mapa.
 * @param {object} layers {limite, viario, equip, tip, fav, hSul, mista}.
 * @param {object} base {cinza, sat, bases}.
 */
export function initControls(map, layers, base) {
  const { limite, viario, equip, tip, fav, hSul, mista } = layers;
  const { cinza, sat, bases } = base;
  const coordEl = document.getElementById('coord');

  const nEq = document.getElementById('n-eq');
  if (nEq) nEq.textContent = `(${equip.getLayers().length})`;
  const nVia = document.getElementById('n-via');
  if (nVia) {
    const totalKm = (viario.toGeoJSON?.().features || []).reduce((s, f) => s + (Number(f.properties?.comp_km) || 0), 0);
    nVia.textContent = `(${viario.getLayers().length} eixos · ${totalKm.toFixed(0).replace('.', ',')} km)`;
  }

  const dl = document.getElementById('lugares');
  const q = document.getElementById('q');
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const equipList = [];
  const viaList = [];
  equip.eachLayer((layer) => {
    const nome = layer.feature?.properties?.nome;
    if (nome) {
      equipList.push({ nome, n: norm(nome), latlng: layer.getLatLng(), layer });
      dl.appendChild(option(nome));
    }
  });
  viario.eachLayer((layer) => {
    const nome = layer.feature?.properties?.nome;
    if (nome && !viaList.some((v) => v.nome === nome)) {
      viaList.push({ nome, n: norm(nome), layer });
      dl.appendChild(option(nome));
    }
  });
  const buscar = (texto) => {
    const alvo = norm(texto);
    if (!alvo) return false;
    const fEq = equipList.find((e) => e.n === alvo) || equipList.find((e) => e.n.includes(alvo));
    if (fEq) {
      map.flyTo(fEq.latlng, 15, { duration: 1.1 });
      setTimeout(() => fEq.layer.openPopup(), 1200);
      return true;
    }
    const fVia = viaList.find((v) => v.n === alvo) || viaList.find((v) => v.n.includes(alvo));
    if (fVia?.layer?.getBounds) {
      map.flyToBounds(fVia.layer.getBounds(), { padding: [40, 40], maxZoom: 15 });
      setTimeout(() => fVia.layer.openPopup(), 900);
      return true;
    }
    return false;
  };
  q.addEventListener('change', (ev) => {
    if (!buscar(ev.target.value) && coordEl) {
      coordEl.textContent = `Topônimo não encontrado: “${ev.target.value.trim()}”. Tente “Yazbek”, “Rodoanel”, “Feira”…`;
    }
  });
  q.addEventListener('input', (ev) => {
    // Sugestão incremental: completa datalist já cobre; busca sob Enter via change
    if (ev.target.value === '' && coordEl) coordEl.textContent = `${map.getCenter().lat.toFixed(5)},${map.getCenter().lng.toFixed(5)} · SIRGAS 2000 · z${map.getZoom()}`;
  });
  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { q.value = ''; q.blur(); }
    if (ev.key === 'Enter') buscar(q.value);
  });

  const mapa = [
    ['c-lim', limite], ['c-via', viario], ['c-eq', equip], ['c-tip', tip], ['c-fav', fav]
  ];
  mapa.forEach(([id, layer]) => bindCheckbox(id, layer, map));

  // Sincronia: LayerControl (topright) <-> checkboxes do painel
  map.on('overlayadd', (e) => {
    const item = mapa.find(([, l]) => l === e.layer);
    if (item) document.getElementById(item[0]).checked = true;
  });
  map.on('overlayremove', (e) => {
    const item = mapa.find(([, l]) => l === e.layer);
    if (item) document.getElementById(item[0]).checked = false;
  });

  const op = document.getElementById('op');
  const opVal = document.getElementById('op-val');
  const aplicarOp = (pct) => {
    const v = Math.min(80, Math.max(10, Number(pct))) / 100;
    [hSul, mista].forEach((ly) => { try { ly.setStyle({ fillOpacity: v }); } catch { /* grupo */ } });
    tip.eachLayer?.((ly) => { try { ly.setStyle({ fillOpacity: v }); } catch { /* noop */ } });
    if (opVal) opVal.textContent = `${Math.round(v * 100)}%`;
    try { localStorage.setItem('embu:opTip', String(Math.round(v * 100))); } catch { /* noop */ }
  };
  if (op) {
    try {
      const salvo = Number(localStorage.getItem('embu:opTip'));
      if (Number.isFinite(salvo) && salvo >= 10 && salvo <= 80) op.value = String(salvo);
    } catch { /* noop */ }
    aplicarOp(op.value);
    op.addEventListener('input', (e) => aplicarOp(e.target.value));
  }

  // Alterna Cinza <-> Satélite mantendo as demais bases do control acessíveis
  const temSatelite = () => map.hasLayer(sat);
  const btnSat = document.getElementById('b-sat');
  const rotulo = () => { btnSat.textContent = temSatelite() ? 'Rua' : 'Satélite'; };
  btnSat.onclick = () => {
    if (temSatelite()) {
      map.removeLayer(sat);
      if (bases && bases['Cinza (Esri)']) bases['Cinza (Esri)'].addTo(map);
      else cinza.addTo(map);
    } else {
      Object.values(bases || {}).forEach((b) => { if (map.hasLayer(b)) map.removeLayer(b); });
      sat.addTo(map);
    }
    rotulo();
  };
  map.on('baselayerchange', rotulo);

  document.getElementById('b-reset').onclick = () => map.fitBounds(limite.getBounds());
  document.getElementById('b-loc').onclick = () => map.locate({ setView: true, maxZoom: 15 });
  map.on('locationerror', () => {
    if (coordEl) coordEl.textContent = 'Localização indisponível — verifique a permissão do navegador.';
  });
  map.on('locationfound', (e) => {
    if (coordEl) coordEl.textContent = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)} · você está aqui · z${map.getZoom()}`;
  });

  const mostraCoord = (latlng) => {
    if (!coordEl) return;
    coordEl.textContent = `${latlng.lat.toFixed(5)},${latlng.lng.toFixed(5)} · SIRGAS 2000 · z${map.getZoom()}`;
  };
  map.on('mousemove', (e) => mostraCoord(e.latlng));
  map.on('click', (e) => mostraCoord(e.latlng));
  map.on('zoomend', () => mostraCoord(map.getCenter()));
}

/**
 * @param {string} value Valor da opção.
 * @returns {HTMLOptionElement}
 */
function option(value) {
  const o = document.createElement('option');
  o.value = value;
  return o;
}

/**
 * @param {string} id ID do checkbox.
 * @param {L.Layer} layer Camada Leaflet.
 * @param {L.Map} map Mapa.
 */
function bindCheckbox(id, layer, map) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', (e) => {
    if (e.target.checked) layer.addTo(map);
    else map.removeLayer(layer);
  });
}
