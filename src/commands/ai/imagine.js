import { generateImage } from '../../lib/ai-client.js'

/** Comando .imagine <descripción>: genera una imagen con IA y la envía. */
export const imagineCommand = {
  name: 'imagine',
  aliases: ['img', 'dalle'],
  category: 'ai',
  description: 'Genera una imagen con IA a partir de una descripción',
  usage: 'imagine <descripción>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const prompt = ctx.text
    if (!prompt) {
      await ctx.reply('⚠️ Uso: .imagine <descripción>\nEjemplo: .imagine un gato astronauta en la luna, estilo acuarela')
      return
    }
    try {
      const buffer = await generateImage(prompt)
      await ctx.sock.sendMessage(ctx.jid, { image: buffer, caption: `🎨 ${prompt}` }, { quoted: ctx.msg })
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`)
    }
  },
}
