import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .mediafire <url>: archivo directo de mediafire.com (documento). */
export const mediafireCommand = {
  name: 'mediafire',
  aliases: ['mf'],
  category: 'downloader',
  description: 'Descarga un archivo de Mediafire',
  usage: 'mediafire <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .mediafire <url de mediafire.com>'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply, engine: 'mediafire' })
  },
}
