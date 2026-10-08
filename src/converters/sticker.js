import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { tmpFilePath } from '../lib/utils.js'

/** Duración máxima (s) de un video para convertirlo en sticker. */
export const VIDEO_STICKER_MAX_SECONDS = 6

/**
 * Convierte una imagen a sticker WebP (512x512, mantiene proporción).
 * @param {string} inputPath Ruta de la imagen de entrada.
 * @param {{outputPath?: string}} [options]
 * @returns {Promise<string>} Ruta del WebP generado.
 */
export async function imageToSticker(inputPath, options = {}) {
  const out = options.outputPath ?? tmpFilePath('sticker', '.webp')
  await sharp(inputPath)
    .resize(512, 512, { fit: 'inside' })
    .webp({ quality: 90 })
    .toFile(out)
  return out
}

/**
 * Convierte un video corto a sticker WebP animado usando ffmpeg.
 * @param {string} inputPath Ruta del video de entrada.
 * @param {{outputPath?: string, durationSeconds?: number}} [options]
 * @returns {Promise<string>} Ruta del WebP generado.
 */
export function videoToSticker(inputPath, options = {}) {
  const out = options.outputPath ?? tmpFilePath('sticker', '.webp')
  const duration = Math.min(Number(options.durationSeconds) || VIDEO_STICKER_MAX_SECONDS, VIDEO_STICKER_MAX_SECONDS)
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
        '-loop', '0',
        '-an',
        '-t', String(duration),
      ])
      .toFormat('webp')
      .on('end', () => resolve(out))
      .on('error', (err) => reject(new Error(`No se pudo convertir el video a sticker: ${err.message}`)))
      .save(out)
  })
}

/**
 * Convierte una imagen o un video corto a sticker WebP, según el tipo MIME.
 * @param {string} inputPath Ruta del archivo de entrada.
 * @param {{mimetype?: string, durationSeconds?: number}} [options]
 * @returns {Promise<string>} Ruta del WebP generado.
 */
export async function mediaToSticker(inputPath, options = {}) {
  const mime = options.mimetype ?? ''
  if (mime.startsWith('video/')) {
    return videoToSticker(inputPath, { durationSeconds: options.durationSeconds })
  }
  return imageToSticker(inputPath)
}
