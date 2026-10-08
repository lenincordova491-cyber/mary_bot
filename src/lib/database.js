import fs from 'node:fs'
import path from 'node:path'
import { DB_PATH } from '../config.js'

/**
 * Estado persistente del bot.
 * @typedef {Object} BotState
 * @property {{prefix: string|null, autoread: boolean}} settings Preferencias globales.
 * @property {Record<string, {addedAt: number}>} chats Chats conocidos (para broadcast).
 * @property {Record<string, Array<{role: string, content: string}>>} aiHistory Historial de IA por chat.
 */

/** @type {BotState} */
const DEFAULT_STATE = {
  settings: { prefix: null, autoread: false },
  chats: {},
  aiHistory: {},
}

/** @type {string|null} */
let dbPath = null
/** @type {BotState} */
let state = structuredClone(DEFAULT_STATE)
/** @type {boolean} */
let loaded = false

/**
 * Fija la ruta del archivo de base de datos (útil en tests).
 * @param {string} p Ruta absoluta del JSON.
 * @returns {void}
 */
export function setDbPath(p) {
  dbPath = p
  loaded = false
  state = structuredClone(DEFAULT_STATE)
}

/**
 * Ruta actual del archivo de base de datos.
 * @returns {string}
 */
export function getDbPath() {
  if (!dbPath) dbPath = DB_PATH
  return dbPath
}

/**
 * Carga el estado desde disco (o inicializa uno nuevo si no existe/corrompe).
 * @returns {BotState}
 */
export function load() {
  const file = getDbPath()
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      const base = structuredClone(DEFAULT_STATE)
      state = {
        ...base,
        ...raw,
        settings: { ...base.settings, ...(raw.settings ?? {}) },
        chats: raw.chats ?? {},
        aiHistory: raw.aiHistory ?? {},
      }
    } else {
      state = structuredClone(DEFAULT_STATE)
    }
  } catch {
    state = structuredClone(DEFAULT_STATE)
  }
  loaded = true
  return state
}

/**
 * Garantiza que el estado esté cargado antes de leerlo/escribirlo.
 * @returns {void}
 */
function ensureLoaded() {
  if (!loaded) load()
}

/**
 * Persiste el estado en disco.
 * @returns {void}
 */
export function save() {
  const file = getDbPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8')
}

/**
 * Devuelve las preferencias globales.
 * @returns {{prefix: string|null, autoread: boolean}}
 */
export function getSettings() {
  ensureLoaded()
  return state.settings
}

/**
 * Actualiza una preferencia global y persiste.
 * @param {'prefix'|'autoread'} key Nombre de la preferencia.
 * @param {string|boolean|null} value Nuevo valor.
 * @returns {void}
 */
export function setSetting(key, value) {
  ensureLoaded()
  state.settings[key] = value
  save()
}

/**
 * Registra un chat como conocido (para el broadcast del owner).
 * @param {string} jid JID del chat.
 * @returns {void}
 */
export function rememberChat(jid) {
  if (!jid) return
  ensureLoaded()
  if (!state.chats[jid]) {
    state.chats[jid] = { addedAt: Date.now() }
    save()
  }
}

/**
 * Lista los JIDs de todos los chats conocidos.
 * @returns {string[]}
 */
export function listChats() {
  ensureLoaded()
  return Object.keys(state.chats)
}

/**
 * Devuelve el historial de IA de un chat (o vacío).
 * @param {string} jid JID del chat.
 * @returns {Array<{role: string, content: string}>}
 */
export function getAiHistory(jid) {
  ensureLoaded()
  return state.aiHistory[jid] ?? []
}

/**
 * Añade un mensaje al historial de IA de un chat (máximo 20 entradas) y persiste.
 * @param {string} jid JID del chat.
 * @param {'user'|'assistant'} role Rol del mensaje.
 * @param {string} content Contenido del mensaje.
 * @returns {void}
 */
export function pushAiHistory(jid, role, content) {
  ensureLoaded()
  const history = state.aiHistory[jid] ?? []
  history.push({ role, content })
  while (history.length > 20) history.shift()
  state.aiHistory[jid] = history
  save()
}

/**
 * Limpia el historial de IA de un chat.
 * @param {string} jid JID del chat.
 * @returns {void}
 */
export function clearAiHistory(jid) {
  ensureLoaded()
  delete state.aiHistory[jid]
  save()
}
