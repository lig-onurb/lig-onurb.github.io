/**
 * data.js — Camada de acesso a dados do Atlas de Embu das Artes.
 * Padrão acadêmico: fontes, datum e limitações declarados nos GeoJSON (ver `data/*.geojson` > `metadata`).
 * Sistema de referência: SIRGAS 2000 (EPSG:4674), coordenadas geográficas decimais.
 */

/** Caminhos relativos à `index.html` (fetch resolve a partir da página). */
export const DATA_PATHS = {
  limite: 'data/limite.geojson',
  viario: 'data/viario.geojson',
  equipamentos: 'data/equipamentos.geojson',
  irregulares: 'data/pontos_irregulares.geojson',
  tipologia: 'data/zonas_tipologia.geojson'
};

/**
 * Carrega um GeoJSON via fetch com erro tipado.
 * @param {string} path Caminho do arquivo.
 * @returns {Promise<object>} GeoJSON parseado.
 * @throws {Error} Se a resposta HTTP não for ok.
 */
export async function loadGeoJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Carrega todas as camadas em paralelo.
 * @param {object} [paths=DATA_PATHS] Dicionário de caminhos.
 * @returns {Promise<{limite:object, viario:object, equipamentos:object, irregulares:object, tipologia:object}>}
 */
export async function loadAllData(paths = DATA_PATHS) {
  const [limite, viario, equipamentos, irregulares, tipologia] = await Promise.all([
    loadGeoJSON(paths.limite),
    loadGeoJSON(paths.viario),
    loadGeoJSON(paths.equipamentos),
    loadGeoJSON(paths.irregulares),
    loadGeoJSON(paths.tipologia)
  ]);
  return { limite, viario, equipamentos, irregulares, tipologia };
}
