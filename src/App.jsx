import { useState, useEffect } from 'react'

const NUM_ROUNDS = 3

const POSITIONS = [
  { id: 'still-meaningful', label: 'It still feels meaningful to me' },
  { id: 'feels-hollow', label: 'It feels hollow now that I know' },
  { id: 'unsettled', label: "I feel unsettled that I couldn't tell" },
  { id: 'no-change', label: "It doesn't change how I feel about it" },
]

const ICONS = {
  back: <path d="M15 5l-7 7 7 7" pathLength={1} />,
  retry: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" pathLength={1} />
      <path d="M20 4v4h-4" pathLength={1} />
    </>
  ),
  lock: <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" pathLength={1} />,
  human: <path d="M5 15c2-7 12-7 14 0" pathLength={1} />,
  ai: (
    <>
      <circle cx="5" cy="16" r="1.5" pathLength={1} />
      <circle cx="12" cy="8" r="1.5" pathLength={1} />
      <circle cx="19" cy="16" r="1.5" pathLength={1} />
      <path d="M6.4 15l4.2-6M13.4 9l4.2 6" pathLength={1} />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function App() {
  const [consent, setConsent] = useState(null) // null = asking, true = yes, false = no
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [rounds, setRounds] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [surveyPhase, setSurveyPhase] = useState('answering') // answering | reveal | closing | done
  const [finalReflection, setFinalReflection] = useState('')

  function loadQuestions() {
    setLoading(true)
    setLoadError(false)
    fetch('/api/questions')
      .then((res) => {
        if (!res.ok) throw new Error('Bad response')
        return res.json()
      })
      .then(({ questions }) => {
        const picked = shuffle(questions).slice(0, NUM_ROUNDS)
        setRounds(
          picked.map((q) => ({
            id: q.id,
            question: q.question,
            userAnswer: '',
            phase: 'writing',
            peerAnswer: '',
            aiText: '',
            aiOnLeft: true,
            guess: null,
            suspected: null,
            reaction: null,
          }))
        )
        setLoading(false)
      })
      .catch(() => {
        setLoadError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadQuestions()
  }, [])

  function updateRound(index, changes) {
    setRounds((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], ...changes }
      return copy
    })
  }

  async function handleSubmit(index, userAnswer) {
    updateRound(index, { userAnswer, phase: 'thinking' })
    const aiOnLeft = Math.random() < 0.5
    const round = rounds[index]
    let peerAnswer = round.peerAnswer // kept from an earlier attempt, if any

    try {
      // Only save the answer and pick a peer once, so retrying
      // doesn't add the same answer to the pool twice.
      if (!peerAnswer) {
        const saveRes = await fetch('/api/save-and-pick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: round.id, userAnswer }),
        })
        if (!saveRes.ok) throw new Error('Save failed')
        peerAnswer = (await saveRes.json()).peerAnswer
      }

      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: round.question }),
      })
      if (!genRes.ok || !genRes.body) throw new Error('Generation failed')

      const reader = genRes.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          let parsed = null
          try {
            parsed = JSON.parse(data)
          } catch {}
          if (parsed?.error) throw new Error(parsed.error)
          if (parsed?.text) fullText += parsed.text
        }
      }

      if (!fullText.trim()) throw new Error('Empty response')

      updateRound(index, { peerAnswer, aiText: fullText, aiOnLeft, phase: 'comparing' })
    } catch (err) {
      console.error(err)
      updateRound(index, { peerAnswer, phase: 'error' })
    }
  }

  function handleGuess(index, side) {
    updateRound(index, { guess: side })
  }

  function goNext() {
    if (currentIndex < NUM_ROUNDS - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setSurveyPhase('reveal')
    }
  }

  function goPrevious() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const allRevealResponsesGiven = rounds.every((r) => r.suspected && r.reaction)
  const correctCount = rounds.filter((r) => r.guess === (r.aiOnLeft ? 'left' : 'right')).length
  const gotAllRight = correctCount === NUM_ROUNDS

  // --- CONSENT SCREEN ---
  if (consent === null) {
    return (
      <main className="page narrow enter">
        <h1>Before we begin</h1>
        <p className="lede">
          This is a research prototype. Your written answers and reflections will be stored anonymously to help with this university project. Do you consent to your responses being stored?
        </p>
        <div className="actions">
          <button className="btn" onClick={() => setConsent(true)}>
            Yes, I consent
          </button>
          <button className="btn quiet" onClick={() => setConsent(false)}>
            No, decline
          </button>
        </div>
      </main>
    )
  }

  // --- EARLY EXIT IF DECLINED ---
  if (consent === false) {
    return (
      <main className="page narrow enter">
        <h1>Thank you</h1>
        <p className="lede">You have declined consent. Thank you for your time.</p>
      </main>
    )
  }

  // --- NORMAL FLOW STARTS HERE ---
  if (loading) {
    return (
      <main className="center">
        <div className="pulse" role="status" aria-label="Loading" />
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="page enter">
        <p className="note">Couldn't load the questions. Please check your connection and try again.</p>
        <div className="actions">
          <button className="btn" onClick={loadQuestions}>
            <Icon name="retry" />
            Try again
          </button>
        </div>
      </main>
    )
  }

  if (surveyPhase === 'closing') {
    return (
      <main className="page narrow enter">
        <h1>One last thing</h1>
        <p className="lede">
          {gotAllRight
            ? "You correctly identified the AI-generated answer in all three rounds. What were you relying on to tell them apart: something in the words themselves, or a feeling that a person was behind them? And if a version of this became harder to spot, would that change what you think meaning in a piece of writing depends on?"
            : "Across these three rounds, you weren't always able to tell which answer was written by a person and which was generated. Does that change what you think meaning in a creative or thoughtful piece of writing actually depends on? Is it something in the words themselves, or something in knowing a conscious person was behind them?"}
        </p>
        <textarea
          value={finalReflection}
          onChange={(e) => setFinalReflection(e.target.value)}
          rows={6}
          placeholder="Write whatever comes to mind, there's no right answer here."
        />
        <div className="actions">
          <button
            className="btn"
            disabled={!finalReflection.trim()}
            onClick={async () => {
              try {
                await fetch('/api/save-results', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rounds, finalReflection }),
                })
              } catch (err) {
                console.error('Could not save results:', err)
              }
              setSurveyPhase('done')
            }}
          >
            Finish
          </button>
        </div>
      </main>
    )
  }

  if (surveyPhase === 'done') {
    return (
      <main className="page narrow enter">
        <h1>Thank you</h1>
        <p className="lede">That's the end of this experience. Thank you for taking part.</p>
      </main>
    )
  }

  if (surveyPhase === 'reveal') {
    return (
      <main className="page">
        <h1 className="enter">Reveal</h1>
        {rounds.map((round, i) => {
          const correctSide = round.aiOnLeft ? 'left' : 'right'
          const guessedCorrectly = round.guess === correctSide
          const sides = [
            { side: 'left', text: round.aiOnLeft ? round.aiText : round.peerAnswer },
            { side: 'right', text: round.aiOnLeft ? round.peerAnswer : round.aiText },
          ]
          const base = 0.8 + i * 0.6

          return (
            <section key={round.id} className="reveal-round enter">
              <h2 className="question small">{round.question}</h2>
              <div className="pair">
                {sides.map(({ side, text }) => {
                  const isAI = correctSide === side
                  return (
                    <div key={side} className="panel">
                      <span
                        className="tagrow revealed"
                        style={{ '--lift-delay': `${base}s`, '--label-delay': `${base + 0.4}s` }}
                      >
                        <span className={`label ${isAI ? 'ai' : 'human'}`}>
                          <Icon name={isAI ? 'ai' : 'human'} />
                          {isAI ? 'AI' : 'Human'}
                          {round.guess === side && (
                            <span className="yours">
                              <Icon name="lock" />
                              your guess
                            </span>
                          )}
                        </span>
                        <span className="bar split">
                          <span className="half l" />
                          <span className="half r" />
                        </span>
                      </span>
                      <span className="answer">{text}</span>
                    </div>
                  )
                })}
              </div>

              <div className="after" style={{ animationDelay: `${base + 1.2}s` }}>
                <p className="verdict">
                  {guessedCorrectly ? 'You guessed correctly.' : 'You guessed incorrectly.'}
                </p>

                <p>Before you found out, did you suspect this one?</p>
                <div className="chips">
                  {['yes', 'unsure', 'no'].map((option) => (
                    <button
                      key={option}
                      className="chip"
                      aria-pressed={round.suspected === option}
                      onClick={() => updateRound(i, { suspected: option })}
                    >
                      {option === 'yes'
                        ? 'I suspected it'
                        : option === 'unsure'
                        ? "I hadn't thought about it"
                        : 'I was confident it was human'}
                    </button>
                  ))}
                </div>

                <p>Now that you know, how does it feel?</p>
                <div className="chips">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      className="chip"
                      aria-pressed={round.reaction === pos.id}
                      onClick={() => updateRound(i, { reaction: pos.id })}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )
        })}

        <div className="actions dock">
          <button
            className="btn"
            onClick={() => setSurveyPhase('closing')}
            disabled={!allRevealResponsesGiven}
          >
            Continue
          </button>
        </div>
      </main>
    )
  }

  const round = rounds[currentIndex]
  const isLastRound = currentIndex === NUM_ROUNDS - 1
  const sides = [
    { side: 'left', text: round.aiOnLeft ? round.aiText : round.peerAnswer },
    { side: 'right', text: round.aiOnLeft ? round.peerAnswer : round.aiText },
  ]

  return (
    <main className="page">
      <div className="progress" aria-label={`Question ${currentIndex + 1} of ${NUM_ROUNDS}`}>
        {rounds.map((_, i) => (
          <span key={i} className={i <= currentIndex ? 'on' : ''} />
        ))}
      </div>

      <div key={currentIndex}>
        <h2 className="question enter">{round.question}</h2>

        {round.phase === 'writing' && (
          <div className="enter">
            <WritingBox onSubmit={(text) => handleSubmit(currentIndex, text)} />
          </div>
        )}

        {round.phase === 'thinking' && (
          <div className="enter preparing" role="status" aria-label="Preparing the comparison">
            <div className="pair">
              <div className="ghost" />
              <div className="ghost" />
            </div>
            <div className="scan" />
          </div>
        )}

        {round.phase === 'error' && (
          <div className="enter">
            <p className="note">Something went wrong while preparing the comparison. Your answer is still here.</p>
            <div className="actions">
              <button className="btn" onClick={() => handleSubmit(currentIndex, round.userAnswer)}>
                <Icon name="retry" />
                Try again
              </button>
            </div>
          </div>
        )}

        {round.phase === 'comparing' && (
          <div className="enter">
            <p className="prompt">Which one do you think is AI-generated?</p>
            <div className="pair">
              {sides.map(({ side, text }) => (
                <button
                  key={side}
                  className="panel"
                  aria-pressed={round.guess === side}
                  onClick={() => handleGuess(currentIndex, side)}
                >
                  <span className="tagrow">
                    <span className="bar" />
                  </span>
                  <span className="answer">{text}</span>
                </button>
              ))}
            </div>
            <div className="actions dock">
              <button className="btn quiet" onClick={goPrevious} disabled={currentIndex === 0}>
                <Icon name="back" />
                Previous
              </button>
              <button className="btn" onClick={goNext} disabled={round.guess === null}>
                {isLastRound ? 'See the reveal' : 'Next question'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function WritingBox({ onSubmit }) {
  const [text, setText] = useState('')
  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Write your answer here..."
      />
      <div className="actions">
        <button className="btn" onClick={() => onSubmit(text)} disabled={!text.trim()}>
          Compare
        </button>
      </div>
    </>
  )
}