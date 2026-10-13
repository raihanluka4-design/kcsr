// Cyber Dino Runner Engine
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const statusIcon = document.getElementById('status-icon');
const startBtn = document.getElementById('start-btn');
const touchJumpBtn = document.getElementById('touch-jump');
const touchDuckBtn = document.getElementById('touch-duck');

// Audio Synthesizer (Web Audio API - zero external sound files required)
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch (_) {}
  }

  playScoreMilestone() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.26);
    } catch (_) {}
  }

  playCrash() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.32);
    } catch (_) {}
  }
}

const sounds = new SoundFX();

// Game State Constants
const STATE = {
  START: 'START',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};

let gameState = STATE.START;
let gameSpeed = 6;
let score = 0;
let highScore = parseInt(localStorage.getItem('cyber_dino_hi') || '0', 10);
let animationId = null;
let lastTime = 0;
let distance = 0;
let particles = [];
let stars = [];

// Ground Level
const GROUND_Y = 240;

// High Score UI init
highScoreEl.textContent = String(highScore).padStart(5, '0');

// Generate background starfield
for (let i = 0; i < 40; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * (GROUND_Y - 40),
    size: Math.random() * 1.5 + 0.5,
    speed: Math.random() * 0.3 + 0.1,
    alpha: Math.random() * 0.7 + 0.3
  });
}

// Dinosaur Player
class Dino {
  constructor() {
    this.standWidth = 44;
    this.standHeight = 52;
    this.duckWidth = 58;
    this.duckHeight = 28;

    this.width = this.standWidth;
    this.height = this.standHeight;
    this.x = 60;
    this.y = GROUND_Y - this.height;

    this.vy = 0;
    this.gravity = 0.75;
    this.jumpForce = -13.5;
    this.grounded = true;
    this.ducking = false;
    this.legStep = 0;
  }

  jump() {
    if (this.grounded) {
      this.vy = this.jumpForce;
      this.grounded = false;
      this.ducking = false;
      this.height = this.standHeight;
      this.width = this.standWidth;
      sounds.playJump();
      this.createJumpParticles();
    }
  }

  duck(isDucking) {
    if (this.grounded) {
      this.ducking = isDucking;
      if (isDucking) {
        this.width = this.duckWidth;
        this.height = this.duckHeight;
        this.y = GROUND_Y - this.height;
      } else {
        this.width = this.standWidth;
        this.height = this.standHeight;
        this.y = GROUND_Y - this.height;
      }
    } else if (isDucking) {
      // Fast fall if ducking mid-air
      this.vy += 1.2;
    }
  }

