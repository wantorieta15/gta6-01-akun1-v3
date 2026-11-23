// Procedural sound: engine hum, sirens, gunshots and radio jingles, all
// synthesized with WebAudio — no audio files, no network.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Engine: low sawtooth through a low-pass filter.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
      // Siren: two-tone triangle, quiet until the heat rises.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
      this.sirenPhase = 0;
    } catch { this.ctx = null; }
  }

  setEngine(speed01, driving) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.05 : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 110, t, 0.1);
  }

  setSiren(wanted, dt) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (wanted > 0) {
      this.sirenPhase += dt * 2.2;
      const f = this.sirenPhase % 2 < 1 ? 720 : 540;
      this.sirenOsc.frequency.setTargetAtTime(f, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.015 + wanted * 0.006, t, 0.2);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.3);
    }
  }

  blip(freq = 880, dur = 0.12, vol = 0.08) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  gunshot() {
    if (!this.ctx || this.muted) return;
    const dur = 0.14;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.22;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }

  crash() { this.blip(120, 0.25, 0.15); }
  pickup() { this.blip(1320, 0.1, 0.07); setTimeout(() => this.blip(1760, 0.14, 0.07), 90); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 0.09), i * 110));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(0, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(0, t, 0.05);
    }
    return this.muted;
  }
}
