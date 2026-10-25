import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { prompt } = req.body || {}
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
   const stream = await ai.models.generateContentStream({
  model: 'gemini-3.6-flash',
  contents: prompt,
  config: {
    systemInstruction:
      'Answer in plain conversational prose only. Do not use markdown formatting of any kind — no bold, no headers, no bullet points, no numbered lists, no horizontal rules. Write the way a person would type a genuine answer into a plain text box: a few natural paragraphs at most, first-person where it fits the question, no section breakdowns or academic structuring. Aim for a maximum of 50 words. Do not exceed this under any circumstances, keep it concise. Very impertant.',
  },
})

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Stream error:', err)
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`)
      res.end()
    }
  }
}