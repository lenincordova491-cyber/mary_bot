import fs from 'node:fs'
import { imageToSticker, videoToSticker, VIDEO_STICKER_MAX_SECONDS } from '../../converters/sticker.js'
import { downloadMediaToTmp, safeUnlink } from '../../lib/utils.js'

/** Comando .sticker (alias .s): imagen o video corto -> sticker WebP. */
export const stickerCommand = {
  name: 'sticker',
  aliases: ['s'],
  category: 'tools',
  description: 'Convierte a sticker la imagen/video citado o adjunto',
  usage: 'sticker (adjunta o cita una imagen/video)',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const media = await downloadMediaToTmp(ctx.sock, ctx.msg)
    if (!media || !['imageMessage', 'videoMessage', 'stickerMessage'].includes(media.key)) {
      await ctx.reply('⚠️ Envía una imagen/video con el comando *.sticker* en el caption, o cita un media con *.sticker*.')
      return
    }

    /** @type {string|null} */
    let out = null
    try {
      if (media.key === 'videoMessage') {
        if ((media.seconds ?? 0) > VIDEO_STICKER_MAX_SECONDS + 2) {
          await ctx.reply(`⚠️ El video dura ${media.seconds}s; el máximo es ${VIDEO_STICKER_MAX_SECONDS}s aprox. Recórtalo primero.`)
          return
        }
        out = await videoToSticker(media.filePath, { durationSeconds: media.seconds })
      } else {
        out = await imageToSticker(media.filePath)
      }
      const buffer = fs.readFileSync(out)
      await ctx.sock.sendMessage(ctx.jid, { sticker: buffer }, { quoted: ctx.msg })
    } finally {
      safeUnlink(media.filePath)
      safeUnlink(out)
    }
  },
}
