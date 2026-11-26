// SORTIE — random.js: deterministic seeded RNG and value noise for the terrain.
// One global: RNG. Same seed always builds the same island.
var RNG = (function () {
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(ix, iz, seed) {
    var h = (ix * 374761393 + iz * 668265263 + seed * 974634) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  // Smooth 2D value noise in [-1, 1], deterministic for a fixed seed.
  function noise2(x, z, seed) {
    var ix = Math.floor(x), iz = Math.floor(z);
    var fx = x - ix, fz = z - iz;
    var a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
    var c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
    var u = smooth(fx), v = smooth(fz);
    return ((a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1);
  }
  function fbm(x, z, seed, octaves) {
    var sum = 0, amp = 1, freq = 1, norm = 0;
    for (var i = 0; i < octaves; i++) {
      sum += noise2(x * freq, z * freq, seed + i * 101) * amp;
      norm += amp; amp *= 0.5; freq *= 2.1;
    }
    return sum / norm;
  }
  return { mulberry32: mulberry32, noise2: noise2, fbm: fbm };
})();
