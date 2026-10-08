import { normalizeTarget } from './target.js'

/**
 * Ejecuta el bloqueo/desbloqueo de un usuario.
 * @param {import('../../handler.js').CommandContext} ctx Contexto del comando.
 * @param {'block'|'unblock'} action Acción a realizar.
 * @returns {Promise<void>}
 */
async function runBlock(ctx, action) {
  const target = normalizeTarget(ctx, ctx.args[0])
  if (!target) {
    await ctx.reply(`⚠️ Uso: .${action === 'block' ? 'block' : 'unblock'} <número> — o cita el mensaje del usuario a ${action === 'block' ? 'bloquear' : 'desbloquear'}.`)
    return
  }
  await ctx.sock.updateBlockStatus(target, action)
  await ctx.reply(`✅ ${target} ${action === 'block' ? 'bloqueado 🔒' : 'desbloqueado 🔓'}.`)
}

/** Comando .block <número|cita> (owner): bloquea a un usuario. */
export const blockCommand = {
  name: 'block',
  category: 'owner',
  description: 'Bloquea a un usuario',
  usage: 'block <número>',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    await runBlock(ctx, 'block')
  },
}

/** Comando .unblock <número|cita> (owner): desbloquea a un usuario. */
export const unblockCommand = {
  name: 'unblock',
  category: 'owner',
  description: 'Desbloquea a un usuario',
  usage: 'unblock <número>',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    await runBlock(ctx, 'unblock')
  },
}
