import ytdlp from 'youtube-dl-exec'
import { assertFileSize, assertInfoSize, runYtDlpDownload } from './youtube.js'
import { mimeFromFileName, sanitizeFileName } from '../lib/utils.js'

/**
 * Descarga un video de Facebook como MP4.
 * @param {string} url URL de facebook.com o fb.watch.
 * @returns {Promise<import('./youtube.js').DownloadResult>}
 */
export async function downloadFacebook(url) {
  const info = await ytdlp(url, { dumpSingleJson: true, noWarnings: true, noPlaylist: true }).catch(() => null)
  const title = sanitizeFileName(info?.title ?? 'video-facebook')
  if (info) assertInfoSize(info)

  const { filePath, ext } = await runYtDlpDownload(url, {
    format: 'b[ext=mp4]/b',
    mergeOutputFormat: 'mp4',
  }, 'facebook')
  assertFileSize(filePath)

  return {
    filePath,
    fileName: `${title}${ext || '.mp4'}`,
    mimetype: mimeFromFileName(`f${ext || '.mp4'}`),
    title: info?.title ?? title,
  }
}
