import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .instagram <url>: reel/video o carrusel de Instagram (documentos). */
export const instagramCommand = {
  name: 'instagram',
  aliases: ['ig'],
  category: 'downloader',
  description: 'Descarga un reel, video o carrusel de Instagram',
  usage: 'instagram <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .instagram <url de Instagram>'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply, engine: 'instagram' })
  },
}
