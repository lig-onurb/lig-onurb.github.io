/**
 * legend.js — Legenda dinâmica no mapa + norte formal (padrão cartográfico).
 */
import { simboloSVG, VIAS_ESTILO } from './symbology.js';

/**
 * Adiciona legenda colapsável com contadores e zoom por camada.
 * @param {L.Map} map Mapa.
 * @param {object} layers {limite, viario, equip, tip, fav}
 * @param {object} stats {nEq, nVias, nFav, kmVias, areaTip}
 * @returns {L.Control}
 */
export function addLegend(map, layers, stats = {}) {
  const Legend = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const via = (hier, label) => {
        const e = VIAS_ESTILO[hier] || {};
        const dash = e.dashArray ? `border-top-style:dashed;` : ``;
        return `<span class="leg-via" style="background:${e.color || '#333'};${dash}"></span>${label}`;
      };
      const div = L.DomUtil.create('div', 'leaflet-control-legend');
      div.setAttribute('role', 'complementary');
      div.setAttribute('aria-label', 'Legenda do mapa');
      div.innerHTML = `
        <button class="leg-toggle" aria-expanded="true" title="Recolher legenda">Legenda −</button>
        <div class="leg-body">
          <p class="leg-title">Embu das Artes 3515004 · SIRGAS 2000</p>
          <ul>
            <li data-fit="limite"><span class="leg-linha-amarela"></span>Limite municipal</li>
            <li data-fit="viario">${via('rodovia', 'BR-116 Régis — logística')}</li>
            <li>${via('anel', 'Rodoanel N–S (SP-021)')}</li>
            <li>${via('arterial', 'Arteriais: Yazbek / Rotary / Marcelino / Leone / Hélio')}</li>
            <li>${via('coletora', 'Coletoras: Medina / J. Souza / J. Paulo I / Veredas / Moraes')}</li>
            <li>${via('vicinal', 'Vicinais sul: Orquidófilos / Keiichi / Taji')}</li>
            <li>${via('cultural', 'Centro Histórico — cultural')}</li>
            <li data-fit="equip">${simboloSVG('circle', '#1976d2')}Equipamentos (${stats.nEq ?? '—'}) · C/T/L/E/S por forma</li>
            <li data-fit="tip"><span class="leg-zona hz"></span>Horizontal sul/mananciais</li>
            <li><span class="leg-zona mx"></span>Mista/vertical BR-116 ${stats.areaTip ? `· ${stats.areaTip}` : ''}</li>
            <li data-fit="fav">${simboloSVG('diamond', '#d32f2f')}Precários (${stats.nFav ?? '—'}) — indicativo</li>
          </ul>
          <p class="leg-stats">${stats.nVias ?? '—'} eixos · ${stats.kmVias ?? '—'} (OSM clipado) · Escala dinâmica</p>
          <p class="leg-stats">Base OSM © contribuidores (ODbL)</p>
        </div>`;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      const btn = div.querySelector('.leg-toggle');
      const body = div.querySelector('.leg-body');
      const alternar = () => {
        const aberto = body.style.display !== 'none';
        body.style.display = aberto ? 'none' : '';
        btn.textContent = aberto ? 'Legenda +' : 'Legenda −';
        btn.setAttribute('aria-expanded', String(!aberto));
      };
      btn.onclick = alternar;
      btn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } };
      div.querySelectorAll('[data-fit]').forEach((li) => {
        li.style.cursor = 'pointer';
        li.title = 'Clique para enquadrar a camada';
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'button');
        const ir = () => {
          const l = layers[li.dataset.fit];
          if (!l) return;
          if (l.getBounds) map.flyToBounds(l.getBounds(), { padding: [30, 30], maxZoom: 15 });
          else if (l.getLatLng) map.flyTo(l.getLatLng(), 15);
        };
        li.onclick = ir;
        li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } };
      });
      return div;
    }
  });
  return new Legend().addTo(map);
}

/**
 * Norte formal com rosa-dos-ventos SVG (substitui/complementa div.norte).
 * @param {L.Map} map Mapa.
 * @returns {L.Control}
 */
export function addNorth(map) {
  const North = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-control-north');
      div.innerHTML = `<svg width="38" height="38" viewBox="0 0 38 38" role="img" aria-label="Norte"><circle cx="19" cy="19" r="17" fill="#fff" stroke="#0f2a44"/><path d="M19 5 L23 20 L19 17 L15 20 Z" fill="#0f2a44"/><text x="19" y="31" text-anchor="middle" font-size="11" font-weight="800" fill="#0f2a44">N</text></svg>`;
      L.DomEvent.disableClickPropagation(div);
      return div;
    }
  });
  return new North().addTo(map);
}
