import path from 'node:path'
import {
  downloadResponseTo,
  fetchText,
  mimeFromFileName,
  tmpFilePath,
  USER_AGENT,
} from '../lib/utils.js'

/**
 * Extrae el enlace directo de descarga de una página de mediafire.com.
 * @param {string} pageUrl URL de la página del archivo (mediafire.com/xxxxx).
 * @returns {Promise<string>} Enlace directo (downloadNNN.mediafire.com).
 */
export async function getMediafireDirectLink(pageUrl) {
  const html = await fetchText(pageUrl)
  const match = html.match(/https?:\/\/download\d{1,4}\.mediafire\.com\/[^"'\s<>]+/i)
  if (!match) {
    throw new Error('No encontré el enlace de descarga. Verifica que la URL sea de un archivo público de mediafire.com.')
  }
  return match[0]
}

/**
 * Deduce el nombre del archivo a partir de content-disposition o de la URL.
 * @param {FetchEvent|any} headers Cabeceras de la respuesta (Headers de fetch).
 * @param {string} url URL del archivo.
 * @returns {string}
 */
export function fileNameFromHeaders(headers, url) {
  const disposition = String(headers?.get?.('content-disposition') ?? '')
  const star = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i)
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/["']/g, '').trim())
    } catch {
      /* cae al siguiente método */
    }
  }
  if (plain) return plain[1].trim()
  try {
    return decodeURIComponent(path.basename(new URL(url).pathname)) || 'archivo-mediafire'
  } catch {
    return 'archivo-mediafire'
  }
}

/**
 * Descarga un archivo de Mediafire a la carpeta temporal.
 * @param {string} pageUrl URL de la página del archivo.
 * @returns {Promise<import('./youtube.js').DownloadResult>}
 */
export async function downloadMediafire(pageUrl) {
  const link = await getMediafireDirectLink(pageUrl)
  const res = await fetch(link, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) throw new Error(`El servidor de Mediafire respondió con HTTP ${res.status}.`)

  const fileName = fileNameFromHeaders(res.headers, link)
  const ext = path.extname(fileName)
  const dest = tmpFilePath('mediafire', ext)

  await downloadResponseTo(res, dest)

  return {
    filePath: dest,
    fileName,
    mimetype: mimeFromFileName(fileName),
    title: fileName,
  }
}
