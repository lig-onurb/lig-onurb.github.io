/**
 * app.js — Ponto de entrada do Atlas de Embu das Artes (nível universitário).
 * Abas: Mapa | Perfil Topográfico (lazy, valores estáticos SRTM90m versionados).
 * Requer HTTP local por uso de fetch (ex.: `python3 -m http.server 8000`).
 */
import { loadAllData } from './data.js';
import { createBaseMap, addLimite, addViario, addEquipamentos, addTip, addIrregulares, addLayerControl } from './map.js';
import { addLegend, addNorth } from './legend.js';
import { initControls } from './controls.js';
import { initProfile } from './profile.js';

let mapPrincipal = null;
let perfilPronto = false;

function stats(data, layers) {
  let kmVias = '—';
  let areaTip = '';
  try {
    if (window.turf) {
      const km = data.viario.features.reduce((s, f) => s + window.turf.length(f, { units: 'kilometers' }), 0);
      kmVias = `${km.toFixed(1)} km`;
      const m2 = data.tipologia.features.reduce((s, f) => s + window.turf.area(f), 0);
      areaTip = `· ${(m2 / 1e6).toFixed(1)} km²`;
    }
  } catch { /* sem turf */ }
  return {
    nEq: layers.equip.getLayers().length,
    nVias: data.viario.features.length,
    nFav: layers.fav.getLayers().length,
    kmVias, areaTip
  };
}

function initTabs() {
  const tabMapa = document.getElementById('tab-mapa');
  const tabPerfil = document.getElementById('tab-perfil');
  const wrap = document.getElementById('wrap');
  const view = document.getElementById('view-perfil');
  if (!tabMapa || !tabPerfil || !view) return;

  const mostrar = async (qual) => {
    const ehMapa = qual === 'mapa';
    tabMapa.setAttribute('aria-selected', String(ehMapa));
    tabPerfil.setAttribute('aria-selected', String(!ehMapa));
    wrap.hidden = !ehMapa;
    view.hidden = ehMapa;
    const acoes = document.querySelector('.topo-acoes');
    if (acoes) acoes.style.display = ehMapa ? '' : 'none';
    if (ehMapa) {
      if (mapPrincipal) setTimeout(() => mapPrincipal.invalidateSize(), 60);
    } else if (!perfilPronto && mapPrincipal) {
      perfilPronto = true;
      try {
        await initProfile(mapPrincipal);
        setTimeout(() => window.__perfilMini?.invalidateSize(), 60);
      } catch (err) {
        console.error(err);
        document.getElementById('perfil-stats').innerHTML =
          `<strong>Erro ao carregar perfil.</strong> ${err.message}`;
      }
    } else {
      setTimeout(() => window.__perfilMini?.invalidateSize(), 60);
    }
  };
  tabMapa.onclick = () => mostrar('mapa');
  tabPerfil.onclick = () => mostrar('perfil');
}

async function init() {
  initTabs();
  const base = createBaseMap();
  const { map, bases } = base;
  mapPrincipal = map;
  try {
    const data = await loadAllData();
    const limite = addLimite(map, data.limite);
    const viario = addViario(map, data.viario);
    const equip = addEquipamentos(map, data.equipamentos);
    const { tip, hSul, mista } = addTip(map, data.tipologia, data.limite);
    const fav = addIrregulares(map, data.irregulares);
    const layers = { limite, viario, equip, tip, fav, hSul, mista };
    const s = stats(data, layers);
    addLayerControl(map, bases, {
      'Limite municipal': limite,
      'Viário estruturante': viario,
      'Equipamentos': equip,
      'Tipologia habitacional': tip,
      'Precários/irregulares': fav
    });
    addLegend(map, layers, s);
    addNorth(map);
    initControls(map, layers, base);
  } catch (err) {
    console.error(err);
    const panel = document.getElementById('panel');
    const div = document.createElement('div');
    div.id = 'erro';
    div.setAttribute('role', 'alert');
    div.innerHTML = `<strong>Erro ao carregar dados.</strong><br>${err.message}<br><small>Sirva a pasta via HTTP (ex.: <code>python3 -m http.server 8000</code>) em vez de abrir por <code>file://</code>.</small>`;
    panel.prepend(div);
  }
}

document.addEventListener('DOMContentLoaded', init);
