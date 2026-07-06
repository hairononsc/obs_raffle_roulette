import type { WidgetTheme, SoundSpec } from '../theme/theme.js';
import type { AudioEngine, SoundKey } from './audio-engine.js';

/**
 * WebAudio implementation. Synth presets ship with the widget (no binary
 * assets needed); a theme can override any key with `{type:"file", src}`
 * and the file is fetched, decoded and played instead.
 */
export class SynthAudio implements AudioEngine {
  private context: AudioContext | null = null;
  private sounds: Record<string, SoundSpec> = {};
  private buffers = new Map<string, AudioBuffer>();

  applyTheme(theme: WidgetTheme): void {
    this.sounds = theme.sounds;
    this.buffers.clear();
    for (const spec of Object.values(theme.sounds)) {
      if (spec.type === 'file') {
        void this.preload(spec.src);
      }
    }
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx?.state === 'suspended') {
      void ctx.resume();
    }
  }

  play(key: SoundKey): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const spec = this.sounds[key] ?? { type: 'synth' as const, preset: key };
    if (spec.type === 'file') {
      this.playFile(ctx, spec.src);
      return;
    }
    this.playPreset(ctx, spec.preset);
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }
    if (typeof AudioContext === 'undefined') {
      return null;
    }
    this.context = new AudioContext();
    return this.context;
  }

  private async preload(src: string): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || this.buffers.has(src)) {
      return;
    }
    try {
      const response = await fetch(src);
      const data = await response.arrayBuffer();
      this.buffers.set(src, await ctx.decodeAudioData(data));
    } catch (error) {
      console.warn(`[audio] failed to preload "${src}"`, error);
    }
  }

  private playFile(ctx: AudioContext, src: string): void {
    const buffer = this.buffers.get(src);
    if (!buffer) {
      void this.preload(src);
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }

  private playPreset(ctx: AudioContext, preset: string): void {
    switch (preset) {
      case 'tick':
        this.blip(ctx, 1600, 0.03, 0.25, 'square');
        break;
      case 'whoosh':
        this.sweep(ctx, 200, 900, 0.5, 0.2);
        break;
      case 'fanfare':
        this.arpeggio(ctx, [523.25, 659.25, 783.99, 1046.5], 0.14, 0.3);
        break;
      case 'sparkle':
        this.arpeggio(ctx, [1567.98, 1975.53, 2349.32], 0.06, 0.12);
        break;
      default:
        this.blip(ctx, 440, 0.1, 0.2, 'sine');
    }
  }

  private blip(
    ctx: AudioContext,
    frequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
  ): void {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private sweep(
    ctx: AudioContext,
    from: number,
    to: number,
    duration: number,
    gainValue: number,
  ): void {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private arpeggio(
    ctx: AudioContext,
    frequencies: number[],
    noteDuration: number,
    gainValue: number,
  ): void {
    frequencies.forEach((frequency, index) => {
      const start = ctx.currentTime + index * noteDuration;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration * 2);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + noteDuration * 2);
    });
  }
}
