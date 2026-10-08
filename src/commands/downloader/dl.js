import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .dl <url>: detecta el motor automáticamente y envía el archivo. */
export const dlCommand = {
  name: 'dl',
  aliases: ['download', 'descargar'],
  category: 'downloader',
  description: 'Descarga desde cualquier dominio soportado (detecta el motor)',
  usage: 'dl <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .dl <url>\nSoporta: youtube, tiktok, instagram, facebook, spotify y mediafire.'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply })
  },
}
