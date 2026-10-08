import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { openaiMock, downloadMediaMessageMock } = vi.hoisted(() => ({
  openaiMock: {
    chat: { completions: { create: vi.fn() } },
    images: { generate: vi.fn() },
  },
  downloadMediaMessageMock: vi.fn(),
}))

vi.mock('openai', () => ({
  default: vi.fn(() => openaiMock),
}))

vi.mock('@whiskeysockets/baileys', () => ({
  downloadMediaMessage: downloadMediaMessageMock,
}))

const { fluentFfmpegMock } = vi.hoisted(() => ({ fluentFfmpegMock: vi.fn() }))
vi.mock('fluent-ffmpeg', () => ({ default: fluentFfmpegMock }))

import sharp from 'sharp'
import { handleMessage, loadCommands } from '../src/handler.js'
import { setDbPath, getSettings, setSetting, rememberChat, getAiHistory, clearAiHistory } from '../src/lib/database.js'
import { askAI } from '../src/lib/ai-client.js'

const OWNER = '521471234567'
const CHAT = `${OWNER}@s.whatsapp.net`
const OTHER = '521555987654'

const fixture = (name) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8')

/** Mensaje fake del owner. */
function ownerMsg(text, extra = {}) {
  return {
    key: { remoteJid: extra.jid ?? CHAT, fromMe: false, id: `T-${Math.random().toString(36).slice(2)}`, participant: `${OWNER}@s.whatsapp.net` },
    message: { conversation: text },
  }
}

/** Mensaje fake de un usuario cualquiera. */
function userMsg(text) {
  return {
    key: { remoteJid: `${OTHER}@s.whatsapp.net`, fromMe: false, id: `T-${Math.random().toString(36).slice(2)}` },
    message: { conversation: text },
  }
}

/** Mensaje con media adjunta o citada. */
function mediaMsg(text, nodeKey, nodeProps = {}, quoted = false) {
  const node = { mimetype: 'image/png', ...nodeProps }
  return {
    key: { remoteJid: CHAT, fromMe: false, id: `T-${Math.random().toString(36).slice(2)}`, participant: `${OWNER}@s.whatsapp.net` },
    message: quoted
      ? { extendedTextMessage: { text, contextInfo: { quotedMessage: { [nodeKey]: node }, participant: `${OWNER}@s.whatsapp.net` } } }
      : { [nodeKey]: node, conversation: text },
  }
}

/** Mensaje cuyo texto viaja en el caption de la imagen. */
function captionMsg(caption, nodeKey, nodeProps = {}) {
  const node = { mimetype: 'image/png', ...nodeProps }
  return {
    key: { remoteJid: CHAT, fromMe: false, id: `T-${Math.random().toString(36).slice(2)}`, participant: `${OWNER}@s.whatsapp.net` },
    message: { [nodeKey]: { ...node, caption } },
  }
}

function fakeSock() {
  return {
    sendMessage: vi.fn(async () => ({ key: { id: 'sent' } })),
    readMessages: vi.fn(async () => {}),
    updateBlockStatus: vi.fn(async () => {}),
    setProfilePicture: vi.fn(async () => {}),
    sendPresenceUpdate: vi.fn(async () => {}),
    user: { id: `${OWNER}:1@s.whatsapp.net` },
  }
}

const sentTexts = (sock) => sock.sendMessage.mock.calls.map((c) => c[1]?.text ?? '').filter(Boolean)
const sentPayloads = (sock) => sock.sendMessage.mock.calls.map((c) => c[1] ?? {})

/** PNG de prueba (sharp). */
async function testPng() {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 200, b: 120 } } }).png().toBuffer()
}

/** WebP de prueba (sticker). */
async function testWebp() {
  return sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 10, g: 200, b: 120, alpha: 1 } } }).webp().toBuffer()
}

