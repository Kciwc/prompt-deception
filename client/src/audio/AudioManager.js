// Single audio context + separate gain nodes for music and SFX so the host
// can adjust them independently. SFX are synthesized (no asset bundling).
// Music supports an optional URL — drop a file at /audio/ambient.mp3 (or
// configure VITE_AMBIENT_MUSIC_URL) to enable; otherwise it no-ops.

const SETTINGS_KEY = 'pd:audio';
const DEFAULTS = { musicVolume: 0.35, sfxVolume: 0.7, muted: false };

class AudioManager {
  constructor() {
    const saved = readSettings();
    this.settings = { ...DEFAULTS, ...saved };
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.musicSource = null;
    this.musicBuffer = null;
    this.musicLoading = null;
    this.musicUrl = import.meta.env.VITE_AMBIENT_MUSIC_URL || '/audio/ambient.mp3';
  }

  // Lazy creation — browsers require a user gesture before unlocking audio.
  async ensure() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this._applySettings();
    return this.ctx;
  }

  // Resume on first interaction (the typical pattern).
  async unlock() {
    await this.ensure();
    if (this.ctx?.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) {}
    }
  }

  setMusicVolume(v) {
    this.settings.musicVolume = clamp01(v);
    saveSettings(this.settings);
    this._applySettings();
  }
  setSfxVolume(v) {
    this.settings.sfxVolume = clamp01(v);
    saveSettings(this.settings);
    this._applySettings();
  }
  setMuted(m) {
    this.settings.muted = !!m;
    saveSettings(this.settings);
    this._applySettings();
  }

  _applySettings() {
    if (!this.ctx) return;
    const masterTarget = this.settings.muted ? 0 : 1;
    this.masterGain.gain.value = masterTarget;
    this.musicGain.gain.value = this.settings.musicVolume;
    this.sfxGain.gain.value = this.settings.sfxVolume;
  }

  // ── Music ─────────────────────────────────────────────
  async startMusic() {
    if (!this.ctx) return;
    if (this.musicSource) return; // already playing
    if (!this.musicBuffer) {
      if (!this.musicLoading) {
        this.musicLoading = (async () => {
          try {
            const res = await fetch(this.musicUrl);
            if (!res.ok) return null;
            const ab = await res.arrayBuffer();
            return await this.ctx.decodeAudioData(ab);
          } catch (_) {
            return null;
          }
        })();
      }
      this.musicBuffer = await this.musicLoading;
      this.musicLoading = null;
    }
    if (!this.musicBuffer) return; // no asset; silent.

    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start(0);
    this.musicSource = src;
  }

  stopMusic() {
    if (!this.musicSource) return;
    try { this.musicSource.stop(0); } catch (_) {}
    try { this.musicSource.disconnect(); } catch (_) {}
    this.musicSource = null;
  }

  // ── SFX (synthesized) ─────────────────────────────────
  // 10-second wake-up chime: two-tone bell, attention-grabbing but not painful.
  chime() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    this._tone({ freq: 880, dur: 0.25, attack: 0.005, release: 0.25, t: t0,        volume: 0.6, type: 'triangle' });
    this._tone({ freq: 660, dur: 0.45, attack: 0.005, release: 0.4,  t: t0 + 0.18, volume: 0.5, type: 'triangle' });
  }

  // Vote-locked tick.
  tick() {
    if (!this.ctx) return;
    this._tone({ freq: 1200, dur: 0.06, attack: 0.001, release: 0.05, t: this.ctx.currentTime, volume: 0.25, type: 'square' });
  }

  // Reveal fanfare — three rising notes.
  reveal() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      this._tone({ freq: f, dur: 0.18, attack: 0.005, release: 0.15, t: t0 + i * 0.13, volume: 0.5, type: 'sine' });
    });
  }

  // Round-end "wah-wah" for misses (optional flavor).
  wrong() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    this._tone({ freq: 220, dur: 0.4, attack: 0.005, release: 0.3, t: t0,        volume: 0.4, type: 'sawtooth' });
    this._tone({ freq: 165, dur: 0.5, attack: 0.005, release: 0.35, t: t0 + 0.18, volume: 0.4, type: 'sawtooth' });
  }

  // Vote cast — quick high "ping".
  voteTick() {
    if (!this.ctx) return;
    this._tone({ freq: 1320, dur: 0.05, attack: 0.001, release: 0.04, t: this.ctx.currentTime, volume: 0.2, type: 'triangle' });
  }

  // Bluff submitted — soft confirm.
  bluffConfirm() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    this._tone({ freq: 660, dur: 0.08, attack: 0.002, release: 0.07, t: t0,        volume: 0.18, type: 'sine' });
    this._tone({ freq: 880, dur: 0.10, attack: 0.002, release: 0.09, t: t0 + 0.05, volume: 0.18, type: 'sine' });
  }

  // Host UI click — short percussive.
  click() {
    if (!this.ctx) return;
    this._tone({ freq: 800, dur: 0.04, attack: 0.001, release: 0.035, t: this.ctx.currentTime, volume: 0.15, type: 'square' });
  }

  // Score bump — bright two-note rise.
  scoreBump() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    this._tone({ freq: 880,  dur: 0.10, attack: 0.002, release: 0.08, t: t0,        volume: 0.35, type: 'triangle' });
    this._tone({ freq: 1320, dur: 0.12, attack: 0.002, release: 0.10, t: t0 + 0.06, volume: 0.35, type: 'triangle' });
  }

  // Drumroll — used before podium / MVP reveals.
  drumroll(durationMs = 1200) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const totalDur = durationMs / 1000;
    const hits = Math.max(8, Math.floor(durationMs / 70));
    for (let i = 0; i < hits; i++) {
      const t = t0 + (i / hits) * totalDur;
      const v = 0.08 + (i / hits) * 0.18; // crescendo
      this._tone({ freq: 80 + Math.random() * 30, dur: 0.05, attack: 0.001, release: 0.04, t, volume: v, type: 'square' });
    }
  }

  // Podium fanfare — celebratory three-note triumphant chord.
  fanfare() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [
      [523, 0],     [659, 0],     [784, 0],     // C major chord
      [659, 0.15],  [784, 0.15],  [988, 0.15],  // E minor-ish lift
      [784, 0.32],  [988, 0.32],  [1175, 0.32], // climax
    ].forEach(([f, off]) => {
      this._tone({ freq: f, dur: 0.55 - off * 0.5, attack: 0.005, release: 0.45, t: t0 + off, volume: 0.32, type: 'triangle' });
    });
  }

  _tone({ freq, dur, attack, release, t, volume, type = 'sine' }) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(this.sfxGain);

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + attack);
    g.gain.setValueAtTime(volume, t + dur - release);
    g.gain.linearRampToValueAtTime(0, t + dur);

    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function clamp01(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); }
  catch { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

export const audioManager = new AudioManager();
