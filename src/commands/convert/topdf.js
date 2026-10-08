import { imagesToPdf } from '../../converters/media.js'
import { downloadMediaToTmp, safeUnlink, sendDocument } from '../../lib/utils.js'

/** Comando .topdf: imagen adjunta o citada -> PDF (documento). */
export const topdfCommand = {
  name: 'topdf',
  aliases: ['pdf'],
  category: 'tools',
  description: 'Convierte una imagen a PDF',
  usage: 'topdf (adjunta o cita una imagen)',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const media = await downloadMediaToTmp(ctx.sock, ctx.msg)
    if (!media || media.key !== 'imageMessage') {
      await ctx.reply('⚠️ Envía una imagen con *.topdf* en el caption, o cita una imagen.')
      return
    }
    /** @type {string|null} */
    let out = null
    try {
      out = await imagesToPdf([media.filePath])
      await sendDocument(ctx.sock, ctx.jid, out, {
        fileName: 'imagen.pdf',
        mimetype: 'application/pdf',
        caption: '📄 Aquí tienes tu PDF',
      })
    } finally {
      safeUnlink(media.filePath)
      safeUnlink(out)
    }
  },
}
