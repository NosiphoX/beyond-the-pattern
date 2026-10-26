import { addResult } from './store.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { rounds, finalReflection } = req.body || {}
  if (!rounds || !finalReflection) {
    res.status(400).json({ error: 'Missing rounds or finalReflection' })
    return
  }

  const result = {
    timestamp: new Date().toISOString(),
    rounds: rounds.map((r) => ({
      questionId: r.id,
      question: r.question,
      guess: r.guess,
      aiWasOn: r.aiOnLeft ? 'left' : 'right',
      guessedCorrectly: r.guess === (r.aiOnLeft ? 'left' : 'right'),
      suspected: r.suspected,
      reaction: r.reaction,
    })),
    finalReflection,
  }

  try {
    await addResult(result)
  } catch (err) {
    console.error('Could not store results:', err)
    res.status(500).json({ saved: false })
    return
  }

  res.status(200).json({ saved: true })
}