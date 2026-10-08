import { fetchText, sanitizeFileName } from '../lib/utils.js'
import { downloadAudio } from './youtube.js'

/**
 * @typedef {Object} SpotifyMetadata
 * @property {string} title Título de la pista.
 * @property {string} artist Artista principal.
 */

/**
 * Extrae tipo e id de una URL de Spotify.
 * @param {string} url URL de open.spotify.com.
 * @returns {{type: 'track'|'album'|'playlist', id: string}|null}
 */
export function parseSpotifyUrl(url) {
  const match = String(url ?? '').match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/([A-Za-z0-9]+)/i)
  if (!match) return null
  return { type: /** @type {'track'|'album'|'playlist'} */ (match[1].toLowerCase()), id: match[2] }
}

/**
 * Busca recursivamente el objeto de pista dentro del JSON de la página embed.
 * @param {any} node Nodo del árbol JSON.
 * @returns {any|null} Objeto con title/name y artists.
 */
function findTrackEntity(node) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findTrackEntity(item)
      if (found) return found
    }
    return null
  }
  if (Array.isArray(node.artists) && node.artists.length && (node.title || node.name)) return node
  for (const value of Object.values(node)) {
    const found = findTrackEntity(value)
    if (found) return found
  }
  return null
}

/**
 * Obtiene título y artista de una pista de Spotify a partir de su página embed (sin API key).
 * @param {string} url URL de open.spotify.com/track/...
 * @returns {Promise<SpotifyMetadata>}
 */
export async function fetchSpotifyMetadata(url) {
  const parsed = parseSpotifyUrl(url)
  if (!parsed) throw new Error('URL de Spotify no válida. Ejemplo: https://open.spotify.com/track/…')
  if (parsed.type !== 'track') {
    throw new Error('Solo puedo descargar pistas individuales (open.spotify.com/track/…), no álbumes ni listas.')
  }

  const html = await fetchText(`https://open.spotify.com/embed/track/${parsed.id}`)
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/)
  if (!scriptMatch) throw new Error('No pude leer los datos de la pista de Spotify (la página cambió o la pista no existe).')

  let data
  try {
    data = JSON.parse(scriptMatch[1])
  } catch {
    throw new Error('No pude interpretar los datos de la pista de Spotify.')
  }
  const entity = findTrackEntity(data)
  if (!entity) throw new Error('No encontré la información de la pista en Spotify.')

  return {
    title: String(entity.title ?? entity.name ?? 'pista'),
    artist: String(entity.artists?.[0]?.name ?? 'Desconocido'),
  }
}

/**
 * Decodifica un string escapado de JSON (para títulos extraídos por regex del HTML de YouTube).
 * @param {string} raw String crudo con escapes JSON.
 * @returns {string}
 */
export function decodeJsonString(raw) {
  try {
    return JSON.parse(`"${raw}"`)
  } catch {
    return String(raw ?? '').replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\//g, '/')
  }
}

/**
 * Busca el primer video de YouTube para una consulta (scraping de la página de resultados).
 * @param {string} query Consulta de búsqueda.
 * @returns {Promise<{id: string, title: string, url: string}|null>}
 */
export async function searchYouTube(query) {
  const videos = await searchYouTubeVideos(query, 1)
  return videos[0] ?? null
}

/**
 * Busca varios videos de YouTube para una consulta (scraping de la página de resultados).
 * @param {string} query Consulta de búsqueda.
 * @param {number} [limit] Máximo de resultados (5 por defecto).
 * @returns {Promise<Array<{id: string, title: string, url: string}>>}
 */
export async function searchYouTubeVideos(query, limit = 5) {
  const html = await fetchText(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`,
  )
  /** @type {Array<{id: string, title: string, url: string}>} */
  const videos = []
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"/g
  let match
  while ((match = re.exec(html)) && videos.length < limit) {
    videos.push({
      id: match[1],
      title: decodeJsonString(match[2]),
      url: `https://www.youtube.com/watch?v=${match[1]}`,
    })
  }
  return videos
}

/**
 * Descarga una pista de Spotify: obtiene metadatos del embed, busca el audio en
 * YouTube y lo descarga como MP3.
 * @param {string} url URL de open.spotify.com/track/...
 * @returns {Promise<import('./youtube.js').DownloadResult>}
 */
export async function downloadSpotifyTrack(url) {
  const meta = await fetchSpotifyMetadata(url)
  const found = await searchYouTube(`${meta.artist} ${meta.title} audio`)
  if (!found) throw new Error(`No encontré "${meta.title}" de ${meta.artist} en YouTube.`)

  const result = await downloadAudio(found.url, 'spotify')
  const fileName = sanitizeFileName(`${meta.artist} - ${meta.title}`, '.mp3')
  return { ...result, fileName, title: `${meta.artist} - ${meta.title}` }
}
