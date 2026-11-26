// SORTIE — missions.js: the three missions, their data, rings and state machine.
// One global: Missions. Data is one array; the same file drives all three sorties.
var Missions = (function () {
  var RING_Y = 150;
  var missions = [
    {
      id: 1, name: 'DELIVERY RUN', short: 'MISI 1 · DELIVERY RUN',
      brief: 'Take off from runway 09, fly 2500 m east and land on runway 27 before the fuel runs out.',
      timeLimit: 300, startFuel: 100,
      start: { x: -1450, z: 200, yaw: -Math.PI / 2 },
      targets: [{ kind: 'runway', name: 'RUNWAY 27', x: 1400, z: -300, y: 8, radius: 350 }],
      rings: []
    },
    {
      id: 2, name: 'RING RACE', short: 'MISI 2 · RING RACE',
      brief: 'Fly through 8 glowing rings in order, as fast as you can. 90 seconds on the clock — boost burns fuel.',
      timeLimit: 90, startFuel: 100,
      start: { x: -1450, z: 200, yaw: -Math.PI / 2 },
      targets: [],
      rings: [
        { x: -600, z: -500, y: 160 }, { x: 200, z: -900, y: 220 }, { x: 1000, z: -600, y: 180 },
        { x: 1500, z: 300, y: 260 }, { x: 900, z: 1100, y: 200 }, { x: 0, z: 1300, y: 280 },
        { x: -900, z: 900, y: 170 }, { x: -1400, z: 300, y: 150 }
      ]
    },
    {
      id: 3, name: 'LOW-LEVEL RECON', short: 'MISI 3 · LOW-LEVEL RECON',
      brief: 'Scan 3 zones below 150 m, stay low, dodge the mountains, then return to runway 09.',
      timeLimit: 240, startFuel: 100,
      start: { x: -1450, z: 200, yaw: -Math.PI / 2 },
      targets: [
        { kind: 'zone', name: 'SCAN ZONE 1', x: -600, z: -900, y: 120, radius: 220 },
        { kind: 'zone', name: 'SCAN ZONE 2', x: 300, z: 900, y: 120, radius: 220 },
        { kind: 'zone', name: 'SCAN ZONE 3', x: 900, z: 300, y: 120, radius: 220 },
        { kind: 'runway', name: 'RTB · RUNWAY 09', x: -1100, z: 200, y: 8, radius: 350 }
      ],
      rings: []
    }
  ];

  var state = {
    index: 0, targetIndex: 0, ringIndex: 0,
    timeLeft: 300, scanned: 0, ringsPassed: 0,
    startedAt: 0, finished: false
  };
  var ringMeshes = [];
  var zoneMeshes = [];
  var sceneRef = null;

  function current() { return missions[state.index]; }
  function activeTarget() {
    var m = current();
    if (m.rings.length) {
      if (state.ringIndex >= m.rings.length) return null;
      var r = m.rings[state.ringIndex];
      return { kind: 'ring', name: 'RING ' + (state.ringIndex + 1) + '/' + m.rings.length, x: r.x, z: r.z, y: r.y, radius: 34 };
    }
    if (state.targetIndex >= m.targets.length) return null;
    return m.targets[state.targetIndex];
  }

  function buildRings(scene) {
    sceneRef = scene;
    for (var i = 0; i < ringMeshes.length; i++) scene.remove(ringMeshes[i]);
    ringMeshes = [];
    for (var j = 0; j < zoneMeshes.length; j++) scene.remove(zoneMeshes[j]);
    zoneMeshes = [];
    var m = current();
    var c = Config.COLORS;
    for (var k = 0; k < m.rings.length; k++) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(30, 2.2, 10, 40),
        new THREE.MeshBasicMaterial({ color: c.ringNext, transparent: true, opacity: 0.9 }));
      ring.position.set(m.rings[k].x, m.rings[k].y, m.rings[k].z);
      // Face the incoming flight direction so the hole is flown through, not edge-on.
      var prev = k > 0 ? m.rings[k - 1] : m.start;
      ring.lookAt(prev.x, prev.y, prev.z);
      scene.add(ring);
      ringMeshes.push(ring);
    }
    for (var z = 0; z < m.targets.length; z++) {
      if (m.targets[z].kind !== 'zone') continue;
      var zone = new THREE.Mesh(
        new THREE.CylinderGeometry(m.targets[z].radius, m.targets[z].radius, 4, 28, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x2fa8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      zone.position.set(m.targets[z].x, m.targets[z].y, m.targets[z].z);
      scene.add(zone);
      zoneMeshes.push(zone);
    }
    refreshRingColors();
  }

  function refreshRingColors() {
    var c = Config.COLORS;
    for (var i = 0; i < ringMeshes.length; i++) {
      var col = i < state.ringIndex ? c.ringDone : (i === state.ringIndex ? c.ringActive : c.ringNext);
      ringMeshes[i].material.color.setHex(col);
    }
  }

  function select(index) {
    state.index = ((index % missions.length) + missions.length) % missions.length;
    G.missionIndex = state.index;
    resetRun();
    if (sceneRef) buildRings(sceneRef);
    Aircraft.respawn();
  }
  function next() { select(state.index + 1); }

  function resetRun() {
    var m = current();
    state.targetIndex = 0; state.ringIndex = 0;
    state.timeLeft = m.timeLimit; state.scanned = 0; state.ringsPassed = 0;
    state.startedAt = G.time; state.finished = false;
    refreshRingColors();
  }

  function start() {
    resetRun();
    G.phase = 'flying';
    G.resultText = '';
    document.getElementById('menu').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    AudioSys.resume();
  }

  function fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    var m = Math.floor(s / 60), ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function update(dt) {
    if (G.phase !== 'flying' || G.posed) return;
    state.timeLeft -= dt;
    var a = Aircraft.state;
    if (!a) return;
    var m = current();
    // Ring race: pass through the active ring.
    if (m.rings.length && state.ringIndex < m.rings.length) {
      var r = m.rings[state.ringIndex];
      var d = Math.sqrt((a.pos.x - r.x) * (a.pos.x - r.x) + (a.pos.y - r.y) * (a.pos.y - r.y) + (a.pos.z - r.z) * (a.pos.z - r.z));
      if (d < 34) {
        state.ringIndex++; state.ringsPassed++;
        G.score += 100;
        G.message = 'RING ' + state.ringsPassed + '/8 — +100';
        G.messageUntil = G.time + 2;
        AudioSys.ring();
        refreshRingColors();
        if (state.ringIndex >= m.rings.length) {
          state.finished = true; G.phase = 'complete';
          var t = m.timeLimit - state.timeLeft;
          G.score += Math.max(0, Math.round((90 - t) * 10));
          G.resultText = 'RING RACE COMPLETE — ' + fmtTime(t) + ' · SCORE ' + G.score + ' · press M for next mission';
          document.getElementById('result').style.display = 'block';
          document.getElementById('resultText').textContent = G.resultText;
          AudioSys.land();
        }
      }
    }
    // Target zones / runways.
    var t = activeTarget();
    if (t && t.kind === 'zone') {
      var dx = a.pos.x - t.x, dz = a.pos.z - t.z;
      var alt = a.pos.y - Terrain.heightAt(a.pos.x, a.pos.z);
      if (Math.sqrt(dx * dx + dz * dz) < t.radius && alt < 150) {
        state.targetIndex++; state.scanned++;
        G.score += 150;
        G.message = t.name + ' SCANNED — +150';
        G.messageUntil = G.time + 2;
        AudioSys.ring();
      }
    }
    if (state.timeLeft <= 0 && !state.finished) {
      state.finished = true; G.phase = 'complete';
      G.resultText = 'TIME UP — SCORE ' + G.score + ' · press R to retry, M for next mission';
      document.getElementById('result').style.display = 'block';
      document.getElementById('resultText').textContent = G.resultText;
    }
    if (a.fuel <= 0 && !a._fuelWarned) {
      a._fuelWarned = true;
      G.message = 'FUEL EMPTY — GLIDE TO A RUNWAY';
      G.messageUntil = G.time + 4;
    }
    if (a.fuel > 5) a._fuelWarned = false;
  }

  function onLanded() {
    var m = current();
    var t = activeTarget();
    var landedOk = false;
    if (m.id === 1 && state.targetIndex === 0) { landedOk = true; state.targetIndex = 1; }
    if (m.id === 3 && state.targetIndex >= 3) { landedOk = true; state.targetIndex = 4; }
    if (landedOk) {
      state.finished = true;
      G.score += 500 + Math.round(Aircraft.state.fuel) * 5;
      G.resultText = m.name + ' COMPLETE — LANDED · SCORE ' + G.score + ' · press M for next mission';
      G.phase = 'complete';
      AudioSys.land();
    } else {
      G.resultText = 'LANDED — press R to take off again, M for next mission';
      G.phase = 'landed';
      AudioSys.land();
    }
    document.getElementById('result').style.display = 'block';
    document.getElementById('resultText').textContent = G.resultText;
  }

  return {
    missions: missions, current: current, activeTarget: activeTarget,
    buildRings: buildRings, select: select, next: next,
    resetRun: resetRun, start: start, update: update, onLanded: onLanded,
    fmtTime: fmtTime,
    get state() { return state; }
  };
})();
