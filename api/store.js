import fs from 'fs'
import path from 'path'
import { Redis } from '@upstash/redis'
import { readPool, writePool } from './pool.js'

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
const redis = url && token ? new Redis({ url, token }) : null

const RESULTS_PATH = path.join(process.cwd(), 'data', 'results.json')

// Seed answers come from data/pool.json. Answers added by participants live
// in Redis when it is connected, otherwise they are appended to pool.json.
export async function getAnswers(questionId) {
  const entry = readPool().find((q) => q.id === questionId)
  if (!entry) return null
  let extra = []
  if (redis) {
    try {
      const stored = await redis.lrange(`answers:${questionId}`, 0, -1)
      extra = stored.map((x) => (x && x.t !== undefined ? String(x.t) : String(x)))
    } catch (err) {
      console.error('Could not read stored answers:', err)
    }
  }
  return [...entry.answers, ...extra]
}

export async function addAnswer(questionId, text) {
  if (redis) {
    await redis.rpush(`answers:${questionId}`, { t: text })
    return
  }
  const pool = readPool()
  const entry = pool.find((q) => q.id === questionId)
  if (entry) {
    entry.answers.push(text)
    writePool(pool)
  }
}

export async function addResult(result) {
  if (redis) {
    await redis.rpush('results', result)
    return
  }
  let results = []
  try {
    results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'))
  } catch {}
  results.push(result)
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2))
}