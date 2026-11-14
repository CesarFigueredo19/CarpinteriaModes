class ShowroomSoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  public muted = false;
  public musicEnabled = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.stopAmbientMusic();
    } else if (this.musicEnabled) {
      this.startAmbientMusic();
    }
  }

  public toggleAmbientMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled && !this.muted) {
      this.startAmbientMusic();
    } else {
      this.stopAmbientMusic();
    }
    return this.musicEnabled;
  }

  public startAmbientMusic() {
    if (this.muted || typeof window === 'undefined') return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.musicTimer !== null) return;

    this.musicEnabled = true;

    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.08, ctx.currentTime);
      this.musicGain.connect(ctx.destination);
    } else {
      this.musicGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.25);
    }

    // Warm showroom lounge chord progression: Fmaj7 -> Dm9 -> Bbmaj7 -> C6
    const chords = [
      [174.61, 220.0, 261.63, 329.63],
      [146.83, 220.0, 261.63, 329.63],
      [116.54, 174.61, 220.0, 293.66],
      [130.81, 196.0, 220.0, 293.66],
    ];

    const playBar = () => {
      if (this.muted || !this.musicEnabled || !this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      const chord = chords[this.musicStep % chords.length];

      // Soft warm pad voices
      chord.forEach((freq) => {
        if (!this.ctx || !this.musicGain) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const env = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(680, now);

        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.14, now + 0.6);
        env.gain.exponentialRampToValueAtTime(0.0008, now + 3.4);

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + 3.5);
      });

      // Gentle wooden marimba-like melodic accent
      const melodyNotes = [chord[2] * 2, chord[3] * 2, chord[1] * 2];
      melodyNotes.forEach((mFreq, idx) => {
        if (!this.ctx || !this.musicGain) return;
        const t = now + 0.55 + idx * 0.95;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(mFreq, t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.08, t + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0008, t + 0.75);

        osc.connect(env);
        env.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.8);
      });

      this.musicStep += 1;
    };

    playBar();
    this.musicTimer = window.setInterval(playBar, 3500);
  }

  public stopAmbientMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    }
  }

  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Soft oak floorboard heel tap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92 + Math.random() * 14, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.065);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playWoodTap() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playRotateTick() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playDrawerGlide(opening: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(opening ? 140 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(opening ? 240 : 125, now + 0.16);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.045, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.24);
    });
  }
}

export const soundEngine = new ShowroomSoundEngine();
