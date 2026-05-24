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
        rootNote: "C4",
        scaleType: "aeolian", 
        scaleArray: [], 
        energy: 0.1,  
        density: 0.1,
        texture: "mechanical",
        rhythm: "flowing",
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
        if (!logEl) return;
        const div = document.createElement('div');
        div.className = `log-entry log-${sender}`;
        div.innerHTML = `<strong>${sender.toUpperCase()}:</strong> ${msg}`;
        logEl.appendChild(div);
        setTimeout(() => { logEl.scrollTop = logEl.scrollHeight; }, 10);
    },
    updateStatus: () => {
        try {
            document.getElementById('ai-state').innerText = State.ai.status;
            const scaleText = State.params.scaleArray.length > 0 ? `${State.params.rootNote.replace(/\d/,'')} ${State.params.scaleType}` : 'Waiting...';
            document.getElementById('current-chord').innerText = scaleText.toUpperCase();
            document.getElementById('current-texture').innerText = State.params.texture.toUpperCase();
            document.getElementById('current-rhythm').innerText = State.params.rhythm.toUpperCase();
        } catch (e) {}
    }
};

// --- EMOTIONAL MUSIC THEORY ENGINE ---
const MusicTheory = {
    notes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    scales: {
        ionian: [0, 2, 4, 5, 7, 9, 11],
        aeolian: [0, 2, 3, 5, 7, 8, 10],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        phrygian: [0, 1, 3, 5, 7, 8, 10],
        lydian: [0, 2, 4, 6, 7, 9, 11],
        harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
        pentatonic_minor: [0, 3, 5, 7, 10]
    },

    noteToFreq: (noteStr) => {
        if (!noteStr || typeof noteStr !== 'string') return 440;
        let cleanNote = noteStr.replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#');
        const match = cleanNote.match(/^([A-G]#?)(\d+)$/);
        if (!match) return 440; 
        const key = match[1];
        const octave = parseInt(match[2], 10);
        let keyIndex = MusicTheory.notes.indexOf(key);
        if (keyIndex === -1) return 440;
        const n = (octave - 4) * 12 + (keyIndex - 9);
        return 440 * Math.pow(2, n / 12);
    },

    generateScaleArray: (rootStr, scaleType) => {
        try {
            let cleanNote = rootStr.replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#');
            const match = cleanNote.match(/^([A-G]#?)(\d+)$/);
            if (!match) return ["C4", "E4", "G4", "A4", "B4"];
            
            const rootKey = match[1];
            const rootOctave = parseInt(match[2], 10);
            const rootIndex = MusicTheory.notes.indexOf(rootKey);
            const intervals = MusicTheory.scales[scaleType] || MusicTheory.scales.aeolian;
            
            const scaleArray = [];
            for (let octOffset = 0; octOffset < 2; octOffset++) {
                intervals.forEach(interval => {
                    let absoluteIndex = rootIndex + interval;
                    let finalOctave = rootOctave + octOffset + Math.floor(absoluteIndex / 12);
                    let finalKey = MusicTheory.notes[absoluteIndex % 12];
                    scaleArray.push(`${finalKey}${finalOctave}`);
                });
            }
            return scaleArray;
        } catch (e) { return ["C4", "E4", "G4"]; }
    },

    getBassNote: () => {
        if (!State.params.scaleArray.length) return "C2";
        return State.params.scaleArray[Math.random() > 0.7 ? 4 : 0];
    },
    
    getPadChord: () => {
        const s = State.params.scaleArray;
        if (s.length < 7) return s.length > 0 ? [s[0]] : ["C3"]; 
        return [s[0], s[2], s[4], s[6]]; 
    },

    getArpeggioNote: (step) => {
        const s = State.params.scaleArray;
        if (!s.length) return "C4";
        const phrasePattern = [0, 2, 4, 2, 7, 4, 2, 1]; 
        const index = phrasePattern[step % phrasePattern.length];
        return s[index % s.length];
    },

    getTensionNote: () => {
        const s = State.params.scaleArray;
        if (!s.length) return "C5";
        return s[Math.min(s.length - 1, 7 + Math.floor(Math.random() * 4))];
    }
};

// --- 2. AUDIO & SEQUENCER (Safe Catch-up & GC) ---
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
        try {
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
            
            UI.log("Acoustic Engine Online.", "system");
            State.isAudioReady = true;

            AudioSys.nextNoteTime = AudioSys.ctx.currentTime + 0.1;
            AudioSys.scheduler();
        } catch (e) {
            console.error("Audio Init Failed:", e);
            UI.log("Audio Error: " + e.message, "system");
        }
    },

    playSynth: (instrument, freq, time, duration) => {
        if (!AudioSys.ctx) return;
        const osc = AudioSys.ctx.createOscillator();
        const osc2 = AudioSys.ctx.createOscillator(); 
        const gain = AudioSys.ctx.createGain();
        const filter = AudioSys.ctx.createBiquadFilter();
        
        gain.gain.setValueAtTime(0, time);
        let sendToDelay = false;
        const maxDuration = duration > 2.0 ? 2.0 : duration; 
        const tail = 0.5; 
        
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
                gain.gain.linearRampToValueAtTime(0.12, time + 1.0);
                gain.gain.setTargetAtTime(0, time + duration, 1.0);
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

        osc.connect(filter); osc2.connect(filter);
        filter.connect(gain); gain.connect(AudioSys.masterGain);
        if (sendToDelay) gain.connect(AudioSys.delay);

        const stopTime = time + maxDuration + tail;
        osc.start(time); osc2.start(time);
        osc.stop(stopTime); osc2.stop(stopTime);

        // Forced Disconnect
        setTimeout(() => {
            try {
                osc.disconnect(); osc2.disconnect();
                filter.disconnect(); gain.disconnect();
            } catch (e) {}
        }, (stopTime - AudioSys.ctx.currentTime) * 1000 + 100);

        AudioSys.visualQueue.push({ time, instrument, noteFreq: freq });
        if (AudioSys.visualQueue.length > 50) AudioSys.visualQueue.shift();
    },

    scheduleNote: (stepNumber, time) => {
        if (!State.isSequencerRunning || State.params.scaleArray.length === 0) return;
        const tx = State.params.texture;
        const rh = State.params.rhythm;
        
        if (stepNumber % 8 === 0) {
            const bassInst = (tx === 'ethereal' || tx === 'vocal') ? 'sub' : 'bass';
            AudioSys.playSynth(bassInst, MusicTheory.noteToFreq(MusicTheory.getBassNote()), time, 2.0);
        }

        const chordStep = rh === 'polyrhythmic' ? 6 : 0;
        if (stepNumber === chordStep || stepNumber === 0) {
            let chordInst = 'pad';
            if (tx === 'vocal') chordInst = 'choir';
            if (tx === 'mechanical') chordInst = 'organ';
            if (tx === 'aggressive') chordInst = 'brass';
            MusicTheory.getPadChord().forEach(note => {
                AudioSys.playSynth(chordInst, MusicTheory.noteToFreq(note), time, 4.0);
            });
        }

        let playArp = false;
        if (rh === 'flowing' && stepNumber % 2 === 0) playArp = true;
        if (rh === 'staccato' && stepNumber % 2 === 0) playArp = true;
        if (rh === 'polyrhythmic' && stepNumber % 3 === 0) playArp = true;
        if (rh === 'march' && (stepNumber % 4 === 0 || stepNumber === 14)) playArp = true;
        
        if (playArp && Math.random() < (State.params.density * 0.8 + 0.2)) {
            const arpInst = (tx === 'crystalline' || tx === 'ethereal') ? 'bell' : 'pluck';
            const note = MusicTheory.getArpeggioNote(stepNumber);
            AudioSys.playSynth(arpInst, MusicTheory.noteToFreq(note), time, 0.3);
        }
        
        if (stepNumber % 4 === 2 && Math.random() < (State.params.energy * 0.5)) {
            const accentInst = tx === 'aggressive' ? 'brass' : 'organ';
            AudioSys.playSynth(accentInst, MusicTheory.noteToFreq(MusicTheory.getTensionNote()), time, 1.5);
        }
    },

    nextNote: () => {
        const energy = isNaN(State.params.energy) ? 0.1 : State.params.energy;
        const tempo = 50 + (energy * 70); 
        const secondsPerBeat = 60.0 / Math.max(1, tempo);
        AudioSys.nextNoteTime += 0.25 * secondsPerBeat; 
        AudioSys.currentStep = (AudioSys.currentStep + 1) % 16;
    },

    scheduler: () => {
        try {
            let catchUpLimit = 0;
            while (AudioSys.nextNoteTime < AudioSys.ctx.currentTime + AudioSys.scheduleAheadTime && catchUpLimit < 32) {
                AudioSys.scheduleNote(AudioSys.currentStep, AudioSys.nextNoteTime);
                AudioSys.nextNote();
                catchUpLimit++;
            }
            AudioSys.timerID = setTimeout(AudioSys.scheduler, AudioSys.lookahead);
        } catch (e) {
            console.error("Scheduler Error:", e);
        }
    }
};

// --- 3. LLM MACRO-ORCHESTRATOR ---
const LLM = {
    setPollRate: (callsPerMinute) => {
        clearInterval(State.apiPollTimer);
        if (!State.isAutoMode) return;
        const intervalMs = (60 / Math.max(1, callsPerMinute)) * 1000;
        State.apiPollTimer = setInterval(() => { LLM.think(); }, intervalMs);
    },

    think: async (explicitPrompt = null) => {
        if (State.ai.status === 'THINKING') return; 
        State.ai.status = 'THINKING';
        UI.updateStatus();
        const endpoint = document.getElementById('config-endpoint').value;
        const model = document.getElementById('config-model').value;
        
        if (explicitPrompt) State.ai.memory.push(`Human: ${explicitPrompt}`);
        else State.ai.memory.push(`System: Evolve the composition gracefully.`);
        if (State.ai.memory.length > 4) State.ai.memory.shift();

        const systemPrompt = `You are a Master Composer AI. Orchestrate the procedural synthesizer. Respond ONLY with a strict JSON object:
{
  "thought": "Internal monologue on chooses.",
  "songNature": "A poetic description.",
  "rootNote": "e.g. C4, D#4, F4",
  "scaleType": "Choose: ionian, aeolian, dorian, phrygian, lydian, harmonic_minor, pentatonic_minor",
  "texture": "Choose: ethereal, mechanical, aggressive, crystalline, vocal",
  "rhythm": "Choose: flowing, staccato, polyrhythmic, march",
  "energy": 0.5,
  "density": 0.5
}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model, prompt: systemPrompt, stream: false, format: 'json' })
            });

            const data = await response.json();
            let rawText = data.response;
            let parsed = null;

            try {
                rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const start = rawText.indexOf('{');
                const end = rawText.lastIndexOf('}');
                if (start !== -1 && end !== -1) parsed = JSON.parse(rawText.substring(start, end + 1));
                else throw new Error("No JSON object found.");
            } catch (pE) { throw new Error("Failed to parse JSON."); }
            
            UI.log(`<strong>Emotion:</strong> ${parsed.songNature || 'Unknown'}`, "ai");
            
            if (parsed.rootNote && parsed.scaleType) {
                State.params.rootNote = parsed.rootNote;
                State.params.scaleType = parsed.scaleType;
                State.params.scaleArray = MusicTheory.generateScaleArray(parsed.rootNote, parsed.scaleType);
                
                const safeF = (v, d) => {
                    let res = Array.isArray(v) ? v[0] : v;
                    res = parseFloat(res);
                    return isNaN(res) ? d : res;
                };

                State.params.energy = Math.max(0.01, Math.min(1, safeF(parsed.energy, 0.5)));
                State.params.density = Math.max(0.01, Math.min(1, safeF(parsed.density, 0.5)));
                State.params.texture = parsed.texture || "mechanical";
                State.params.rhythm = parsed.rhythm || "flowing";
                
                if (!State.isSequencerRunning) {
                    State.isSequencerRunning = true;
                    AudioSys.nextNoteTime = AudioSys.ctx.currentTime + 0.1;
                    UI.log("AI blueprint received. Symphony Engaged.", "system");
                }
            }
            State.ai.status = 'LISTENING';
            UI.updateStatus();
        } catch (err) {
            UI.log(`Error: ${err.message}`, "system");
            State.ai.status = 'ERROR';
            UI.updateStatus();
        }
    }
};

// --- 4. ENGINE & VIBE (Highly Discrete Visuals) ---
const Engine = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000),
    renderer: null,
    controls: null,
    pipes: [], 
    sparks: [], 
    particles: null,
    
    ambientLight: null,
    baseProps: {
        brass: { color: 0xb5a642, metalness: 0.9, roughness: 0.2, clearcoat: 1.0 },
        copper: { color: 0xb87333, metalness: 0.8, roughness: 0.3, clearcoat: 0.8 },
        steel: { color: 0x556677, metalness: 0.7, roughness: 0.4, clearcoat: 0.5 }
    },

    init: () => {
        try {
            const container = document.getElementById('canvas-container');
            Engine.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
            Engine.renderer.setSize(window.innerWidth, window.innerHeight);
            Engine.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
            Engine.renderer.setClearColor(0x020101, 1);
            container.appendChild(Engine.renderer.domElement);
            
            Engine.scene.fog = new THREE.FogExp2(0x020101, 0.015);
            Engine.camera.position.set(0, 10, 60);
            
            Engine.controls = new OrbitControls(Engine.camera, Engine.renderer.domElement);
            Engine.controls.enableDamping = true;
            Engine.controls.dampingFactor = 0.05;
            Engine.controls.maxPolarAngle = Math.PI / 2; 
            Engine.controls.target.set(0, 15, 0); 
            Engine.controls.autoRotate = true;
            Engine.controls.autoRotateSpeed = 0.5;

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
        } catch (e) { console.error("Engine Init Failed:", e); }
    },
    
    buildMassivePipes: () => {
        Engine.createPipeRing(24, 15, 10, 'copper'); 
        Engine.createPipeRing(36, 25, 20, 'brass');  
        Engine.createPipeRing(48, 35, 35, 'steel');  
    },

    createPipeRing: (numPipes, radius, baseHeight, type) => {
        for (let i = 0; i < numPipes; i++) {
            const angle = Math.PI + (i / (numPipes - 1)) * Math.PI; 
            const height = baseHeight + (Math.random() * 15);
            const geo = new THREE.CylinderGeometry(1.5, 1.2, height, 16);
            const matProps = Engine.baseProps[type];
            const mat = new THREE.MeshPhysicalMaterial({
                color: matProps.color, metalness: matProps.metalness, roughness: matProps.roughness,
                clearcoat: matProps.clearcoat, clearcoatRoughness: 0.1,
                emissive: 0x000000, emissiveIntensity: 0
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(Math.cos(angle)*radius, height/2, Math.sin(angle)*radius);
            Engine.pipes.push({ mesh, baseY: height/2, currentScale: 1.0, glowIntensity: 0, glowColor: new THREE.Color(0x000000) });
            Engine.scene.add(mesh);
        }
    },

    buildSparks: () => {
        for(let i=0; i<12; i++) { 
            const light = new THREE.PointLight(0x000000, 0, 15); 
            Engine.scene.add(light);
            Engine.sparks.push({ light, active: false, intensity: 0 });
        }
    },

    buildParticles: () => {
        const geo = new THREE.BufferGeometry();
        const count = 500;
        const pos = new Float32Array(count * 3);
        for(let i=0; i<count*3; i++) { pos[i] = (Math.random() - 0.5) * 150; }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffddaa, size: 0.3, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending });
        Engine.particles = new THREE.Points(geo, mat);
        Engine.scene.add(Engine.particles);
    },

    triggerVisualEvent: (event) => {
        try {
            const isInner = (event.instrument === 'pluck' || event.instrument === 'bell');
            const isMiddle = (event.instrument === 'organ' || event.instrument === 'brass' || event.instrument === 'pad' || event.instrument === 'choir');
            const targetRing = isInner ? {start:0, end:24} : isMiddle ? {start:24, end:60} : {start:60, end:108}; 
            const range = targetRing.end - targetRing.start;
            const randIndex = targetRing.start + Math.floor(Math.random() * range);
            const pipe = Engine.pipes[randIndex];
            if (pipe) {
                let cHex = 0xffaa00; let lightIntensity = 40; let glowInt = 0.5;
                switch(event.instrument) {
                    case 'pluck': cHex = 0x00ffff; lightIntensity = 80; glowInt = 0.8; break; 
                    case 'bell': cHex = 0xffffff; lightIntensity = 120; glowInt = 1.0; break; 
                    case 'organ': cHex = 0xff8800; lightIntensity = 60; glowInt = 0.6; break; 
                    case 'brass': cHex = 0xff3300; lightIntensity = 80; glowInt = 0.9; break; 
                    case 'pad': cHex = 0x6600ff; lightIntensity = 30; glowInt = 0.3; break;   
                    case 'choir': cHex = 0xff00ff; lightIntensity = 40; glowInt = 0.4; break; 
                    case 'bass': cHex = 0xff0000; lightIntensity = 100; glowInt = 0.8; break; 
                    case 'sub': cHex = 0x0000ff; lightIntensity = 100; glowInt = 0.7; break;  
                }
                pipe.glowColor.setHex(cHex); pipe.glowIntensity = glowInt;
                pipe.mesh.material.emissive.copy(pipe.glowColor);
                pipe.mesh.material.emissiveIntensity = pipe.glowIntensity;
                pipe.currentScale = 1.01; 
                const spark = Engine.sparks.find(s => !s.active) || Engine.sparks[0];
                spark.active = true; spark.intensity = lightIntensity; spark.light.color.setHex(cHex);
                spark.light.position.copy(pipe.mesh.position); spark.light.position.z += 1.5; 
                spark.light.intensity = spark.intensity;
            }
        } catch (e) {}
    },

    loop: (timestamp) => {
        try {
            State.time = timestamp * 0.001;
            const currentAudioTime = AudioSys.ctx ? AudioSys.ctx.currentTime : 0;
            while(AudioSys.visualQueue.length > 0 && AudioSys.visualQueue[0].time <= currentAudioTime) {
                Engine.triggerVisualEvent(AudioSys.visualQueue.shift());
            }
            Engine.pipes.forEach((pipe, i) => {
                const en = isNaN(State.params.energy) ? 0.1 : State.params.energy;
                const breathSpeed = 0.5 + en * 2.0;
                pipe.mesh.position.y = pipe.baseY + Math.sin(State.time * breathSpeed + i) * (0.2 + en * 0.5); 
                if (pipe.glowIntensity > 0.01) {
                    pipe.glowIntensity = MathLogic.lerp(pipe.glowIntensity, 0, 0.05);
                    pipe.mesh.material.emissiveIntensity = pipe.glowIntensity;
                } else pipe.mesh.material.emissiveIntensity = 0;
                if (pipe.currentScale > 1.001) {
                    pipe.currentScale = MathLogic.lerp(pipe.currentScale, 1.0, 0.1);
                    pipe.mesh.scale.set(pipe.currentScale, 1.0, pipe.currentScale);
                } else pipe.mesh.scale.set(1.0, 1.0, 1.0);
            });
            Engine.sparks.forEach(spark => {
                if (spark.active) {
                    spark.intensity = MathLogic.lerp(spark.intensity, 0, 0.1); 
                    spark.light.intensity = spark.intensity;
                    if (spark.intensity < 1) { spark.active = false; spark.light.intensity = 0; }
                }
            });
            if (Engine.particles) Engine.particles.rotation.y = State.time * 0.02 * (1 + (isNaN(State.params.energy) ? 0.1 : State.params.energy));
            if (Engine.controls) Engine.controls.update();
            if (Engine.renderer) Engine.renderer.render(Engine.scene, Engine.camera);
            requestAnimationFrame(Engine.loop);
        } catch (e) { console.error("Loop Crash:", e); }
    }
};

// --- BINDINGS ---
document.getElementById('btn-start').addEventListener('click', () => {
    if (!State.isAudioReady) {
        AudioSys.init();
        document.getElementById('btn-start').innerText = "Boiler Active";
        State.ai.status = 'LISTENING';
        UI.updateStatus();
    }
});
document.querySelectorAll('.btn-feedback').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!State.isAudioReady) return;
        LLM.think(e.target.getAttribute('data-prompt'));
    });
});
document.getElementById('config-speed').addEventListener('input', (e) => {
    const rate = parseInt(e.target.value);
    document.getElementById('speed-label').innerText = `${rate} API Calls / Min`;
    if (State.isAutoMode) LLM.setPollRate(rate);
});
document.getElementById('toggle-auto').addEventListener('change', (e) => {
    State.isAutoMode = e.target.checked;
    if (State.isAutoMode) {
        LLM.think("Start the composition.");
        LLM.setPollRate(parseInt(document.getElementById('config-speed').value));
    } else clearInterval(State.apiPollTimer);
});
Engine.init();
