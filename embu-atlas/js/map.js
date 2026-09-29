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
    const area = p.area_km2 ? `${String(p.area_km2).replace('.', ',')} km²` : '70,264 km²';
    const pop = p.pop_2022 ? `${Number(p.pop_2022).toLocaleString('pt-BR')} hab.` : '250.691 hab.';
    layer.bindPopup(popupTabela(
      p.nome || 'Embu das Artes 3515004',
      [['Área', area], ['Pop. 2022', pop], ['Densidade', p.densidade_2022 ? `${String(p.densidade_2022).replace('.', ',')} hab./km²` : '3.561,05 hab./km²'], ['PIB pc 2023', p.pib_pc_2023 ? `R$ ${Number(p.pib_pc_2023).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 68.971,96'], ['IDHM 2010', p.idhm_2010 ? `${String(p.idhm_2010).replace('.', ',')} — alto` : '0,735 — alto'], ['Datum', 'SIRGAS 2000']],
      `Fonte: IBGE Cidades@. ${p.fonte || 'Geometria simplificada de trabalho.'}`
    ));
  });
  const b = limite.getBounds();
  map.fitBounds(b);
  map.setMaxBounds(b.pad(0.25));
  return limite;
}

/** Vias com rótulo permanente por hierarquia. */
const ROTULO_MIN_ZOOM = { rodovia: 11, anel: 11, arterial: 13, coletora: 14, vicinal: 15, cultural: 14 };

/**
 * Viário com hierarquia Bertin + rótulos por hierarquia (LineString e MultiLineString).
 * @param {L.Map} map Mapa.
 * @param {object} geojson Linhas.
 * @returns {L.GeoJSON}
 */
export function addViario(map, geojson) {
  const viario = L.geoJSON(geojson, {
    style: (f) => ({ ...estiloViario(f.properties), interactive: true }),
    onEachFeature: (f, layer) => {
      const p = f.properties || {};
      let comp = p.comp_km != null ? `${String(p.comp_km).replace('.', ',')} km (clipado ao limite)` : '';
      if (!comp) {
        try {
          if (window.turf) comp = `${window.turf.length(f, { units: 'kilometers' }).toFixed(2).replace('.', ',')} km (esquemático)`;
        } catch { /* sem turf */ }
      }
      const trechos = p.n_trechos > 1 ? ` · ${p.n_trechos} trechos` : '';
      layer.bindPopup(popupTabela(
        p.nome || 'Via',
        [['Função', p.descricao || p.classe || '—'], ['Comprimento', comp + trechos], ['Classe', p.classe || '—'], ['Precisão', p.precisao || 'eixo OSM clipado']],
        `Fonte: ${p.fonte || 'OpenStreetMap (ODbL)'} · SIRGAS 2000`
      ));
      layer.bindTooltip(p.nome || 'Via', { permanent: false, direction: 'top', className: 'via-label', sticky: true });
      layer.on('mouseover', (e) => {
        if (e.originalEvent?.pointerType === 'touch') return;
        layer.setStyle({ weight: (estiloViario(p).weight || 4) + 2 });
      });
      layer.on('mouseout', () => viario.resetStyle(layer));
      layer.on('focus', () => layer.setStyle({ weight: (estiloViario(p).weight || 4) + 2 }));
      layer.on('blur', () => viario.resetStyle(layer));
    }
  }).addTo(map);

  const rotular = () => {
    const z = map.getZoom();
    // No celular, menos rótulos simultâneos (telas estreitas poluem rápido)
    const mob = window.innerWidth < 700;
    viario.eachLayer((l) => {
      const tt = l.getTooltip();
      if (!tt) return;
      const hier = l.feature?.properties?.hierarquia || 'coletora';
      const min = (ROTULO_MIN_ZOOM[hier] ?? 14) + (mob && (hier === 'arterial' || hier === 'coletora' || hier === 'cultural') ? 1 : 0);
      if (z >= min) l.openTooltip();
      else l.closeTooltip();
    });
  };
  map.on('zoomend moveend', rotular);
  rotular();
  return viario;
}

/**
 * Equipamentos com símbolo por forma (sem popup em hover; click/teclado apenas).
 * @param {L.Map} map Mapa.
 * @param {object} geojson Pontos.
 * @returns {L.GeoJSON}
 */
export function addEquipamentos(map, geojson) {
  return L.geoJSON(geojson, {
    pointToLayer: (f, latlng) => {
      const p = f.properties || {};
      const m = L.marker(latlng, { icon: iconeEquipamento(p.cor, p.letra), title: p.nome, keyboard: true, alt: p.nome });
      m.bindPopup(popupTabela(
        `${p.letra || '•'} — ${p.nome}`,
        [['Categoria', p.categoria || '—'], ['Precisão', p.precisao || '—']],
        `Fonte: ${p.fonte || 'atlas original'} · SIRGAS 2000`
      ));
      return m;
    }
  }).addTo(map);
}

/** Converte anel [lng,lat] p/ Leaflet, com validação. */
function anelParaLatLng(anel) {
  return (anel || []).filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])).map(([lng, lat]) => [lat, lng]);
}

/**
 * Tipologia com suporte a Polygon/MultiPolygon + clip opcional pelo limite.
 * @param {L.Map} map Mapa.
 * @param {object} geojson Zonas.
 * @param {object} limiteGeojson Limite para recorte.
 * @returns {{tip:L.LayerGroup, hSul:L.Polygon, mista:L.Polygon}}
 */
export function addTip(map, geojson, limiteGeojson) {
  const limPoly = limiteGeojson?.features?.[0];
  const polys = [];
  const porNome = {};
  (geojson.features || []).forEach((f) => {
    const p = f.properties || {};
    let geom = f.geometry;
    let areaTxt = '';
    try {
      if (window.turf && limPoly && window.turf.intersect) {
        const clip = window.turf.intersect(window.turf.featureCollection([window.turf.feature(geom), limPoly]));
        if (clip?.geometry) geom = clip.geometry;
      }
      if (window.turf) {
        const a = window.turf.area(window.turf.feature(geom));
        if (Number.isFinite(a)) areaTxt = `${a.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} m² (interseção c/ limite)`;
      }
    } catch { /* fallback sem clip */ }
    let latlngs = [];
    if (geom?.type === 'Polygon') latlngs = [anelParaLatLng(geom.coordinates[0])];
    else if (geom?.type === 'MultiPolygon') latlngs = geom.coordinates.map((poly) => anelParaLatLng(poly[0]));
    else latlngs = [anelParaLatLng(f.geometry?.coordinates?.[0])];
    latlngs.filter((a) => a.length >= 3).forEach((anel) => {
      const poly = L.polygon(anel, {
        color: p.cor_borda, fillColor: p.cor_preenchimento, fillOpacity: 0.28, weight: 2, dashArray: '6 4'
      }).bindPopup(popupTabela(
        p.nome,
        [['Hipótese', p.hipotese || p.popup || '—'], ['Área clipada', areaTxt], ['Método', p.metodo || 'modelo interpretativo']],
        'Não corresponde a zoneamento legal — ver Plano Diretor.'
      ));
      polys.push(poly);
      porNome[p.nome] = poly;
    });
  });
  const tip = L.layerGroup(polys).addTo(map);
  const hSul = porNome['Zona horizontal sul — mananciais'] || polys[0];
  const mista = porNome['Zona mista/vertical — eixo BR-116'] || polys[1] || polys[0];
  return { tip, hSul, mista };
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
