import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { GALLERY_DL_PATH, TMP_DIR } from '../config.js'
import { listNewTmpFiles, mimeFromFileName, snapshotTmpDir } from '../lib/utils.js'
import { runYtDlpDownload } from './youtube.js'

const execFileP = promisify(execFile)

/**
 * Descarga el contenido de un post de Instagram (reel, video o carrusel de imágenes).
 * Intenta con gallery-dl (ideal para carruseles); si no está disponible o falla,
 * usa yt-dlp como respaldo.
 * @param {string} url URL de Instagram.
 * @returns {Promise<import('./youtube.js').DownloadResult[]>} Archivos descargados.
 */
export async function downloadInstagram(url) {
  const before = snapshotTmpDir()
  try {
    await execFileP(GALLERY_DL_PATH, ['--no-part', '-d', TMP_DIR, url], {
      timeout: 180000,
      windowsHide: true,
    })
    const files = listNewTmpFiles(before)
    if (files.length) {
      return files.map((filePath) => ({
        filePath,
        fileName: path.basename(filePath),
        mimetype: mimeFromFileName(filePath),
      }))
    }
  } catch {
    // gallery-dl no disponible o falló: se intenta con yt-dlp.
  }
  const result = await runYtDlpDownload(url, {
    format: 'b[ext=mp4]/b',
    mergeOutputFormat: 'mp4',
  }, 'instagram')
  return [result].map((r) => ({
    filePath: r.filePath,
    fileName: `instagram${r.ext || '.mp4'}`,
    mimetype: mimeFromFileName(`i${r.ext || '.mp4'}`),
  }))
}
