import pino from 'pino'
import { connectToWhatsApp } from './lib/baileys.js'
import { cleanTmpDir } from './lib/utils.js'
import { handleMessage, loadCommands, setUrlDispatcher } from './handler.js'
import { dispatchDownload } from './engines/universal.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

/**
 * Punto de entrada del bot: carga los comandos, conecta con WhatsApp
 * y conecta el flujo de mensajes entrantes con el handler.
 * @returns {Promise<void>}
 */
async function main() {
  cleanTmpDir()

  const commands = await loadCommands()
  logger.info({ count: commands.length }, 'Comandos cargados')

  // URLs sin comando (p. ej. un link de YouTube pegado directo) -> dispatcher universal.
  setUrlDispatcher(({ sock, jid, url, reply }) => dispatchDownload({ sock, jid, url, reply }))

  let wired = false
  const sock = await connectToWhatsApp({
    logger,
    onConnected: (s) => {
      logger.info('Mary_uwu conectada a WhatsApp ✅')
      if (!wired) {
        wired = true
        s.ev.on('messages.upsert', (upsert) => {
          handleMessage(upsert, s).catch((err) => logger.error({ err }, 'Error en el handler de mensajes'))
        })
      }
    },
  })

  const shutdown = () => {
    try {
      sock?.end(new Error('Cierre manual'))
    } catch {
      /* best effort */
    }
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logger.error({ err }, 'No se pudo iniciar Mary_uwu')
  process.exit(1)
})
