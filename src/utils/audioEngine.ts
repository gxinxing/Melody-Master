class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: OscillatorNode[] = [];
  private volume: number = 0.5;

  private readonly ATTACK = 0.02;
  private readonly DECAY = 0.1;
  private readonly SUSTAIN = 0.7;
  private readonly RELEASE = 0.3;

  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private ensureContext(): { ctx: AudioContext; masterGain: GainNode } {
    if (!this.ctx || !this.masterGain) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    return { ctx: this.ctx, masterGain: this.masterGain };
  }

  private applyADSR(gainNode: GainNode, startTime: number, duration: number): void {
    const gain = gainNode.gain;
    const sustainLevel = this.SUSTAIN;

    gain.setValueAtTime(0, startTime);
    gain.linearRampToValueAtTime(1, startTime + this.ATTACK);
    gain.linearRampToValueAtTime(sustainLevel, startTime + this.ATTACK + this.DECAY);
    gain.setValueAtTime(sustainLevel, startTime + duration - this.RELEASE);
    gain.linearRampToValueAtTime(0, startTime + duration);
  }

  playNote(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    const { ctx, masterGain } = this.ensureContext();
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    this.applyADSR(gainNode, now, duration);

    oscillator.start(now);
    oscillator.stop(now + duration);

    this.activeNodes.push(oscillator);
    oscillator.onended = () => {
      const idx = this.activeNodes.indexOf(oscillator);
      if (idx > -1) this.activeNodes.splice(idx, 1);
    };
  }

  playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine'): void {
    for (const freq of frequencies) {
      this.playNote(freq, duration, type);
    }
  }

  playInterval(rootFreq: number, semitones: number, duration: number): void {
    const secondFreq = rootFreq * Math.pow(2, semitones / 12);
    const noteDuration = duration / 2;
    const { ctx } = this.ensureContext();

    this.playNote(rootFreq, noteDuration);

    const secondOsc = ctx.createOscillator();
    const secondGain = ctx.createGain();
    const startTime = ctx.currentTime + noteDuration;

    secondOsc.type = 'sine';
    secondOsc.frequency.setValueAtTime(secondFreq, startTime);

    secondOsc.connect(secondGain);
    secondGain.connect(this.masterGain!);

    this.applyADSR(secondGain, startTime, noteDuration);

    secondOsc.start(startTime);
    secondOsc.stop(startTime + noteDuration);

    this.activeNodes.push(secondOsc);
    secondOsc.onended = () => {
      const idx = this.activeNodes.indexOf(secondOsc);
      if (idx > -1) this.activeNodes.splice(idx, 1);
    };
  }

  playScale(rootFreq: number, intervals: number[], duration: number): void {
    const noteDuration = duration / (intervals.length + 1);
    const { ctx, masterGain } = this.ensureContext();
    let currentSemitones = 0;

    this.playNote(rootFreq, noteDuration);

    for (let i = 0; i < intervals.length; i++) {
      currentSemitones += intervals[i];
      const freq = rootFreq * Math.pow(2, currentSemitones / 12);
      const startTime = ctx.currentTime + noteDuration * (i + 1);

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);

      oscillator.connect(gainNode);
      gainNode.connect(masterGain);

      this.applyADSR(gainNode, startTime, noteDuration);

      oscillator.start(startTime);
      oscillator.stop(startTime + noteDuration);

      this.activeNodes.push(oscillator);
      oscillator.onended = () => {
        const idx = this.activeNodes.indexOf(oscillator);
        if (idx > -1) this.activeNodes.splice(idx, 1);
      };
    }
  }

  stopAll(): void {
    for (const node of this.activeNodes) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
    this.activeNodes = [];
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.masterGain.context.currentTime);
    }
  }
}

export const audioEngine = new AudioEngine();
