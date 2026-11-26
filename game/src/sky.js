// SORTIE — sky.js: sunset gradient dome, low sun disc, and matching fog.
// One global: Sky.
var Sky = (function () {
  function build(scene) {
    var c = Config.COLORS;
    scene.fog = new THREE.Fog(c.fog, 900, 6500);
    var geo = new THREE.SphereGeometry(9000, 24, 16);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(c.skyTop) },
        mid: { value: new THREE.Color(c.skyMid) },
        low: { value: new THREE.Color(c.skyLow) }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;' +
        'void main(){ float h = normalize(vP).y; vec3 col = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));' +
        ' gl_FragColor = vec4(col, 1.0); }'
    });
    var dome = new THREE.Mesh(geo, mat);
    scene.add(dome);

    // Sun disc low on the western horizon, with a glow ring.
    var sun = new THREE.Mesh(new THREE.CircleGeometry(260, 32),
      new THREE.MeshBasicMaterial({ color: c.sun, fog: false }));
    sun.position.set(-6500, 900, -2600);
    sun.lookAt(0, 200, 0);
    scene.add(sun);
    var glow = new THREE.Mesh(new THREE.CircleGeometry(520, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8a4d, transparent: true, opacity: 0.28, fog: false }));
    glow.position.copy(sun.position).multiplyScalar(1.001);
    glow.lookAt(0, 200, 0);
    scene.add(glow);

    // A few flat sunset clouds for depth.
    var cloudMat = new THREE.MeshBasicMaterial({ color: 0xffc9a3, transparent: true, opacity: 0.55, fog: false });
    var rnd = RNG.mulberry32(77);
    for (var i = 0; i < 10; i++) {
      var w = 500 + rnd() * 700;
      var cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, 60 + rnd() * 70), cloudMat);
      var a = rnd() * Math.PI * 2;
      cloud.position.set(Math.cos(a) * 5200, 700 + rnd() * 700, Math.sin(a) * 5200);
      cloud.lookAt(0, cloud.position.y, 0);
      scene.add(cloud);
    }

    var hemi = new THREE.HemisphereLight(0xffb98a, 0x3d4a2a, 0.85);
    scene.add(hemi);
    var sunLight = new THREE.DirectionalLight(0xffc27a, 1.15);
    sunLight.position.set(-3000, 1200, -1500);
    scene.add(sunLight);
    return { dome: dome };
  }
  return { build: build };
})();