beforeEach(async () => {
  setDbPath(path.join(os.tmpdir(), `mary_uwu_tests-${process.pid}`, `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}.json`))
  openaiMock.chat.completions.create.mockReset()
  openaiMock.images.generate.mockReset()
  downloadMediaMessageMock.mockReset()
  fluentFfmpegMock.mockReset()
  fluentFfmpegMock.mockImplementation(() => {
    const handlers = {}
    const chain = {
      outputOptions: vi.fn(() => chain),
      toFormat: vi.fn(() => chain),
      on: vi.fn((ev, cb) => {
        handlers[ev] = cb
        return chain
      }),
      save: vi.fn((out) => {
        // Escribe un GIF mínimo para que el comando pueda leer el archivo.
        fs.writeFileSync(out, Buffer.from('GIF89a'))
        handlers.end?.()
        return chain
      }),
    }
    return chain
  })
  await loadCommands()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function run(sock, ...messages) {
  await handleMessage({ messages, type: 'notify' }, sock)
}

describe('comandos owner — protección y funcionalidad', () => {
  it('un usuario normal no puede usar comandos de owner', async () => {
    const sock = fakeSock()
    await run(sock, userMsg('.broadcast hola a todos'))
    expect(sentTexts(sock)[0]).toContain('No tienes permiso para usar este comando')
    expect(sock.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('.broadcast envía a todos los chats conocidos y confirma', async () => {
    rememberChat('1203a@g.us')
    rememberChat(`${OTHER}@s.whatsapp.net`)
    const sock = fakeSock()
    // El chat del owner también queda registrado al llegar su comando.
    await run(sock, ownerMsg('.broadcast mantenimiento a medianoche'))
    const calls = sentPayloads(sock)
    expect(calls.filter((p) => p.text?.includes('📢 *Broadcast*')).length).toBe(3)
    expect(sentTexts(sock).at(-1)).toContain('Broadcast enviado a 3/3 chats')
  })

  it('.broadcast sin texto pide uso', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.broadcast'))
    expect(sentTexts(sock)[0]).toContain('Uso: .broadcast')
  })

  it('.block normaliza el número y bloquea', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.block 521555123456'))
    expect(sock.updateBlockStatus).toHaveBeenCalledWith('521555123456@s.whatsapp.net', 'block')
    expect(sentTexts(sock)[0]).toContain('bloqueado')
  })

  it('.unblock desbloquea', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.unblock 521555123456'))
    expect(sock.updateBlockStatus).toHaveBeenCalledWith('521555123456@s.whatsapp.net', 'unblock')
  })

  it('.autoread on/off cambia la preferencia', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.autoread on'))
    expect(getSettings().autoread).toBe(true)
    expect(sentTexts(sock)[0]).toContain('activado')
    await run(sock, ownerMsg('.autoread off'))
    expect(getSettings().autoread).toBe(false)
    expect(sentTexts(sock).at(-1)).toContain('desactivado')
  })

  it('.prefix cambia el prefijo efectivo del handler', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.prefix >'))
    expect(getSettings().prefix).toBe('>')
    // El nuevo prefijo funciona:
    const sock2 = fakeSock()
    await run(sock2, ownerMsg('>ping'))
    expect(sentTexts(sock2)[0]).toContain('Pong 🏓')
    setSetting('prefix', null)
  })

  it('.prefix rechaza prefijos inválidos', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.prefix hola mundo'))
    expect(sentTexts(sock)[0]).toContain('Uso: .prefix')
  })

  it('.reload recarga los comandos', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.reload'))
    expect(sentTexts(sock)[0]).toMatch(/recargados/)
  })

  it('.eval ejecuta código y devuelve el resultado', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.eval 2 + 2'))
    expect(sentTexts(sock)[0]).toContain('4')
  })

  it('.eval reporta errores del código', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.eval throw new Error("fallo custom")'))
    expect(sentTexts(sock)[0]).toContain('fallo custom')
  })

  it('.setpp actualiza la foto con una imagen adjunta', async () => {
    downloadMediaMessageMock.mockResolvedValue(await testPng())
    const sock = fakeSock()
    await run(sock, captionMsg('.setpp', 'imageMessage'))
    expect(sock.setProfilePicture).toHaveBeenCalledTimes(1)
    const buffer = sock.setProfilePicture.mock.calls[0][0]
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(sentTexts(sock)[0]).toContain('Foto de perfil actualizada')
  })
})

