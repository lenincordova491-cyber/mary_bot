import { inspect } from 'node:util'

/** Comando .eval <código> (owner): ejecuta JavaScript con acceso al contexto del bot. */
export const evalCommand = {
  name: 'eval',
  category: 'owner',
  description: 'Ejecuta código JavaScript (solo owner, cuidado con lo que ejecutas)',
  usage: 'eval <código>',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const code = ctx.text
    if (!code) return void (await ctx.reply('⚠️ Uso: .eval <código JS>\nTienes acceso a: sock, msg, jid, ctx.'))

    try {
      // El código del owner corre con acceso al cierre del handler (sock, msg, ctx).
      const result = await (async () => eval(code))()
      const output = inspect(result, { depth: 2, breakLength: Infinity }).slice(0, 3000)
      await ctx.reply(`📤 Resultado:\n${output}`)
    } catch (err) {
      await ctx.reply(`❌ Error:\n${String(err?.stack ?? err).slice(0, 1500)}`)
    }
  },
}
