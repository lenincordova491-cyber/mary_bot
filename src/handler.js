import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BOT_NAME, DEFAULT_PREFIX, isOwnerJid } from './config.js'
import { getSettings, rememberChat } from './lib/database.js'
import { extractText, firstUrl } from './lib/utils.js'

/**
 * Contexto de ejecución de un comando.
 * @typedef {Object} CommandContext
 * @property {any} sock Socket de Baileys.
 * @property {any} msg Mensaje original de Baileys.
 * @property {string} jid JID del chat.
 * @property {string} sender JID del remitente.
 * @property {boolean} isOwner true si el remitente es el owner (o el propio bot).
 * @property {boolean} isGroup true si el chat es de grupo.
 * @property {string} command Nombre del comando sin prefijo.
 * @property {string[]} args Argumentos separados por espacios.
 * @property {string} text Texto completo tras el comando.
 * @property {(text: string) => Promise<any>} reply Responde al chat citando el mensaje.
 * @property {CommandModule[]} commands Snapshot del registro de comandos (para .help).
 */

/**
 * Módulo de comando exportado desde src/commands o src/plugins.
 * @typedef {Object} CommandModule
 * @property {string} name Nombre del comando (sin prefijo).
 * @property {string[]} [aliases] Alias adicionales.
 * @property {string} [category] Categoría (basic|downloader|tools|ai|owner|plugins).
 * @property {string} [description] Descripción para .help.
 * @property {string} [usage] Uso sin el prefijo, ej.: "ytmp3 <url>".
 * @property {boolean} [ownerOnly] Solo el owner puede ejecutarlo.
 * @property {(ctx: CommandContext) => Promise<any>|any} handler Implementación.
 */

/** @type {Map<string, CommandModule>} Registro de comandos por nombre. */
export const commandRegistry = new Map()

/** @type {Map<string, string>} Registro de alias -> nombre canónico. */
const aliasRegistry = new Map()

/** @type {null | (payload: {sock: any, msg: any, jid: string, url: string, reply: (t: string) => Promise<any>}) => Promise<void>} */
let urlDispatcher = null

/**
 * Registra un módulo de comando (y sus alias).
 * @param {CommandModule} mod Módulo de comando.
 * @returns {void}
 */
export function registerCommand(mod) {
  if (!mod || typeof mod.name !== 'string' || typeof mod.handler !== 'function') return
  const name = mod.name.toLowerCase()
  commandRegistry.set(name, mod)
  for (const alias of mod.aliases ?? []) {
    if (typeof alias === 'string') aliasRegistry.set(alias.toLowerCase(), name)
  }
}

/**
 * Busca un comando por nombre o alias.
 * @param {string} name Nombre o alias (sin prefijo).
 * @returns {CommandModule|null} Módulo encontrado o null.
 */
export function getCommand(name) {
  const key = String(name ?? '').toLowerCase()
  const direct = commandRegistry.get(key)
  if (direct) return direct
  const canonical = aliasRegistry.get(key)
  return canonical ? commandRegistry.get(canonical) ?? null : null
}

/**
 * Snapshot de todos los comandos registrados.
 * @returns {CommandModule[]}
 */
export function listCommands() {
  return [...commandRegistry.values()]
}

/**
 * Registra la función que procesa URLs sin comando (dispatcher universal).
 * @param {(payload: {sock: any, msg: any, jid: string, url: string, reply: (t: string) => Promise<any>}) => Promise<void>} fn
 * @returns {void}
 */
export function setUrlDispatcher(fn) {
  urlDispatcher = fn
}

/**
 * Determina si un valor exportado es un módulo de comando válido.
 * @param {unknown} value Valor exportado.
 * @returns {boolean}
 */
function isCommandModule(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof /** @type {CommandModule} */ (value).name === 'string' &&
    typeof /** @type {CommandModule} */ (value).handler === 'function',
  )
}

/**
 * Recorre recursivamente un directorio y devuelve las rutas de archivos .js.
 * @param {string} dir Directorio raíz.
 * @returns {string[]}
 */
