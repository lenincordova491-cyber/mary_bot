import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('youtube-dl-exec', () => ({ default: vi.fn() }))
vi.mock('node:child_process', () => ({ execFile: vi.fn() }))

import ytdlp from 'youtube-dl-exec'
import { execFile } from 'node:child_process'
import { detectEngine, dispatchDownload, UNKNOWN_URL_MESSAGE } from '../src/engines/universal.js'
import { downloadYouTubeAudio, downloadYouTubeVideo } from '../src/engines/youtube.js'
import { downloadTikTok } from '../src/engines/tiktok.js'
import { downloadFacebook } from '../src/engines/facebook.js'
import { downloadInstagram } from '../src/engines/instagram.js'
import {
  downloadSpotifyTrack,
  fetchSpotifyMetadata,
  parseSpotifyUrl,
  searchYouTube,
} from '../src/engines/spotify.js'
import { downloadMediafire, fileNameFromHeaders, getMediafireDirectLink } from '../src/engines/mediafire.js'
import { FileTooLargeError } from '../src/lib/utils.js'
import { TMP_DIR } from '../src/config.js'

const fixture = (name) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8')

/**
 * Implementación del mock de yt-dlp: dumpSingleJson devuelve info; las descargas
 * escriben un archivo en la plantilla output (como haría yt-dlp).
 * @param {any} info Metadatos a devolver.
 */
function mockYtDlp(info) {
  vi.mocked(ytdlp).mockImplementation(async (_url, flags = {}) => {
    if (flags.dumpSingleJson) return info
    if (typeof flags.output === 'string' && flags.output.includes('%(ext)s')) {
      const ext = flags.extractAudio ? 'mp3' : 'mp4'
      fs.writeFileSync(flags.output.replace('%(ext)s', ext), Buffer.from(`contenido-${ext}`))
      return undefined
    }
    return undefined
  })
}

