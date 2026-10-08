import OpenAI from 'openai'
import { OPENAI_IMAGE_MODEL, OPENAI_MODEL } from '../config.js'

/**
 * Crea el cliente de OpenAI con la API key del entorno.
 * @returns {OpenAI} Cliente configurado.
 * @throws {Error} Si OPENAI_API_KEY no está configurada.
 */
export function createAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'La IA no está configurada: añade OPENAI_API_KEY en el archivo .env (usa .env.example como plantilla).',
    )
  }
  return new OpenAI({ apiKey })
}

/**
 * Mensaje de la conversación con la IA.
 * @typedef {{role: 'system'|'user'|'assistant', content: string}} AiMessage
 */

/**
 * Consulta al modelo de chat con historial de contexto.
 * @param {string} prompt Mensaje del usuario.
 * @param {AiMessage[]} [history] Historial previo (sin el mensaje actual).
 * @returns {Promise<string>} Respuesta del modelo.
 */
export async function askAI(prompt, history = []) {
  const client = createAIClient()
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Eres Mary_uwu, una asistente de WhatsApp amable, directa y concisa. ' +
          'Respondes en español, con respuestas breves y útiles.',
      },
      ...history,
      { role: 'user', content: prompt },
    ],
  })
  const text = completion?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('La IA no devolvió respuesta.')
  return text
}

/**
 * Genera una imagen con el modelo de imágenes de OpenAI.
 * @param {string} prompt Descripción de la imagen.
 * @returns {Promise<Buffer>} Imagen en PNG/JPG.
 */
export async function generateImage(prompt) {
  const client = createAIClient()
  const response = await client.images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt,
    n: 1,
    size: '1024x1024',
  })
  const item = response?.data?.[0]
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item?.url) {
    const img = await fetch(item.url)
    if (!img.ok) throw new Error(`No pude descargar la imagen generada (HTTP ${img.status}).`)
    return Buffer.from(await img.arrayBuffer())
  }
  throw new Error('La IA no devolvió ninguna imagen.')
}
