import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .ytmp4 <url>: video de YouTube hasta 720p como MP4 (documento). */
export const ytmp4Command = {
  name: 'ytmp4',
  aliases: ['ytv'],
  category: 'downloader',
  description: 'Descarga un video de YouTube en MP4 (máx. 720p)',
  usage: 'ytmp4 <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .ytmp4 <url de YouTube>\nEjemplo: .ytmp4 https://youtu.be/dQw4w9WgXcQ'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply, engine: 'youtube', mode: 'video' })
  },
}
