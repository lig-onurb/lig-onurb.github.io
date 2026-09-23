/**
 * map.js — Construção cartográfica (Leaflet 1.9.4 + turf 6).
 * Datum SIRGAS 2000 (EPSG:4674). Bases com atribuição; overlays com clip pelo limite.
 */
import { estiloViario, iconeEquipamento, simboloSVG, popupTabela } from './symbology.js';

/**
 * Cria o mapa base com 4 fundos e controle de zoom reposicionado.
 * @returns {{map:L.Map, bases:Object, cinza:L.TileLayer, sat:L.TileLayer}}
 */
export function createBaseMap() {
  const map = L.map('map', {
    preferCanvas: true,
    zoomControl: false,
    minZoom: 11,
    maxZoom: 18
  }).setView([-23.6489, -46.8522], 12);
  L.control.zoom({ position: 'topright' }).addTo(map);

  const cinza = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri, HERE, Garmin, OpenStreetMap contributors | IBGE' }
  ).addTo(map);
  const osm = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' }
  );
  const relevo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { maxZoom: 17, attribution: '© OpenStreetMap contributors, SRTM | estilo: © OpenTopoMap (CC-BY-SA)' }
  );
  const sat = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri, Maxar, Earthstar Geographics' }
  );
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const bases = { 'Cinza (Esri)': cinza, 'OSM Padrão': osm, 'Relevo (OpenTopoMap)': relevo, 'Satélite (Esri)': sat };
  return { map, bases, cinza, sat };
}

/** Ícone circular legado (compat). @deprecated Usar iconeEquipamento. */
export function pin(cor, letra) {
  return iconeEquipamento(cor, letra);
}

/**
 * Limite municipal com halo + tabela de atributos; trava maxBounds.
 * @param {L.Map} map Mapa.
 * @param {object} geojson Limite.
 * @returns {L.GeoJSON}
 */
export function addLimite(map, geojson) {
  L.geoJSON(geojson, { style: { color: '#fff', weight: 9, fillOpacity: 0 } }).addTo(map);
  const limite = L.geoJSON(geojson, {
    style: { color: '#b89c00', weight: 3, fillOpacity: 0, dashArray: null }
  }).addTo(map);
  limite.eachLayer((layer) => {
    const p = layer.feature?.properties || {};
    layer.bindPopup(popupTabela(
      p.nome || 'Embu das Artes 3515004',
      [['Área', '70,264 km²'], ['Pop. 2022', '250.691 hab.'], ['Densidade', '3.561,05 hab./km²'], ['PIB pc 2023', 'R$ 68.971,96'], ['IDHM 2010', '0,735 — alto'], ['Datum', 'SIRGAS 2000']],
      'Fonte: IBGE Cidades@. Geometria simplificada de trabalho.'
    ));
  });
  const b = limite.getBounds();
  map.fitBounds(b);
  map.setMaxBounds(b.pad(0.25));
  return limite;
}

/**
 * Viário com hierarquia Bertin + rótulos nos eixos estruturantes (zoom ≥13).
 * @param {L.Map} map Mapa.
 * @param {object} geojson Linhas.
 * @returns {L.GeoJSON}
 */
export function addViario(map, geojson) {
  const viario = L.geoJSON(geojson, {
    style: (f) => estiloViario(f.properties),
    onEachFeature: (f, layer) => {
      const p = f.properties || {};
      let comp = '';
      try {
        if (window.turf) comp = `${window.turf.length(f, { units: 'kilometers' }).toFixed(2)} km (esquemático)`;
      } catch { /* sem turf */ }
      layer.bindPopup(popupTabela(
        p.nome || 'Via',
        [['Função', p.descricao || p.classe || '—'], ['Comprimento', comp], ['Classe', p.classe || '—'], ['Precisão', p.precisao || 'eixo esquemático']],
        `Fonte: ${p.fonte || 'vetorização interpretativa'} · SIRGAS 2000`
      ));
      if (p.nome?.includes('BR-116') || p.nome?.includes('Rodoanel')) {
        layer.bindTooltip(p.nome, { permanent: false, direction: 'top', className: 'via-label', sticky: true });
      }
      layer.on('mouseover', () => layer.setStyle({ weight: (estiloViario(p).weight || 4) + 2 }));
      layer.on('mouseout', () => viario.resetStyle(layer));
    }
  }).addTo(map);

  const rotular = () => {
    const z = map.getZoom();
    viario.eachLayer((l) => {
      const tt = l.getTooltip();
      if (!tt) return;
      const nome = l.feature?.properties?.nome || '';
      const estruturante = nome.includes('BR-116') || nome.includes('Rodoanel');
      if (estruturante && z >= 13) l.openTooltip();
      else l.closeTooltip();
    });
  };
  map.on('zoomend', rotular);
  rotular();
  return viario;
}

