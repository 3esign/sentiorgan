import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. STATE (The Parametric Brain) ---
const State = {
    time: 0,
    isAudioReady: false,
    isAutoMode: false,
    isSequencerRunning: false, 
    apiPollTimer: null,
    
    params: {
        chord: [], 
        energy: 0.0,  
        density: 0.0,
        texture: "mechanical", // ethereal, mechanical, aggressive, crystalline, vocal
        rhythm: "flowing",     // flowing, staccato, polyrhythmic, march
        evolutionMechanism: "Awaiting LLM initialization..."
    },

    ai: {
        status: 'DORMANT',
        memory: [] 
    }
};

const UI = {
    log: (msg, sender = 'system') => {
        const logEl = document.getElementById('log');
        const div = document.createElement('div');
        div.className = `log-entry log-${sender}`;
        div.innerHTML = `<strong>${sender.toUpperCase()}:</strong> ${msg}`;
        logEl.appendChild(div);
        setTimeout(() => { logEl.scrollTop = logEl.scrollHeight; }, 10);
    },
    updateStatus: () => {
        document.getElementById('ai-state').innerText = State.ai.status;
        document.getElementById('current-chord').innerText = State.params.chord.length > 0 ? State.params.chord.join(', ') : 'Waiting...';
        document.getElementById('current-texture').innerText = State.params.texture.toUpperCase();
        document.getElementById('current-rhythm').innerText = State.params.rhythm.toUpperCase();
    }
};

