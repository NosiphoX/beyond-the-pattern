import { readPool, writePool } from './pool.js'

const FALLBACK_ANSWER =
  "I don't have another stored answer to compare against for this question yet, so this is a placeholder response standing in for one."

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { questionId, userAnswer } = req.body || {}
  if (!questionId || !userAnswer) {
    res.status(400).json({ error: 'Missing questionId or userAnswer' })
    return
  }

  const pool = readPool()
  const entry = pool.find((q) => q.id === questionId)
  if (!entry) {
    res.status(404).json({ error: 'Question not found' })
    return
  }

  // Pick the peer answer BEFORE adding the user's own. If the pool is
  // empty, fall back to a fixed placeholder instead of breaking.
  const peerAnswer =
    entry.answers.length > 0
      ? entry.answers[Math.floor(Math.random() * entry.answers.length)]
      : FALLBACK_ANSWER

  entry.answers.push(userAnswer)
  try {
    writePool(pool)
  } catch (err) {
    console.error('Could not persist to pool (expected in production):', err)
  }

  res.status(200).json({ peerAnswer })
}