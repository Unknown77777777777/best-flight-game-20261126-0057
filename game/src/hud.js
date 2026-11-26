// SORTIE — hud.js: the 2D Canvas overlay — mission, timer, fuel, ALT/SPD/HDG,
// throttle/flap/gear/damage/V-S, target markers, and the cockpit gauge cluster.
// One global: HUD. Bold type with black stroke, one green/amber style, big numbers.
var HUD = (function () {
  var cv = null, ctx = null, camera = null;
  var W = 1280, H = 720;

  function init(canvas, cam) {
    cv = canvas; ctx = canvas.getContext('2d'); camera = cam;
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W; cv.height = H;
  }
  function text(str, x, y, size, color, align) {
    ctx.font = 'bold ' + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color || '#f4f1e8';
    ctx.fillText(str, x, y);
  }
  function bar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(244,241,232,0.8)'; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
  function gauge(cx, cy, r, label, value, max, unit, color) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,12,20,0.72)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f4f1e8'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r - 8, -Math.PI * 0.75, -Math.PI * 0.75 + (Math.PI * 1.5) * (value / max));
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.stroke();
    var ang = -Math.PI * 0.75 + (Math.PI * 1.5) * Math.max(0, Math.min(1, value / max));
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (r - 14), cy + Math.sin(ang) * (r - 14));
    ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = '#f4f1e8'; ctx.fill();
    text(label, cx, cy + r + 16, 15, '#f4f1e8', 'center');
    text(Math.round(value) + ' ' + unit, cx, cy - r + 22, 15, color, 'center');
  }
  function project(p) {
    var v = p.clone().project(camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
  }
  function marker(p, label, dist, color) {
    var s = project(p);
    if (!s) return;
    var onScreen = s.x > 40 && s.x < W - 40 && s.y > 40 && s.y < H - 40;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    if (onScreen) {
      ctx.strokeRect(s.x - 22, s.y - 22, 44, 44);
      ctx.beginPath(); ctx.moveTo(s.x - 32, s.y); ctx.lineTo(s.x - 22, s.y);
      ctx.moveTo(s.x + 22, s.y); ctx.lineTo(s.x + 32, s.y);
      ctx.moveTo(s.x, s.y - 32); ctx.lineTo(s.x, s.y - 22);
      ctx.moveTo(s.x, s.y + 22); ctx.lineTo(s.x, s.y + 32);
      ctx.stroke();
      text(label + '  ' + Math.round(dist) + ' m', s.x, s.y - 40, 18, color, 'center');
    } else {
      // Edge arrow pointing toward the target.
      var ex = Math.max(50, Math.min(W - 50, s.x)), ey = Math.max(70, Math.min(H - 70, s.y));
      ctx.beginPath(); ctx.moveTo(ex, ey - 14); ctx.lineTo(ex + 12, ey + 10); ctx.lineTo(ex - 12, ey + 10); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      text(label + '  ' + Math.round(dist) + ' m', ex, ey + 30, 17, color, 'center');
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var a = Aircraft.state;
    var m = Missions.current();
    if (!a || !m) return;
    var green = '#7dff9a', amber = '#ffc44d', red = '#ff5a4d', white = '#f4f1e8';
    var alt = Math.max(0, a.pos.y - Terrain.heightAt(a.pos.x, a.pos.z));
    var kts = Math.round(a.speed * 1.94);
    var hdg = Math.round(Aircraft.headingDeg());

    // Top-left: mission + timer + score.
    text(m.short, 24, 30, 24, white);
    text(Missions.fmtTime(Missions.state.timeLeft), 24, 62, 30, Missions.state.timeLeft < 20 ? red : amber);
    text('SCORE ' + G.score, 24, 94, 18, green);

    // Top-right: fuel bar + warning lamps.
    var fuelColor = a.fuel > 40 ? green : (a.fuel > 20 ? amber : red);
    text('FUEL ' + Math.round(a.fuel) + '%', W - 224, 30, 20, fuelColor, 'left');
    bar(W - 224, 46, 200, 16, a.fuel / 100, fuelColor);
    var warnY = 78;
    if (a.fuel < 20) { text('⚠ FUEL LOW', W - 224, warnY, 20, (Math.floor(G.time * 3) % 2) ? red : white); warnY += 26; }
    if (a.damage > 40) { text('⚠ DAMAGE ' + Math.round(a.damage) + '%', W - 224, warnY, 20, amber); warnY += 26; }
    if (a.stalled) { text('⚠ STALL', W - 224, warnY, 20, (Math.floor(G.time * 3) % 2) ? red : white); warnY += 26; }
    if (a.boost) text('BOOST', W - 224, warnY, 20, amber);

    // Centre: horizon line + big ALT / SPD / HDG.
    var cy = Math.round(H * 0.30);
    ctx.strokeStyle = 'rgba(244,241,232,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 260, cy); ctx.lineTo(W / 2 + 260, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 - 14, cy); ctx.lineTo(W / 2, cy - 14); ctx.lineTo(W / 2 + 14, cy); ctx.stroke();
    text('ALT ' + Math.round(alt), W / 2 - 300, cy - 44, 34, white, 'center');
    text('SPD ' + kts + ' KTS', W / 2, cy - 44, 34, white, 'center');
    var hdgStr = ('00' + hdg).slice(-3);
    text('HDG ' + hdgStr + '°', W / 2 + 300, cy - 44, 34, white, 'center');
    text('ALT m', W / 2 - 300, cy - 12, 14, amber, 'center');
    text('SPEED', W / 2, cy - 12, 14, amber, 'center');
    text('HEADING', W / 2 + 300, cy - 12, 14, amber, 'center');

    // Transient centre message (ring passed, scanned, fuel empty).
    if (G.time < G.messageUntil && G.message) {
      text(G.message, W / 2, H * 0.42, 28, amber, 'center');
    }
    if (G.shot === 'landing') text('LANDING', W / 2, H * 0.55, 40, green, 'center');

    // Target marker + runway marker under 3 km.
    var t = Missions.activeTarget();
    if (t) {
      var tp = new THREE.Vector3(t.x, t.y, t.z);
      var dist = a.pos.distanceTo(tp);
      marker(tp, t.name, dist, t.kind === 'ring' ? '#ffd21f' : '#2fa8ff');
    }
    for (var i = 0; i < Terrain.runways.length; i++) {
      var rw = Terrain.runways[i];
      var rp = new THREE.Vector3(rw.cx, Config.RUNWAY_ELEV + 2, rw.cz);
      var rd = a.pos.distanceTo(rp);
      if (rd < 3000 && !(t && t.kind === 'runway' && Math.abs(t.x - rw.cx) < 10)) {
        marker(rp, rw.name, rd, '#f4f1e8');
      }
    }

    // Bottom strip: throttle, flap/gear, damage, vertical speed.
    var by = H - 46;
    text('THR ' + Math.round(a.throttle * 100) + '%', 24, by - 8, 18, white);
    bar(140, by - 18, 170, 16, a.throttle, a.boost ? amber : green);
    text((a.flaps ? 'FLAP ' : '') + (a.gear ? 'GEAR ' : '') + 'DMG ' + Math.round(a.damage) + '%', 340, by - 8, 18, a.damage > 40 ? amber : white);
    bar(560, by - 18, 140, 16, a.damage / 100, a.damage > 60 ? red : amber);
    var vs = a.vs;
    text('V/S ' + (vs >= 0 ? '+' : '') + vs.toFixed(1) + ' m/s', 730, by - 8, 18, Math.abs(vs) > 8 ? red : white);
    text('W/S throttle · A/D roll · ↑/↓ pitch · Q/E yaw · SHIFT boost · F flap · G gear · SPACE brake · C camera · R respawn · M mission', W / 2, H - 14, 13, 'rgba(244,241,232,0.65)', 'center');

    // Cockpit view: three round gauges + canopy frame + nose.
    if (G.cameraMode === 'cockpit') {
      var gy = H - 150;
      gauge(W / 2 - 190, gy, 62, 'ALTIMETER', alt, 1500, 'm', green);
      gauge(W / 2, gy, 62, 'AIRSPEED', kts, 280, 'KTS', green);
      gauge(W / 2 + 190, gy, 62, 'HEADING', hdg, 360, '°', amber);
      // Canopy frame: two short dark arcs hugging the left/right screen edges only.
      ctx.strokeStyle = 'rgba(20,24,32,0.95)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(-40, H * 0.55, 180, -Math.PI * 0.35, Math.PI * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(W + 40, H * 0.55, 180, Math.PI * 0.65, Math.PI * 1.35); ctx.stroke();
      // Nose of the plane peeking over the bottom edge, below the gauges.
      ctx.fillStyle = '#ff6a2a';
      ctx.beginPath(); ctx.moveTo(W / 2 - 18, H); ctx.lineTo(W / 2 + 18, H); ctx.lineTo(W / 2 + 6, H - 34); ctx.lineTo(W / 2 - 6, H - 34); ctx.closePath(); ctx.fill();
    }

    // Crosshair in chase view.
    if (G.cameraMode === 'chase' && G.phase === 'flying') {
      ctx.strokeStyle = 'rgba(244,241,232,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2 - 20, H / 2); ctx.lineTo(W / 2 - 6, H / 2);
      ctx.moveTo(W / 2 + 6, H / 2); ctx.lineTo(W / 2 + 20, H / 2);
      ctx.moveTo(W / 2, H / 2 - 20); ctx.lineTo(W / 2, H / 2 - 6);
      ctx.moveTo(W / 2, H / 2 + 6); ctx.lineTo(W / 2, H / 2 + 20); ctx.stroke();
    }
  }

  return { init: init, draw: draw, resize: resize };
})();
