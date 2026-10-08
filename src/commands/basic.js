import { BOT_NAME } from '../config.js'

/** Advertencia sobre riesgo de baneo incluida en .start y .help. */
export const BAN_WARNING =
  '⚠️ *Aviso importante:* automatizar WhatsApp con un bot no es oficial y existe riesgo de que tu número sea *baneado*. ' +
  'Usa un número secundario y no hagas spam.\n'

/** Encabezados de categorías para .help. */
const CATEGORY_HEADERS = {
  basic: '📡 *Básicos*',
  downloader: '📥 *Descargas*',
  tools: '🛠️ *Herramientas*',
  ai: '🤖 *IA*',
  owner: '👑 *Owner*',
  plugins: '🧩 *Plugins*',
}

/** Comando .start (alias: .menu, .hola). */
export const startCommand = {
  name: 'start',
  aliases: ['menu', 'hola'],
  category: 'basic',
  description: 'Saludo inicial del bot',
  usage: 'start',
  ownerOnly: false,
  /**
   * @param {import('../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    await ctx.reply(
      `¡Hola! Soy ${BOT_NAME} 🐱, tu bot de descargas y utilidades.\n` +
      'Escribe *.help* para ver todo lo que puedo hacer.\n\n' +
      BAN_WARNING,
    )
  },
}

/** Comando .ping. */
export const pingCommand = {
  name: 'ping',
  aliases: ['pong'],
  category: 'basic',
  description: 'Comprueba que el bot responde',
  usage: 'ping',
  ownerOnly: false,
  /**
   * @param {import('../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    await ctx.reply('Pong 🏓')
  },
}

/** Comando .help (alias: .ayuda): lista dinámica de comandos por categoría. */
export const helpCommand = {
  name: 'help',
  aliases: ['ayuda', 'comandos'],
  category: 'basic',
  description: 'Muestra esta lista de comandos',
  usage: 'help',
  ownerOnly: false,
  /**
   * @param {import('../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const prefix = ctx.args.length ? ctx.args[0] : null
    const groups = /** @type {Record<string, import('../handler.js').CommandModule[]>} */ ({})
    for (const cmd of ctx.commands ?? []) {
      const cat = cmd.category ?? 'basic'
      ;(groups[cat] ??= []).push(cmd)
    }

    /** @type {string[]} */
    const lines = [`*🐱 ${BOT_NAME} — Comandos*\n`]
    for (const [category, header] of Object.entries(CATEGORY_HEADERS)) {
      const mods = groups[category]
      if (!mods?.length) continue
      lines.push(header)
      for (const mod of mods.sort((a, b) => a.name.localeCompare(b.name))) {
        const names = [mod.name, ...(mod.aliases ?? [])].join('/')
        const usage = mod.usage ? ` ${prefix ?? '.'}${mod.usage}` : ''
        lines.push(`• *${prefix ?? '.'}${names}*${usage ? '' : ''}${mod.description ? ` — ${mod.description}` : ''}${usage}`)
      }
      lines.push('')
    }
    lines.push(BAN_WARNING)
    await ctx.reply(lines.join('\n'))
  },
}
