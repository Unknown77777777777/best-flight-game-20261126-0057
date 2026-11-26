// SORTIE — main.js: fixed-timestep loop and wiring for every module.
// One global: Sortie (the boot entry point). Loads in classic-script order:
// three, config, random, input, aircraft, terrain, sky, hud, missions, camera,
// audio, shots, then this file.
var Sortie = (function () {
  var renderer, scene, camera, clock;
  var ACC = 1 / 60, acc = 0, last = 0;

  function boot() {
    var gl = document.getElementById('gl');
    renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    window.__sortieScene = scene;
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 20000);
    camera.position.set(-1500, 60, 260);

    Sky.build(scene);
    Terrain.build(scene);
    Aircraft.create(scene);
    Missions.buildRings(scene);
    CameraRig.create(camera);
    HUD.init(document.getElementById('hud'), camera);
    Input.init(gl);
    AudioSys.resume();

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      HUD.resize();
    });

    // Menu wiring.
    var buttons = document.querySelectorAll('#missionList button');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          Missions.select(parseInt(btn.getAttribute('data-mission'), 10));
          refreshBrief();
        });
      })(buttons[i]);
    }
    document.getElementById('startBtn').addEventListener('click', function () {
      Missions.start();
      refreshBrief();
    });
    document.getElementById('retryBtn').addEventListener('click', function () {
      document.getElementById('result').style.display = 'none';
      Aircraft.respawn();
    });
    window.addEventListener('keydown', function (e) {
      if (G.phase === 'menu' && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) {
        Missions.select(parseInt(e.code.slice(-1), 10) - 1);
        refreshBrief();
      }
      if (G.phase === 'menu' && e.code === 'Enter') Missions.start();
    });
    refreshBrief();

    // Deterministic screenshot pose, if requested (?shot=...&seed=1).
    Shots.apply();

    last = performance.now();
    requestAnimationFrame(frame);
  }

  function refreshBrief() {
    var m = Missions.current();
    var el = document.getElementById('brief');
    if (el && m) el.textContent = m.brief + ' — Time limit ' + Missions.fmtTime(m.timeLimit) + ' · Fuel ' + m.startFuel + '%';
    var list = document.querySelectorAll('#missionList button');
    for (var i = 0; i < list.length; i++) {
      list[i].classList.toggle('active', i === Missions.state.index);
    }
  }

  function step(dt) {
    G.time += dt;
    if (G.phase === 'flying') G.elapsed += dt;
    Aircraft.update(dt, Input.axis()); // posed mode: update() only syncs the frozen model pose
    Missions.update(dt); // posed mode: update() returns immediately
    CameraRig.update(dt);
    AudioSys.update(dt);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= ACC) { step(ACC); acc -= ACC; }
    renderer.render(scene, camera);
    HUD.draw();
  }

  return { boot: boot };
})();

window.addEventListener('load', Sortie.boot);