  createJumpParticles() {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: this.x + this.width / 2 + (Math.random() * 20 - 10),
        y: GROUND_Y,
        vx: (Math.random() - 0.5) * 3 - 2,
        vy: -Math.random() * 2 - 0.5,
        color: '#00f0ff',
        size: Math.random() * 3 + 1,
        life: 1.0,
        decay: 0.04
      });
    }
  }

  update() {
    // Gravity & physics
    if (!this.grounded) {
      this.vy += this.gravity;
      this.y += this.vy;

      if (this.y >= GROUND_Y - this.height) {
        this.y = GROUND_Y - this.height;
        this.vy = 0;
        this.grounded = true;
      }
    } else {
      this.y = GROUND_Y - this.height;
      this.legStep += gameSpeed * 0.05;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const cyan = '#00f0ff';
    const darkAccent = '#092736';

    if (!this.ducking) {
      // Normal standing / running dino
      // Body
      ctx.fillStyle = cyan;
      ctx.shadowColor = cyan;
      ctx.shadowBlur = 8;
      ctx.fillRect(8, 12, 28, 26);

      // Head & Snout
      ctx.fillRect(20, 0, 24, 18);
      ctx.fillRect(36, 6, 8, 10);

      // Eye
      ctx.fillStyle = darkAccent;
      ctx.fillRect(28, 4, 4, 4);

      // Small arms
      ctx.fillStyle = cyan;
      ctx.fillRect(32, 22, 10, 4);

      // Tail
      ctx.fillRect(0, 18, 10, 12);
      ctx.fillRect(0, 24, 4, 12);

      // Animated Legs
      const legOffset = Math.sin(this.legStep) * 6;
      if (this.grounded) {
        // Leg 1
        ctx.fillRect(14, 38, 5, 14 + legOffset);
        // Leg 2
        ctx.fillRect(26, 38, 5, 14 - legOffset);
      } else {
        // Jumping legs position
        ctx.fillRect(12, 38, 5, 10);
        ctx.fillRect(24, 38, 5, 8);
      }
    } else {
      // Ducking dino
      ctx.fillStyle = cyan;
      ctx.shadowColor = cyan;
      ctx.shadowBlur = 8;

      // Low elongated body
      ctx.fillRect(8, 8, 36, 16);
      // Head extended forward
      ctx.fillRect(40, 4, 18, 14);
      // Eye
      ctx.fillStyle = darkAccent;
      ctx.fillRect(48, 6, 4, 4);

      // Arms & Tail
      ctx.fillStyle = cyan;
      ctx.fillRect(0, 12, 8, 8);
      ctx.fillRect(38, 16, 8, 4);

      // Running legs low
      const legOffset = Math.sin(this.legStep) * 4;
      ctx.fillRect(18, 22, 5, 6 + legOffset);
      ctx.fillRect(32, 22, 5, 6 - legOffset);
    }

    ctx.restore();
  }

  getBounds() {
    // Generous hitbox padding for fair gameplay
    return {
      x: this.x + 4,
      y: this.y + 4,
      width: this.width - 8,
      height: this.height - 6
    };
  }
}

// Obstacle (Cactus & Pterodactyls)
class Obstacle {
  constructor(type, x) {
    this.type = type; // 'cactus_s', 'cactus_l', 'cactus_group', 'pterodactyl'
    this.x = x;
    this.markedForRemoval = false;

    if (this.type === 'cactus_s') {
      this.width = 20;
      this.height = 38;
      this.y = GROUND_Y - this.height;
    } else if (this.type === 'cactus_l') {
      this.width = 28;
      this.height = 54;
      this.y = GROUND_Y - this.height;
    } else if (this.type === 'cactus_group') {
      this.width = 52;
      this.height = 42;
      this.y = GROUND_Y - this.height;
    } else if (this.type === 'pterodactyl') {
      this.width = 46;
      this.height = 32;
      // Heights: 0 = low (duck), 1 = medium (jump or duck), 2 = high (run under)
      const flightAltitudes = [GROUND_Y - 44, GROUND_Y - 72, GROUND_Y - 96];
      this.y = flightAltitudes[Math.floor(Math.random() * flightAltitudes.length)];
      this.wingCycle = 0;
    }
  }

  update(speed) {
    this.x -= speed;
    if (this.type === 'pterodactyl') {
      this.wingCycle += 0.15;
    }
    if (this.x + this.width < -50) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type.startsWith('cactus')) {
      const color = '#ff007f';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      if (this.type === 'cactus_s') {
        ctx.fillRect(6, 0, 8, this.height);
        ctx.fillRect(0, 10, 6, 12);
        ctx.fillRect(14, 14, 6, 10);
      } else if (this.type === 'cactus_l') {
        ctx.fillRect(10, 0, 10, this.height);
        ctx.fillRect(0, 12, 10, 16);
        ctx.fillRect(20, 18, 8, 14);
      } else if (this.type === 'cactus_group') {
        // Triple cyber crystal
        ctx.fillRect(4, 8, 8, this.height - 8);
        ctx.fillRect(20, 0, 10, this.height);
        ctx.fillRect(38, 12, 8, this.height - 12);
      }
    } else if (this.type === 'pterodactyl') {
      const birdColor = '#ffb703';
      ctx.fillStyle = birdColor;
      ctx.shadowColor = birdColor;
      ctx.shadowBlur = 12;

      // Torso & head
      ctx.fillRect(12, 12, 22, 8);
      ctx.fillRect(32, 6, 10, 8); // Beak
      ctx.fillRect(4, 10, 8, 4); // Tail

      // Flapping wings
      const flap = Math.sin(this.wingCycle);
      if (flap > 0) {
        // Wings up
        ctx.fillRect(16, 0, 12, 12);
      } else {
        // Wings down
        ctx.fillRect(16, 20, 12, 12);
      }
    }

