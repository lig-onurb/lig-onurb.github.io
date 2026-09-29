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
 * Carrega um GeoJSON via fetch com erro tipado, timeout e validação mínima.
 * @param {string} path Caminho do arquivo.
 * @param {number} [timeoutMs=9000] Timeout.
 * @returns {Promise<object>} GeoJSON parseado.
 * @throws {Error} Se a resposta HTTP não for ok ou o GeoJSON for inválido.
 */
export async function loadGeoJSON(path, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(path, { signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error(`Tempo esgotado ao carregar ${path}`);
    throw new Error(`Falha de rede ao carregar ${path}: ${e.message}`);
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: HTTP ${res.status}`);
  const j = await res.json();
  if (j?.type !== 'FeatureCollection' || !Array.isArray(j.features)) {
    throw new Error(`GeoJSON inválido em ${path}: esperado FeatureCollection`);
  }
  return j;
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
