/**
 * Procedural audio for Swiposaur.
 *
 * Everything is synthesized with the Web Audio API: there are no recorded
 * samples, no downloaded tracks and no synthetic voice lines. The background
 * music is a small 16-step sequencer (bass, arpeggio, kick, snare, hats) whose
 * tempo and layers rise with the chaos multiplier.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isMuted: boolean = false;
  private sfxVolume: number = 0.8;
  private musicVolume: number = 0.55;

  private beatTimer: number | null = null;
  private nextNoteTime: number = 0;
  private beatStep: number = 0;
  private chaosMult: number = 1;

  constructor() {
    try {
      const saved = localStorage.getItem('slap_run_muted');
      if (saved !== null) {
        this.isMuted = JSON.parse(saved);
      }
      const savedSfx = localStorage.getItem('slap_run_sfx_volume');
      if (savedSfx !== null) {
        const value = Number(savedSfx);
        if (Number.isFinite(value)) this.sfxVolume = Math.max(0, Math.min(1, value));
      }
      const savedMusic = localStorage.getItem('slap_run_music_volume');
      if (savedMusic !== null) {
        const value = Number(savedMusic);
        if (Number.isFinite(value)) this.musicVolume = Math.max(0, Math.min(1, value));
      }
    } catch {}
  }

  private initCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.42;
      this.musicGain.connect(this.masterGain);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private resume(ctx: AudioContext): void {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /** Schedules one oscillator note on the SFX bus. */
  private toneAt(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainVal: number,
    when: number,
    bus: AudioNode | null = null
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freqStart), when);
      if (Math.abs(freqEnd - freqStart) > 0.5) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(12, freqEnd), when + duration);
      }

      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainVal), when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

      osc.connect(gain);
      gain.connect(bus ?? this.masterGain);
      osc.start(when);
      osc.stop(when + duration + 0.02);
    } catch {}
  }

  private noiseAt(
    duration: number,
    gainVal: number,
    filterType: BiquadFilterType,
    frequency: number,
    when: number,
    bus: AudioNode | null = null
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;
    try {
      if (!this.noiseBuffer) {
        const length = Math.floor(ctx.sampleRate * 1);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
      }

      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(frequency, when);
      filter.Q.value = filterType === 'bandpass' ? 1.2 : 0.7;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainVal), when + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(bus ?? this.masterGain);
      source.start(when);
      source.stop(when + duration + 0.02);
    } catch {}
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal: number = 0.3
  ): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume(ctx);
    this.toneAt(freqStart, freqEnd, duration, type, gainVal * this.sfxVolume, ctx.currentTime);
  }

  private playNoise(
    duration: number,
    gainVal: number,
    filterType: BiquadFilterType = 'lowpass',
    frequency: number = 1200
  ): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume(ctx);
    this.noiseAt(duration, gainVal * this.sfxVolume, filterType, frequency, ctx.currentTime);
  }

  private notes(
    notes: Array<{ freq: number; delay: number; duration?: number; gain?: number; type?: OscillatorType }>,
    baseGain: number = 0.3
  ): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    for (const note of notes) {
      this.toneAt(
        note.freq,
        note.freq,
        note.duration ?? 0.16,
        note.type ?? 'triangle',
        (note.gain ?? baseGain) * this.sfxVolume,
        now + note.delay
      );
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('slap_run_muted', JSON.stringify(muted));
    } catch {}
    if (muted) {
      this.stopArcadeBeat();
    }
  }

  public toggleMute(): boolean {
    const next = !this.isMuted;
    this.setMuted(next);
    return next;
  }

  public setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem('slap_run_sfx_volume', String(this.sfxVolume));
    } catch {}
  }

  public setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.42, this.ctx.currentTime, 0.05);
    }
    try {
      localStorage.setItem('slap_run_music_volume', String(this.musicVolume));
    } catch {}
  }

  // ---------------------------------------------------------------- UI & core

  public playClick(): void {
    this.playTone(620, 430, 0.05, 'triangle', 0.14);
  }

  public playStart(): void {
    this.notes(
      [
        { freq: 330, delay: 0, duration: 0.14, type: 'triangle' },
        { freq: 494, delay: 0.09, duration: 0.16, type: 'triangle' },
        { freq: 660, delay: 0.18, duration: 0.24, type: 'sine' },
        { freq: 990, delay: 0.26, duration: 0.28, type: 'sine', gain: 0.22 },
      ],
      0.3
    );
  }

  public playSlap(combo: number = 1): void {
    const baseFreq = Math.min(820, 280 + combo * 28);
    this.playNoise(0.1, 0.34, 'bandpass', 1800);
    this.playTone(baseFreq, 95, 0.15, 'sawtooth', 0.34);
    this.playTone(170, 60, 0.11, 'square', 0.22);
  }

  public playMegaSlap(): void {
    this.playNoise(0.28, 0.5, 'lowpass', 900);
    this.playTone(190, 42, 0.42, 'sawtooth', 0.52);
    this.playTone(920, 130, 0.3, 'square', 0.3);
    this.playTone(140, 30, 0.4, 'sine', 0.42);
  }

  /** The opening strike: a leather-crack whip, no palm slap. */
  public playWhipCrack(): void {
    this.playNoise(0.075, 0.62, 'highpass', 1400);
    this.playTone(1500, 190, 0.11, 'sawtooth', 0.4);
    this.playTone(110, 42, 0.24, 'sine', 0.45);
    window.setTimeout(() => this.playNoise(0.06, 0.32, 'bandpass', 2400), 45);
  }

  public playWhoosh(): void {
    this.playNoise(0.12, 0.16, 'bandpass', 900);
    this.playTone(460, 150, 0.13, 'sine', 0.14);
  }

  public playJump(): void {
    this.playTone(250, 540, 0.17, 'sine', 0.22);
    this.playNoise(0.06, 0.08, 'highpass', 1800);
  }

  public playCoin(): void {
    this.playTone(988, 1319, 0.09, 'sine', 0.2);
    window.setTimeout(() => this.playTone(1319, 1568, 0.08, 'sine', 0.14), 45);
  }

  public playCoinShower(count: number = 6): void {
    if (this.isMuted) return;
    for (let i = 0; i < count; i++) {
      window.setTimeout(() => this.playTone(900 + i * 120, 1400 + i * 90, 0.09, 'sine', 0.16), i * 70);
    }
  }

  public playPowerup(): void {
    this.notes(
      [
        { freq: 440, delay: 0, duration: 0.12 },
        { freq: 660, delay: 0.09, duration: 0.14 },
        { freq: 880, delay: 0.18, duration: 0.2 },
      ],
      0.28
    );
  }

  public playStaminaRefill(): void {
    this.playTone(320, 660, 0.14, 'sine', 0.22);
  }

  public playWhack(): void {
    this.playNoise(0.14, 0.24, 'lowpass', 700);
    this.playTone(150, 44, 0.2, 'triangle', 0.38);
  }

  public playNearMiss(): void {
    this.playTone(560, 780, 0.09, 'sine', 0.18);
  }

  public playPoliceWhistle(): void {
    this.playTone(1220, 1120, 0.16, 'square', 0.22);
    window.setTimeout(() => this.playTone(1270, 1170, 0.16, 'square', 0.22), 110);
  }

  public playEscaped(): void {
    this.notes(
      [
        { freq: 523, delay: 0, duration: 0.16 },
        { freq: 659, delay: 0.1, duration: 0.18 },
        { freq: 784, delay: 0.2, duration: 0.24 },
      ],
      0.28
    );
  }

  public playBusted(): void {
    this.playNoise(0.3, 0.3, 'lowpass', 500);
    this.playTone(330, 110, 0.4, 'sawtooth', 0.42);
    window.setTimeout(() => this.playTone(220, 70, 0.45, 'square', 0.38), 130);
  }

  public playFeverStart(): void {
    this.playTone(420, 840, 0.14, 'triangle', 0.3);
    window.setTimeout(() => this.playTone(640, 1280, 0.22, 'sawtooth', 0.32), 100);
    window.setTimeout(() => this.playTone(900, 1600, 0.2, 'square', 0.2), 180);
  }

  public playChaosAlarm(): void {
    this.playTone(900, 430, 0.18, 'sawtooth', 0.26);
  }

  public playAchievement(): void {
    this.notes(
      [523.25, 659.25, 783.99, 1046.5].map((freq, index) => ({
        freq,
        delay: index * 0.075,
        duration: 0.18,
      })),
      0.28
    );
  }

  public playLevelUp(): void {
    this.playAchievement();
  }

  public playStageClear(): void {
    this.notes(
      [440, 554, 659, 880, 1108].map((freq, index) => ({
        freq,
        delay: index * 0.085,
        duration: 0.2,
      })),
      0.3
    );
  }

  public playIntroWindup(): void {
    this.playTone(120, 380, 0.85, 'sawtooth', 0.26);
    this.playNoise(0.7, 0.1, 'bandpass', 400);
  }

  // ------------------------------------------------------------- flame & eggs

  public playFirePickup(): void {
    this.playNoise(0.34, 0.32, 'lowpass', 1400);
    this.notes(
      [
        { freq: 392, delay: 0, duration: 0.12, type: 'sawtooth' },
        { freq: 523, delay: 0.06, duration: 0.14, type: 'triangle' },
        { freq: 659, delay: 0.13, duration: 0.16, type: 'triangle' },
        { freq: 784, delay: 0.2, duration: 0.22, type: 'sine' },
      ],
      0.3
    );
  }

  public playFireBlast(): void {
    this.playNoise(0.24, 0.4, 'lowpass', 900);
    this.playNoise(0.1, 0.18, 'highpass', 2200);
    this.playTone(260, 55, 0.2, 'sawtooth', 0.32);
  }

  public playEggCrack(): void {
    this.playNoise(0.06, 0.4, 'bandpass', 1800);
    window.setTimeout(() => this.playNoise(0.05, 0.34, 'bandpass', 2300), 90);
    window.setTimeout(() => this.playNoise(0.05, 0.3, 'bandpass', 1500), 170);
    this.playTone(160, 70, 0.18, 'triangle', 0.22);
  }

  public playEggHatch(): void {
    this.notes(
      [
        { freq: 523, delay: 0, duration: 0.16 },
        { freq: 659, delay: 0.08, duration: 0.16 },
        { freq: 784, delay: 0.16, duration: 0.18 },
        { freq: 1046, delay: 0.26, duration: 0.34, gain: 0.3 },
      ],
      0.28
    );
  }

  public playTutorialCue(): void {
    this.notes(
      [
        { freq: 660, delay: 0, duration: 0.12 },
        { freq: 880, delay: 0.1, duration: 0.16 },
      ],
      0.2
    );
  }

  public playTutorialWrong(): void {
    this.playTone(220, 170, 0.12, 'square', 0.14);
  }

  // -------------------------------------------------------------- background

  private tempo(): number {
    return 132 + Math.min(36, Math.max(0, this.chaosMult - 1) * 4);
  }

  private scheduleStep(step: number, when: number): void {
    if (!this.musicGain) return;
    const bus = this.musicGain;
    const intense = this.chaosMult >= 4;
    const fever = this.chaosMult >= 8;

    // Four-on-the-floor kick.
    if (step % 8 === 0) {
      this.toneAt(120, 44, 0.14, 'sine', 0.5, when, bus);
      this.noiseAt(0.05, 0.16, 'lowpass', 180, when, bus);
    }
    // Snare backbeat with a little noise snap.
    if (step % 8 === 4) {
      this.noiseAt(0.12, intense ? 0.24 : 0.18, 'bandpass', 1900, when, bus);
      this.toneAt(190, 120, 0.08, 'triangle', 0.16, when, bus);
    }
    // Hats on the offbeat, busier when the run heats up.
    if (step % 2 === 1) {
      this.noiseAt(0.028, intense ? 0.1 : 0.06, 'highpass', 7000, when, bus);
    }
    if (fever && step % 4 === 3) {
      this.noiseAt(0.04, 0.08, 'highpass', 9000, when, bus);
    }

    // Bass line in A minor, one note per half bar.
    const bassNotes = [55, 55, 65.41, 55, 43.65, 43.65, 49, 49];
    if (step % 8 === 0) {
      const note = bassNotes[Math.floor(step / 4) % bassNotes.length];
      this.toneAt(note, note, 0.42, 'triangle', 0.22, when, bus);
      this.toneAt(note * 2, note * 2, 0.3, 'sine', 0.08, when, bus);
    }

    // Arpeggio: A minor pentatonic plucks, sparse at low chaos.
    const arp = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
    if (step % 2 === 0 && (intense || step % 8 < 4)) {
      const note = arp[(step / 2) % arp.length];
      this.toneAt(note, note, 0.11, 'square', 0.045, when, bus);
    }

    // A brighter answer phrase once per bar when fever is running.
    if (fever && step % 16 === 12) {
      this.toneAt(659.25, 880, 0.18, 'triangle', 0.08, when, bus);
    }
  }

  private scheduler = (): void => {
    const ctx = this.ctx;
    if (!ctx || this.isMuted) return;
    while (this.nextNoteTime < ctx.currentTime + 0.16) {
      this.scheduleStep(this.beatStep, this.nextNoteTime);
      const secondsPerStep = 60 / this.tempo() / 4;
      this.nextNoteTime += secondsPerStep;
      this.beatStep = (this.beatStep + 1) % 32;
    }
  };

  public startArcadeBeat(): void {
    if (this.beatTimer !== null) return;
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume(ctx);
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.42, ctx.currentTime, 0.1);
    }
    this.beatStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.08;
    this.beatTimer = window.setInterval(this.scheduler, 25);
  }

  public stopArcadeBeat(): void {
    if (this.beatTimer !== null) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
  }

  public updateBeatChaos(mult: number): void {
    this.chaosMult = mult;
  }
}

export const sounds = new SoundEngine();
