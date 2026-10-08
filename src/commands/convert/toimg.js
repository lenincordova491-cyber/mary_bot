import fs from 'node:fs'
import { stickerToImage } from '../../converters/media.js'
import { downloadMediaToTmp, safeUnlink } from '../../lib/utils.js'

/** Comando .toimg: sticker citado -> imagen PNG. */
export const toimgCommand = {
  name: 'toimg',
  aliases: ['toimage'],
  category: 'tools',
  description: 'Convierte un sticker citado a imagen',
  usage: 'toimg (cita un sticker)',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const media = await downloadMediaToTmp(ctx.sock, ctx.msg)
    if (!media || media.key !== 'stickerMessage') {
      await ctx.reply('⚠️ Cita un sticker con *.toimg* para convertirlo a imagen.')
      return
    }
    /** @type {string|null} */
    let out = null
    try {
      out = await stickerToImage(media.filePath)
      const buffer = fs.readFileSync(out)
      await ctx.sock.sendMessage(ctx.jid, { image: buffer }, { quoted: ctx.msg })
    } finally {
      safeUnlink(media.filePath)
      safeUnlink(out)
    }
  },
}