describe('módulo de IA (.ai y .imagine)', () => {
  beforeEach(() => {
    clearAiHistory(CHAT)
  })

  it('.ai responde con la IA y guarda contexto', async () => {
    const client = openaiMock
    client.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: '¡Hola! Soy Mary_uwu 🐱' } }],
    })
    const sock = fakeSock()
    await run(sock, ownerMsg('.ai hola quién eres'))
    expect(sentTexts(sock)[0]).toContain('¡Hola! Soy Mary_uwu 🐱')
    const history = getAiHistory(CHAT)
    expect(history.length).toBe(2)
    expect(history[0]).toEqual({ role: 'user', content: 'hola quién eres' })
    expect(history[1]).toEqual({ role: 'assistant', content: '¡Hola! Soy Mary_uwu 🐱' })
  })

  it('.ai envía el historial previo al modelo', async () => {
    clearAiHistory(CHAT)
    const client = openaiMock
    client.chat.completions.create
      .mockResolvedValueOnce({ choices: [{ message: { content: 'primer turno' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'segundo turno' } }] })
    const sock = fakeSock()
    await run(sock, ownerMsg('.ai turno uno'), ownerMsg('.ai turno dos'))
    const secondCall = client.chat.completions.create.mock.calls[1][0]
    expect(secondCall.messages).toEqual(expect.arrayContaining([
      { role: 'user', content: 'turno uno' },
      { role: 'assistant', content: 'primer turno' },
    ]))
  })

  it('.ai reset limpia el historial', async () => {
    const client = openaiMock
    client.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })
    const sock = fakeSock()
    await run(sock, ownerMsg('.ai hola'), ownerMsg('.ai reset'))
    expect(getAiHistory(CHAT)).toEqual([])
    expect(sentTexts(sock).at(-1)).toContain('Historial de IA borrado')
  })

  it('.ai reporta errores de la IA con mensaje claro', async () => {
    const client = openaiMock
    client.chat.completions.create.mockRejectedValue(new Error('quota excedida'))
    const sock = fakeSock()
    await run(sock, ownerMsg('.ai hola'))
    expect(sentTexts(sock)[0]).toContain('quota excedida')
  })

  it('askAI exige OPENAI_API_KEY configurada', async () => {
    const original = process.env.OPENAI_API_KEY
    try {
      process.env.OPENAI_API_KEY = ''
      await expect(askAI('hola')).rejects.toThrow('OPENAI_API_KEY')
    } finally {
      process.env.OPENAI_API_KEY = original
    }
  })

  it('.imagine genera y envía una imagen', async () => {
    const client = openaiMock
    const png = await testPng()
    client.images.generate.mockResolvedValue({ data: [{ b64_json: png.toString('base64') }] })
    const sock = fakeSock()
    await run(sock, ownerMsg('.imagine un gato astronauta'))
    const imageCall = sentPayloads(sock).find((p) => p.image)
    expect(imageCall).toBeTruthy()
    expect(Buffer.isBuffer(imageCall.image)).toBe(true)
    expect(imageCall.caption).toContain('un gato astronauta')
    expect(client.images.generate).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'un gato astronauta' }))
  })

  it('.imagine descarga la imagen por URL si el modelo responde con url', async () => {
    const client = openaiMock
    const png = await testPng()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(png, { status: 200 })))
    client.images.generate.mockResolvedValue({ data: [{ url: 'https://cdn.openai.test/img.png' }] })
    const sock = fakeSock()
    await run(sock, ownerMsg('.imagine paisaje'))
    const imageCall = sentPayloads(sock).find((p) => p.image)
    expect(imageCall).toBeTruthy()
    expect(imageCall.image.length).toBeGreaterThan(0)
  })

  it('.imagine sin descripción pide uso', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.imagine'))
    expect(sentTexts(sock)[0]).toContain('Uso: .imagine')
  })
})

