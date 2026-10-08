/**
 * Normaliza el objetivo de comandos de usuario (block/unblock).
 * Acepta: número, JID completo, usuario citado o el chat actual.
 * @param {import('../../handler.js').CommandContext} ctx Contexto del comando.
 * @param {string} [arg] Argumento con número o JID.
 * @returns {string|null} JID normalizado o null.
 */
export function normalizeTarget(ctx, arg) {
  const raw = String(arg ?? '').trim()
  if (raw) {
    if (raw.includes('@')) return raw
    const digits = raw.replace(/\D/g, '')
    return digits ? `${digits}@s.whatsapp.net` : null
  }
  const quoted = ctx.msg?.message?.extendedTextMessage?.contextInfo?.participant
  if (quoted) return quoted
  return ctx.jid ?? null
}