/**
 * Equipamentos com símbolo por forma + highlight.
 * @param {L.Map} map Mapa.
 * @param {object} geojson Pontos.
 * @returns {L.GeoJSON}
 */
export function addEquipamentos(map, geojson) {
  return L.geoJSON(geojson, {
    pointToLayer: (f, latlng) => {
      const p = f.properties || {};
      const m = L.marker(latlng, { icon: iconeEquipamento(p.cor, p.letra), title: p.nome, keyboard: true });
      m.bindPopup(popupTabela(
        `${p.letra || '•'} — ${p.nome}`,
        [['Categoria', p.categoria || '—'], ['Precisão', p.precisao || '—']],
        `Fonte: ${p.fonte || 'atlas original'} · SIRGAS 2000`
      ));
      m.on('mouseover', () => m.openPopup());
      return m;
    }
  }).addTo(map);
}

/**
 * Tipologia clipada pelo limite (turf.intersect) + área calculada.
 * @param {L.Map} map Mapa.
 * @param {object} geojson Zonas.
 * @param {object} limiteGeojson Limite para recorte.
 * @returns {{tip:L.LayerGroup, hSul:L.Polygon, mista:L.Polygon}}
 */
export function addTip(map, geojson, limiteGeojson) {
  const limPoly = limiteGeojson?.features?.[0];
  const polys = geojson.features.map((f) => {
    const p = f.properties || {};
    let geom = f.geometry;
    let areaTxt = '';
    try {
      if (window.turf && limPoly) {
        const clip = window.turf.intersect(window.turf.featureCollection([window.turf.feature(geom), limPoly]));
        if (clip) geom = clip.geometry;
      }
      if (window.turf) areaTxt = `${window.turf.area(window.turf.feature(geom)).toFixed(0)} m² (interseção c/ limite)`;
    } catch { /* fallback sem clip */ }
    const latlngs = geom.type === 'Polygon'
      ? geom.coordinates[0].map(([lng, lat]) => [lat, lng])
      : f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    return L.polygon(latlngs, {
      color: p.cor_borda, fillColor: p.cor_preenchimento, fillOpacity: 0.28, weight: 2, dashArray: '6 4'
    }).bindPopup(popupTabela(
      p.nome,
      [['Hipótese', p.hipotese || p.popup || '—'], ['Área clipada', areaTxt], ['Método', p.metodo || 'modelo interpretativo']],
      'Não corresponde a zoneamento legal — ver Plano Diretor.'
    ));
  });
  const tip = L.layerGroup(polys).addTo(map);
  return { tip, hSul: polys[0], mista: polys[1] };
}

/**
 * Assentamentos precários com losango + nota ética.
 * @param {L.Map} map Mapa.
 * @param {object} geojson Pontos.
 * @returns {L.GeoJSON}
 */
export function addIrregulares(map, geojson) {
  return L.geoJSON(geojson, {
    pointToLayer: (f, latlng) => {
      const nome = f.properties?.nome || 'Irregular';
      const m = L.marker(latlng, {
        title: nome, keyboard: true,
        icon: L.divIcon({ className: '', html: `<div class="fav-wrap">${simboloSVG('diamond', '#d32f2f')}</div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
      });
      m.bindPopup(popupTabela(
        nome,
        [['Tipo', f.properties?.tipo || 'ponto indicativo'], ['Precisão', f.properties?.precisao || 'aproximada']],
        'Evitar estigmatização — cruzar com aglomerados subnormais IBGE/CadÚnico.'
      ));
      return m;
    }
  }).addTo(map);
}

/**
 * Controle de camadas (bases + overlays) padrão universitário.
 * @param {L.Map} map Mapa.
 * @param {object} bases Dicionário de TileLayers.
 * @param {object} overlays Dicionário de overlays.
 * @returns {L.Control.Layers}
 */
export function addLayerControl(map, bases, overlays) {
  return L.control.layers(bases, overlays, { position: 'topright', collapsed: true }).addTo(map);
}
