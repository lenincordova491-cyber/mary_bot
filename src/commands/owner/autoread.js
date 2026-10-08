import { getSettings, setSetting } from '../../lib/database.js'

/** Comando .autoread on|off (owner): lectura automática de mensajes. */
export const autoreadCommand = {
  name: 'autoread',
  category: 'owner',
  description: 'Activa/desactiva la lectura automática (on/off)',
  usage: 'autoread on|off',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const arg = (ctx.args[0] ?? '').toLowerCase()
    if (arg && arg !== 'on' && arg !== 'off') {
      await ctx.reply('⚠️ Uso: .autoread on|off')
      return
    }
    const value = arg === 'on' ? true : arg === 'off' ? false : !getSettings().autoread
    setSetting('autoread', value)
    await ctx.reply(`✅ Autoread ${value ? 'activado' : 'desactivado'}.`)
  },
}
