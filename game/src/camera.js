// SORTIE — camera.js: chase and cockpit cameras with smoothing and free-look.
// One global: CameraRig. Chase sits 15 degrees behind and above the plane;
// cockpit sits inside it, with the nose and canopy frame in view.
var CameraRig = (function () {
  var cam = null;
  var chasePos = new THREE.Vector3();
  var initialized = false;

  function create(camera) { cam = camera; }

  function update(dt) {
    var a = Aircraft.state;
    if (!a) return;
    var mouse = Input.consumeMouse();
    G.freeLookYaw -= mouse.x * 0.0022;
    G.freeLookPitch -= mouse.y * 0.0022;
    G.freeLookPitch = Math.max(-0.7, Math.min(0.7, G.freeLookPitch));
    if (!Input.is('MouseLeft') && !document.pointerLockElement) {
      G.freeLookYaw *= (1 - 2 * dt);
      G.freeLookPitch *= (1 - 2 * dt);
    }
    var fwd = Aircraft.forward();
    var up = new THREE.Vector3(0, 1, 0);
    var right = new THREE.Vector3().crossVectors(fwd, up).normalize();

    if (G.cameraMode === 'cockpit') {
      var eye = a.pos.clone().addScaledVector(fwd, 0.4).add(new THREE.Vector3(0, 0.75, 0));
      cam.position.copy(eye);
      var look = eye.clone().addScaledVector(fwd, 40)
        .addScaledVector(right, Math.sin(G.freeLookYaw) * 12)
        .add(new THREE.Vector3(0, G.freeLookPitch * 10, 0));
      cam.up.set(0, 1, 0);
      cam.lookAt(look);
      cam.rotateZ(a.roll * 0.4); // cockpit rolls a little with the plane
      initialized = false;
      return;
    }

    // Chase: 15 deg behind, slightly above, with look-ahead into turns.
    var back = fwd.clone().multiplyScalar(-19);
    var target = a.pos.clone().add(back).add(new THREE.Vector3(0, 5.5, 0));
    if (!initialized) { chasePos.copy(target); initialized = true; }
    chasePos.lerp(target, 0.12);
    cam.position.copy(chasePos);
    var lookAt = a.pos.clone().addScaledVector(fwd, 14).add(new THREE.Vector3(0, 1, 0));
    cam.up.set(0, 1, 0);
    cam.lookAt(lookAt);
    cam.rotateZ(a.roll * 0.4); // camera roll reduced 60% so it never fights the pilot
  }
  return { create: create, update: update };
})();
