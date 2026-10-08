import ytdlp from 'youtube-dl-exec'
import fs from 'node:fs'
import path from 'node:path'
import { MAX_FILE_SIZE } from '../config.js'
import {
  FileTooLargeError,
  listNewTmpFiles,
  mimeFromFileName,
  sanitizeFileName,
  snapshotTmpDir,
  tmpFilePath,
} from '../lib/utils.js'

/** Opciones comunes para yt-dlp en todas las descargas. */
const YTDLP_BASE_FLAGS = {
  noPlaylist: true,
  noWarnings: true,
  noCheckCertificates: true,
}

/**
 * @typedef {Object} DownloadResult
 * @property {string} filePath Ruta local del archivo descargado.
 * @property {string} fileName Nombre sugerido para el documento.
 * @property {string} mimetype Tipo MIME del archivo.
 * @property {string} [title] Título legible (para el caption).
 */

/**
 * Obtiene los metadatos de un video de YouTube vía yt-dlp (dumpSingleJson).
 * @param {string} url URL de YouTube.
 * @returns {Promise<any>} Objeto de metadatos de yt-dlp.
 */
export async function getYouTubeInfo(url) {
  return ytdlp(url, { ...YTDLP_BASE_FLAGS, dumpSingleJson: true })
}

/**
 * Valida el tamaño de un archivo local contra el límite de envío.
 * @param {string} filePath Ruta del archivo.
 * @returns {void}
 * @throws {FileTooLargeError} Si supera MAX_FILE_SIZE.
 */
export function assertFileSize(filePath) {
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_FILE_SIZE) throw new FileTooLargeError(stat.size, MAX_FILE_SIZE)
}

/**
 * Descarga con yt-dlp a la carpeta temporal y devuelve el archivo producido.
 * @param {string} url URL a descargar.
 * @param {Record<string, unknown>} flags Flags adicionales de yt-dlp.
 * @param {string} prefix Prefijo del archivo temporal.
 * @returns {Promise<{filePath: string, ext: string}>}
 */
export async function runYtDlpDownload(url, flags, prefix) {
  const before = snapshotTmpDir()
  const base = tmpFilePath(prefix, '')
  await ytdlp(url, { ...YTDLP_BASE_FLAGS, ...flags, output: `${base}.%(ext)s` })
  const files = listNewTmpFiles(before)
  if (!files.length) throw new Error('yt-dlp no produjo ningún archivo. El contenido puede ser privado o no soportado.')
  return { filePath: files[0], ext: path.extname(files[0]) }
}

/**
 * Verifica el tamaño anunciado por los metadatos antes de descargar.
 * @param {any} info Metadatos de yt-dlp.
 * @returns {void}
 * @throws {FileTooLargeError} Si filesize/filesize_approx supera el límite.
 */
export function assertInfoSize(info) {
  const size = Number(info?.filesize ?? info?.filesize_approx ?? 0)
  if (size > MAX_FILE_SIZE) throw new FileTooLargeError(size, MAX_FILE_SIZE)
}

/**
 * Descarga el audio de una URL arbitraria (para YouTube o respaldos) en MP3.
 * No consulta metadatos: el llamante define fileName/title.
 * @param {string} url URL a descargar.
 * @param {string} prefix Prefijo del archivo temporal.
 * @returns {Promise<{filePath: string, ext: string, mimetype: string}>}
 */
export async function downloadAudio(url, prefix) {
  const { filePath, ext } = await runYtDlpDownload(url, {
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: 0,
  }, prefix)
  assertFileSize(filePath)
  return { filePath, ext: ext || '.mp3', mimetype: mimeFromFileName(`a${ext || '.mp3'}`) }
}

/**
 * Descarga el audio de un video de YouTube en MP3.
 * @param {string} url URL de YouTube.
 * @returns {Promise<DownloadResult>}
 */
export async function downloadYouTubeAudio(url) {
  const info = await getYouTubeInfo(url)
  assertInfoSize(info)
  const title = sanitizeFileName(info?.title ?? 'audio-youtube')
  const { filePath, ext, mimetype } = await downloadAudio(url, 'ytmp3')
  return {
    filePath,
    fileName: `${title}${ext}`,
    mimetype,
    title: info?.title ?? title,
  }
}

/**
 * Descarga un video de YouTube en MP4 (máx. 720p) para envío como documento.
 * @param {string} url URL de YouTube.
 * @returns {Promise<DownloadResult>}
 */
export async function downloadYouTubeVideo(url) {
  const info = await getYouTubeInfo(url)
  assertInfoSize(info)
  const title = sanitizeFileName(info?.title ?? 'video-youtube')
  const { filePath, ext } = await runYtDlpDownload(url, {
    format: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]/best',
    mergeOutputFormat: 'mp4',
  }, 'ytmp4')
  assertFileSize(filePath)
  return {
    filePath,
    fileName: `${title}${ext || '.mp4'}`,
    mimetype: mimeFromFileName(`v${ext || '.mp4'}`),
    title: info?.title ?? title,
  }
}
