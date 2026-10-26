import { getAnswers, addAnswer } from './store.js'

const FALLBACK_ANSWER =
  "I don't have another stored answer to compare against for this question yet, so this is a placeholder response standing in for one."

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { questionId, userAnswer } = req.body || {}
  if (!questionId || !userAnswer) {
    res.status(400).json({ error: 'Missing questionId or userAnswer' })
    return
  }

  const answers = await getAnswers(questionId)
  if (!answers) {
    res.status(404).json({ error: 'Question not found' })
    return
  }

  const peerAnswer =
    answers.length > 0 ? answers[Math.floor(Math.random() * answers.length)] : FALLBACK_ANSWER

  try {
    await addAnswer(questionId, userAnswer)
  } catch (err) {
    console.error('Could not store answer:', err)
  }

  res.status(200).json({ peerAnswer })
}