describe('comandos de conversión', () => {
  it('.sticker con imagen adjunta devuelve un sticker WebP', async () => {
    downloadMediaMessageMock.mockResolvedValue(await testPng())
    const sock = fakeSock()
    await run(sock, captionMsg('.sticker', 'imageMessage'))
    const stickerCall = sentPayloads(sock).find((p) => p.sticker)
    expect(stickerCall).toBeTruthy()
    const meta = await sharp(stickerCall.sticker).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width, meta.height)).toBe(512)
  })

  it('.sticker sin media avisa al usuario', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.sticker'))
    expect(sentTexts(sock)[0]).toContain('Envía una imagen/video')
  })

  it('.toimg convierte un sticker citado a imagen', async () => {
    downloadMediaMessageMock.mockResolvedValue(await testWebp())
    const sock = fakeSock()
    await run(sock, mediaMsg('.toimg', 'stickerMessage', { mimetype: 'image/webp' }, true))
    const imageCall = sentPayloads(sock).find((p) => p.image)
    expect(imageCall).toBeTruthy()
    const meta = await sharp(imageCall.image).metadata()
    expect(meta.format).toBe('png')
  })

  it('.toimg sin sticker citado avisa', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.toimg'))
    expect(sentTexts(sock)[0]).toContain('Cita un sticker')
  })

  it('.topdf convierte una imagen adjunta a PDF documento', async () => {
    downloadMediaMessageMock.mockResolvedValue(await testPng())
    const sock = fakeSock()
    await run(sock, captionMsg('.topdf', 'imageMessage'))
    const docCall = sentPayloads(sock).find((p) => p.document)
    expect(docCall).toBeTruthy()
    expect(docCall.fileName).toBe('imagen.pdf')
    expect(docCall.mimetype).toBe('application/pdf')
    expect(docCall.document.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('.gif convierte un video citado a GIF reproducible', async () => {
    downloadMediaMessageMock.mockResolvedValue(Buffer.from('video-fake'))
    const sock = fakeSock()
    await run(sock, mediaMsg('.gif', 'videoMessage', { mimetype: 'video/mp4', seconds: 5 }, true))
    const gifCall = sentPayloads(sock).find((p) => p.video && p.gifPlayback)
    expect(gifCall).toBeTruthy()
    expect(fluentFfmpegMock).toHaveBeenCalledTimes(1)
    expect(fluentFfmpegMock.mock.results[0].value.toFormat).toHaveBeenCalledWith('gif')
  })
})

describe('comandos de herramientas (fetch mockeado)', () => {
  function mockFetchRoutes(routes) {
    const fetchMock = vi.fn(async (url) => {
      for (const [pattern, responder] of routes) {
        if (pattern.test(String(url))) return responder()
      }
      throw new Error(`fetch no mockeado: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('.tiny acorta con is.gd', async () => {
    mockFetchRoutes([[/is\.gd\/create/, () => new Response('https://is.gd/abc123')]])
    const sock = fakeSock()
    await run(sock, ownerMsg('.tiny https://example.com/muy/largo'))
    expect(sentTexts(sock)[0]).toContain('https://is.gd/abc123')
  })

  it('.tiny cae a TinyURL si is.gd falla', async () => {
    mockFetchRoutes([
      [/is\.gd\/create/, () => new Response('Error: bad url', { status: 500 })],
      [/tinyurl\.com\/api-create/, () => new Response('https://tinyurl.com/xyz')],
    ])
    const sock = fakeSock()
    await run(sock, ownerMsg('.tiny https://example.com/x'))
    expect(sentTexts(sock)[0]).toContain('https://tinyurl.com/xyz')
  })

  it('.enc y .dec codifican/decodifican URLs', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.enc hola mundo/ñ'), ownerMsg('.dec hola%20mundo%2F%C3%B1'))
    expect(sentTexts(sock)[0]).toBe('🔐 hola%20mundo%2F%C3%B1')
    expect(sentTexts(sock)[1]).toBe('🔓 hola mundo/ñ')
  })

  it('.search devuelve resultados de Google', async () => {
    mockFetchRoutes([[/google\.com\/search/, () => new Response(fixture('google-results.html'))]])
    const sock = fakeSock()
    await run(sock, ownerMsg('.search node.js tutorial'))
    const text = sentTexts(sock)[0]
    expect(text).toContain('Resultados para')
    expect(text).toContain('nodejs.org')
  })

  it('.search usa DuckDuckGo cuando Google no devuelve resultados', async () => {
    mockFetchRoutes([
      [/google\.com\/search/, () => new Response('<html>consent</html>')],
      [/duckduckgo\.com/, () => new Response(fixture('ddg-results.html'))],
    ])
    const sock = fakeSock()
    await run(sock, ownerMsg('.search bot whatsapp'))
    expect(sentTexts(sock)[0]).toContain('whiskeysockets')
  })

  it('.wikipedia lista artículos', async () => {
    mockFetchRoutes([[/wikipedia\.org\/w\/api\.php/, () => new Response(JSON.stringify({
      query: { search: [{ title: 'Node.js', snippet: '<span>Entorno de ejecución de JavaScript</span>' }] },
    }))]])
    const sock = fakeSock()
    await run(sock, ownerMsg('.wikipedia node.js'))
    const text = sentTexts(sock)[0]
    expect(text).toContain('Node.js')
    expect(text).toContain('https://es.wikipedia.org/wiki/Node.js')
    expect(text).toContain('Entorno de ejecución')
  })

  it('.ytsearch lista videos', async () => {
    mockFetchRoutes([[/youtube\.com\/results/, () => new Response(fixture('yt-search.html'))]])
    const sock = fakeSock()
    await run(sock, ownerMsg('.ytsearch rick astley'))
    expect(sentTexts(sock)[0]).toContain('dQw4w9WgXcQ')
  })

  it('.lyrics obtiene la letra', async () => {
    mockFetchRoutes([[/api\.lyrics\.ovh/, () => new Response(JSON.stringify({ lyrics: 'Never gonna give you up…' }))]])
    const sock = fakeSock()
    await run(sock, ownerMsg('.lyrics Rick Astley - Never Gonna Give You Up'))
    expect(sentTexts(sock)[0]).toContain('Never gonna give you up')
  })

  it('.lyrics sin formato correcto pide uso', async () => {
    const sock = fakeSock()
    await run(sock, ownerMsg('.lyrics solo-cancion'))
    expect(sentTexts(sock)[0]).toContain('Uso: .lyrics')
  })

  it('.clima muestra el clima actual', async () => {
    mockFetchRoutes([
      [/geocoding-api\.open-meteo\.com/, () => new Response(JSON.stringify({ results: [{ name: 'Lima', country: 'Perú', latitude: -12.05, longitude: -77.04 }] }))],
      [/api\.open-meteo\.com\/v1\/forecast/, () => new Response(JSON.stringify({ current: { temperature_2m: 18.3, relative_humidity_2m: 70, weather_code: 2, wind_speed_10m: 9.2 } }))],
    ])
    const sock = fakeSock()
    await run(sock, ownerMsg('.clima Lima'))
    const text = sentTexts(sock)[0]
    expect(text).toContain('Clima en Lima, Perú')
    expect(text).toContain('18.3 °C')
    expect(text).toContain('Parcialmente nublado')
  })

  it('.clima con ciudad inexistente avisa claramente', async () => {
    mockFetchRoutes([[/geocoding-api\.open-meteo\.com/, () => new Response(JSON.stringify({}))]])
    const sock = fakeSock()
    await run(sock, ownerMsg('.clima asdfghjkl'))
    expect(sentTexts(sock)[0]).toContain('No encontré la ciudad')
  })
})

describe('comandos downloader — validación de uso', () => {
  it.each(['.ytmp3', '.ytmp4', '.tiktok', '.instagram', '.facebook', '.spotify', '.mediafire', '.dl'])('%s sin URL pide uso', async (cmd) => {
    const sock = fakeSock()
    await run(sock, ownerMsg(cmd))
    expect(sentTexts(sock)[0]).toContain('Uso:')
  })
})
