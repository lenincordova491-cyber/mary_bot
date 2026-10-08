import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { TMP_DIR, MAX_FILE_SIZE } from '../config.js'

/** User-Agent usado para las peticiones HTTP del bot (scraping y descargas directas). */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Error lanzado cuando un archivo supera el límite de envío como documento. */
export class FileTooLargeError extends Error {
  /**
   * @param {number} size Tamaño real en bytes.
   * @param {number} max Tamaño máximo permitido en bytes.
   */
  constructor(size, max) {
    super(
      `El archivo pesa ${formatBytes(size)} y supera el límite de ${formatBytes(max)} ` +
      'para envío como documento. Intenta con una calidad/resolución menor.',
    )
    this.name = 'FileTooLargeError'
    this.size = size
    this.max = max
  }
}

/** @type {Record<string, string>} Extensión (en minúscula) -> tipo MIME. */
const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.weba': 'audio/webm',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive',
  '.txt': 'text/plain',
}

/**
 * Deduce el tipo MIME a partir del nombre/extension del archivo.
 * @param {string} fileName Nombre o ruta del archivo.
 * @returns {string} Tipo MIME (application/octet-stream si se desconoce).
 */
export function mimeFromFileName(fileName) {
  const ext = path.extname(String(fileName ?? '')).toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

/**
 * Formatea un número de bytes en una cadena legible.
 * @param {number} bytes Cantidad de bytes.
 * @returns {string} Ej.: "12.5 MB".
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '?'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  const rounded = i === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1)
  return `${rounded} ${units[i]}`
}

/**
 * Garantiza que la carpeta temporal exista y devuelve su ruta.
 * @returns {string}
 */
export function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true })
  return TMP_DIR
}

/**
 * Genera una ruta única dentro de la carpeta temporal.
 * @param {string} prefix Prefijo descriptivo (ej. "ytmp3").
 * @param {string} [ext] Extensión con punto (ej. ".mp3").
 * @returns {string} Ruta absoluta.
 */
export function tmpFilePath(prefix = 'file', ext = '') {
  ensureTmpDir()
  const rand = crypto.randomBytes(4).toString('hex')
  return path.join(TMP_DIR, `${prefix}-${Date.now()}-${rand}${ext}`)
}

/**
 * Borra un archivo si existe (ignora errores, best-effort).
 * @param {string} filePath Ruta del archivo.
 * @returns {void}
 */
export function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    /* best effort */
  }
}

/**
 * Limpia archivos temporales con una antigüedad mayor a maxAgeMs.
 * @param {number} [maxAgeMs] Antigüedad máxima en ms (30 min por defecto).
 * @returns {void}
 */
export function cleanTmpDir(maxAgeMs = 30 * 60 * 1000) {
  try {
    ensureTmpDir()
    for (const entry of fs.readdirSync(TMP_DIR)) {
      const full = path.join(TMP_DIR, entry)
      try {
        const stat = fs.statSync(full)
        if (Date.now() - stat.mtimeMs > maxAgeMs) safeUnlink(full)
      } catch {
        /* best effort */
      }
    }
  } catch {
    /* best effort */
  }
}

/**
 * Envía un mensaje de texto a un chat.
 * @param {any} sock Socket de Baileys.
 * @param {string} jid JID destino.
 * @param {string} text Texto a enviar.
 * @param {any} [quoted] Mensaje a citar (opcional).
 * @returns {Promise<any>} Promesa del envío.
 */
export async function sendText(sock, jid, text, quoted) {
  return sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined)
}

/**
 * Envía un archivo local como DOCUMENTO (sin compresión), validando el límite de 100 MB.
 * @param {any} sock Socket de Baileys.
 * @param {string} jid JID destino.
 * @param {string} filePath Ruta local del archivo.
 * @param {{fileName?: string, mimetype?: string, caption?: string}} [options]
 * @returns {Promise<any>} Promesa del envío.
 * @throws {FileTooLargeError} Si el archivo supera MAX_FILE_SIZE.
 */
