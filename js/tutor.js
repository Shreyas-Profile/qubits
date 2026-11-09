// AI tutor client. Sends the user's question plus a small
// lesson-aware context payload to /api/tutor, which proxies to
// OpenRouter → Gemini 2.5 Flash Lite.

export async function askTutor({ question, lesson, state }) {
  const res = await fetch('/api/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, lesson, state }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.reply;
}
