import { statSync } from 'node:fs'
import { formatBytes, safeUnlink, sendDocument } from '../lib/utils.js'
import { downloadFacebook } from './facebook.js'
import { downloadInstagram } from './instagram.js'
import { downloadMediafire } from './mediafire.js'
import { downloadSpotifyTrack } from './spotify.js'
import { downloadTikTok } from './tiktok.js'
import { downloadYouTubeAudio, downloadYouTubeVideo } from './youtube.js'

/** @typedef {import('./youtube.js').DownloadResult} DownloadResult */

/** Dominios soportados por el dispatcher universal. */
export const SUPPORTED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'fb.watch',
  'open.spotify.com',
  'mediafire.com',
]

/** Mensaje de error para URLs no reconocidas. */
export const UNKNOWN_URL_MESSAGE =
  '❌ No reconozco esa URL. Dominios soportados:\n' +
  SUPPORTED_DOMAINS.map((d) => `• ${d}`).join('\n') +
  '\n\nTambién puedes usar: .ytmp3, .ytmp4, .tiktok, .instagram, .facebook, .spotify, .mediafire o .dl <url>'

/**
 * Detecta el motor de descarga adecuado para una URL.
 * @param {string} url URL a analizar.
 * @returns {'youtube'|'tiktok'|'instagram'|'facebook'|'spotify'|'mediafire'|'unknown'}
 */
export function detectEngine(url) {
  let host
  try {
    host = new URL(String(url ?? '')).hostname.toLowerCase()
  } catch {
    return 'unknown'
  }
  host = host.replace(/^www\./, '')

  if (host === 'youtu.be' || host.endsWith('.youtube.com') || host === 'youtube.com') return 'youtube'
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram'
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch' || host.endsWith('.fb.watch')) return 'facebook'
  if (host === 'spotify.com' || host.endsWith('.spotify.com')) return 'spotify'
  if (host === 'mediafire.com' || host.endsWith('.mediafire.com')) return 'mediafire'
  return 'unknown'
}

/**
 * Ejecuta la descarga con el motor indicado.
 * @param {'youtube'|'tiktok'|'instagram'|'facebook'|'spotify'|'mediafire'} engine Motor a usar.
 * @param {string} url URL del contenido.
 * @param {{mode?: 'audio'|'video'|'auto'}} [options] mode aplica solo a YouTube.
 * @returns {Promise<DownloadResult[]>} Archivos descargados.
 */
export async function downloadWithEngine(engine, url, options = {}) {
  const mode = options.mode ?? 'auto'
  switch (engine) {
    case 'youtube':
      return [mode === 'audio' ? await downloadYouTubeAudio(url) : await downloadYouTubeVideo(url)]
    case 'tiktok':
      return [await downloadTikTok(url)]
    case 'instagram':
      return downloadInstagram(url)
    case 'facebook':
      return [await downloadFacebook(url)]
    case 'spotify':
      return [await downloadSpotifyTrack(url)]
    case 'mediafire':
      return [await downloadMediafire(url)]
    default:
      throw new Error(`Motor no soportado: ${engine}`)
  }
}

/**
 * Envía los archivos descargados como documentos (sin compresión).
 * @param {any} sock Socket de Baileys.
 * @param {string} jid JID destino.
 * @param {DownloadResult[]} results Archivos a enviar.
 * @returns {Promise<void>}
 */
export async function sendDownloadResults(sock, jid, results) {
  for (const result of results) {
    /** @type {string|undefined} */
    let caption = result.title
    try {
      caption = `${result.title} · ${formatBytes(statSync(result.filePath).size)}`
    } catch {
      /* caption simple sin tamaño */
    }
    await sendDocument(sock, jid, result.filePath, {
      fileName: result.fileName,
      mimetype: result.mimetype,
      caption,
    })
  }
}

/**
 * Flujo completo: detectar motor (o usar el dado), descargar, enviar como documento
 * y limpiar los archivos temporales.
 * @param {{sock: any, jid: string, url: string, reply: (t: string) => Promise<any>, engine?: string, mode?: 'audio'|'video'|'auto', notify?: boolean}} payload
 * @returns {Promise<{ok: boolean, engine?: string, count?: number, reason?: string}>}
 */
export async function dispatchDownload(payload) {
  const { sock, jid, url, reply, notify = true } = payload
  const engine = payload.engine ?? detectEngine(url)
  if (engine === 'unknown') {
    await reply(UNKNOWN_URL_MESSAGE)
    return { ok: false, reason: 'unknown' }
  }

  if (notify) await reply(`⏳ Descargando desde ${engine}…`)

  let results = []
  try {
    results = await downloadWithEngine(/** @type {any} */ (engine), url, { mode: payload.mode })
    await sendDownloadResults(sock, jid, results)
    return { ok: true, engine, count: results.length }
  } catch (err) {
    const message = err?.message ?? String(err)
    await reply(`❌ No pude descargar desde ${engine}: ${message}`)
    return { ok: false, engine, reason: 'error' }
  } finally {
    for (const result of results) safeUnlink(result.filePath)
  }
}
