# qubits

Learn quantum computing by playing with it. Six interactive lessons
rendered on real Bloch spheres, plus a sandbox and an AI tutor.

Live at https://qubits.shreyas.uk.

## Stack

- Static HTML + vanilla JS, no build step.
- Three.js (CDN) for the Bloch spheres.
- Cloudflare Pages for hosting, Pages Functions for the AI-tutor proxy.
- OpenRouter → Gemini 2.5 Flash Lite for the tutor.

## Deploy

Push to `main`. Cloudflare Pages auto-builds from GitHub. Custom
domain `qubits.shreyas.uk` is attached in the Pages dashboard.
