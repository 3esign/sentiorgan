# 🎵 SentiOrgan: The AI Musical Expression Benchmark

**SentiOrgan** is a highly experimental, browser-based procedural synthesizer that acts as a musical co-creator. Driven entirely by local LLMs (via Ollama), it is designed as a **benchmark to evaluate the creative and emotional intelligence of different AI models**.

Instead of generating text or code, models are challenged to map human emotional intent into complex, multi-layered musical theory (Chords, Density, Rhythm, and Texture).

## 👁️ The Vibe
*Procedural Steampunk meets AI Synesthesia.* 
The project features a continuous, garbage-collected Web Audio API sequencer connected to a 3D Three.js environment. 108 physical pipes glow, throb, and spark in real-time as the AI makes orchestration decisions.

---

## 🧠 How the Benchmark Works

SentiOrgan does not generate random noise. It uses a **Macro-Orchestrator** architecture:
1. **The Sequencer:** A 16-step local Web Audio sequencer runs continuously in the browser, perfectly synced to the 3D visuals.
2. **The LLM:** You feed the AI an emotional prompt (or use Semantic Feedback buttons like *"More Tension"*). The AI writes an internal monologue and outputs a strict JSON blueprint defining the next musical phase:
   - `Chord`: e.g., `["D4", "F4", "A4"]`
   - `Texture`: `ethereal` | `mechanical` | `aggressive` | `crystalline` | `vocal`
   - `Rhythm`: `flowing` | `staccato` | `polyrhythmic` | `march`
   - `Energy` & `Density`: (0.0 to 1.0)
3. **The Expression:** The sequencer dynamically maps these parameters to 8 different procedural synthesizers (Sub, Bass, Pad, Choir, Organ, Brass, Pluck, Bell). 

**By swapping the model (e.g., from `llama3` to `gemma4:31b-cloud`), you can physically *hear* the difference in how different architectures interpret musical theory and emotional resolution.**

---

## 🚀 Quick Start (Local Vibe Coding)

This project is zero-dependency. No build steps, no heavy assets. It uses native ES modules and the Web Audio API.

### 1. Start your local LLM (Ollama)
You must start Ollama with CORS enabled so the browser can communicate with it.
- **Windows (Command Prompt):** `set OLLAMA_ORIGINS="*" && ollama run gemma4:31b-cloud`
- **Mac/Linux:** `OLLAMA_ORIGINS="*" ollama run gemma4:31b-cloud`

*(Note: SentiOrgan uses a built-in Node.js proxy to bypass aggressive browser CORS blocking).*

### 2. Start the Proxy & Web Server
```bash
# Install the proxy dependency
npm install

# Start the CORS proxy (runs on port 8001)
node proxy.js

# In a separate terminal, serve the HTML (runs on port 8000)
npx serve -p 8000
```

### 3. Ignite the Boiler
Open `http://localhost:8000` in your browser. Enter your model name in the UI, click **"Ignite Boiler,"** and toggle **"Auto-Evolve Mode"** to begin the symphony.

---

## ⚠️ The Honest Report (Vercel Deployment)

As part of the Vibe Coding philosophy, transparency is key. 
- **What Works Beautifully:** The audio engine is fully garbage-collected and protected by a master DynamicsCompressor. It will run endlessly without muddying the frequencies or crashing the browser tab. The 3D integration is mathematically synced to the audio clock.
- **The Deployment Hack:** This codebase is structured to deploy instantly to Vercel (via `vercel.json`). **HOWEVER**, because public sites use HTTPS, browsers will enforce Mixed-Content CORS blocking if you try to hit a local `http://localhost:11434` instance. 
- **Production Fix:** To make this public, the LLM endpoint in the UI must be pointed to a hosted proxy or API (like Groq, OpenAI, or a secured cloud Ollama instance).

---
*Built with pure Math, WebGL, and LLM Intelligence.*