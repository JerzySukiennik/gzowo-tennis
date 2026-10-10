// Gzowo Tennis audio: CC0 hits, bounces and crowd clips plus a soft procedural crowd murmur.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.last = {};
  }

  async init() {
    if (this.ctx) return this.ctx.resume();
    this.ctx = new AudioContext();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(comp).connect(this.ctx.destination);
    this.murmur();
    const manifest = await fetch('sounds/manifest.json').then(r => r.json());
    await Promise.all(Object.entries(manifest).map(async ([cat, files]) => {
      this.buffers[cat] = (await Promise.all(files.map(async f => {
        try { return await this.ctx.decodeAudioData(await fetch(`sounds/${f}`).then(r => r.arrayBuffer())); } catch { return null; }
      }))).filter(Boolean);
    }));
  }

  murmur() {
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = b * 3; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.7;
    this.murmurGain = this.ctx.createGain();
    this.murmurGain.gain.value = 0.0;
    src.connect(bp).connect(this.murmurGain).connect(this.out);
    src.start();
  }

  setCrowd(level) {
    if (this.murmurGain) this.murmurGain.gain.setTargetAtTime(level * 0.35, this.ctx.currentTime, 0.4);
  }

  play(cat, vol = 1, rate = 1, pan = 0) {
    const list = this.buffers[cat];
    if (!this.ctx || !list || !list.length) return;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[cat]) i = (i + 1) % list.length;
    this.last[cat] = i;
    const src = this.ctx.createBufferSource();
    src.buffer = list[i];
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.out);
    src.start();
  }
}
