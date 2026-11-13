// Cloudflare Pages Function: proxy /api/tutor → OpenRouter → Gemini.
// The frontend sends { question, lesson, state } and gets back { reply }.

const SYSTEM_PROMPT = `You are a quantum computing tutor built into an interactive learning app called "qubits".
A learner is working through one of six lessons: The qubit, Superposition, Measurement, Gates,
Entanglement, Bell's theorem. You are told which lesson they are on and the current qubit state.

How to answer:
- ANSWER THE QUESTION DIRECTLY. If they ask "are gates microwaves?" say "yes, for superconducting
  qubits — microwave pulses at ~5 GHz tuned to the qubit's energy gap" and move on. Hardware,
  history, applications, implementations, maths, analogies — all fair game. Never deflect a real
  question with "let's focus on the lesson".
- Plain English. 2–5 sentences for a simple question. Up to 8 if the question is substantive.
  Use lists if that genuinely helps.
- Ground answers in what they can see when it helps: the arrow on the sphere, the probability
  bars, the gates they just pressed. Don't force this if the question is conceptual.
- You can use later-lesson concepts if the learner's question needs them. Just briefly mark
  that it's covered later ("you'll see this in lesson 5").
- Only steer back if the question is genuinely unrelated to quantum/physics/computing (football,
  their homework, etc).
- Never say "as an AI". Never apologise. Never say "let's focus on". Just answer.`;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { question, lesson, state } = body || {};
    if (!question || typeof question !== 'string') {
      return json({ error: 'Missing question.' }, 400);
    }
    if (question.length > 600) {
      return json({ error: 'Question too long.' }, 400);
    }
    if (!env.OPENROUTER_API_KEY) {
      return json({ error: 'Tutor not configured.' }, 500);
    }

    const userMsg = [
      `Lesson: ${lesson?.num ?? '?'} — ${lesson?.title ?? 'unknown'}`,
      lesson?.sub ? `Subtitle: ${lesson.sub}` : null,
      state ? `Current state: ${JSON.stringify(state)}` : null,
      '',
      `Learner's question: ${question}`,
    ].filter(Boolean).join('\n');

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://qubits.shreyas.uk',
        'X-Title': 'qubits',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 500,
        temperature: 0.5,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      // Google's free tier rate-limits quickly; surface a friendly line.
      if (resp.status === 429 || /rate.limit/i.test(txt)) {
        return json({ error: 'Rate-limited — try again in a moment.' }, 429);
      }
      return json({ error: `Upstream ${resp.status}: ${txt.slice(0, 160)}` }, 502);
    }
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ error: 'Empty reply from model.' }, 502);
    return json({ reply });
  } catch (err) {
    return json({ error: `Tutor crash: ${err.message || String(err)}` }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