/** Responde el mock de fetch según la URL solicitada. @param {Array<[RegExp, () => any]>} routes */
function mockFetch(routes) {
  const fetchMock = vi.fn(async (url) => {
    for (const [pattern, responder] of routes) {
      if (pattern.test(String(url))) return responder()
    }
    throw new Error(`fetch no mockeado para ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const reply = vi.fn(async (t) => t)

/** @returns {{sendMessage: any, readMessages: any, user: {id: string}}} */
function fakeSock() {
  return {
    sendMessage: vi.fn(async () => ({ key: { id: 'sent' } })),
    readMessages: vi.fn(async () => {}),
    user: { id: '521471234567:1@s.whatsapp.net' },
  }
}

beforeEach(() => {
  vi.mocked(ytdlp).mockReset()
  vi.mocked(execFile).mockReset()
  vi.unstubAllGlobals()
  reply.mockClear()
})

describe('detectEngine', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc123', 'youtube'],
    ['https://youtu.be/abc123', 'youtube'],
    ['https://music.youtube.com/watch?v=abc123', 'youtube'],
    ['https://www.tiktok.com/@user/video/123456', 'tiktok'],
    ['https://vm.tiktok.com/ZMabc123/', 'tiktok'],
    ['https://www.instagram.com/reel/abc123/', 'instagram'],
    ['https://www.facebook.com/watch/?v=123', 'facebook'],
    ['https://fb.watch/abc123/', 'facebook'],
    ['https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb', 'spotify'],
    ['https://www.mediafire.com/file/abc/file.mp3/file', 'mediafire'],
    ['https://example.com/video', 'unknown'],
    ['no es una URL', 'unknown'],
  ])('%s -> %s', (url, expected) => {
    expect(detectEngine(url)).toBe(expected)
  })

  it('el mensaje de URL desconocida lista todos los dominios soportados', () => {
    for (const domain of ['youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com', 'facebook.com', 'fb.watch', 'open.spotify.com', 'mediafire.com']) {
      expect(UNKNOWN_URL_MESSAGE).toContain(domain)
    }
  })
})

describe('motor de YouTube (yt-dlp)', () => {
  it('descarga audio en MP3 con el título del video', async () => {
    mockYtDlp({ title: 'Mi Video de Prueba', filesize: 1024 * 1024 })
    const result = await downloadYouTubeAudio('https://youtu.be/abc123')
    expect(result.fileName).toBe('Mi Video de Prueba.mp3')
    expect(result.mimetype).toBe('audio/mpeg')
    expect(fs.existsSync(result.filePath)).toBe(true)
    fs.unlinkSync(result.filePath)
  })

  it('descarga video en MP4', async () => {
    mockYtDlp({ title: 'Video Prueba', filesize: 1024 })
    const result = await downloadYouTubeVideo('https://youtu.be/abc123')
    expect(result.fileName).toBe('Video Prueba.mp4')
    expect(result.mimetype).toBe('video/mp4')
    fs.unlinkSync(result.filePath)
  })

  it('rechaza sin descargar cuando los metadatos indican un archivo mayor al límite', async () => {
    mockYtDlp({ title: 'Gigante', filesize: 150 * 1024 * 1024 })
    await expect(downloadYouTubeAudio('https://youtu.be/abc123')).rejects.toBeInstanceOf(FileTooLargeError)
  })
})

describe('motores TikTok y Facebook (yt-dlp)', () => {
  it('descarga un video de TikTok', async () => {
    mockYtDlp({ title: 'Baile Viral', filesize: null })
    const result = await downloadTikTok('https://www.tiktok.com/@u/video/1')
    expect(result.fileName).toBe('Baile Viral.mp4')
    expect(result.mimetype).toBe('video/mp4')
    fs.unlinkSync(result.filePath)
  })

  it('descarga un video de Facebook', async () => {
    mockYtDlp({ title: null, filesize: null })
    const result = await downloadFacebook('https://fb.watch/abc/')
    expect(result.mimetype).toBe('video/mp4')
    expect(result.fileName).toContain('video-facebook')
    fs.unlinkSync(result.filePath)
  })
})

describe('motor de Instagram (gallery-dl con fallback yt-dlp)', () => {
  it('usa gallery-dl y devuelve los archivos del carrusel', async () => {
    // Simula los archivos que gallery-dl habría descargado.
    vi.mocked(execFile).mockImplementation(((bin, args, opts, cb) => {
      for (let i = 0; i < 2; i += 1) {
        fs.writeFileSync(path.join(TMP_DIR, `insta-carousel-${Date.now()}-${i}.jpg`), Buffer.from('jpg'))
      }
      cb?.(null, '', '')
      return undefined
    }))
    const results = await downloadInstagram('https://www.instagram.com/p/abc/')
    expect(results.length).toBe(2)
    expect(results[0].mimetype).toBe('image/jpeg')
    for (const r of results) fs.unlinkSync(r.filePath)
  })

  it('cae a yt-dlp cuando gallery-dl no está disponible', async () => {
    mockYtDlp(null)
    vi.mocked(execFile).mockImplementation(((bin, args, opts, cb) => {
      cb?.(new Error('ENOENT: gallery-dl no encontrado'))
      return undefined
    }))
    const results = await downloadInstagram('https://www.instagram.com/reel/abc/')
    expect(results.length).toBe(1)
    expect(results[0].fileName).toBe('instagram.mp4')
    fs.unlinkSync(results[0].filePath)
  })
})

describe('motor de Spotify', () => {
  it('parsea URLs de track/album/playlist', () => {
    expect(parseSpotifyUrl('https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb')).toEqual({ type: 'track', id: '6habFhsOp2NvshLv26DqMb' })
    expect(parseSpotifyUrl('https://open.spotify.com/intl-es/album/xyz')).toEqual({ type: 'album', id: 'xyz' })
    expect(parseSpotifyUrl('https://open.spotify.com/playlist/abc?si=1')).toEqual({ type: 'playlist', id: 'abc' })
    expect(parseSpotifyUrl('https://example.com/track/abc')).toBeNull()
  })

  it('obtiene metadatos desde la página embed (sin API key)', async () => {
    mockFetch([[/open\.spotify\.com\/embed/, () => new Response(fixture('spotify-embed.html'))]])
    const meta = await fetchSpotifyMetadata('https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb')
    expect(meta.title).toBe('Never Gonna Give You Up')
    expect(meta.artist).toBe('Rick Astley')
  })

  it('rechaza álbumes y listas con un mensaje claro', async () => {
    await expect(fetchSpotifyMetadata('https://open.spotify.com/album/xyz')).rejects.toThrow('Solo puedo descargar pistas')
  })

  it('busca en YouTube por scraping de resultados', async () => {
    mockFetch([[/youtube\.com\/results/, () => new Response(fixture('yt-search.html'))]])
    const found = await searchYouTube('rick astley never gonna give you up')
    expect(found?.id).toBe('dQw4w9WgXcQ')
    expect(found?.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(found?.title).toContain('Never Gonna Give You Up')
  })

  it('descarga la pista como "Artista - Título.mp3"', async () => {
    mockYtDlp(null)
    mockFetch([
      [/open\.spotify\.com\/embed/, () => new Response(fixture('spotify-embed.html'))],
      [/youtube\.com\/results/, () => new Response(fixture('yt-search.html'))],
    ])
    const result = await downloadSpotifyTrack('https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb')
    expect(result.fileName).toBe('Rick Astley - Never Gonna Give You Up.mp3')
    expect(result.title).toBe('Rick Astley - Never Gonna Give You Up')
    fs.unlinkSync(result.filePath)
  })
})

describe('motor de Mediafire (scraping)', () => {
  it('extrae el enlace directo de la página', async () => {
    mockFetch([[/www\.mediafire\.com/, () => new Response(fixture('mediafire-page.html'))]])
    const link = await getMediafireDirectLink('https://www.mediafire.com/file/abc/Cancion.mp3')
    expect(link).toContain('download2341.mediafire.com')
    expect(link.endsWith('.mp3')).toBe(true)
  })

  it('descarga el archivo respetando el nombre original', async () => {
    mockFetch([
      [/www\.mediafire\.com/, () => new Response(fixture('mediafire-page.html'))],
      [/download\d+\.mediafire\.com/, () => new Response(Buffer.from('mp3-data'), {
        headers: { 'content-disposition': 'attachment; filename="Cancion de prueba.mp3"' },
      })],
    ])
    const result = await downloadMediafire('https://www.mediafire.com/file/abc/Cancion.mp3')
    expect(result.fileName).toBe('Cancion de prueba.mp3')
    expect(result.mimetype).toBe('audio/mpeg')
    expect(fs.existsSync(result.filePath)).toBe(true)
    fs.unlinkSync(result.filePath)
  })

  it('falla con mensaje claro si la página no tiene enlace directo', async () => {
    mockFetch([[/.*/, () => new Response('<html>sin enlaces</html>')]])
    await expect(getMediafireDirectLink('https://www.mediafire.com/file/abc')).rejects.toThrow('No encontré el enlace')
  })

  it('deduce el nombre desde content-disposition (filename*) o de la URL', () => {
    const h = (v) => ({ get: () => v })
    expect(fileNameFromHeaders(h("attachment; filename*=UTF-8''Mi%20Archivo.pdf"), 'https://x/y')).toBe('Mi Archivo.pdf')
    expect(fileNameFromHeaders(h('attachment; filename="X.mp3"'), 'https://x/y')).toBe('X.mp3')
    expect(fileNameFromHeaders(h(null), 'https://x/y/Cancion.mp3')).toBe('Cancion.mp3')
  })
})

describe('dispatchDownload (integración con mocks)', () => {
  it('URL desconocida -> mensaje con los dominios soportados', async () => {
    const result = await dispatchDownload({ sock: fakeSock(), jid: 'x@s.whatsapp.net', url: 'https://example.com/a', reply })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unknown')
    expect(reply).toHaveBeenCalledTimes(1)
    expect(reply.mock.calls[0][0]).toContain('mediafire.com')
  })

  it('flujo completo: URL de YouTube -> motor (mock) -> documento sin compresión + limpieza', async () => {
    mockYtDlp({ title: 'Video Integración', filesize: 2048 })
    const sock = fakeSock()
    const result = await dispatchDownload({ sock, jid: 'x@s.whatsapp.net', url: 'https://youtu.be/int123', reply })
    expect(result.ok).toBe(true)
    expect(result.engine).toBe('youtube')

    const docCall = sock.sendMessage.mock.calls.find((c) => c[1]?.document)
    expect(docCall).toBeTruthy()
    const payload = docCall[1]
    expect(Buffer.isBuffer(payload.document)).toBe(true)
    expect(payload.fileName).toBe('Video Integración.mp4')
    expect(payload.mimetype).toBe('video/mp4')
    expect(docCall[2]).toBeUndefined() // sin quoted ni opciones de compresión
    expect(reply.mock.calls[0][0]).toContain('Descargando')

    // El archivo temporal se elimina tras enviarlo (limpieza en finally).
    const leftovers = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith('ytmp4-'))
    expect(leftovers).toEqual([])
  })

  it('rechaza con mensaje claro cuando el archivo supera 100 MB', async () => {
    mockYtDlp({ title: 'Pelicula Larga', filesize: 250 * 1024 * 1024 })
    const sock = fakeSock()
    const result = await dispatchDownload({ sock, jid: 'x@s.whatsapp.net', url: 'https://youtu.be/big1', reply })
    expect(result.ok).toBe(false)
    expect(reply.mock.calls.some((c) => String(c[0]).includes('supera el límite'))).toBe(true)
  })

  it('información de tamaño en el caption del documento', async () => {
    mockYtDlp({ title: 'Con Caption', filesize: 2048 })
    const sock = fakeSock()
    await dispatchDownload({ sock, jid: 'x@s.whatsapp.net', url: 'https://youtu.be/cap1', reply, notify: false })
    const docCall = sock.sendMessage.mock.calls.find((c) => c[1]?.document)
    expect(docCall[1].caption).toContain('Con Caption · 13 B')
  })
})

describe('downloadToFile (guardián de tamaño en streaming)', () => {
  it('aborta y borra el archivo si el body supera maxBytes', async () => {
    const bigBody = () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(64).fill(65))
        controller.close()
      },
    }))
    mockFetch([[/big\.example/, bigBody]])
    const { downloadToFile } = await import('../src/lib/utils.js')
    const dest = path.join(TMP_DIR, 'guard-test.bin')
    await expect(downloadToFile('https://big.example/file', dest, { maxBytes: 10 })).rejects.toBeInstanceOf(FileTooLargeError)
    expect(fs.existsSync(dest)).toBe(false)
  })
})
