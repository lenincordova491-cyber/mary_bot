import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  commandRegistry,
  getCommand,
  handleMessage,
  listCommands,
  loadCommands,
  registerCommand,
  setUrlDispatcher,
} from '../src/handler.js'
import { setSetting } from '../src/lib/database.js'
import { setDbPath } from '../src/lib/database.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const OWNER = '521471234567'
const OTHER = '521555987654'

/** Crea un mensaje fake de Baileys. */
function fakeMsg(text, opts = {}) {
  return {
    key: {
      remoteJid: opts.jid ?? `${OTHER}@s.whatsapp.net`,
      fromMe: opts.fromMe ?? false,
      id: `TEST-${Math.random().toString(36).slice(2)}`,
      ...(opts.participant ? { participant: opts.participant } : {}),
    },
    message: opts.extended ? { extendedTextMessage: { text } } : { conversation: text },
    pushName: 'Tester',
  }
}

/** Crea un socket fake de Baileys. */
function fakeSock() {
  return {
    sendMessage: vi.fn(async () => ({ key: { id: 'sent' } })),
    readMessages: vi.fn(async () => {}),
    user: { id: `${OWNER}:1@s.whatsapp.net` },
  }
}

const sentTexts = (sock) => sock.sendMessage.mock.calls.map((c) => c[1]?.text ?? '')

beforeEach(() => {
  setDbPath(path.join(os.tmpdir(), `mary_uwu_tests-${process.pid}`, `db-${Date.now()}-${Math.random().toString(36).slice(2)}.json`))
  setUrlDispatcher(null)
})

beforeAll(async () => {
  await loadCommands()
})

afterAll(() => {
  fs.rmSync(path.join(os.tmpdir(), `mary_uwu_tests-${process.pid}`), { recursive: true, force: true })
})

describe('registro de comandos', () => {
  it('carga los comandos básicos con sus alias', () => {
    expect(getCommand('ping')).toBeTruthy()
    expect(getCommand('start')).toBeTruthy()
    expect(getCommand('menu')).toBe(getCommand('start')) // alias
    expect(getCommand('ayuda')).toBe(getCommand('help')) // alias
    expect(getCommand('noexiste')).toBeNull()
  })

  it('ignora módulos exportados que no son comandos', () => {
    const before = commandRegistry.size
    registerCommand(/** @type {any} */ ({ name: 'roto' }))
    registerCommand(/** @type {any} */ (null))
    expect(commandRegistry.size).toBe(before)
  })
})

describe('handleMessage — comandos básicos', () => {
  it('.ping responde "Pong 🏓"', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.ping')], type: 'notify' }, sock)
    expect(sock.sendMessage).toHaveBeenCalledTimes(1)
    expect(sentTexts(sock)[0]).toContain('Pong 🏓')
  })

  it('.start responde con el saludo de Mary_uwu y la advertencia de baneo', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.start')], type: 'notify' }, sock)
    const text = sentTexts(sock)[0]
    expect(text).toContain('¡Hola! Soy Mary_uwu 🐱')
    expect(text).toContain('número secundario')
  })

  it('.help lista las categorías y usa el prefijo configurado', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.help')], type: 'notify' }, sock)
    const text = sentTexts(sock)[0]
    expect(text).toContain('Comandos')
    expect(text).toContain('.ping')
    expect(text).toContain('Básicos')
  })

  it('los mensajes con texto en extendedTextMessage también ejecutan comandos', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.ping', { extended: true })], type: 'notify' }, sock)
    expect(sentTexts(sock)[0]).toContain('Pong 🏓')
  })

  it('responde con error ante un comando desconocido', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.blablabla')], type: 'notify' }, sock)
    expect(sentTexts(sock)[0]).toContain('no reconocido')
  })

  it('ignora mensajes sin prefijo y sin URL, y los de status@broadcast', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('hola qué tal'), fakeMsg('.ping', { jid: 'status@broadcast' })], type: 'notify' }, sock)
    expect(sock.sendMessage).not.toHaveBeenCalled()
  })

  it('ignora el lote de tipo append (sincronización de historial)', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.ping')], type: 'append' }, sock)
    expect(sock.sendMessage).not.toHaveBeenCalled()
  })

  it('captura errores del comando y responde con el mensaje de error', async () => {
    registerCommand(/** @type {any} */ ({
      name: 'falla',
      category: 'basic',
      handler: async () => {
        throw new Error('boom intencional')
      },
    }))
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.falla')], type: 'notify' }, sock)
    expect(sentTexts(sock)[0]).toContain('❌ Error: boom intencional')
  })
})

describe('handleMessage — permisos de owner', () => {
  beforeEach(() => {
    registerCommand(/** @type {any} */ ({
      name: 'soloowner',
      category: 'basic',
      ownerOnly: true,
      handler: async (ctx) => ctx.reply('ejecutado'),
    }))
  })

  it('bloquea a un usuario que no es owner', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.soloowner')], type: 'notify' }, sock)
    expect(sentTexts(sock)[0]).toContain('No tienes permiso para usar este comando')
  })

  it('permite al owner por número configurado', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.soloowner', { jid: `${OWNER}@s.whatsapp.net` })], type: 'notify' }, sock)
    expect(sentTexts(sock)[0]).toContain('ejecutado')
  })

  it('permite al owner en un grupo (participant coincide)', async () => {
    const sock = fakeSock()
    await handleMessage({
      messages: [fakeMsg('.soloowner', { jid: '1203456789@g.us', participant: `${OWNER}@s.whatsapp.net` })],
      type: 'notify',
    }, sock)
    expect(sentTexts(sock)[0]).toContain('ejecutado')
  })

  it('permite comandos del propio bot (fromMe)', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('.soloowner', { fromMe: true })], type: 'notify' }, sock)
    expect(sentTexts(sock)[0]).toContain('ejecutado')
  })
})

describe('handleMessage — autoread y dispatcher de URLs', () => {
  it('lee los mensajes cuando autoread está activo', async () => {
    setSetting('autoread', true)
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('hola sin prefijo')], type: 'notify' }, sock)
    expect(sock.readMessages).toHaveBeenCalledTimes(1)
    setSetting('autoread', false)
  })

  it('delega URLs sin comando al dispatcher universal', async () => {
    const dispatcher = vi.fn(async () => {})
    setUrlDispatcher(dispatcher)
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('mira https://youtu.be/abc123')], type: 'notify' }, sock)
    expect(dispatcher).toHaveBeenCalledTimes(1)
    expect(dispatcher.mock.calls[0][0].url).toBe('https://youtu.be/abc123')
  })

  it('no delega URLs en mensajes del propio bot (fromMe)', async () => {
    const dispatcher = vi.fn(async () => {})
    setUrlDispatcher(dispatcher)
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('https://youtu.be/abc123', { fromMe: true })], type: 'notify' }, sock)
    expect(dispatcher).not.toHaveBeenCalled()
  })

  it('ignora URLs si no hay dispatcher registrado', async () => {
    const sock = fakeSock()
    await handleMessage({ messages: [fakeMsg('https://example.com/x')], type: 'notify' }, sock)
    expect(sock.sendMessage).not.toHaveBeenCalled()
  })
})

describe('listCommands', () => {
  it('incluye los comandos cargados desde src/commands', () => {
    const names = listCommands().map((c) => c.name)
    expect(names).toContain('ping')
    expect(names).toContain('help')
    expect(names).toContain('start')
  })
})
