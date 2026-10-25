import fs from 'fs'
import path from 'path'

const POOL_PATH = path.join(process.cwd(), 'data', 'pool.json')

export function readPool() {
  const raw = fs.readFileSync(POOL_PATH, 'utf-8')
  return JSON.parse(raw)
}

export function writePool(pool) {
  fs.writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2))
}