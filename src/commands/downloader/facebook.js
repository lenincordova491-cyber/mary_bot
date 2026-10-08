import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .facebook <url>: video de Facebook o fb.watch (documento). */
export const facebookCommand = {
  name: 'facebook',
  aliases: ['fb'],
  category: 'downloader',
  description: 'Descarga un video de Facebook',
  usage: 'facebook <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .facebook <url de Facebook o fb.watch>'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply, engine: 'facebook' })
  },
}
