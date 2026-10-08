import { loadCommands } from '../../handler.js'

/** Comando .reload (owner): recarga todos los comandos sin reiniciar el proceso. */
export const reloadCommand = {
  name: 'reload',
  category: 'owner',
  description: 'Recarga los comandos sin reiniciar el bot',
  usage: 'reload',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const commands = await loadCommands({ bustCache: true })
    await ctx.reply(`🔄 ${commands.length} comandos recargados.`)
  },
}
