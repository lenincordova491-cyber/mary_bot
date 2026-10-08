import sharp from 'sharp'
import { downloadMediaToTmp, firstUrl, safeUnlink, tmpFilePath, downloadToFile } from '../../lib/utils.js'

/** Comando .setpp (owner): cambia la foto de perfil del bot. */
export const setppCommand = {
  name: 'setpp',
  aliases: ['setprofile'],
  category: 'owner',
  description: 'Cambia la foto de perfil del bot',
  usage: 'setpp (adjunta o cita una imagen, o pasa una URL)',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const media = await downloadMediaToTmp(ctx.sock, ctx.msg)
    /** @type {string|null} */
    let inputPath = media?.filePath ?? null
    const url = firstUrl(ctx.text)
    if (!inputPath && url) {
      inputPath = tmpFilePath('setpp-src', '.jpg')
      try {
        await downloadToFile(url, inputPath)
      } catch (err) {
        safeUnlink(inputPath)
        await ctx.reply(`❌ No pude descargar la imagen: ${err.message}`)
        return
      }
    }
    if (!inputPath) {
      await ctx.reply('⚠️ Uso: envía una imagen con *.setpp* en el caption, cita una imagen, o pasa una URL.')
      return
    }

    try {
      const buffer = await sharp(inputPath)
        .resize(720, 720, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 92 })
        .toBuffer()
      await ctx.sock.setProfilePicture(buffer)
      await ctx.reply('✅ Foto de perfil actualizada.')
    } finally {
      safeUnlink(inputPath)
    }
  },
}
