import fs from 'fs'
import path from 'path'

const RESULTS_PATH = path.join(process.cwd(), 'data', 'results.json')

function readResults() {
  try {
    return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'))
  } catch {
    return []
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { rounds, finalReflection } = req.body || {}
  if (!rounds || !finalReflection) {
    res.status(400).json({ error: 'Missing rounds or finalReflection' })
    return
  }

  const results = readResults()
  results.push({
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
  })

  try {
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2))
  } catch (err) {
    console.error('Could not persist results (expected in production):', err)
  }

  res.status(200).json({ saved: true })
}