export async function sendDocument(sock, jid, filePath, options = {}) {
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_FILE_SIZE) throw new FileTooLargeError(stat.size, MAX_FILE_SIZE)
  const fileName = options.fileName || path.basename(filePath)
  const buffer = fs.readFileSync(filePath)
  return sock.sendMessage(jid, {
    document: buffer,
    fileName,
    mimetype: options.mimetype || mimeFromFileName(fileName),
    ...(options.caption ? { caption: options.caption } : {}),
  })
}

/**
 * Desenvuelve mensajes efímeros / view-once / documento con caption.
 * @param {any} message Contenedor de mensaje de Baileys.
 * @returns {any} Mensaje interno.
 */
function unwrapMessage(message) {
  let m = message
  for (let i = 0; i < 5 && m?.ephemeralMessage?.message; i += 1) m = m.ephemeralMessage.message
  if (m?.viewOnceMessage?.message) m = m.viewOnceMessage.message
  if (m?.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message
  if (m?.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message
  return m
}

/**
 * Extrae el texto de un mensaje de Baileys (conversation, extendedText, captions).
 * @param {any} message Contenedor de mensaje (msg.message).
 * @returns {string} Texto extraído (vacío si no hay).
 */
export function extractText(message) {
  const m = unwrapMessage(message)
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    ''
  ).trim()
}

/**
 * Devuelve la primera URL http(s) de un texto.
 * @param {string} text Texto a analizar.
 * @returns {string|null} URL encontrada o null.
 */
export function firstUrl(text) {
  const match = String(text ?? '').match(/https?:\/\/\S+/i)
  return match ? match[0] : null
}

/**
 * Convierte un título arbitrario en un nombre de archivo seguro.
 * @param {string} name Nombre original (ej. título del video).
 * @param {string} [ext] Extensión con punto (ej. ".mp3").
 * @returns {string}
 */
export function sanitizeFileName(name, ext = '') {
  const cleaned = String(name ?? 'archivo')
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
  return ((cleaned || 'archivo') + ext).slice(0, 150)
}

/**
 * Descarga un texto (HTML) desde una URL.
 * @param {string} url URL a obtener.
 * @param {{headers?: Record<string, string>}} [options]
 * @returns {Promise<string>} Cuerpo de la respuesta.
 */
export async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, ...(options.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`No se pudo obtener ${url} (HTTP ${res.status}).`)
  return res.text()
}

/**
 * Recorre recursivamente un directorio y registra (ruta -> mtime) de sus archivos.
 * @param {string} dir Directorio a recorrer.
 * @param {Map<string, number>} map Mapa de salida.
 * @returns {void}
 */
function walkDirWithMtime(dir, map) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkDirWithMtime(full, map)
    else if (entry.isFile()) {
      try {
        map.set(full, fs.statSync(full).mtimeMs)
      } catch {
        /* best effort */
      }
    }
  }
}

/**
 * Toma una "foto" del estado actual de la carpeta temporal (para detectar archivos nuevos).
 * @returns {Map<string, number>} Mapa ruta -> mtimeMs.
 */
export function snapshotTmpDir() {
  ensureTmpDir()
  /** @type {Map<string, number>} */
  const map = new Map()
  walkDirWithMtime(TMP_DIR, map)
  return map
}

/**
 * Devuelve los archivos creados/modificados en tmp desde la instantánea dada.
 * @param {Map<string, number>} before Instantánea previa (snapshotTmpDir).
 * @returns {string[]} Rutas absolutas ordenadas por fecha de modificación.
 */
export function listNewTmpFiles(before) {
  const after = snapshotTmpDir()
  const files = [...after.entries()]
    .filter(([p, mtime]) => before.get(p) !== mtime)
    .map(([p]) => p)
  return files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
}

/**
 * Descarga el body de una respuesta fetch ya abierta a un archivo local,
 * aplicando el límite de tamaño.
 * @param {any} res Respuesta de fetch (con body y headers).
 * @param {string} destPath Ruta local de destino.
 * @param {{maxBytes?: number}} [options]
 * @returns {Promise<string>} Ruta del archivo descargado.
 * @throws {FileTooLargeError} Si el archivo supera maxBytes.
 */