const MathLogic = {
    lerp: (start, end, amt) => (1 - amt) * start + amt * end,
    noteToFreq: (note) => {
        if (!note || typeof note !== 'string') return 440;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        let cleanNote = note.replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#');
        const match = cleanNote.match(/^([A-G]#?)(\d+)$/);
        if (!match) return 440; 
        const key = match[1];
        const octave = parseInt(match[2], 10);
        let keyIndex = notes.indexOf(key);
        if (keyIndex === -1) return 440;
        const n = (octave - 4) * 12 + (keyIndex - 9);
        return 440 * Math.pow(2, n / 12);
    },
    getArpeggioNote: (index) => {
        if (State.params.chord.length === 0) return "C4";
        return State.params.chord[index % State.params.chord.length];
    },
    getRandomNote: () => {
        if (State.params.chord.length === 0) return "C4";
        return State.params.chord[Math.floor(Math.random() * State.params.chord.length)];
    }
};

// --- 2. AUDIO & SEQUENCER (Expanded Arsenal & Dynamics) ---
const AudioSys = {
    ctx: null,
    masterGain: null,
    compressor: null,
    delay: null,
    
    nextNoteTime: 0,
    currentStep: 0,
    lookahead: 25.0, 
    scheduleAheadTime: 0.1, 
    timerID: null,
    visualQueue: [], 
    
    init: () => {
        AudioSys.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        AudioSys.masterGain = AudioSys.ctx.createGain();
        AudioSys.masterGain.gain.value = 0.5; 
        
        AudioSys.compressor = AudioSys.ctx.createDynamicsCompressor();
        AudioSys.compressor.threshold.value = -24;
        AudioSys.compressor.knee.value = 30;
        AudioSys.compressor.ratio.value = 12;
        AudioSys.compressor.attack.value = 0.003;
        AudioSys.compressor.release.value = 0.25;

        AudioSys.delay = AudioSys.ctx.createDelay();
        AudioSys.delay.delayTime.value = 0.5; 
        const feedback = AudioSys.ctx.createGain();
        feedback.gain.value = 0.25; 
        
        const delayFilter = AudioSys.ctx.createBiquadFilter();
        delayFilter.type = 'highpass';
        delayFilter.frequency.value = 400; 

        AudioSys.delay.connect(delayFilter);
        delayFilter.connect(feedback);
        feedback.connect(AudioSys.delay);
        AudioSys.delay.connect(AudioSys.masterGain);
        
        AudioSys.masterGain.connect(AudioSys.compressor);
        AudioSys.compressor.connect(AudioSys.ctx.destination);
        
        UI.log("Expanded Acoustic Arsenal Online.", "system");
        State.isAudioReady = true;

        AudioSys.nextNoteTime = AudioSys.ctx.currentTime + 0.1;
        AudioSys.scheduler();
    },

    playSynth: (instrument, freq, time, duration) => {
        const osc = AudioSys.ctx.createOscillator();
        const osc2 = AudioSys.ctx.createOscillator(); 
        const gain = AudioSys.ctx.createGain();
        const filter = AudioSys.ctx.createBiquadFilter();
        
        gain.gain.setValueAtTime(0, time);
        let sendToDelay = false;
        
        // Strict release time to ensure nodes die quickly
        const maxDuration = duration > 2.0 ? 2.0 : duration; 
        const tail = 0.5; // Audio tail before forced GC
        
        switch (instrument) {
            case 'bass':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq * 0.25, time); 
                osc2.type = 'sine'; osc2.frequency.setValueAtTime(freq * 0.25, time);
                filter.type = 'lowpass'; filter.frequency.setValueAtTime(80, time);
                filter.frequency.exponentialRampToValueAtTime(400, time + 0.1);
                filter.frequency.exponentialRampToValueAtTime(80, time + maxDuration);
                gain.gain.linearRampToValueAtTime(0.6, time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, time + maxDuration);
                break;

            case 'sub':
                osc.type = 'sine'; osc.frequency.setValueAtTime(freq * 0.25, time); 
                osc2.type = 'sine'; osc2.frequency.setValueAtTime(freq * 0.25, time);
                filter.type = 'lowpass'; filter.frequency.setValueAtTime(100, time);
                gain.gain.linearRampToValueAtTime(0.5, time + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, time + maxDuration);
                break;
                
            case 'pluck':
                osc.type = 'square'; osc.frequency.setValueAtTime(freq * 2, time); 
                osc2.type = 'triangle'; osc2.frequency.setValueAtTime(freq * 2.01, time); 
                filter.type = 'bandpass'; filter.frequency.setValueAtTime(2000, time);
                gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
                sendToDelay = true;
                break;

            case 'bell':
                osc.type = 'sine'; osc.frequency.setValueAtTime(freq * 2, time); 
                osc2.type = 'sine'; osc2.frequency.setValueAtTime(freq * 5.56, time);
                filter.type = 'highpass'; filter.frequency.setValueAtTime(500, time);
                gain.gain.linearRampToValueAtTime(0.2, time + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
                sendToDelay = true;
                break;
                
            case 'pad':
                osc.type = 'sine'; osc.frequency.setValueAtTime(freq, time);
                osc2.type = 'sine'; osc2.frequency.setValueAtTime(freq * 1.005, time); 
                filter.type = 'lowpass'; filter.frequency.setValueAtTime(800, time);
                gain.gain.linearRampToValueAtTime(0.12, time + 0.5);
                gain.gain.exponentialRampToValueAtTime(0.001, time + maxDuration);
                break;

            case 'choir':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, time);
                osc2.type = 'sawtooth'; osc2.frequency.setValueAtTime(freq * 0.99, time); 
                filter.type = 'bandpass'; filter.frequency.setValueAtTime(1090, time); filter.Q.value = 4;
                gain.gain.linearRampToValueAtTime(0.15, time + 0.5);
                gain.gain.exponentialRampToValueAtTime(0.001, time + maxDuration);
                sendToDelay = true;
                break;
                
            case 'organ':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, time);
                osc2.type = 'square'; osc2.frequency.setValueAtTime(freq * 2, time); 
                filter.type = 'lowpass'; filter.frequency.setValueAtTime(2500, time);
                gain.gain.linearRampToValueAtTime(0.1, time + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, time + maxDuration);
                sendToDelay = true;
                break;

            case 'brass':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, time);
                osc2.type = 'sawtooth'; osc2.frequency.setValueAtTime(freq * 1.01, time); 
                filter.type = 'lowpass'; filter.frequency.setValueAtTime(200, time);
                filter.frequency.linearRampToValueAtTime(3000, time + 0.2); 
                filter.frequency.exponentialRampToValueAtTime(200, time + maxDuration);
                gain.gain.linearRampToValueAtTime(0.15, time + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, time + maxDuration);
                sendToDelay = true;
                break;
        }

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(AudioSys.masterGain);
        
        if (sendToDelay) {
            gain.connect(AudioSys.delay);
        }

        const stopTime = time + maxDuration + tail;
        osc.start(time); 
        osc2.start(time);
        osc.stop(stopTime); 
        osc2.stop(stopTime);

        // Aggressive Garbage Collection (Prevent memory leaks/glitches)
        const msUntilDeath = (stopTime - AudioSys.ctx.currentTime) * 1000;
        setTimeout(() => {
            osc.disconnect();
            osc2.disconnect();
            filter.disconnect();
            gain.disconnect();
        }, msUntilDeath + 100);

        AudioSys.visualQueue.push({ time, instrument, noteFreq: freq });
        // Prevent visual queue memory leak
        if (AudioSys.visualQueue.length > 50) AudioSys.visualQueue.shift();
    },

    scheduleNote: (stepNumber, time) => {
        if (!State.isSequencerRunning || State.params.chord.length === 0) return;

        const tx = State.params.texture;
        const rh = State.params.rhythm;
        
        // 1. Foundation
        if (stepNumber % 8 === 0) {
            const bassInst = (tx === 'ethereal' || tx === 'vocal') ? 'sub' : 'bass';
            AudioSys.playSynth(bassInst, MathLogic.noteToFreq(State.params.chord[0]), time, 2.0);
        }

        // 2. Chords (Polyrhythm hits on 6, else 0)
        const chordStep = rh === 'polyrhythmic' ? 6 : 0;
        if (stepNumber === chordStep || stepNumber === 0) {
            let chordInst = 'pad';
            if (tx === 'vocal') chordInst = 'choir';
            if (tx === 'mechanical') chordInst = 'organ';
            if (tx === 'aggressive') chordInst = 'brass';

            State.params.chord.slice(0, 3).forEach(note => {
                AudioSys.playSynth(chordInst, MathLogic.noteToFreq(note), time, 4.0);
            });
        }

        // 3. Arpeggio Logic based on Rhythm Parameter
        let playArp = false;
        if (rh === 'flowing' && stepNumber % 4 === 0) playArp = true;
        if (rh === 'staccato' && stepNumber % 2 === 0) playArp = true;
        if (rh === 'polyrhythmic' && stepNumber % 3 === 0) playArp = true;
        if (rh === 'march' && (stepNumber % 4 === 0 || stepNumber === 14)) playArp = true;
        
        if (playArp && Math.random() < (State.params.density * 0.8 + 0.2)) {
            const arpInst = (tx === 'crystalline' || tx === 'ethereal') ? 'bell' : 'pluck';
            const note = MathLogic.getArpeggioNote(stepNumber);
            AudioSys.playSynth(arpInst, MathLogic.noteToFreq(note), time, 0.3);
        }
        
        // 4. Accents
        if (stepNumber % 4 === 2 && Math.random() < (State.params.energy * 0.8)) {
            const accentInst = tx === 'aggressive' ? 'brass' : 'organ';
            const rNote = MathLogic.getRandomNote();
            AudioSys.playSynth(accentInst, MathLogic.noteToFreq(rNote), time, 0.8);
        }
    },

    nextNote: () => {
        const tempo = 50 + (State.params.energy * 70); 
        const secondsPerBeat = 60.0 / tempo;
        AudioSys.nextNoteTime += 0.25 * secondsPerBeat; 
        AudioSys.currentStep++;
        if (AudioSys.currentStep >= 16) {
            AudioSys.currentStep = 0;
        }
    },

    scheduler: () => {
        while (AudioSys.nextNoteTime < AudioSys.ctx.currentTime + AudioSys.scheduleAheadTime) {
            AudioSys.scheduleNote(AudioSys.currentStep, AudioSys.nextNoteTime);
            AudioSys.nextNote();
        }
        AudioSys.timerID = setTimeout(AudioSys.scheduler, AudioSys.lookahead);
    }
};

