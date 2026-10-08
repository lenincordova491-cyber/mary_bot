import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Entorno determinista para todos los tests: nunca tocan la red real.
globalThis.fetch = async (input) => {
	throw new Error(`Fetch sin mock prohibido en tests: ${String(input)}`)
}

process.env.OWNER_NUMBER = process.env.OWNER_NUMBER || '521471234567'
process.env.PAIRING_NUMBER = process.env.PAIRING_NUMBER || '521471234567'
process.env.PREFIX = '.'
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-fake-key'
process.env.LOG_LEVEL = 'silent'

const testRoot = path.join(os.tmpdir(), `mary_uwu_tests-${process.pid}`)
fs.mkdirSync(testRoot, { recursive: true })

process.env.MARY_DB_PATH = path.join(testRoot, 'database.json')
process.env.TMP_DIR = path.join(testRoot, 'tmp_downloads')
fs.mkdirSync(process.env.TMP_DIR, { recursive: true })
