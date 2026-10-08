import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .ytmp3 <url>: audio de YouTube como MP3 (documento). */
export const ytmp3Command = {
  name: 'ytmp3',
  aliases: ['yta'],
  category: 'downloader',
  description: 'Descarga el audio de un video de YouTube como MP3',
  usage: 'ytmp3 <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .ytmp3 <url de YouTube>\nEjemplo: .ytmp3 https://youtu.be/dQw4w9WgXcQ'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply, engine: 'youtube', mode: 'audio' })
  },
}
