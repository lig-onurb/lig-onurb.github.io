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

  const nEq = document.getElementById('n-eq');
  if (nEq) nEq.textContent = `(${equip.getLayers().length})`;

  const dl = document.getElementById('lugares');
  const q = document.getElementById('q');
  const equipList = [];
  equip.eachLayer((layer) => {
    const nome = layer.feature?.properties?.nome;
    if (nome) {
      equipList.push({ nome, latlng: layer.getLatLng() });
      dl.appendChild(option(nome));
    }
  });
  viario.eachLayer((layer) => {
    const nome = layer.feature?.properties?.nome;
    if (nome) dl.appendChild(option(nome));
  });
  q.addEventListener('change', (ev) => {
    const alvo = ev.target.value.trim();
    const foundEq = equipList.find((e) => e.nome === alvo);
    if (foundEq) {
      map.flyTo(foundEq.latlng, 15, { duration: 1.2 });
      return;
    }
    viario.eachLayer((layer) => {
      if (layer.feature?.properties?.nome === alvo && layer.getBounds) {
        map.flyToBounds(layer.getBounds(), { padding: [30, 30] });
      }
    });
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

  document.getElementById('op').addEventListener('input', (e) => {
    const v = e.target.value / 100;
    hSul.setStyle({ fillOpacity: v });
    mista.setStyle({ fillOpacity: v });
  });

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
  map.on('locationerror', () => alert('Não foi possível obter sua localização. Verifique a permissão do navegador.'));

  map.on('mousemove', (e) => {
    document.getElementById('coord').textContent =
      `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)} · SIRGAS 2000 · z${map.getZoom()}`;
  });
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
