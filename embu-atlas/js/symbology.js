/**
 * symbology.js — Semiologia gráfica (J. Bertin) do Atlas de Embu das Artes.
 * Hierarquia visual: cor + espessura + tracejado para o viário;
 * forma + cor para equipamentos; borda tracejada + transparência para tipologia.
 */

/** Hierarquia do sistema viário por `hierarquia` (fonte única de verdade visual). */
export const VIAS_ESTILO = {
  rodovia: { color: '#D81B06', weight: 6, opacity: 0.96 },
  anel: { color: '#7B1FA2', weight: 5.5, dashArray: '12 5', opacity: 0.95 },
  arterial: { color: '#F57C00', weight: 4.5, opacity: 0.95 },
  coletora: { color: '#1565C0', weight: 3.5, opacity: 0.92 },
  vicinal: { color: '#2E9E44', weight: 3, opacity: 0.9 },
  cultural: { color: '#C2185B', weight: 3, dashArray: '2 5', opacity: 0.92 }
};

/**
 * Resolve o estilo de uma via a partir de properties.
 * @param {object} props properties do GeoJSON.
 * @returns {object} Estilo Leaflet.
 */
export function estiloViario(props = {}) {
  if (props.hierarquia && VIAS_ESTILO[props.hierarquia]) return VIAS_ESTILO[props.hierarquia];
  // Compat: nomes antigos / sem hierarquia
  const nome = props.nome || '';
  if (nome.includes('BR-116')) return VIAS_ESTILO.rodovia;
  if (nome.includes('Rodoanel')) return VIAS_ESTILO.anel;
  if (nome.includes('Centro Histórico')) return VIAS_ESTILO.cultural;
  if (/Yazbek|Rotary|Marcelino|Salvador|Hélio|Hercílio/i.test(nome)) return VIAS_ESTILO.arterial;
  if (/Medina|Jorge de Souza|João Paulo|Campo Limpo|Moraes|Veredas/i.test(nome)) return VIAS_ESTILO.coletora;
  if (/Orquid|Keiichi|Taji/i.test(nome)) return VIAS_ESTILO.vicinal;
  return VIAS_ESTILO.coletora;
}

/** Formas por categoria de equipamento (variável visual FORMA). */
export const EQUIP_FORMA = {
  C: 'circle', T: 'star', L: 'triangle', E: 'square', S: 'cross'
};

/**
 * Gera SVG de símbolo por forma.
 * @param {string} forma circle|square|triangle|star|cross|diamond
 * @param {string} cor Cor de preenchimento.
 * @returns {string} SVG inline.
 */
export function simboloSVG(forma, cor) {
  const s = `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">`;
  const e = `</svg>`;
  switch (forma) {
    case 'square':
      return `${s}<rect x="4" y="4" width="14" height="14" fill="${cor}" stroke="#fff" stroke-width="2"/>${e}`;
    case 'triangle':
      return `${s}<path d="M11 3 L19 18 L3 18 Z" fill="${cor}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>${e}`;
    case 'star':
      return `${s}<path d="M11 2l2.2 4.9 5.3.6-3.9 3.6 1 5.2-4.6-2.6-4.6 2.6 1-5.2L3.5 7.5l5.3-.6z" fill="${cor}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>${e}`;
    case 'cross':
      return `${s}<path d="M8 3h6v5h5v6h-5v5H8v-5H3V8h5z" fill="${cor}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>${e}`;
    case 'diamond':
      return `${s}<path d="M11 2 L20 11 L11 20 L2 11 Z" fill="${cor}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>${e}`;
    case 'circle':
    default:
      return `${s}<circle cx="11" cy="11" r="8" fill="${cor}" stroke="#fff" stroke-width="2"/>${e}`;
  }
}

/**
 * Ícone Leaflet combinando forma + letra da categoria.
 * @param {string} cor Cor de fundo.
 * @param {string} letra C|T|L|E|S.
 * @returns {L.DivIcon}
 */
export function iconeEquipamento(cor, letra) {
  const forma = EQUIP_FORMA[letra] || 'circle';
  return L.divIcon({
    className: 'equip-ico',
    html: `<div class="equip-wrap" style="--c:${cor}">${simboloSVG(forma, cor)}<span>${letra}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

/**
 * Escapa HTML para popups/títulos.
 * @param {unknown} v Valor.
 * @returns {string}
 */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Monta popup tabular acadêmico (título + linhas atributo/valor + rodapé fonte).
 * @param {string} titulo Título em negrito.
 * @param {Array<[string,string]>} linhas Pares [rótulo, valor].
 * @param {string} [rodape] Fonte/precisão/datum.
 * @returns {string} HTML.
 */
export function popupTabela(titulo, linhas = [], rodape = '') {
  const rows = linhas.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('');
  return `<div class="popup-tabela"><strong>${esc(titulo)}</strong><table>${rows}</table>${rodape ? `<small>${rodape}</small>` : ''}</div>`;
}