    ctx.restore();
  }

  getBounds() {
    return {
      x: this.x + 3,
      y: this.y + 3,
      width: this.width - 6,
      height: this.height - 6
    };
  }
}

// Parallax Ground
let groundOffset = 0;
function drawGround(ctx, speed) {
  groundOffset = (groundOffset + speed) % 40;

  ctx.save();
  // Ground neon baseline
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();

  // Grid / texture dashes underneath ground
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;

  for (let x = -groundOffset; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 20, canvas.height);
    ctx.stroke();
  }

  // Horizon subline
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 18);
  ctx.lineTo(canvas.width, GROUND_Y + 18);
  ctx.stroke();

  ctx.restore();
}

function drawBackground(ctx, speed) {
  // Clear canvas
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Distant stars / cosmic particles
  ctx.save();
  for (let star of stars) {
    star.x -= star.speed * (speed / 6);
    if (star.x < 0) star.x = canvas.width;

    ctx.fillStyle = `rgba(180, 220, 255, ${star.alpha})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }

  // Distant subtle mountain silhouettes
  ctx.fillStyle = 'rgba(17, 24, 39, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(120, GROUND_Y - 40);
  ctx.lineTo(260, GROUND_Y);
  ctx.lineTo(440, GROUND_Y - 60);
  ctx.lineTo(600, GROUND_Y);
  ctx.lineTo(750, GROUND_Y - 35);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function updateParticles(ctx) {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();
  }
}

// AABB Collision Detection
function checkCollision(box1, box2) {
  return (
    box1.x < box2.x + box2.width &&
    box1.x + box1.width > box2.x &&
    box1.y < box2.y + box2.height &&
    box1.y + box1.height > box2.y
  );
}

// Game Core Manager
const player = new Dino();
let obstacles = [];
let spawnTimer = 0;
let minSpawnInterval = 75;

function resetGame() {
  score = 0;
  distance = 0;
  gameSpeed = 6;
  obstacles = [];
  particles = [];
  spawnTimer = 40;
  player.vy = 0;
  player.y = GROUND_Y - player.standHeight;
  player.ducking = false;
  player.grounded = true;
  currentScoreEl.textContent = '00000';
}

function spawnObstacle() {
  const allowPtero = score > 150;
  const types = ['cactus_s', 'cactus_l', 'cactus_group'];
  if (allowPtero) {
    types.push('pterodactyl', 'pterodactyl');
  }

  const selected = types[Math.floor(Math.random() * types.length)];
  obstacles.push(new Obstacle(selected, canvas.width + 20));
}

function handleGameOver() {
  gameState = STATE.GAMEOVER;
  sounds.playCrash();

  // Crash particles explosion
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 1;
    particles.push({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.5 ? '#00f0ff' : '#ff007f',
      size: Math.random() * 4 + 2,
      life: 1.0,
      decay: 0.03
    });
  }

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('cyber_dino_hi', highScore);
    highScoreEl.textContent = String(highScore).padStart(5, '0');
  }

  // Show Game Over UI
  statusIcon.textContent = '💥';
  overlayTitle.textContent = 'SYSTEM OVERLOAD';
  overlaySubtitle.textContent = `Score: ${score} | High: ${highScore}`;
  startBtn.textContent = 'TRY AGAIN';
  overlay.classList.remove('hidden');
}

function loop(currentTime) {
  if (gameState !== STATE.RUNNING) return;

  const delta = currentTime - lastTime;
  lastTime = currentTime;

  // Background & Ground
  drawBackground(ctx, gameSpeed);
  drawGround(ctx, gameSpeed);

  // Score & Speed Scaling
  distance += gameSpeed * 0.04;
  const oldScore = score;
  score = Math.floor(distance);

  if (score !== oldScore) {
    currentScoreEl.textContent = String(score).padStart(5, '0');

    // Milestone sound every 100 points
    if (score > 0 && score % 100 === 0) {
      sounds.playScoreMilestone();
    }
  }

  // Gradual speed increase
  gameSpeed = Math.min(15, 6 + Math.floor(score / 120) * 0.6);

  // Obstacle Spawning
  spawnTimer--;
  if (spawnTimer <= 0) {
    spawnObstacle();
    // Random gap based on speed
    const baseInterval = Math.max(38, Math.floor(minSpawnInterval - gameSpeed * 2));
    spawnTimer = baseInterval + Math.floor(Math.random() * 45);
  }

  // Obstacles update & render
  const dinoHitbox = player.getBounds();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.update(gameSpeed);
    obs.draw(ctx);

    // Collision check
    if (checkCollision(dinoHitbox, obs.getBounds())) {
      handleGameOver();
      // Render one last frame with crash particles
      updateParticles(ctx);
      return;
    }

    if (obs.markedForRemoval) {
      obstacles.splice(i, 1);
    }
  }

  // Dino update & render
  player.update();
  player.draw(ctx);

  // Particles
  updateParticles(ctx);

  animationId = requestAnimationFrame(loop);
}

// User Actions
function startGame() {
  sounds.init();
  resetGame();
  gameState = STATE.RUNNING;
  overlay.classList.add('hidden');
  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function togglePause() {
  if (gameState === STATE.RUNNING) {
    gameState = STATE.PAUSED;
    statusIcon.textContent = '⏸️';
    overlayTitle.textContent = 'PAUSED';
    overlaySubtitle.textContent = 'Press P or Click Resume to continue';
    startBtn.textContent = 'RESUME';
    overlay.classList.remove('hidden');
  } else if (gameState === STATE.PAUSED) {
    gameState = STATE.RUNNING;
    overlay.classList.add('hidden');
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }
}

// Event Listeners: Keyboard
const keysPressed = {};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (gameState === STATE.START || gameState === STATE.GAMEOVER) {
      startGame();
    } else if (gameState === STATE.RUNNING) {
      player.jump();
    }
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (gameState === STATE.RUNNING) {
      player.duck(true);
    }
  } else if (e.code === 'KeyP') {
    togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    if (gameState === STATE.RUNNING) {
      player.duck(false);
    }
  }
});

// UI Buttons
startBtn.addEventListener('click', () => {
  if (gameState === STATE.PAUSED) {
    togglePause();
  } else {
    startGame();
  }
});

// Touch / Mobile Controls
touchJumpBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  sounds.init();
  if (gameState === STATE.START || gameState === STATE.GAMEOVER) {
    startGame();
  } else if (gameState === STATE.RUNNING) {
    player.jump();
  }
});

touchDuckBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  sounds.init();
  if (gameState === STATE.RUNNING) {
    player.duck(true);
  }
});

touchDuckBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (gameState === STATE.RUNNING) {
    player.duck(false);
  }
});

// Mouse click on canvas to jump
canvas.addEventListener('mousedown', () => {
  sounds.init();
  if (gameState === STATE.START || gameState === STATE.GAMEOVER) {
    startGame();
  } else if (gameState === STATE.RUNNING) {
    player.jump();
  }
});

// Initial canvas draw (preview frame)
drawBackground(ctx, 0);
drawGround(ctx, 0);
player.draw(ctx);
