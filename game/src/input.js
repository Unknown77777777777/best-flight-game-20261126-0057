// SORTIE — input.js: keyboard + mouse (pointer-lock free-look).
// One global: Input. Keys are read as plain booleans by the physics step.
var Input = (function () {
  var keys = {};
  var mouseDX = 0, mouseDY = 0;
  var locked = false;
  var canvas = null;

  function keyName(e) {
    if (e.code) return e.code;
    return 'Key' + (e.key || '').toUpperCase();
  }
  function onDown(e) {
    keys[keyName(e)] = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    if (e.code === 'KeyC') G.cameraMode = (G.cameraMode === 'chase') ? 'cockpit' : 'chase';
    if (e.code === 'KeyM') Missions.next();
    if (e.code === 'KeyR') Aircraft.respawn();
    if (e.code === 'KeyF') Aircraft.toggleFlaps();
    if (e.code === 'KeyG') Aircraft.toggleGear();
  }
  function onUp(e) { keys[keyName(e)] = false; }
  function onMove(e) {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
  function onLockChange() {
    locked = (document.pointerLockElement === canvas);
  }
  function init(c) {
    canvas = c;
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', function () { keys = {}; });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLockChange);
    canvas.addEventListener('click', function () {
      if (G.phase === 'flying' && canvas.requestPointerLock) canvas.requestPointerLock();
    });
  }
  function is(code) { return !!keys[code]; }
  // Mouse deltas since last read, consumed by the camera each frame.
  function consumeMouse() {
    var d = { x: mouseDX, y: mouseDY };
    mouseDX = 0; mouseDY = 0;
    return d;
  }
  function axis() {
    return {
      throttleUp: is('KeyW'), throttleDown: is('KeyS'),
      rollLeft: is('KeyA'), rollRight: is('KeyD'),
      pitchUp: is('ArrowUp'), pitchDown: is('ArrowDown'),
      yawLeft: is('KeyQ'), yawRight: is('KeyE'),
      boost: is('ShiftLeft') || is('ShiftRight'),
      brake: is('Space')
    };
  }
  return { init: init, is: is, axis: axis, consumeMouse: consumeMouse };
})();