// --- 3. LLM MACRO-ORCHESTRATOR ---
const LLM = {
    setPollRate: (callsPerMinute) => {
        clearInterval(State.apiPollTimer);
        if (!State.isAutoMode) return;
        const intervalMs = (60 / callsPerMinute) * 1000;
        State.apiPollTimer = setInterval(() => {
            LLM.think();
        }, intervalMs);
    },

    think: async (explicitPrompt = null) => {
        if (State.ai.status === 'THINKING') return; 
        
        State.ai.status = 'THINKING';
        UI.updateStatus();
        
        const endpoint = document.getElementById('config-endpoint').value;
        const model = document.getElementById('config-model').value;
        
        if (explicitPrompt) {
            State.ai.memory.push(`Human Feedback: ${explicitPrompt}`);
        } else {
            State.ai.memory.push(`System: Evolve the composition naturally.`);
        }

        if (State.ai.memory.length > 4) State.ai.memory.shift();

        const systemPrompt = `You are an Autonomous AI Composer controlling a highly advanced procedural synthesizer.
You have absolute freedom to radically alter the instrumentation, scale, rhythm, and texture.

Current State: 
- Chord: ${State.params.chord.length > 0 ? State.params.chord.join(',') : 'None'}
- Texture: ${State.params.texture}
- Rhythm: ${State.params.rhythm}
- Energy: ${State.params.energy.toFixed(2)}
- Density: ${State.params.density.toFixed(2)}

Recent Feedback/Memory:
${State.ai.memory.join('\n')}

Based on the feedback, orchestrate the next phrase. 
Respond ONLY with a strict JSON object (No markdown, no backticks, no preamble):
{
  "thought": "Internal monologue on your creative choices.",
  "songNature": "A poetic description of the current composition.",
  "evolutionMechanism": "Your structural plan for the next few iterations.",
  "chord": ["Array", "of", "4", "Scientific", "Pitches", "e.g.", "D4", "F4", "A4"],
  "texture": "Choose ONE: ethereal, mechanical, aggressive, crystalline, vocal",
  "rhythm": "Choose ONE: flowing, staccato, polyrhythmic, march",
  "energy": [Float 0.0 to 1.0 (0=Ambient/Slow, 1=Intense)],
  "density": [Float 0.0 to 1.0 (0=Sparse, 1=Complex/Busy)]
}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: systemPrompt,
                    stream: false,
                    format: 'json'
                })
            });

            const data = await response.json();
            let rawText = data.response;
            let parsed = null;

            try {
                rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const startIndex = rawText.indexOf('{');
                const endIndex = rawText.lastIndexOf('}');
                if (startIndex !== -1 && endIndex !== -1) {
                    const cleanJson = rawText.substring(startIndex, endIndex + 1);
                    parsed = JSON.parse(cleanJson);
                } else {
                    throw new Error("No JSON object found.");
                }
            } catch (parseError) {
                console.error("Raw Output:", rawText);
                throw new Error("Failed to parse JSON.");
            }
            
            UI.log(`<strong>Nature:</strong> ${parsed.songNature || 'Unknown'}`, "ai");
            UI.log(`<strong>Mechanism:</strong> ${parsed.evolutionMechanism || 'Unknown'}`, "ai");
            
            if (parsed.chord && Array.isArray(parsed.chord) && parsed.chord.length > 0) {
                State.params.chord = parsed.chord.slice(0, 4); 
                State.params.energy = Math.max(0, Math.min(1, parsed.energy || 0.5));
                State.params.density = Math.max(0, Math.min(1, parsed.density || 0.5));
                
                // New Autonomy Parameters
                State.params.texture = parsed.texture || "mechanical";
                State.params.rhythm = parsed.rhythm || "flowing";
                
                State.params.evolutionMechanism = parsed.evolutionMechanism || "Unknown";
                
                if (!State.isSequencerRunning) {
                    State.isSequencerRunning = true;
                    UI.log("AI blueprint received. Symphony Engaged.", "system");
                }
            }
            
            State.ai.status = 'LISTENING';
            UI.updateStatus();

        } catch (err) {
            console.error("LLM Error:", err);
            UI.log(`Error: ${err.message}`, "system");
            State.ai.status = 'ERROR';
            UI.updateStatus();
        }
    }
};

// --- 4. ENGINE & VIBE (Expanded Visual Mappings) ---
const Engine = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000),
    renderer: new THREE.WebGLRenderer({ antialias: true, alpha: true }),
    controls: null,
    pipes: [], 
    sparks: [], 
    particles: null,
    
    ambientTargetColor: new THREE.Color(0x111111),
    ambientLight: null,

    baseProps: {
        brass: { color: 0xb5a642, metalness: 0.9, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.1 },
        copper: { color: 0xb87333, metalness: 0.8, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 },
        steel: { color: 0x556677, metalness: 0.7, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 }
    },

    init: () => {
        const container = document.getElementById('canvas-container');
        Engine.renderer.setSize(window.innerWidth, window.innerHeight);
        Engine.renderer.setClearColor(0x020101, 1);
        container.appendChild(Engine.renderer.domElement);
        
        Engine.scene.fog = new THREE.FogExp2(0x020101, 0.015);
        Engine.camera.position.set(0, 10, 60);
        
        Engine.controls = new OrbitControls(Engine.camera, Engine.renderer.domElement);
        Engine.controls.enableDamping = true;
        Engine.controls.dampingFactor = 0.05;
        Engine.controls.maxPolarAngle = Math.PI / 2; 
        Engine.controls.target.set(0, 15, 0); 
        Engine.controls.enablePan = false;

        Engine.ambientLight = new THREE.AmbientLight(0x111111, 2);
        Engine.scene.add(Engine.ambientLight);
        
        const spotlight = new THREE.PointLight(0xffddaa, 1000, 200);
        spotlight.position.set(0, 20, 30);
        Engine.scene.add(spotlight);
        
        const rimLight = new THREE.PointLight(0x4488ff, 500, 200);
        rimLight.position.set(0, 10, -30);
        Engine.scene.add(rimLight);

        Engine.buildMassivePipes();
        Engine.buildSparks();
        Engine.buildParticles();

        window.addEventListener('resize', () => {
            Engine.camera.aspect = window.innerWidth / window.innerHeight;
            Engine.camera.updateProjectionMatrix();
            Engine.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        requestAnimationFrame(Engine.loop);
    },
    
    buildMassivePipes: () => {
        Engine.createPipeRing(24, 15, 10, 'copper'); // Pluck, Bell
        Engine.createPipeRing(36, 25, 20, 'brass');  // Organ, Brass, Pad, Choir
        Engine.createPipeRing(48, 35, 35, 'steel');  // Bass, Sub
    },

    createPipeRing: (numPipes, radius, baseHeight, type) => {
        for (let i = 0; i < numPipes; i++) {
            const angle = Math.PI + (i / (numPipes - 1)) * Math.PI; 
            const height = baseHeight + (Math.random() * 15);
            
            const geo = new THREE.CylinderGeometry(1.5, 1.2, height, 24);
            const matProps = Engine.baseProps[type];
            
            const mat = new THREE.MeshPhysicalMaterial({
                color: matProps.color,
                metalness: matProps.metalness,
                roughness: matProps.roughness,
                clearcoat: matProps.clearcoat,
                clearcoatRoughness: matProps.clearcoatRoughness,
                emissive: 0x000000, 
                emissiveIntensity: 0
            });
            
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.x = Math.cos(angle) * radius;
            mesh.position.z = Math.sin(angle) * radius;
            mesh.position.y = height / 2;
            
            mesh.userData = { isPipe: true, index: i };
            
            Engine.pipes.push({ 
                mesh, baseY: height / 2, currentScale: 1.0, glowIntensity: 0, glowColor: new THREE.Color(0x000000)
            });
            
            Engine.scene.add(mesh);
        }
    },

    buildSparks: () => {
        for(let i=0; i<12; i++) { // Increased pool for more instruments
            const light = new THREE.PointLight(0x000000, 0, 15); 
            Engine.scene.add(light);
            Engine.sparks.push({ light: light, active: false, intensity: 0 });
        }
    },

    buildParticles: () => {
        const geo = new THREE.BufferGeometry();
        const count = 500;
        const pos = new Float32Array(count * 3);
        for(let i=0; i<count*3; i++) {
            pos[i] = (Math.random() - 0.5) * 150;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffddaa, size: 0.3, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending });
        Engine.particles = new THREE.Points(geo, mat);
        Engine.scene.add(Engine.particles);
    },

    triggerVisualEvent: (event) => {
        // Map 8 instruments to rings
        const isInner = (event.instrument === 'pluck' || event.instrument === 'bell');
        const isMiddle = (event.instrument === 'organ' || event.instrument === 'brass' || event.instrument === 'pad' || event.instrument === 'choir');
        
        const targetRing = isInner ? {start:0, end:24} : 
                           isMiddle ? {start:24, end:60} : 
                           {start:60, end:108}; // Bass/Sub
                           
        const range = targetRing.end - targetRing.start;
        const randIndex = targetRing.start + Math.floor(Math.random() * range);
        const pipe = Engine.pipes[randIndex];

        if (pipe) {
            let cHex = 0xffaa00;
            let lightIntensity = 40;
            let glowInt = 0.5;
            
            // Expanded Color Palette for Instruments
            switch(event.instrument) {
                case 'pluck': cHex = 0x00ffff; lightIntensity = 80; glowInt = 0.8; break; // Cyan
                case 'bell': cHex = 0xffffff; lightIntensity = 120; glowInt = 1.0; break; // White
                case 'organ': cHex = 0xff8800; lightIntensity = 60; glowInt = 0.6; break; // Orange
                case 'brass': cHex = 0xff3300; lightIntensity = 80; glowInt = 0.9; break; // Fiery Red
                case 'pad': cHex = 0x6600ff; lightIntensity = 30; glowInt = 0.3; break;   // Deep Purple
                case 'choir': cHex = 0xff00ff; lightIntensity = 40; glowInt = 0.4; break; // Pink
                case 'bass': cHex = 0xff0000; lightIntensity = 100; glowInt = 0.8; break; // Blood Red
                case 'sub': cHex = 0x0000ff; lightIntensity = 100; glowInt = 0.7; break;  // Deep Blue
            }
            
            pipe.glowColor.setHex(cHex);
            pipe.glowIntensity = glowInt;
            pipe.mesh.material.emissive.copy(pipe.glowColor);
            pipe.mesh.material.emissiveIntensity = pipe.glowIntensity;
            
            pipe.currentScale = 1.01; 
            
            const spark = Engine.sparks.find(s => !s.active) || Engine.sparks[0];
            spark.active = true;
            spark.intensity = lightIntensity;
            spark.light.color.setHex(cHex);
            spark.light.position.copy(pipe.mesh.position);
            spark.light.position.z += 1.5; 
            spark.light.position.y += (Math.random() * 10) - 5; 
            spark.light.intensity = spark.intensity;
        }
    },

    loop: (timestamp) => {
        State.time = timestamp * 0.001;
        
        const currentAudioTime = AudioSys.ctx ? AudioSys.ctx.currentTime : 0;
        while(AudioSys.visualQueue.length > 0 && AudioSys.visualQueue[0].time <= currentAudioTime) {
            const ev = AudioSys.visualQueue.shift();
            Engine.triggerVisualEvent(ev);
        }
        
        Engine.pipes.forEach((pipe, i) => {
            const breathSpeed = 0.5 + State.params.energy * 2.0;
            pipe.mesh.position.y = pipe.baseY + Math.sin(State.time * breathSpeed + i) * (0.2 + State.params.energy * 0.5); 
            
            if (pipe.glowIntensity > 0.01) {
                pipe.glowIntensity = MathLogic.lerp(pipe.glowIntensity, 0, 0.05);
                pipe.mesh.material.emissiveIntensity = pipe.glowIntensity;
            } else {
                pipe.mesh.material.emissiveIntensity = 0;
            }
            
            if (pipe.currentScale > 1.001) {
                pipe.currentScale = MathLogic.lerp(pipe.currentScale, 1.0, 0.1);
                pipe.mesh.scale.set(pipe.currentScale, 1.0, pipe.currentScale);
            } else {
                pipe.mesh.scale.set(1.0, 1.0, 1.0);
            }
        });

        Engine.sparks.forEach(spark => {
            if (spark.active) {
                spark.intensity = MathLogic.lerp(spark.intensity, 0, 0.1); 
                spark.light.intensity = spark.intensity;
                spark.light.position.y += 0.05; 
                if (spark.intensity < 1) {
                    spark.active = false;
                    spark.light.intensity = 0;
                }
            }
        });

        if (Engine.particles) {
            Engine.particles.rotation.y = State.time * 0.02 * (1 + State.params.energy);
        }

        Engine.controls.update();
        Engine.renderer.render(Engine.scene, Engine.camera);
        requestAnimationFrame(Engine.loop);
    }
};

// --- BINDINGS ---
document.getElementById('btn-start').addEventListener('click', () => {
    if (!State.isAudioReady) {
        AudioSys.init();
        const btn = document.getElementById('btn-start');
        btn.innerText = "Boiler Ignited (Awaiting AI)";
        btn.style.color = "#888";
        btn.style.borderColor = "#888";
        btn.disabled = true;
        State.ai.status = 'LISTENING';
        UI.updateStatus();
    }
});

// Semantic Feedback Buttons
document.querySelectorAll('.btn-feedback').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!State.isAudioReady) return;
        const prompt = e.target.getAttribute('data-prompt');
        UI.log(e.target.innerText, "human");
        LLM.think(prompt);
    });
});

document.getElementById('config-speed').addEventListener('input', (e) => {
    const callsPerMin = parseInt(e.target.value);
    document.getElementById('speed-label').innerText = `${callsPerMin} API Calls / Min`;
    
    if (State.isAutoMode) {
        LLM.setPollRate(callsPerMin);
    }
});

document.getElementById('toggle-auto').addEventListener('change', (e) => {
    State.isAutoMode = e.target.checked;
    UI.log(State.isAutoMode ? "Auto-Evolve Engaged." : "Auto-Evolve Disengaged.", "system");
    
    if (State.isAutoMode) {
        const rate = parseInt(document.getElementById('config-speed').value);
        if(!State.isSequencerRunning) {
             LLM.think("Start the composition. Establish the initial mood and scale.");
        } else {
             LLM.think(); 
        }
        LLM.setPollRate(rate);
    } else {
        clearInterval(State.apiPollTimer);
    }
});

Engine.init();
