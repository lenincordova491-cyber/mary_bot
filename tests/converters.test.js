import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const { fluentFfmpegMock } = vi.hoisted(() => ({ fluentFfmpegMock: vi.fn() }))
vi.mock('fluent-ffmpeg', () => ({ default: fluentFfmpegMock }))

import sharp from 'sharp'
import { imageToSticker, mediaToSticker, videoToSticker } from '../src/converters/sticker.js'
import { imagesToPdf, stickerToImage, videoToGif } from '../src/converters/media.js'

/** Crea un ffmpeg encadenable que "termina" sin escribir nada (mock). */
function makeChain() {
  /** @type {Record<string, Function>} */
  const handlers = {}
  /** @type {any} */
  const chain = {
    outputOptions: vi.fn(() => chain),
    toFormat: vi.fn(() => chain),
    on: vi.fn((event, cb) => {
      handlers[event] = cb
      return chain
    }),
    save: vi.fn((out) => {
      chain._out = out
      handlers.end?.()
      return chain
    }),
  }
  return chain
}

/** Genera un PNG de prueba con sharp. @param {number} width @param {number} height */
async function makeTestPng(width = 800, height = 600) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } } }).png().toBuffer()
}

const tmpFile = (ext) => path.join(os.tmpdir(), `mary-conv-test-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)

/** Borrado best-effort (Windows puede retener el handle de sharp un instante). */
function safeRm(p) {
  try {
    fs.rmSync(p, { force: true })
  } catch {
    /* deja el temporal: se limpia con el directorio tmp del SO */
  }
}

beforeEach(() => {
  fluentFfmpegMock.mockReset()
  fluentFfmpegMock.mockImplementation(() => makeChain())
})

describe('converters/sticker', () => {
  it('convierte una imagen a sticker WebP de 512px', async () => {
    const input = tmpFile('.png')
    fs.writeFileSync(input, await makeTestPng(800, 600))
    const out = await imageToSticker(input)
    expect(out.endsWith('.webp')).toBe(true)
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width, meta.height)).toBe(512)
    safeRm(input)
    safeRm(out)
  })

  it('mediaToSticker enruta video a ffmpeg e imagen a sharp', async () => {
    const input = tmpFile('.png')
    fs.writeFileSync(input, await makeTestPng(100, 100))
    const outImage = await mediaToSticker(input, { mimetype: 'image/png' })
    expect(outImage.endsWith('.webp')).toBe(true)

    const outVideo = await mediaToSticker(input, { mimetype: 'video/mp4', durationSeconds: 5 })
    expect(outVideo.endsWith('.webp')).toBe(true)
    expect(fluentFfmpegMock).toHaveBeenCalledTimes(1)
    const chain = fluentFfmpegMock.mock.results[0].value
    expect(chain.toFormat).toHaveBeenCalledWith('webp')
    expect(chain.outputOptions).toHaveBeenCalledWith(expect.arrayContaining(['-t', '5']))
    expect(fluentFfmpegMock).toHaveBeenCalledWith(input)
  })

  it('videoToSticker limita la duración al máximo de sticker', async () => {
    const out = await videoToSticker('video.mp4', { durationSeconds: 60 })
    expect(out.endsWith('.webp')).toBe(true)
    const chain = fluentFfmpegMock.mock.results[0].value
    expect(chain.outputOptions).toHaveBeenCalledWith(expect.arrayContaining(['-t', '6']))
  })
})

describe('converters/media', () => {
  it('convierte un sticker WebP a PNG', async () => {
    const webp = tmpFile('.webp')
    fs.writeFileSync(webp, await makeTestPng(300, 300).then((b) => sharp(b).webp().toBuffer()))
    const out = await stickerToImage(webp)
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('png')
    safeRm(webp)
    safeRm(out)
  })

  it('videoToGif invoca ffmpeg con formato gif', async () => {
    const out = await videoToGif('clip.mp4', { durationSeconds: 4, width: 320 })
    expect(out.endsWith('.gif')).toBe(true)
    const chain = fluentFfmpegMock.mock.results[0].value
    expect(chain.toFormat).toHaveBeenCalledWith('gif')
    expect(chain.outputOptions).toHaveBeenCalledWith(expect.arrayContaining(['-t', '4']))
    expect(fluentFfmpegMock).toHaveBeenCalledWith('clip.mp4')
    expect(chain.save).toHaveBeenCalledWith(out)
  })

  it('convierte una imagen a PDF válido', async () => {
    const input = tmpFile('.png')
    fs.writeFileSync(input, await makeTestPng(600, 400))
    const out = await imagesToPdf([input])
    const header = fs.readFileSync(out).subarray(0, 5).toString('latin1')
    expect(header).toBe('%PDF-')
    expect(fs.statSync(out).size).toBeGreaterThan(500)
    safeRm(input)
    safeRm(out)
  })

  it('imagesToPdf falla sin imágenes', async () => {
    await expect(imagesToPdf([])).rejects.toThrow('al menos una imagen')
  })
})
