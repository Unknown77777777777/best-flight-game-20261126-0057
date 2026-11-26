// SORTIE — audio.js: all sound is synthesised WebAudio, no audio files.
// One global: AudioSys. Engine hum follows throttle; beeps warn; chimes mark events.
var AudioSys = (function () {
  var ctx = null, engineOsc = null, engineGain = null, engineFilter = null;
  var lastBeep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch (e) { return false; }
  }
  function resume() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  function tone(freq, dur, type, vol, when) {
    if (!ensure()) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.12, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function update(dt) {
    if (!ctx || !Aircraft.state) return;
    var a = Aircraft.state;
    var target = (G.phase === 'flying') ? 0.02 + a.throttle * 0.06 + (a.boost ? 0.03 : 0) : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(50 + a.throttle * 90 + a.speed * 0.35, ctx.currentTime, 0.1);
    engineFilter.frequency.setTargetAtTime(350 + a.throttle * 900, ctx.currentTime, 0.1);
    // Warning beeps: fuel low, stall, heavy damage.
    var now = G.time;
    if (now - lastBeep > 0.9 && G.phase === 'flying' &&
        (a.fuel < 20 || a.stalled || a.damage > 60)) {
      lastBeep = now;
      tone(a.stalled ? 320 : 880, 0.12, 'square', 0.06);
    }
  }
  function ring() { tone(660, 0.12, 'sine', 0.16); tone(990, 0.22, 'sine', 0.16, 0.1); }
  function land() { tone(523, 0.18, 'sine', 0.15); tone(784, 0.3, 'sine', 0.15, 0.15); }
  function crash() {
    if (!ensure()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.7);
    f.type = 'lowpass'; f.frequency.value = 500;
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f).connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.85);
  }
  return { resume: resume, update: update, ring: ring, land: land, crash: crash };
})();
