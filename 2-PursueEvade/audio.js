// ============================================
// Audio procédural
// ============================================
class SoundFX {
  constructor() {
    this.muted = false;
  }

  tone(freq, dur, type = 'sine', vol = 0.3) {
    if (this.muted) return;
    let o = new p5.Oscillator(type);
    o.freq(freq);
    o.amp(vol, 0.01);
    o.start();
    setTimeout(() => { o.amp(0, 0.05); setTimeout(() => o.stop(), 100); }, dur * 1000);
  }

  noise(dur, vol = 0.3) {
    if (this.muted) return;
    let n = new p5.Noise('white');
    let e = new p5.Envelope();
    e.setADSR(0.001, 0.1, 0, 0.1);
    e.setRange(vol, 0);
    n.amp(e);
    n.start();
    e.play();
    setTimeout(() => n.stop(), dur * 1000);
  }

  capture() {
    this.tone(600, 0.08, 'sine', 0.3);
    setTimeout(() => this.tone(900, 0.1, 'sine', 0.3), 80);
    setTimeout(() => this.tone(1200, 0.15, 'sine', 0.3), 160);
  }

  alert() {
    this.tone(400, 0.1, 'square', 0.2);
    setTimeout(() => this.tone(600, 0.1, 'square', 0.2), 100);
  }

  powerUp() {
    this.tone(500, 0.1, 'sine', 0.3);
    setTimeout(() => this.tone(700, 0.1, 'sine', 0.3), 100);
    setTimeout(() => this.tone(1000, 0.2, 'sine', 0.3), 200);
  }

  combo() {
    this.tone(800, 0.06, 'square', 0.25);
    setTimeout(() => this.tone(1200, 0.08, 'square', 0.25), 60);
  }

  gameOver() {
    this.tone(400, 0.2, 'sine', 0.3);
    setTimeout(() => this.tone(300, 0.2, 'sine', 0.3), 200);
    setTimeout(() => this.tone(200, 0.4, 'sine', 0.3), 400);
    setTimeout(() => this.tone(100, 0.8, 'sine', 0.3), 800);
  }

  achievement() {
    this.tone(523, 0.1, 'sine', 0.3);
    setTimeout(() => this.tone(659, 0.1, 'sine', 0.3), 100);
    setTimeout(() => this.tone(784, 0.1, 'sine', 0.3), 200);
    setTimeout(() => this.tone(1047, 0.3, 'sine', 0.3), 300);
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }
}

class MusicPlayer {
  constructor() {
    this.currentTrack = null;
    this.osc1 = null;
    this.osc2 = null;
    this.muted = false;
    this.volume = 0.08;
    this.noteIndex = 0;
    this.noteTimer = 0;
    this.melody = null;
  }

  getMelody(name) {
    switch (name) {
      case 'menu':
        return { notes: [261, 329, 392, 329, 261, 293, 349, 293], tempo: 50, wave: 'sine' };
      case 'game':
        return { notes: [392, 523, 659, 523, 440, 587, 698, 587], tempo: 25, wave: 'triangle' };
      default:
        return { notes: [440], tempo: 60, wave: 'sine' };
    }
  }

  play(name) {
    if (this.currentTrack === name) return;
    this.stop();
    this.currentTrack = name;
    this.melody = this.getMelody(name);
    this.noteIndex = 0;
    this.noteTimer = 0;

    this.osc1 = new p5.Oscillator(this.melody.wave);
    this.osc1.amp(0);
    this.osc1.start();
    this.osc1.amp(this.muted ? 0 : this.volume, 0.5);

    this.osc2 = new p5.Oscillator('sine');
    this.osc2.amp(0);
    this.osc2.start();
    this.osc2.amp(this.muted ? 0 : this.volume * 0.4, 0.5);
  }

  update() {
    if (!this.melody || !this.osc1) return;
    this.noteTimer++;
    if (this.noteTimer >= this.melody.tempo) {
      this.noteTimer = 0;
      let f = this.melody.notes[this.noteIndex];
      this.osc1.freq(f);
      if (this.osc2) this.osc2.freq(f * 2);
      this.noteIndex = (this.noteIndex + 1) % this.melody.notes.length;
    }
  }

  stop() {
    if (this.osc1) { this.osc1.amp(0, 0.3); let o = this.osc1; setTimeout(() => o.stop(), 400); this.osc1 = null; }
    if (this.osc2) { this.osc2.amp(0, 0.3); let o = this.osc2; setTimeout(() => o.stop(), 400); this.osc2 = null; }
    this.currentTrack = null;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.osc1) this.osc1.amp(this.muted ? 0 : this.volume, 0.2);
    if (this.osc2) this.osc2.amp(this.muted ? 0 : this.volume * 0.4, 0.2);
    return this.muted;
  }
}

let soundFX;
let musicPlayer;