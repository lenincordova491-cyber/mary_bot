import { askAI } from '../../lib/ai-client.js'
import { clearAiHistory, getAiHistory, pushAiHistory } from '../../lib/database.js'

/** Comando .ai <mensaje>: conversación con IA manteniendo contexto por chat. */
export const aiCommand = {
  name: 'ai',
  aliases: ['chatgpt', 'mary'],
  category: 'ai',
  description: 'Habla con la IA (mantiene contexto; .ai reset limpia el historial)',
  usage: 'ai <mensaje>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const prompt = ctx.text
    if (!prompt) return void (await ctx.reply('⚠️ Uso: .ai <mensaje>\nEjemplo: .ai explícame qué es un haiku'))

    if (prompt.toLowerCase() === 'reset') {
      clearAiHistory(ctx.jid)
      await ctx.reply('🧹 Historial de IA borrado para este chat.')
      return
    }

    try {
      await ctx.sock.sendPresenceUpdate?.('composing', ctx.jid)
    } catch {
      /* opcional */
    }

    try {
      const history = getAiHistory(ctx.jid).map((h) => ({ role: h.role, content: h.content }))
      const answer = await askAI(prompt, history)
      pushAiHistory(ctx.jid, 'user', prompt)
      pushAiHistory(ctx.jid, 'assistant', answer)
      await ctx.reply(answer)
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`)
    }
  },
}
