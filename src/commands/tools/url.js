/** Comando .enc <texto>: codifica texto/URL (percent-encoding). */
export const encCommand = {
  name: 'enc',
  aliases: ['encode', 'urlencode'],
  category: 'tools',
  description: 'Codifica un texto/URL (percent-encoding)',
  usage: 'enc <texto>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    if (!ctx.text) {
      await ctx.reply('⚠️ Uso: .enc <texto o URL>\nEjemplo: .enc hola mundo/ñ')
      return
    }
    await ctx.reply(`🔐 ${encodeURIComponent(ctx.text)}`)
  },
}

/** Comando .dec <texto>: decodifica percent-encoding. */
export const decCommand = {
  name: 'dec',
  aliases: ['decode', 'urldecode'],
  category: 'tools',
  description: 'Decodifica un texto/URL codificado',
  usage: 'dec <texto>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    if (!ctx.text) {
      await ctx.reply('⚠️ Uso: .dec <texto codificado>\nEjemplo: .dec hola%20mundo')
      return
    }
    try {
      await ctx.reply(`🔓 ${decodeURIComponent(ctx.text)}`)
    } catch {
      await ctx.reply('❌ El texto no es un percent-encoding válido.')
    }
  },
}
