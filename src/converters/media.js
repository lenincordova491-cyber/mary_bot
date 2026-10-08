import fs from 'node:fs'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { tmpFilePath } from '../lib/utils.js'

/**
 * Convierte un sticker WebP a imagen PNG (o JPEG con fondo blanco).
 * @param {string} stickerPath Ruta del sticker WebP.
 * @param {{format?: 'png'|'jpeg', outputPath?: string}} [options]
 * @returns {Promise<string>} Ruta de la imagen generada.
 */
export async function stickerToImage(stickerPath, options = {}) {
  const format = options.format === 'jpeg' ? 'jpeg' : 'png'
  const out = options.outputPath ?? tmpFilePath('toimg', `.${format}`)
  if (format === 'jpeg') {
    await sharp(stickerPath, { animated: false })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 92 })
      .toFile(out)
  } else {
    await sharp(stickerPath, { animated: false }).png().toFile(out)
  }
  return out
}

/**
 * Convierte un video (recorte corto) a GIF con ffmpeg.
 * @param {string} inputPath Ruta del video de entrada.
 * @param {{outputPath?: string, durationSeconds?: number, width?: number}} [options]
 * @returns {Promise<string>} Ruta del GIF generado.
 */
export function videoToGif(inputPath, options = {}) {
  const out = options.outputPath ?? tmpFilePath('gif', '.gif')
  const width = options.width ?? 480
  const duration = Number(options.durationSeconds) > 0 ? Number(options.durationSeconds) : undefined
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      .outputOptions([
        '-vf', `fps=10,scale=${width}:-1:flags=lanczos`,
      ])
      .toFormat('gif')
      .on('end', () => resolve(out))
      .on('error', (err) => reject(new Error(`No se pudo convertir el video a GIF: ${err.message}`)))
    if (duration) cmd.outputOptions(['-t', String(duration)])
    cmd.save(out)
  })
}

/**
 * Convierte una o varias imágenes en un PDF (una página por imagen).
 * Las imágenes se normalizan a JPEG con fondo blanco antes de incrustarlas.
 * @param {string[]} imagePaths Rutas de las imágenes.
 * @param {{outputPath?: string}} [options]
 * @returns {Promise<string>} Ruta del PDF generado.
 */
export async function imagesToPdf(imagePaths, options = {}) {
  if (!imagePaths?.length) throw new Error('Necesito al menos una imagen para crear el PDF.')
  const out = options.outputPath ?? tmpFilePath('pdf', '.pdf')

  const pdf = await PDFDocument.create()
  for (const imagePath of imagePaths) {
    const jpeg = await sharp(imagePath, { animated: false })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer()
    const meta = await sharp(jpeg).metadata()
    const image = await pdf.embedJpg(jpeg)
    const page = pdf.addPage([meta.width ?? 612, meta.height ?? 792])
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    })
  }
  fs.writeFileSync(out, await pdf.save())
  return out
}