function walkJsFiles(dir) {
  /** @type {string[]} */
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkJsFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

/**
 * Carga (o recarga) todos los comandos desde src/commands y src/plugins.
 * @param {{bustCache?: boolean}} [options] bustCache invalida la caché de módulos (usado por .reload).
 * @returns {Promise<CommandModule[]>} Lista de comandos cargados.
 */
export async function loadCommands({ bustCache = false } = {}) {
  commandRegistry.clear()
  aliasRegistry.clear()

  const base = path.dirname(fileURLToPath(import.meta.url))
  for (const folder of ['commands', 'plugins']) {
    const root = path.join(base, folder)
    if (!fs.existsSync(root)) continue
    for (const file of walkJsFiles(root)) {
      const url = pathToFileURL(file)
      if (bustCache) url.searchParams.set('reload', `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      try {
        const mod = await import(url.href)
        for (const exported of Object.values(mod)) {
          if (isCommandModule(exported)) registerCommand(/** @type {CommandModule} */ (exported))
        }
      } catch (err) {
        console.warn(`⚠️ No se pudo cargar el comando ${file}: ${err?.message ?? err}`)
      }
    }
  }
  return listCommands()
}

/**
 * Procesa un evento messages.upsert completo.
 * @param {{messages?: any[], type?: string}} upsert Evento de Baileys.
 * @param {any} sock Socket de Baileys.
 * @returns {Promise<void>}
 */
export async function handleMessage(upsert, sock) {
  if (upsert?.type === 'append') return
  for (const msg of upsert?.messages ?? []) {
    try {
      await handleOne(msg, sock)
    } catch (err) {
      console.error(`❌ Error procesando mensaje: ${err?.stack ?? err}`)
    }
  }
}

/**
 * Procesa un mensaje individual: comandos con prefijo o dispatch de URLs.
 * @param {any} msg Mensaje de Baileys.
 * @param {any} sock Socket de Baileys.
 * @returns {Promise<void>}
 */
async function handleOne(msg, sock) {
  if (!msg?.message || !msg?.key) return

  const jid = msg.key.remoteJid
  if (!jid || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return

  const settings = getSettings()

  if (settings.autoread && msg.key.id) {
    try {
      await sock.readMessages?.([msg.key])
    } catch {
      /* best effort */
    }
  }

  rememberChat(jid)

  const text = extractText(msg.message)
  if (!text) return

  const prefix = settings.prefix || DEFAULT_PREFIX
  const sender = msg.key.fromMe ? (sock.user?.id ?? jid) : (msg.key.participant || jid)
  const isOwner = Boolean(msg.key.fromMe) || isOwnerJid(sender)

  /** @type {(t: string) => Promise<any>} */
  const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg })

  // Comandos con prefijo.
  if (text.startsWith(prefix)) {
    const body = text.slice(prefix.length).trim()
    if (!body) return
    const [rawName, ...rest] = body.split(/\s+/)
    const cmd = getCommand(rawName)
    if (!cmd) {
      await reply(`❌ Comando «${prefix}${rawName}» no reconocido.\nUsa ${prefix}help para ver la lista de comandos.`)
      return
    }
    if (cmd.ownerOnly && !isOwner) {
      await reply('🚫 No tienes permiso para usar este comando.')
      return
    }
    /** @type {CommandContext} */
    const ctx = {
      sock,
      msg,
      jid,
      sender,
      isOwner,
      isGroup: jid.endsWith('@g.us'),
      command: rawName.toLowerCase(),
      args: rest,
      text: body.slice(rawName.length).trim(),
      reply,
      commands: listCommands(),
    }
    try {
      await cmd.handler(ctx)
    } catch (err) {
      await reply(`❌ Error: ${err?.message ?? err}`)
    }
    return
  }

  // Sin prefijo: si contiene una URL, delega al dispatcher universal.
  // Se ignoran los mensajes del propio bot (fromMe) para no reaccionar a las respuestas que contienen enlaces.
  const url = firstUrl(text)
  if (url && urlDispatcher && !msg.key.fromMe) {
    try {
      await urlDispatcher({ sock, msg, jid, url, reply })
    } catch (err) {
      await reply(`❌ Error: ${err?.message ?? err}`)
    }
  }
}

/** Nombre visible del bot (reexportado para conveniencia). */
export const BOT_DISPLAY_NAME = BOT_NAME
