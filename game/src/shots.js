// SORTIE — shots.js: deterministic screenshot poses from ?shot=<name>&seed=1.
// One global: Shots. Each shot freezes the plane in a fixed pose with the HUD on,
// so the same URL always renders the same frame.
var Shots = (function () {
  function params() {
    var q = new URLSearchParams(window.location.search);
    return { shot: q.get('shot'), seed: parseInt(q.get('seed') || '1', 10) || 1 };
  }

  function apply() {
    var p = params();
    if (!p.shot) return false;
    G.shot = p.shot;
    G.shotSeed = p.seed;
    G.posed = true;
    var a = Aircraft.state;
    var m;
    document.getElementById('menu').style.display = 'none';
    G.phase = 'flying';

    if (p.shot === 'cover') {
      // Chase view, plane low over runway 09, mountains and coast ahead, HUD lit.
      Missions.select(0);
      a.pos.set(-1450, Config.RUNWAY_ELEV + 110, 200);
      a.yaw = -Math.PI / 2; a.pitch = 0.02; a.roll = 0.10;
      a.throttle = 0.78; a.fuel = 78; a.damage = 0; a.gear = true; a.flaps = true;
      a.vel.set(60, 2, 0); a.speed = 60; a.vs = 2;
      G.cameraMode = 'chase';
    } else if (p.shot === 'cockpit') {
      // Cockpit view, gauges lit, a ring visible through the windscreen.
      Missions.select(1);
      Missions.state.ringIndex = 2;
      a.pos.set(400, 245, -700);
      a.yaw = -1.74; a.pitch = -0.03; a.roll = -0.08;
      a.throttle = 0.72; a.fuel = 62; a.damage = 0; a.gear = false; a.flaps = false;
      a.vel.set(55, 0, 0); a.speed = 55; a.vs = 0;
      G.cameraMode = 'cockpit';
      Missions.refreshRingColors && Missions.refreshRingColors();
    } else if (p.shot === 'rings') {
      // Ring race, banking hard toward the active yellow ring, fuel warning on.
      Missions.select(1);
      Missions.state.ringIndex = 2;
      Missions.state.timeLeft = 72;
      a.pos.set(850, 195, -680);
      a.yaw = -2.06; a.pitch = -0.05; a.roll = -0.85;
      a.throttle = 0.95; a.fuel = 18; a.damage = 32; a.gear = false; a.flaps = false;
      a.vel.set(70, 0, 0); a.speed = 70; a.vs = -1.5; a.boost = true;
      G.cameraMode = 'chase';
      G.message = 'RING 3/8 — BOOST BURNS FUEL';
      G.messageUntil = 1e9;
    } else if (p.shot === 'landing') {
      // Final approach to runway 27, gear down, low altimeter, LANDING on screen.
      Missions.select(0);
      a.pos.set(700, Config.RUNWAY_ELEV + 55, -300);
      a.yaw = -Math.PI / 2; a.pitch = -0.06; a.roll = 0.02;
      a.throttle = 0.42; a.fuel = 34; a.damage = 0; a.gear = true; a.flaps = true;
      a.vel.set(48, -3.2, 0); a.speed = 48; a.vs = -3.2;
      G.cameraMode = 'chase';
    } else {
      return false;
    }
    // Rebuild rings for the selected mission and repaint colours.
    Missions.buildRings(window.__sortieScene);
    Aircraft.state && (function () { /* model sync happens in the loop */ })();
    return true;
  }

  return { apply: apply, params: params };
})();
