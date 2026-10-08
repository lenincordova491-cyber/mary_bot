import ytdlp from 'youtube-dl-exec'
import { assertFileSize, assertInfoSize, runYtDlpDownload } from './youtube.js'
import { mimeFromFileName, sanitizeFileName } from '../lib/utils.js'

/**
 * Descarga un video de TikTok (sin marca de agua cuando está disponible) como MP4.
 * @param {string} url URL de TikTok.
 * @returns {Promise<import('./youtube.js').DownloadResult>}
 */
export async function downloadTikTok(url) {
  const info = await ytdlp(url, { dumpSingleJson: true, noWarnings: true, noPlaylist: true }).catch(() => null)
  const title = sanitizeFileName(info?.title ?? 'video-tiktok')
  if (info) assertInfoSize(info)

  const { filePath, ext } = await runYtDlpDownload(url, {
    format: 'b[ext=mp4]/b',
    mergeOutputFormat: 'mp4',
  }, 'tiktok')
  assertFileSize(filePath)

  return {
    filePath,
    fileName: `${title}${ext || '.mp4'}`,
    mimetype: mimeFromFileName(`t${ext || '.mp4'}`),
    title: info?.title ?? title,
  }
}