export async function downloadResponseTo(res, destPath, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_FILE_SIZE
  if (!res.ok) throw new Error(`La descarga falló con HTTP ${res.status}.`)
  if (!res.body) throw new Error('La respuesta no contiene datos.')

  const contentLength = Number(res.headers.get('content-length') || 0)
  if (contentLength > maxBytes) throw new FileTooLargeError(contentLength, maxBytes)

  let received = 0
  const guard = new Transform({
    /** @param {Buffer} chunk @param {string} _enc @param {(err?: Error|null, data?: Buffer) => void} cb */
    transform(chunk, _enc, cb) {
      received += chunk.length
      if (received > maxBytes) {
        cb(new FileTooLargeError(received, maxBytes))
        return
      }
      cb(null, chunk)
    },
  })

  try {
    await pipeline(Readable.fromWeb(/** @type {any} */ (res.body)), guard, fs.createWriteStream(destPath))
  } catch (err) {
    safeUnlink(destPath)
    throw err
  }
  return destPath
}

/** @type {Record<string, string>} MIME -> extensión con punto. */
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
}

/**
 * Deduce una extensión de archivo a partir de un tipo MIME.
 * @param {string} mime Tipo MIME.
 * @returns {string} Extensión con punto ('' si se desconoce).
 */
export function extFromMime(mime) {
  return EXT_BY_MIME[String(mime ?? '').toLowerCase()] ?? ''
}

/**
 * Elimina etiquetas HTML y decodifica las entidades más comunes de un fragmento.
 * @param {string} html Texto con etiquetas HTML.
 * @returns {string} Texto plano.
 */
export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

/** Tipos de nodo de mensaje que contienen media útil para el bot. */
const MEDIA_NODE_KEYS = ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage', 'audioMessage']

/**
 * Busca el nodo de media en el mensaje actual o en el mensaje citado.
 * @param {any} msg Mensaje de Baileys.
 * @returns {{node: any, key: string, quoted: boolean}|null} Nodo encontrado.
 */
export function findMediaNode(msg) {
  const direct = msg?.message ?? {}
  for (const key of MEDIA_NODE_KEYS) {
    if (direct[key]) return { node: direct[key], key, quoted: false }
  }
  const context = direct?.extendedTextMessage?.contextInfo ?? direct?.imageMessage?.contextInfo ?? direct?.videoMessage?.contextInfo
  const quoted = context?.quotedMessage
  if (quoted) {
    for (const key of MEDIA_NODE_KEYS) {
      if (quoted[key]) return { node: quoted[key], key, quoted: true }
    }
  }
  return null
}

/**
 * Descarga la media adjunta (o citada) de un mensaje a la carpeta temporal.
 * @param {any} sock Socket de Baileys.
 * @param {any} msg Mensaje de Baileys.
 * @returns {Promise<{filePath: string, mimetype: string, key: string, quoted: boolean, seconds?: number}|null>}
 */
export async function downloadMediaToTmp(sock, msg) {
  const found = findMediaNode(msg)
  if (!found) return null

  const target = {
    key: msg.key,
    message: found.quoted ? { [found.key]: found.node } : msg.message,
  }
  const buffer = await downloadMediaMessage(target, 'buffer', {
    reuploadRequest: sock?.updateMediaMessage?.bind(sock),
  })

  const ext = path.extname(String(found.node.fileName ?? '')) || extFromMime(found.node.mimetype) || ''
  const filePath = tmpFilePath('media', ext)
  fs.writeFileSync(filePath, Buffer.from(buffer))
  return {
    filePath,
    mimetype: found.node.mimetype ?? '',
    key: found.key,
    quoted: found.quoted,
    seconds: found.node.seconds,
  }
}

/**
 * Descarga un archivo por HTTP a una ruta local, aplicando el límite de tamaño.
 * @param {string} url URL del archivo.
 * @param {string} destPath Ruta local de destino.
 * @param {{maxBytes?: number, headers?: Record<string, string>}} [options]
 * @returns {Promise<string>} Ruta del archivo descargado.
 * @throws {FileTooLargeError} Si el archivo supera maxBytes.
 */
export async function downloadToFile(url, destPath, options = {}) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, ...(options.headers ?? {}) } })
  return downloadResponseTo(res, destPath, { maxBytes: options.maxBytes })
}
