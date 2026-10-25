import { readPool } from './pool.js'

export default function handler(req, res) {
  const pool = readPool()
  const questions = pool.map(({ id, question }) => ({ id, question }))
  res.status(200).json({ questions })
}