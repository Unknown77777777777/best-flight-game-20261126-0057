// SORTIE — config.js: every constant for the world, physics and look, in one place.
// One global: Config. No imports; later files read Config directly.
var Config = {
  WORLD_SIZE: 6000,
  ISLAND_RADIUS: 2600,
  SEA_LEVEL: 0,
  RUNWAY_ELEV: 8,
  RUNWAY_LENGTH: 700,
  RUNWAY_WIDTH: 46,
  GRAVITY: 9.8,
  LIFT_SPEED: 60,
  LIFT_ACCEL: 28,
  STALL_SPEED: 45,
  PITCH_RATE: 0.9,
  ROLL_RATE: 2.4,
  YAW_RATE: 0.5,
  DRAG: 0.12,
  THRUST: 26,
  BOOST_MULT: 1.8,
  MAX_SPEED: 140,
  FUEL_BURN: 0.55,
  FUEL_BURN_BOOST: 2.2,
  FLAP_LIFT_BONUS: 0.25,
  FLAP_DRAG: 0.10,
  BRAKE_DECEL: 30,
  WORLD_SEED: 20261126,
  COLORS: {
    skyTop: 0x2b1e5e,
    skyMid: 0xc65a7a,
    skyLow: 0xff9a5c,
    sun: 0xffd27a,
    fog: 0xe08a68,
    sea: 0x2e5f8a,
    sand: 0xd9b380,
    grass: 0x5d8a4a,
    forest: 0x3d6b35,
    rock: 0x7a6a63,
    snow: 0xe8e4da,
    runway: 0x4a4a52,
    marking: 0xf2f2e8,
    planeOrange: 0xff6a2a,
    planeWhite: 0xf4f1e8,
    ringActive: 0xffd21f,
    ringNext: 0x2fa8ff,
    ringDone: 0x37d67a,
    hudGreen: '#7dff9a',
    hudAmber: '#ffc44d',
    hudRed: '#ff5a4d',
    hudWhite: '#f4f1e8'
  }
};

// Shared mutable session state. Modules read and write G; main.js owns the loop.
var G = {
  time: 0,
  phase: 'menu', // menu | flying | landed | crashed | complete
  missionIndex: 0,
  cameraMode: 'chase', // chase | cockpit
  score: 0,
  message: '',
  messageUntil: 0,
  shot: null, // 'cover' | 'cockpit' | 'rings' | 'landing' | null
  shotSeed: 1,
  posed: false, // shot mode: aircraft frozen in a fixed pose
  freeLookYaw: 0,
  freeLookPitch: 0,
  elapsed: 0,
  resultText: ''
};
