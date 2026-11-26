// SORTIE — terrain.js: deterministic island heightmap, sea, runways, mountains, coast.
// One global: Terrain. heightAt(x, z) is the single source of truth for ground level.
var Terrain = (function () {
  var runways = [
    { id: 'A', name: 'RWY 09', cx: -1100, cz: 200, num: '09', heading: 90 },
    { id: 'B', name: 'RWY 27', cx: 1400, cz: -300, num: '27', heading: 270 }
  ];
  var peaks = [];
  (function () {
    var rnd = RNG.mulberry32(Config.WORLD_SEED);
    var spots = [[-700, -900, 380], [300, 900, 460], [900, 300, 340], [-1900, -1200, 320], [1800, 800, 400], [200, -1500, 300]];
    for (var i = 0; i < spots.length; i++) {
      peaks.push({ x: spots[i][0] + (rnd() - 0.5) * 200, z: spots[i][1] + (rnd() - 0.5) * 200, h: spots[i][2], r: 700 + rnd() * 300 });
    }
  })();

  function runwayDist(x, z) {
    var best = 1e9, bestR = null;
    for (var i = 0; i < runways.length; i++) {
      var r = runways[i];
      // Flat corridor: the runway plus a 500 m approach zone past each end,
      // so landings never face a hill in the final approach.
      var dx = Math.abs(x - r.cx) / (Config.RUNWAY_LENGTH / 2 + 500);
      var dz = Math.abs(z - r.cz) / (Config.RUNWAY_WIDTH / 2 + 150);
      var d = Math.max(dx, dz);
      if (d < best) { best = d; bestR = r; }
    }
    return { d: best, runway: bestR };
  }
  function onRunway(x, z) {
    for (var i = 0; i < runways.length; i++) {
      var r = runways[i];
      if (Math.abs(x - r.cx) < Config.RUNWAY_LENGTH / 2 && Math.abs(z - r.cz) < Config.RUNWAY_WIDTH / 2) return r;
    }
    return null;
  }

  function rawHeight(x, z) {
    var d = Math.sqrt(x * x + z * z) / Config.ISLAND_RADIUS;
    var island = 1 - smoothstep(0.75, 1.15, d);
    var base = RNG.fbm(x * 0.0006, z * 0.0006, Config.WORLD_SEED, 4) * 110 + 70;
    var hills = RNG.fbm(x * 0.003, z * 0.003, Config.WORLD_SEED + 7, 3) * 45;
    var h = (base + hills) * island;
    for (var i = 0; i < peaks.length; i++) {
      var p = peaks[i];
      var pd = Math.sqrt((x - p.x) * (x - p.x) + (z - p.z) * (z - p.z)) / p.r;
      if (pd < 1) h += p.h * (1 - pd * pd) * island;
    }
    // Sea floor beyond the coast.
    if (island <= 0) h = -12 + island * 20;
    // Flatten ground around the runways so landings are fair.
    var rd = runwayDist(x, z);
    if (rd.d < 1.6) {
      var t = smoothstep(0.7, 1.6, rd.d);
      h = h * t + Config.RUNWAY_ELEV * (1 - t);
    }
    return h;
  }
  function smoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function heightAt(x, z) { return rawHeight(x, z); }

  function runwayTexture(num) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#4a4a52'; ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#f2f2e8';
    ctx.fillRect(0, 3, 512, 3); ctx.fillRect(0, 58, 512, 3);
    for (var x = 20; x < 512; x += 48) ctx.fillRect(x, 30, 26, 4);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num, 40, 32); ctx.fillText(num, 472, 32);
    var tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  function build(scene) {
    var size = Config.WORLD_SIZE, seg = 128;
    var geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var c = Config.COLORS;
    var sand = new THREE.Color(c.sand), grass = new THREE.Color(c.grass),
        forest = new THREE.Color(c.forest), rock = new THREE.Color(c.rock),
        snow = new THREE.Color(c.snow), sea = new THREE.Color(c.sea);
    var tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var h = rawHeight(x, z);
      pos.setY(i, h);
      if (h < 2) tmp.copy(sea).lerp(sand, Math.max(0, (h + 12) / 14));
      else if (h < 6) tmp.copy(sand);
      else if (h < 90) tmp.copy(grass).lerp(forest, RNG.fbm(x * 0.01, z * 0.01, 99, 2) * 0.5 + 0.5);
      else if (h < 260) tmp.copy(forest).lerp(rock, (h - 90) / 170);
      else if (h < 420) tmp.copy(rock);
      else tmp.copy(rock).lerp(snow, Math.min(1, (h - 420) / 120));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    scene.add(new THREE.Mesh(geo, mat));

    // Sea plane.
    var seaGeo = new THREE.PlaneGeometry(size * 2.4, size * 2.4);
    seaGeo.rotateX(-Math.PI / 2);
    var seaMesh = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: c.sea, roughness: 0.35, metalness: 0.25 }));
    seaMesh.position.y = -0.5;
    scene.add(seaMesh);

    // Runways with painted numbers and threshold marks.
    for (var r = 0; r < runways.length; r++) {
      var rw = runways[r];
      var rgeo = new THREE.PlaneGeometry(Config.RUNWAY_LENGTH, Config.RUNWAY_WIDTH);
      rgeo.rotateX(-Math.PI / 2);
      var rmat = new THREE.MeshStandardMaterial({ map: runwayTexture(rw.num), roughness: 0.9 });
      var rmesh = new THREE.Mesh(rgeo, rmat);
      rmesh.position.set(rw.cx, Config.RUNWAY_ELEV + 0.15, rw.cz);
      scene.add(rmesh);
      // Threshold bars.
      var bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, Config.RUNWAY_WIDTH - 8),
        new THREE.MeshStandardMaterial({ color: 0xf2f2e8 }));
      bar.position.set(rw.cx - Config.RUNWAY_LENGTH / 2 + 18, Config.RUNWAY_ELEV + 0.3, rw.cz);
      scene.add(bar);
      var bar2 = bar.clone();
      bar2.position.x = rw.cx + Config.RUNWAY_LENGTH / 2 - 18;
      scene.add(bar2);
    }

    // Low hills as simple cones for silhouette variety.
    var rnd = RNG.mulberry32(Config.WORLD_SEED + 31);
    var hillMat = new THREE.MeshStandardMaterial({ color: c.forest, roughness: 1 });
    for (var k = 0; k < 14; k++) {
      var hx = (rnd() - 0.5) * 4400, hz = (rnd() - 0.5) * 4400;
      var hh = rawHeight(hx, hz);
      if (hh < 100) continue; // cones only on high ground, clear of runways and ring lines
      var cone = new THREE.Mesh(new THREE.ConeGeometry(90 + rnd() * 120, 60 + rnd() * 90, 7), hillMat);
      cone.position.set(hx, hh + 10, hz);
      scene.add(cone);
    }
    return { runways: runways, peaks: peaks };
  }

  return { build: build, heightAt: heightAt, onRunway: onRunway, runways: runways, peaks: peaks };
})();
