import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcodeTerminal from 'qrcode-terminal'
import { AUTH_DIR, PAIRING_NUMBER } from '../config.js'

/**
 * Calcula el retardo de reconexión con backoff exponencial: 1s, 2s, 4s, 8s (tope 8s).
 * @param {number} attempt Número de intento (1-based).
 * @returns {number} Retardo en milisegundos.
 */
export function getBackoffDelayMs(attempt) {
  const a = Math.max(1, Math.floor(Number(attempt) || 1))
  return Math.min(1000 * 2 ** (a - 1), 8000)
}

/**
 * Establece la conexión con WhatsApp mediante Baileys.
 * - Sesión persistente en AUTH_DIR (useMultiFileAuthState).
 * - Si PAIRING_NUMBER está configurado y no hay sesión registrada, solicita
 *   un código de emparejamiento de 8 dígitos; si no, muestra el QR en terminal.
 * - Reconexión automática con backoff exponencial (1s, 2s, 4s, 8s).
 *
 * @param {{logger?: any, onConnected?: (sock: any) => void}} [options]
 * @returns {Promise<any>} Socket de Baileys conectado (o conectándose).
 */
export async function connectToWhatsApp(options = {}) {
  const logger = options.logger ?? pino({ level: process.env.LOG_LEVEL || 'warn' })
  const { onConnected } = options

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })

  let reconnections = 0
  let pairingRequested = false

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    try {
      const { connection, lastDisconnect, qr } = update

      if (qr && !state.creds.registered) {
        if (PAIRING_NUMBER) {
          if (!pairingRequested) {
            pairingRequested = true
            const code = await sock.requestPairingCode(PAIRING_NUMBER)
            // El código entregado por WhatsApp tiene 8 caracteres.
            console.log(
              `\n📱 Código de emparejamiento para ${PAIRING_NUMBER}: ${code}\n` +
              'En WhatsApp: Dispositivos vinculados > Vincular un dispositivo > Vincular con el número de teléfono.\n',
            )
          }
        } else {
          qrcodeTerminal.generate(qr, { small: true })
        }
      }

      if (connection === 'open') {
        reconnections = 0
        onConnected?.(sock)
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        if (statusCode === DisconnectReason.loggedOut) {
          console.error('❌ Sesión cerrada (loggedOut). Elimina la carpeta auth_info/ y vuelve a vincular el dispositivo.')
          return
        }
        reconnections += 1
        const delay = getBackoffDelayMs(reconnections)
        console.warn(`⚠️ Conexión cerrada (código ${statusCode}). Reconectando en ${delay / 1000}s (intento ${reconnections})…`)
        setTimeout(() => {
          connectToWhatsApp({ ...options, logger }).catch((err) => logger.error({ err }, 'Reconexión fallida'))
        }, delay)
      }
    } catch (err) {
      logger.error({ err }, 'Error procesando connection.update')
    }
  })

  return sock
}
