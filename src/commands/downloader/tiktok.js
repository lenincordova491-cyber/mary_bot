import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .tiktok <url>: video de TikTok sin marca de agua (documento). */
export const tiktokCommand = {
  name: 'tiktok',
  aliases: ['tt'],
  category: 'downloader',
  description: 'Descarga un video de TikTok',
  usage: 'tiktok <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .tiktok <url de TikTok>'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply, engine: 'tiktok' })
  },
}
