import { setSetting } from '../../lib/database.js'

/** Comando .prefix <nuevo> (owner): cambia el prefijo de comandos. */
export const prefixCommand = {
  name: 'prefix',
  category: 'owner',
  description: 'Cambia el prefijo de comandos',
  usage: 'prefix <nuevo prefijo>',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const next = ctx.args[0]
    if (!next || /\s/.test(next) || next.length > 3) {
      await ctx.reply('⚠️ Uso: .prefix <nuevo prefijo> (1-3 caracteres, sin espacios)')
      return
    }
    setSetting('prefix', next)
    await ctx.reply(`✅ Prefijo actualizado. Ahora los comandos se usan así: *${next}help*`)
  },
}
