// SORTIE — aircraft.js: the low-poly plane model, arcade physics, fuel and damage.
// One global: Aircraft. Physics follow the spec: lift vs speed, stall below 45 m/s,
// drag, thrust, boost burns fuel, damage cuts lift and top throttle, smoke trail.
var Aircraft = (function () {
  var state = null;
  var group = null;
  var smokePool = [];
  var smokeTimer = 0;
  var sceneRef = null;

  function buildModel() {
    var c = Config.COLORS;
    var g = new THREE.Group();
    var orange = new THREE.MeshStandardMaterial({ color: c.planeOrange, roughness: 0.55, metalness: 0.15 });
    var white = new THREE.MeshStandardMaterial({ color: c.planeWhite, roughness: 0.5, metalness: 0.1 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.6, metalness: 0.3 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.75 });

    var fus = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 4.6, 10), orange);
    fus.rotation.x = Math.PI / 2; g.add(fus);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 10), white);
    nose.rotation.x = -Math.PI / 2; nose.position.z = -3.0; g.add(nose);
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    canopy.scale.set(1, 0.75, 1.7); canopy.position.set(0, 0.42, -1.1); g.add(canopy);
    var wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.16, 1.7), white);
    wing.position.set(0, -0.08, -0.4); g.add(wing);
    var tipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.7), orange);
    tipL.position.set(-4.6, -0.08, -0.4); g.add(tipL);
    var tipR = tipL.clone(); tipR.position.x = 4.6; g.add(tipR);
    var tailH = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.1), orange);
    tailH.position.set(0, 0.18, 2.1); g.add(tailH);
    var tailV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.2), orange);
    tailV.position.set(0, 0.7, 2.1); g.add(tailV);
    var finTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 1.2), white);
    finTip.position.set(0, 1.45, 2.1); g.add(finTip);
    var gearL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), dark);
    gearL.position.set(-1.1, -0.85, -0.6); gearL.name = 'gearL'; g.add(gearL);
    var gearR = gearL.clone(); gearR.position.x = 1.1; gearR.name = 'gearR'; g.add(gearR);
    var gearN = gearL.clone(); gearN.position.set(0, -0.85, -2.2); gearN.name = 'gearN'; g.add(gearN);
    return g;
  }

  function create(scene) {
    sceneRef = scene;
    group = buildModel();
    scene.add(group);
    var smokeMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.45 });
    for (var i = 0; i < 24; i++) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), smokeMat.clone());
      s.visible = false; scene.add(s); smokePool.push({ mesh: s, life: 0 });
    }
    state = {
      pos: new THREE.Vector3(-1450, Config.RUNWAY_ELEV + 1.2, 200),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: -Math.PI / 2, // facing +X along runway A (heading 090)
      pitch: 0, roll: 0,
      throttle: 0, fuel: 100, damage: 0,
      flaps: false, gear: true, stalled: false,
      onGround: true, airborne: false, speed: 0, vs: 0,
      boost: false, landed: false, crashed: false
    };
    syncModel();
    return state;
  }

  function forward() {
    var e = new THREE.Euler(state.pitch, state.yaw, state.roll, 'YXZ');
    return new THREE.Vector3(0, 0, -1).applyEuler(e);
  }
  function headingDeg() {
    var f = forward();
    var h = Math.atan2(f.x, -f.z) * 180 / Math.PI;
    return ((h % 360) + 360) % 360;
  }
  function syncModel() {
    group.position.copy(state.pos);
    group.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
    group.traverse(function (o) {
      if (o.name === 'gearL' || o.name === 'gearR' || o.name === 'gearN') o.visible = state.gear;
    });
  }

  function respawn() {
    var m = Missions.current();
    var r = m && m.start ? m.start : { x: -1450, z: 200, yaw: Math.PI / 2 };
    state.pos.set(r.x, Config.RUNWAY_ELEV + 1.2, r.z);
    state.vel.set(0, 0, 0);
    state.yaw = r.yaw; state.pitch = 0; state.roll = 0;
    state.throttle = 0; state.fuel = m ? m.startFuel : 100; state.damage = 0;
    state.flaps = false; state.gear = true; state.stalled = false;
    state.onGround = true; state.airborne = false; state.landed = false; state.crashed = false;
    G.phase = 'flying'; G.resultText = '';
    Missions.resetRun();
    syncModel();
  }

  function toggleFlaps() { state.flaps = !state.flaps; }
  function toggleGear() { state.gear = !state.gear; }

  function addDamage(amount) {
    state.damage = Math.min(100, state.damage + amount);
    if (state.damage >= 100) { state.damage = 100; }
  }

  function update(dt, input) {
    if (G.posed || G.phase === 'menu' || state.crashed || state.landed) { syncModel(); return; }
    var speedFactor = Math.min(1, Math.max(0.15, state.speed / 60));
    // Throttle
    if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.55);
    if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.55);
    var maxThrottle = 1 - state.damage * 0.004;
    var effThrottle = Math.min(state.throttle, maxThrottle);
    state.boost = input.boost && state.fuel > 0 && effThrottle > 0.3;
    // Control rates scale with speed so the plane answers at every speed.
    if (input.rollLeft) state.roll += Config.ROLL_RATE * speedFactor * dt;
    if (input.rollRight) state.roll -= Config.ROLL_RATE * speedFactor * dt;
    if (input.pitchUp) state.pitch += Config.PITCH_RATE * speedFactor * dt;
    if (input.pitchDown) state.pitch -= Config.PITCH_RATE * speedFactor * dt;
    if (input.yawLeft) state.yaw += Config.YAW_RATE * speedFactor * dt;
    if (input.yawRight) state.yaw -= Config.YAW_RATE * speedFactor * dt;
    state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch));
    state.roll = Math.max(-1.4, Math.min(1.4, state.roll));
    // Auto-level roll gently when no roll input.
    if (!input.rollLeft && !input.rollRight) state.roll *= (1 - 0.6 * dt);

    var speed = state.vel.length();
    state.speed = speed;
    var liftFactor = Math.min(1.3, Math.max(0, speed / Config.LIFT_SPEED));
    liftFactor *= (1 - state.damage * 0.004);
    if (state.flaps) liftFactor += Config.FLAP_LIFT_BONUS;
    state.stalled = speed < Config.STALL_SPEED && !state.onGround;
    if (state.stalled) state.pitch -= 0.35 * dt; // nose drops in a stall
    var fwd = forward();
    var thrust = effThrottle * Config.THRUST * (state.boost ? Config.BOOST_MULT : 1);
    if (state.fuel <= 0) thrust = 0;
    state.vel.addScaledVector(fwd, thrust * dt);
    state.vel.y += liftFactor * Config.LIFT_ACCEL * dt - Config.GRAVITY * dt;
    var drag = Config.DRAG + (state.flaps ? Config.FLAP_DRAG : 0) + (state.gear && !state.onGround ? 0.05 : 0);
    state.vel.multiplyScalar(Math.max(0, 1 - drag * dt));
    if (state.vel.length() > Config.MAX_SPEED) state.vel.setLength(Config.MAX_SPEED);
    if (input.brake && state.onGround) state.vel.multiplyScalar(Math.max(0, 1 - Config.BRAKE_DECEL * dt / 60));
    state.pos.addScaledVector(state.vel, dt);
    state.vs = state.vel.y;

    // Fuel burn: throttle and boost decide the range.
    if (state.fuel > 0) {
      var burn = Config.FUEL_BURN * (0.25 + effThrottle) * (state.boost ? Config.FUEL_BURN_BOOST : 1);
      state.fuel = Math.max(0, state.fuel - burn * dt);
    }

    // Ground / terrain contact.
    var ground = Terrain.heightAt(state.pos.x, state.pos.z);
    var alt = state.pos.y - ground;
    if (alt <= 1.2) {
      var vs = state.vel.y;
      var onRunway = Terrain.onRunway(state.pos.x, state.pos.z);
      if (!state.onGround && onRunway && Math.abs(state.roll) < 0.21 && vs > -6) {
        state.pos.y = ground + 1.2;
        state.vel.y = 0; state.onGround = true; state.landed = true;
        G.phase = 'landed';
        Missions.onLanded();
      } else if (!state.onGround && vs < -8) {
        crash('TERRAIN IMPACT');
      } else {
        state.pos.y = ground + 1.2;
        if (state.vel.y < 0) state.vel.y = 0;
        state.onGround = true;
        if (state.airborne && speed < 12) { /* rolled to a stop */ }
      }
    } else {
      state.onGround = false;
      if (alt > 5) state.airborne = true;
    }
    if (state.pos.y < -5) crash('LOST AT SEA');

    // Damage smoke trail.
    if (state.damage > 25 && !state.crashed) {
      smokeTimer -= dt;
      if (smokeTimer <= 0) {
        smokeTimer = 0.06;
        for (var i = 0; i < smokePool.length; i++) {
          if (smokePool[i].life <= 0) {
            smokePool[i].life = 1.2;
            smokePool[i].mesh.position.copy(state.pos).addScaledVector(fwd, 2.4);
            smokePool[i].mesh.visible = true;
            break;
          }
        }
      }
    }
    for (var j = 0; j < smokePool.length; j++) {
      var p = smokePool[j];
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.scale.setScalar(1 + (1.2 - p.life));
        p.mesh.material.opacity = 0.45 * Math.max(0, p.life / 1.2);
        if (p.life <= 0) p.mesh.visible = false;
      }
    }
    syncModel();
  }

  function crash(reason) {
    if (state.crashed) return;
    state.crashed = true; state.vel.set(0, 0, 0);
    G.phase = 'crashed';
    G.resultText = 'CRASHED — ' + reason + ' · press R to respawn';
    AudioSys.crash();
  }

  return {
    create: create, update: update, respawn: respawn,
    toggleFlaps: toggleFlaps, toggleGear: toggleGear,
    addDamage: addDamage, forward: forward, headingDeg: headingDeg,
    get state() { return state; },
    get group() { return group; }
  };
})();
