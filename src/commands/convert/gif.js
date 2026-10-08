import fs from 'node:fs'
import { videoToGif } from '../../converters/media.js'
import { downloadMediaToTmp, safeUnlink } from '../../lib/utils.js'

/** Comando .gif: video citado -> GIF (se reproduce como GIF en WhatsApp). */
export const gifCommand = {
  name: 'gif',
  aliases: ['togif'],
  category: 'tools',
  description: 'Convierte un video corto citado a GIF',
  usage: 'gif (cita un video corto)',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const media = await downloadMediaToTmp(ctx.sock, ctx.msg)
    if (!media || media.key !== 'videoMessage') {
      await ctx.reply('⚠️ Cita un video con *.gif* para convertirlo a GIF.')
      return
    }
    /** @type {string|null} */
    let out = null
    try {
      out = await videoToGif(media.filePath, { durationSeconds: Math.min(media.seconds ?? 6, 10) })
      const buffer = fs.readFileSync(out)
      await ctx.sock.sendMessage(ctx.jid, { video: buffer, gifPlayback: true, mimetype: 'video/mp4' }, { quoted: ctx.msg })
    } finally {
      safeUnlink(media.filePath)
      safeUnlink(out)
    }
  },
}
