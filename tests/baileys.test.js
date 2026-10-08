import { describe, expect, it } from 'vitest'
import { getBackoffDelayMs } from '../src/lib/baileys.js'

describe('getBackoffDelayMs (reconexión exponencial)', () => {
  it('progresión 1s, 2s, 4s, 8s', () => {
    expect(getBackoffDelayMs(1)).toBe(1000)
    expect(getBackoffDelayMs(2)).toBe(2000)
    expect(getBackoffDelayMs(3)).toBe(4000)
    expect(getBackoffDelayMs(4)).toBe(8000)
  })

  it('se mantiene en el tope de 8s para intentos posteriores', () => {
    expect(getBackoffDelayMs(5)).toBe(8000)
    expect(getBackoffDelayMs(20)).toBe(8000)
  })

  it('normaliza entradas inválidas al primer intento', () => {
    expect(getBackoffDelayMs(0)).toBe(1000)
    expect(getBackoffDelayMs(-3)).toBe(1000)
    expect(getBackoffDelayMs(2.7)).toBe(2000)
  })
})
