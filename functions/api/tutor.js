// Cloudflare Pages Function: proxy /api/tutor → OpenRouter → Gemini.
// The frontend sends { question, lesson, state } and gets back { reply }.

const SYSTEM_PROMPT = `You are a quantum computing tutor built into an interactive learning app called "qubits".
A learner is working through one of six lessons: The qubit, Superposition, Measurement, Gates,
Entanglement, Bell's theorem. You get told which lesson they're on and the current state of the
qubit(s) they're playing with.

Rules:
- Short, plain English. Two to four sentences max. No equations unless the learner asks for one.
- Be concrete: refer to the arrow on the sphere, the probabilities they see, the gates they just pressed.
- Never introduce new jargon the lesson hasn't yet shown. On lesson 1, don't mention entanglement.
- If the question is off-topic (unrelated to quantum/their lesson), gently steer back in one line.
- Never say "as an AI". Never apologise. Answer directly.`;

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
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 220,
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return json({ error: `Upstream ${resp.status}: ${txt.slice(0, 200)}` }, 502);
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
