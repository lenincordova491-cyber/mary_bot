import { dispatchDownload } from '../../engines/universal.js'
import { firstUrl } from '../../lib/utils.js'

/** Comando .spotify <url>: pista de Spotify como MP3 (documento). */
export const spotifyCommand = {
  name: 'spotify',
  aliases: ['sp'],
  category: 'downloader',
  description: 'Descarga una pista de Spotify como MP3',
  usage: 'spotify <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) return void (await ctx.reply('⚠️ Uso: .spotify <url de open.spotify.com/track/…>'))
    await dispatchDownload({ sock: ctx.sock, jid: ctx.jid, url, reply: ctx.reply, engine: 'spotify' })
  },
}
