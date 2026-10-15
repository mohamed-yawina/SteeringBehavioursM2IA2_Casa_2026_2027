// ============================================
// Système audio - génération de sons par code
// Utilise P5.sound (oscillateurs, enveloppes)
// ============================================

// Un synthétiseur simple pour générer des sons
class SoundFX {
  constructor() {
    this.muted = false;
    this.masterVolume = 0.5;
  }

  // Joue un son court (bip, tir, etc.)
  playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (this.muted) return;

    let osc = new p5.Oscillator(type);
    osc.freq(freq);
    osc.amp(volume * this.masterVolume, 0.01);
    osc.start();

    setTimeout(() => {
      osc.amp(0, 0.05);
      setTimeout(() => osc.stop(), 100);
    }, duration * 1000);
  }

  // Joue un son "bruit blanc" (explosion)
  playNoise(duration, volume = 0.3) {
    if (this.muted) return;

    let noise = new p5.Noise('white');
    let env = new p5.Envelope();
    env.setADSR(0.001, 0.1, 0, 0.1);
    env.setRange(volume * this.masterVolume, 0);
    noise.amp(env);
    noise.start();
    env.play();

    setTimeout(() => noise.stop(), duration * 1000);
  }

  // ============================================
  // Effets sonores spécifiques
  // ============================================

  shoot() {
    this.playTone(800, 0.05, 'square', 0.15);
  }

  explosion() {
    this.playNoise(0.3, 0.4);
  }

  bigExplosion() {
    this.playNoise(0.6, 0.6);
    this.playTone(80, 0.4, 'sawtooth', 0.3);
  }

  hurt() {
    this.playTone(200, 0.15, 'sawtooth', 0.3);
  }

  powerUp() {
    this.playTone(500, 0.1, 'sine', 0.3);
    setTimeout(() => this.playTone(700, 0.1, 'sine', 0.3), 100);
    setTimeout(() => this.playTone(900, 0.15, 'sine', 0.3), 200);
  }

  levelUp() {
    this.playTone(523, 0.12, 'sine', 0.3);
    setTimeout(() => this.playTone(659, 0.12, 'sine', 0.3), 120);
    setTimeout(() => this.playTone(784, 0.12, 'sine', 0.3), 240);
    setTimeout(() => this.playTone(1047, 0.3, 'sine', 0.3), 360);
  }

  waveStart() {
    this.playTone(440, 0.15, 'triangle', 0.25);
    setTimeout(() => this.playTone(660, 0.2, 'triangle', 0.25), 150);
  }

  bossAppear() {
    this.playTone(100, 0.5, 'sawtooth', 0.4);
    setTimeout(() => this.playTone(80, 0.6, 'sawtooth', 0.4), 500);
    setTimeout(() => this.playTone(60, 0.8, 'sawtooth', 0.4), 1000);
  }

  gameOver() {
    this.playTone(400, 0.2, 'sine', 0.3);
    setTimeout(() => this.playTone(300, 0.2, 'sine', 0.3), 200);
    setTimeout(() => this.playTone(200, 0.4, 'sine', 0.3), 400);
    setTimeout(() => this.playTone(100, 0.8, 'sine', 0.3), 800);
  }

  comboUp() {
    this.playTone(600, 0.08, 'square', 0.2);
    setTimeout(() => this.playTone(900, 0.1, 'square', 0.2), 80);
  }

  // ============================================
  // Contrôle du son
  // ============================================

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

// ============================================
// Musique de fond - génération continue
// ============================================
class MusicPlayer {
  constructor() {
    this.currentTrack = null;
    this.currentOsc = null;
    this.currentOsc2 = null;
    this.muted = false;
    this.volume = 0.15;
    this.noteIndex = 0;
    this.noteTimer = 0;
    this.melody = null;
  }

  // Mélodies (fréquences en Hz)
  getMelody(trackName) {
    switch (trackName) {
      case 'menu':
        return {
          notes: [261.63, 329.63, 392.00, 329.63, 261.63, 293.66, 349.23, 293.66],
          tempo: 60,
          waveType: 'sine'
        };
      case 'game':
        return {
          notes: [392.00, 523.25, 659.25, 523.25, 440.00, 587.33, 698.46, 587.33],
          tempo: 30,
          waveType: 'triangle'
        };
      case 'boss':
        return {
          notes: [110.00, 116.54, 123.47, 130.81, 123.47, 116.54, 110.00, 103.83],
          tempo: 20,
          waveType: 'sawtooth'
        };
      default:
        return { notes: [440], tempo: 60, waveType: 'sine' };
    }
  }

  playTrack(trackName) {
    if (this.currentTrack === trackName) return;

    this.stop();
    this.currentTrack = trackName;
    this.melody = this.getMelody(trackName);
    this.noteIndex = 0;
    this.noteTimer = 0;

    // Crée un oscillateur continu
    this.currentOsc = new p5.Oscillator(this.melody.waveType);
    this.currentOsc.amp(0);
    this.currentOsc.start();
    this.currentOsc.amp(this.muted ? 0 : this.volume, 0.5);

    // Oscillateur secondaire (harmonique)
    this.currentOsc2 = new p5.Oscillator('sine');
    this.currentOsc2.amp(0);
    this.currentOsc2.start();
    this.currentOsc2.amp(this.muted ? 0 : this.volume * 0.5, 0.5);
  }

  update() {
    if (!this.currentTrack || !this.melody || !this.currentOsc) return;

    this.noteTimer++;
    if (this.noteTimer >= this.melody.tempo) {
      this.noteTimer = 0;

      let freq = this.melody.notes[this.noteIndex];
      this.currentOsc.freq(freq);

      if (this.currentOsc2) {
        this.currentOsc2.freq(freq * 2);
      }

      this.noteIndex = (this.noteIndex + 1) % this.melody.notes.length;
    }
  }

  stop() {
    if (this.currentOsc) {
      this.currentOsc.amp(0, 0.3);
      let osc = this.currentOsc;
      setTimeout(() => osc.stop(), 400);
      this.currentOsc = null;
    }
    if (this.currentOsc2) {
      this.currentOsc2.amp(0, 0.3);
      let osc2 = this.currentOsc2;
      setTimeout(() => osc2.stop(), 400);
      this.currentOsc2 = null;
    }
    this.currentTrack = null;
  }

  setVolume(v) {
    this.volume = v;
    if (this.currentOsc && !this.muted) {
      this.currentOsc.amp(v, 0.2);
      if (this.currentOsc2) this.currentOsc2.amp(v * 0.5, 0.2);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.currentOsc) {
      this.currentOsc.amp(this.muted ? 0 : this.volume, 0.2);
      if (this.currentOsc2) {
        this.currentOsc2.amp(this.muted ? 0 : this.volume * 0.5, 0.2);
      }
    }
    return this.muted;
  }
}

// Instances globales
let soundFX;
let musicPlayer;