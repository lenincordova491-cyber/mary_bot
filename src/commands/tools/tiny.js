import { firstUrl, fetchText } from '../../lib/utils.js'

/**
 * Acorta una URL con is.gd; si falla, intenta TinyURL.
 * @param {string} url URL larga.
 * @returns {Promise<string>} URL corta.
 */
export async function shortenUrl(url) {
  try {
    const short = (await fetchText(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`)).trim()
    if (short.startsWith('https://is.gd/') || short.startsWith('http://is.gd/')) return short
  } catch {
    /* intenta con TinyURL */
  }
  const fallback = (await fetchText(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)).trim()
  if (!fallback.startsWith('http')) throw new Error('No pude acortar la URL (los servicios no respondieron).')
  return fallback
}

/** Comando .tiny <url>: acorta URLs con is.gd/TinyURL. */
export const tinyCommand = {
  name: 'tiny',
  aliases: ['shorturl', 'acortar'],
  category: 'tools',
  description: 'Acorta una URL',
  usage: 'tiny <url>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const url = firstUrl(ctx.text)
    if (!url) {
      await ctx.reply('⚠️ Uso: .tiny <url>\nEjemplo: .tiny https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      return
    }
    try {
      const short = await shortenUrl(url)
      await ctx.reply(`🔗 ${short}`)
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`)
    }
  },
}
