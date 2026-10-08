import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Raíz del proyecto (carpeta padre de src/). */
export const PROJECT_ROOT = path.resolve(__dirname, '..')

/**
 * Reduce un valor a solo sus dígitos (útil para números telefónicos).
 * @param {unknown} value
 * @returns {string}
 */
function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Número del dueño del bot (solo dígitos, formato internacional). */
export const OWNER_NUMBER = onlyDigits(process.env.OWNER_NUMBER)

/** Número al que se envía el código de emparejamiento (por defecto, el owner). */
export const PAIRING_NUMBER = onlyDigits(process.env.PAIRING_NUMBER) || OWNER_NUMBER

/** Prefijo de comandos por defecto (editable en runtime con .prefix). */
export const DEFAULT_PREFIX = process.env.PREFIX || '.'

/** Nombre informativo de la sesión. */
export const SESSION_NAME = process.env.SESSION_NAME || 'mary_uwu'

/** Nombre visible del bot en los mensajes. */
export const BOT_NAME = 'Mary_uwu'

/** Carpeta donde Baileys guarda las credenciales de la sesión. */
export const AUTH_DIR = process.env.AUTH_DIR || path.join(PROJECT_ROOT, 'auth_info')

/** Carpeta de descargas temporales. */
export const TMP_DIR = process.env.TMP_DIR || path.join(PROJECT_ROOT, 'tmp_downloads')

/** Ruta del archivo JSON de estado persistente. */
export const DB_PATH = process.env.MARY_DB_PATH || path.join(PROJECT_ROOT, 'data', 'database.json')

/** Límite de tamaño de archivo (MB) para envío como documento. */
export const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) > 0
  ? Number(process.env.MAX_FILE_SIZE_MB)
  : 100

/** Límite de tamaño de archivo en bytes. */
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

/** API key de OpenAI (módulo de IA). */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

/** Modelo de chat de OpenAI. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/** Modelo de generación de imágenes de OpenAI. */
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3'

/** Binario de gallery-dl (Instagram). */
export const GALLERY_DL_PATH = process.env.GALLERY_DL_PATH || 'gallery-dl'

/** Binario de yt-dlp alternativo (si se usa el binario del sistema en vez de youtube-dl-exec). */
export const YTDLP_PATH = process.env.YTDLP_PATH || ''

/**
 * Determina si un JID pertenece al dueño del bot.
 * @param {string} jid JID de WhatsApp (ej. "521234567890@s.whatsapp.net").
 * @returns {boolean} true si el número del JID coincide con OWNER_NUMBER.
 */
export function isOwnerJid(jid) {
  if (!OWNER_NUMBER) return false
  const bare = String(jid ?? '').split('@')[0] ?? ''
  return onlyDigits(bare.split(':')[0]) === OWNER_NUMBER
}
