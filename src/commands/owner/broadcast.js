import { listChats } from '../../lib/database.js'

/** Pausa entre envíos para evitar rate-limit. @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Comando .broadcast <texto> (owner): envía un mensaje a todos los chats conocidos. */
export const broadcastCommand = {
  name: 'broadcast',
  aliases: ['bc'],
  category: 'owner',
  description: 'Envía un mensaje a todos los chats del bot',
  usage: 'broadcast <texto>',
  ownerOnly: true,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const text = ctx.text
    if (!text) return void (await ctx.reply('⚠️ Uso: .broadcast <texto a enviar>'))

    const chats = listChats().filter((jid) => !jid.endsWith('@broadcast') && !jid.endsWith('@newsletter'))
    if (!chats.length) return void (await ctx.reply('ℹ️ Aún no conozco ningún chat.'))

    let sent = 0
    for (const jid of chats) {
      try {
        await ctx.sock.sendMessage(jid, { text: `📢 *Broadcast*\n\n${text}` })
        sent += 1
        await sleep(250)
      } catch {
        /* continúa con el siguiente chat */
      }
    }
    await ctx.reply(`📢 Broadcast enviado a ${sent}/${chats.length} chats.`)
  },
}
