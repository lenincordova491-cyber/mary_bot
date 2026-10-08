import { fetchText } from '../../lib/utils.js'

/** Descripción en español de los códigos de clima de Open-Meteo. */
const WEATHER_CODES = {
  0: 'Despejado ☀️',
  1: 'Mayormente despejado 🌤️',
  2: 'Parcialmente nublado ⛅',
  3: 'Nublado ☁️',
  45: 'Niebla 🌫️',
  48: 'Niebla con escarcha 🌫️',
  51: 'Llovizna ligera 🌦️',
  53: 'Llovizna 🌦️',
  55: 'Llovizna intensa 🌧️',
  61: 'Lluvia ligera 🌦️',
  63: 'Lluvia 🌧️',
  65: 'Lluvia fuerte 🌧️',
  71: 'Nieve ligera 🌨️',
  73: 'Nieve 🌨️',
  75: 'Nieve fuerte ❄️',
  80: 'Chubascos ligeros 🌦️',
  81: 'Chubascos 🌧️',
  82: 'Chubascos fuertes ⛈️',
  95: 'Tormenta ⛈️',
  96: 'Tormenta con granizo ⛈️',
  99: 'Tormenta fuerte con granizo ⛈️',
}

/**
 * Geocodifica una ciudad con la API de Open-Meteo.
 * @param {string} city Nombre de la ciudad.
 * @returns {Promise<{name: string, country: string, latitude: number, longitude: number}>}
 */
export async function geocodeCity(city) {
  const raw = await fetchText(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`,
  )
  const data = JSON.parse(raw)
  const place = data?.results?.[0]
  if (!place) throw new Error(`No encontré la ciudad «${city}».`)
  return {
    name: place.name,
    country: place.country ?? '',
    latitude: place.latitude,
    longitude: place.longitude,
  }
}

/**
 * Obtiene el clima actual de unas coordenadas (Open-Meteo, sin API key).
 * @param {{latitude: number, longitude: number}} coords
 * @returns {Promise<{temperature: number, humidity: number, windSpeed: number, description: string}>}
 */
export async function fetchCurrentWeather(coords) {
  const raw = await fetchText(
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}` +
    '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius',
  )
  const data = JSON.parse(raw)
  const current = data?.current
  if (!current) throw new Error('No pude obtener el clima actual.')
  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    description: WEATHER_CODES[current.weather_code] ?? 'Clima desconocido',
  }
}

/**
 * Consulta completa: ciudad -> clima formateado.
 * @param {string} city Ciudad a consultar.
 * @returns {Promise<string>} Mensaje formateado con el clima.
 */
export async function getWeatherReport(city) {
  const place = await geocodeCity(city)
  const weather = await fetchCurrentWeather(place)
  return (
    `🌤️ *Clima en ${place.name}${place.country ? `, ${place.country}` : ''}*\n\n` +
    `${weather.description}\n` +
    `🌡️ Temperatura: ${weather.temperature} °C\n` +
    `💧 Humedad: ${weather.humidity} %\n` +
    `💨 Viento: ${weather.windSpeed} km/h`
  )
}

/** Comando .clima (alias .weather): clima actual por ciudad. */
export const weatherCommand = {
  name: 'clima',
  aliases: ['weather', 'tiempo'],
  category: 'tools',
  description: 'Clima actual de una ciudad',
  usage: 'clima <ciudad>',
  ownerOnly: false,
  /**
   * @param {import('../../handler.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async handler(ctx) {
    const city = ctx.text
    if (!city) return void (await ctx.reply('⚠️ Uso: .clima <ciudad>\nEjemplo: .clima Lima'))
    try {
      await ctx.reply(await getWeatherReport(city))
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`)
    }
  },
}
