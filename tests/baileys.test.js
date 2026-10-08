import { describe, expect, it } from 'vitest'
import { getBackoffDelayMs, getReconnectDelayMs } from '../src/lib/baileys.js'

describe('getBackoffDelayMs (reconexión exponencial)', () => {
  it('progresión 5s, 10s, 20s, 40s', () => {
    expect(getBackoffDelayMs(1)).toBe(5000)
    expect(getBackoffDelayMs(2)).toBe(10000)
    expect(getBackoffDelayMs(3)).toBe(20000)
    expect(getBackoffDelayMs(4)).toBe(40000)
  })

  it('se mantiene en el tope de 60s para intentos posteriores', () => {
    expect(getBackoffDelayMs(5)).toBe(60000)
    expect(getBackoffDelayMs(20)).toBe(60000)
  })

  it('normaliza entradas inválidas al primer intento', () => {
    expect(getBackoffDelayMs(0)).toBe(5000)
    expect(getBackoffDelayMs(-3)).toBe(5000)
    expect(getBackoffDelayMs(2.7)).toBe(10000)
    expect(getReconnectDelayMs(440, 1)).toBeNull()
    expect(getReconnectDelayMs(408, 1)).toBe(5000)
  })
})
