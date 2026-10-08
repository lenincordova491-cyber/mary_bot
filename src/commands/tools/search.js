import { fetchText, stripHtml } from '../../lib/utils.js'
import { searchYouTubeVideos } from '../../engines/spotify.js'

/** @typedef {{title: string, url: string}} SearchResult */

/**
 * Busca en Google (scraping de la versión HTML).
 * @param {string} query Consulta.
 * @returns {Promise<SearchResult[]>} Hasta 5 resultados.
 */
export async function googleSearch(query) {
  const html = await fetchText(
    `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8&hl=es`,
  )
  /** @type {SearchResult[]} */
  const results = []
  const re = /<a href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>(?:<[^>]+>)*([^<]{3,120})</g
  let match
  while ((match = re.exec(html)) && results.length < 5) {
    const url = decodeURIComponent(match[1])
    if (url.includes('google.') || url.includes('accounts.google')) continue
    results.push({ title: match[2].trim(), url })
  }
  return results
}

/**
 * Busca con DuckDuckGo (fallback de Google).
 * @param {string} query Consulta.
 * @returns {Promise<SearchResult[]>}
 */
export async function duckDuckGoSearch(query) {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)
  /** @type {SearchResult[]} */
  const results = []
  const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let match
  while ((match = re.exec(html)) && results.length < 5) {
    let url = match[1]
    const uddg = url.match(/[?&]uddg=([^&]+)/)
    if (uddg) url = decodeURIComponent(uddg[1])
    const title = stripHtml(match[2]).trim()
    if (title && url.startsWith('http')) results.push({ title, url })
  }
  return results
}

/**
 * Busca en Google con fallback a DuckDuckGo.
 * @param {string} query Consulta.
 * @returns {Promise<SearchResult[]>}
 */
export async function webSearch(query) {
  try {
    const results = await googleSearch(query)
    if (results.length) return results
  } catch {
    /* fallback */
  }
  return duckDuckGoSearch(query)
}

/**
 * Busca artículos en Wikipedia (español).
 * @param {string} query Consulta.
 * @returns {Promise<{title: string, snippet: string, url: string}[]>}
 */
export async function wikipediaSearch(query) {
  const raw = await fetchText(
    `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`,
  )
  const data = JSON.parse(raw)
  const items = data?.query?.search ?? []
  return items.map((item) => ({
    title: item.title,
    snippet: stripHtml(item.snippet ?? '').trim(),
    url: `https://es.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(' ', '_'))}`,
  }))
}

/**
 * Obtiene la letra de una canción con api.lyrics.ovh.
 * @param {string} artist Artista.
 * @param {string} title Título.
 * @returns {Promise<string>} Letra de la canción.
 */
export async function fetchLyrics(artist, title) {
  const raw = await fetchText(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
  )
  const data = JSON.parse(raw)
  if (!data?.lyrics) throw new Error('No encontré la letra de esa canción.')
  return String(data.lyrics).trim()
}

/** Comando .search (alias .google): búsqueda web con Google/DuckDuckGo. */
export const searchCommand = {
  name: 'search',
  aliases: ['google', 'buscar'],
  category: 'tools',
  description: 'Busca en la web (Google/DuckDuckGo)',
  usage: 'search <consulta>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const query = ctx.text
    if (!query) return void (await ctx.reply('⚠️ Uso: .search <consulta>'))
    try {
      const results = await webSearch(query)
      if (!results.length) return void (await ctx.reply('❌ Sin resultados.'))
      const lines = results.map((r, i) => `${i + 1}. *${r.title}*\n${r.url}`)
      await ctx.reply(`🔎 *Resultados para:* _${query}_\n\n${lines.join('\n\n')}`)
    } catch (err) {
      await ctx.reply(`❌ La búsqueda falló: ${err.message}`)
    }
  },
}

/** Comando .wikipedia (alias .wiki): resúmenes de artículos. */
export const wikipediaCommand = {
  name: 'wikipedia',
  aliases: ['wiki'],
  category: 'tools',
  description: 'Busca en Wikipedia',
  usage: 'wikipedia <consulta>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const query = ctx.text
    if (!query) return void (await ctx.reply('⚠️ Uso: .wikipedia <consulta>'))
    try {
      const results = await wikipediaSearch(query)
      if (!results.length) return void (await ctx.reply('❌ No encontré artículos en Wikipedia.'))
      const lines = results.map((r, i) => `${i + 1}. *${r.title}*\n${r.snippet}…\n${r.url}`)
      await ctx.reply(`📚 *Wikipedia:* _${query}_\n\n${lines.join('\n\n')}`)
    } catch (err) {
      await ctx.reply(`❌ La búsqueda en Wikipedia falló: ${err.message}`)
    }
  },
}

/** Comando .ytsearch (alias .yts): primeros videos de YouTube para una consulta. */
export const ytSearchCommand = {
  name: 'ytsearch',
  aliases: ['yts'],
  category: 'tools',
  description: 'Busca videos en YouTube',
  usage: 'ytsearch <consulta>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const query = ctx.text
    if (!query) return void (await ctx.reply('⚠️ Uso: .ytsearch <consulta>'))
    try {
      const videos = await searchYouTubeVideos(query, 5)
      if (!videos.length) return void (await ctx.reply('❌ Sin resultados en YouTube.'))
      const lines = videos.map((v, i) => `${i + 1}. ${v.title}\n${v.url}`)
      await ctx.reply(`🎬 *YouTube:* _${query}_\n\n${lines.join('\n\n')}\n\n💡 Copia una URL y usa .ytmp3 o .ytmp4 para descargar.`)
    } catch (err) {
      await ctx.reply(`❌ La búsqueda en YouTube falló: ${err.message}`)
    }
  },
}

/** Comando .lyrics (alias .letra): letra de una canción ("artista - título"). */
export const lyricsCommand = {
  name: 'lyrics',
  aliases: ['letra'],
  category: 'tools',
  description: 'Letra de una canción (artista - título)',
  usage: 'lyrics <artista> - <título>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const parts = ctx.text.split(/\s+-\s+/)
    if (!ctx.text || parts.length < 2) {
      await ctx.reply('⚠️ Uso: .lyrics <artista> - <título>\nEjemplo: .lyrics Rick Astley - Never Gonna Give You Up')
      return
    }
    const [artist, title] = [parts[0].trim(), parts.slice(1).join(' - ').trim()]
    try {
      const lyrics = await fetchLyrics(artist, title)
      const clipped = lyrics.length > 3500 ? `${lyrics.slice(0, 3500)}…\n\n_(letra truncada)_` : lyrics
      await ctx.reply(`🎤 *${artist} — ${title}*\n\n${clipped}`)
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`)
    }
  },
}
