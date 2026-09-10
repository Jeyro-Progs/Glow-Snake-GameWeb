const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const box = 22;

const deviceSelect = document.getElementById("deviceSelect");
const swipeHint = document.getElementById("swipeHint");
const mainMenu = document.getElementById("mainMenu");
const gameOverScreen = document.getElementById("gameOverScreen");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownText = document.getElementById("countdownText");
const pauseOverlay = document.getElementById("pauseOverlay");
const bestScorePanel = document.getElementById("bestScorePanel");
const bestScoreValue = document.getElementById("bestScoreValue");
const controlsHint = document.getElementById("controlsHint");
const cornerLabel = document.getElementById("cornerLabel");
const cornerValue = document.getElementById("cornerValue");
const finalScoreEl = document.getElementById("finalScore");
const newRecordText = document.getElementById("newRecordText");
const pauseBtn = document.getElementById("pauseBtn");
const soundBtn = document.getElementById("soundBtn");
const gearBtn = document.getElementById("gearBtn");
const settingsModal = document.getElementById("settingsModal");
const leaderboardModal = document.getElementById("leaderboardModal");
const leaderboardValueEl = document.getElementById("leaderboardValue");
const pauseIcon = document.getElementById("pauseIcon");
const resumeIcon = document.getElementById("resumeIcon");
const soundIconOn = document.getElementById("soundIconOn");
const soundIconOff = document.getElementById("soundIconOff");
const shieldBadge = document.getElementById("shieldBadge");
const shieldTimeText = document.getElementById("shieldTimeText");
const hazardFlash = document.getElementById("hazardFlash");

let snake, prevSnake, direction, food, score;
let particles = [];
let popups = [];
let foodType = "normal";
let foodSpawnTime = 0;
let foodLifespan = 5000;
let comboCount = 0;
let lastEatTime = 0;
const COMBO_WINDOW = 2600;
const achievedMilestones = new Set();
const milestones = [10, 20, 35, 50, 75, 100];
let lastFrameTime = performance.now();
let moveTimer = null;
let renderLoopId = null;
let lastTickTime = 0;
let isPlaying = false;
let isPaused = false;
let menuOpen = true;
let countdownGen = 0;
let countdownTimeoutId = null;
let isCountdownActive = false;
let swipeHintTimeoutId = null;
let difficulty = "normal";
let muted = false;
let deviceMode = localStorage.getItem("jeysnakeDevice") || null;
const speedMap = { easy: 220, normal: 160, hard: 100 };
let currentSpeed = speedMap.normal;
let highScore = Number(localStorage.getItem("snakeHighScore")) || 0;

// ----- Unique mechanic: Shield power-up (temporary invincibility + wall wrap) -----
let shieldActive = false;
let shieldUntil = 0;

// ----- Unique mechanic: Hazard / poison food (avoid it!) -----
let hazard = null; // { x, y, spawnTime, expireTime }
let nextHazardAt = 0;

updateScoreDisplays();
setDifficulty(difficulty);

// ===== Device selection =====
function applyDeviceMode(mode) {
  deviceMode = mode;
  document.body.classList.toggle("mode-mobile", mode === "mobile");
  document.body.classList.toggle("mode-pc", mode === "pc");
}

function selectDevice(mode) {
  localStorage.setItem("jeysnakeDevice", mode);
  applyDeviceMode(mode);
  deviceSelect.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  document.body.classList.add("menu-open");
}

if (deviceMode) {
  applyDeviceMode(deviceMode);
  deviceSelect.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  document.body.classList.add("menu-open");
}

// ===== Sound (WebAudio) =====
let audioCtx = null;
function beep(freq, duration, type = "sine") {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

soundBtn.addEventListener("click", () => {
  muted = !muted;
  soundIconOn.classList.toggle("hidden", muted);
  soundIconOff.classList.toggle("hidden", !muted);
  syncSoundToggleUI();
});

function toggleSound() {
  muted = !muted;
  soundIconOn.classList.toggle("hidden", muted);
  soundIconOff.classList.toggle("hidden", !muted);
  syncSoundToggleUI();
}

function syncSoundToggleUI() {
  document.getElementById("soundToggle").classList.toggle("on", !muted);
}

function switchDeviceInline(mode) {
  localStorage.setItem("jeysnakeDevice", mode);
  applyDeviceMode(mode);
  syncDeviceSwitchUI();
  if (isPlaying || isPaused) {
    if (mode === "mobile") {
      if (isPlaying) showSwipeHintTemporarily();
      controlsHint.classList.add("hidden");
    } else {
      controlsHint.classList.remove("hidden");
      swipeHint.classList.add("hidden");
    }
  }
}

function syncDeviceSwitchUI() {
  document.getElementById("deviceSwitchMobile").classList.toggle("active", deviceMode === "mobile");
  document.getElementById("deviceSwitchPc").classList.toggle("active", deviceMode === "pc");
}

function openModal(modal) {
  modal.classList.remove("modalClosing");
  modal.classList.remove("hidden");
}

function closeModal(modal, onClosed) {
  modal.classList.add("modalClosing");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("modalClosing");
    if (onClosed) onClosed();
  }, 240);
}

// ===== Difficulty picker (shown before every Play) =====
function openPlayDifficulty() {
  hideFullScreens();
  openModal(document.getElementById("playDifficultyModal"));
}
function closePlayDifficulty() {
  closeModal(document.getElementById("playDifficultyModal"), () => mainMenu.classList.remove("hidden"));
}
function chooseDifficultyAndPlay(level) {
  setDifficulty(level);
  closeModal(document.getElementById("playDifficultyModal"), startGame);
}

// ===== Settings & Leaderboard =====
function openSettings() {
  openModal(settingsModal);
  syncSoundToggleUI();
  syncDeviceSwitchUI();
  if (isPlaying) pauseGame();
}
function closeSettings() { closeModal(settingsModal); }
gearBtn.addEventListener("click", openSettings);

function openLeaderboard() {
  leaderboardValueEl.innerText = highScore;
  openModal(leaderboardModal);
}
function closeLeaderboard() { closeModal(leaderboardModal); }

function openCredits() { openModal(document.getElementById("creditsModal")); }
function closeCredits() { closeModal(document.getElementById("creditsModal")); }

// ===== Achievement toast =====
let toastTimeoutId = null;
function showToast(text) {
  const toastEl = document.getElementById("achievementToast");
  clearTimeout(toastTimeoutId);
  toastEl.textContent = text;
  toastEl.classList.add("show");
  toastTimeoutId = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function checkMilestones() {
  for (const m of milestones) {
    if (score >= m && !achievedMilestones.has(m)) {
      achievedMilestones.add(m);
      showToast("🏅 Score " + m + " reached!");
      break;
    }
  }
}

// ===== Floating popup text (combo/bonus/penalty) =====
function spawnPopup(x, y, text, color) {
  popups.push({ x, y, text, color, life: 1 });
}

function updateAndDrawPopups(dt) {
  ctx.save();
  ctx.font = "bold 13px Poppins, sans-serif";
  ctx.textAlign = "center";
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.y -= dt * 0.03;
    p.life -= dt * 0.0016;
    if (p.life <= 0) { popups.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function setDifficulty(level) {
  difficulty = level;
  const arenaThemes = {
    easy: { border: "rgba(34, 197, 94, 0.7)", glow: "rgba(34, 197, 94, 0.18)" },
    normal: { border: "rgba(255, 179, 0, 0.72)", glow: "rgba(255, 179, 0, 0.18)" },
    hard: { border: "rgba(239, 68, 68, 0.72)", glow: "rgba(239, 68, 68, 0.2)" }
  };
  const theme = arenaThemes[level];
  document.documentElement.style.setProperty("--arena-border", theme.border);
  document.documentElement.style.setProperty("--arena-glow", theme.glow);
  document.querySelectorAll(".diffBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.diff === level);
  });
}

function updateScoreDisplays() {
  if (menuOpen) {
    cornerLabel.innerText = "High Score";
    cornerValue.innerText = highScore;
  } else {
    cornerLabel.innerText = "Score";
    cornerValue.innerText = score || 0;
  }
  bestScoreValue.innerText = highScore;
}

function hideFullScreens() {
  mainMenu.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  countdownOverlay.style.display = "none";
  pauseOverlay.classList.add("hidden");
}

function showMainMenu() {
  isPlaying = false;
  isPaused = false;
  menuOpen = true;
  document.body.classList.add("menu-open");
  countdownGen++;
  isCountdownActive = false;
  clearTimeout(countdownTimeoutId);
  clearTimeout(swipeHintTimeoutId);
  clearInterval(moveTimer);
  hideFullScreens();
  settingsModal.classList.add("hidden");
  leaderboardModal.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  bestScorePanel.classList.add("hidden");
  controlsHint.classList.add("hidden");
  swipeHint.classList.add("hidden");
  pauseBtn.classList.add("hidden");
  soundBtn.classList.remove("hidden");
  shieldBadge.classList.add("hidden");
  document.getElementById("gameWrapper").style.visibility = "hidden";
  updateScoreDisplays();
}

function startGame() {
  settingsModal.classList.add("hidden");
  hideFullScreens();
  menuOpen = false;
  document.body.classList.remove("menu-open");
  bestScorePanel.classList.remove("hidden");
  pauseBtn.classList.remove("hidden");
  soundBtn.classList.add("hidden");
  pauseIcon.classList.remove("hidden");
  resumeIcon.classList.add("hidden");

  if (deviceMode === "mobile") {
    swipeHint.classList.add("hidden");
    controlsHint.classList.add("hidden");
  } else {
    controlsHint.classList.remove("hidden");
    swipeHint.classList.add("hidden");
  }

  const gameWrapperEl = document.getElementById("gameWrapper");
  gameWrapperEl.style.visibility = "visible";
  gameWrapperEl.classList.remove("gameOverExit");
  gameWrapperEl.classList.remove("startPop");
  void gameWrapperEl.offsetWidth;
  gameWrapperEl.classList.add("startPop");

  const sweepEl = document.getElementById("arenaSweep");
  sweepEl.classList.remove("playSweep");
  void sweepEl.offsetWidth;
  sweepEl.classList.add("playSweep");

  snake = [{ x: 9 * box, y: 9 * box }];
  prevSnake = [{ x: 9 * box, y: 9 * box }];
  direction = null;
  score = 0;
  particles = [];
  popups = [];
  comboCount = 0;
  lastEatTime = 0;
  achievedMilestones.clear();
  shieldActive = false;
  shieldUntil = 0;
  shieldBadge.classList.add("hidden");
  canvas.classList.remove("shielded");
  hazard = null;
  nextHazardAt = performance.now() + 5000 + Math.random() * 3000;
  currentSpeed = speedMap[difficulty];
  updateScoreDisplays();
  spawnFood();

  clearInterval(moveTimer);
  isPlaying = false;
  isPaused = false;

  runCountdown(() => {
    lastTickTime = performance.now();
    moveTimer = setInterval(tick, currentSpeed);
    isPlaying = true;
    if (deviceMode === "mobile") showSwipeHintTemporarily();
  });

  if (!renderLoopId) renderLoopId = requestAnimationFrame(renderLoop);
}

function pauseGame() {
  if (!isPlaying || isPaused) return;
  isPaused = true;
  clearInterval(moveTimer);
  pauseOverlay.classList.remove("hidden");
  pauseIcon.classList.add("hidden");
  resumeIcon.classList.remove("hidden");
  if (deviceMode === "mobile") swipeHint.classList.add("hidden");
}

function showSwipeHintTemporarily() {
  clearTimeout(swipeHintTimeoutId);
  swipeHint.classList.remove("hidden");
  swipeHintTimeoutId = setTimeout(() => swipeHint.classList.add("hidden"), 5000);
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  pauseOverlay.classList.add("hidden");
  lastTickTime = performance.now();
  moveTimer = setInterval(tick, currentSpeed);
  pauseIcon.classList.remove("hidden");
  resumeIcon.classList.add("hidden");
}

pauseBtn.addEventListener("click", () => {
  if (isPaused) resumeGame(); else pauseGame();
});

function runCountdown(callback) {
  const steps = ["3", "2", "1", "GO!"];
  clearTimeout(countdownTimeoutId);
  isCountdownActive = true;
  const gen = ++countdownGen;
  let idx = 0;

  countdownOverlay.style.display = "flex";

  function showNext() {
    if (gen !== countdownGen) return;
    if (idx >= steps.length) {
      countdownOverlay.style.display = "none";
      isCountdownActive = false;
      foodSpawnTime = performance.now() - 250;
      callback();
      return;
    }
    countdownText.textContent = steps[idx];
    countdownText.classList.remove("popAnim");
    void countdownText.offsetWidth;
    countdownText.classList.add("popAnim");
    idx++;
    countdownTimeoutId = setTimeout(showNext, 600);
  }
  showNext();
}

function spawnFood() {
  let newFood, isOnSnake, isOnHazard;
  do {
    newFood = {
      x: Math.floor(Math.random() * (canvas.width / box)) * box,
      y: Math.floor(Math.random() * (canvas.height / box)) * box
    };
    isOnSnake = snake.some(seg => seg.x === newFood.x && seg.y === newFood.y);
    isOnHazard = hazard && hazard.x === newFood.x && hazard.y === newFood.y;
  } while (isOnSnake || isOnHazard);
  food = newFood;

  // Rare special food: Golden Apple (bonus points, time-limited) or Shield (temporary invincibility)
  const roll = Math.random();
  if (roll < 0.16) foodType = "golden";
  else if (roll < 0.24) foodType = "shield";
  else foodType = "normal";

  foodSpawnTime = performance.now();
  foodLifespan = 5000;
}

function spawnHazard() {
  let hx, hy, clash;
  let tries = 0;
  do {
    hx = Math.floor(Math.random() * (canvas.width / box)) * box;
    hy = Math.floor(Math.random() * (canvas.height / box)) * box;
    clash = snake.some(seg => seg.x === hx && seg.y === hy) || (food && food.x === hx && food.y === hy);
    tries++;
  } while (clash && tries < 30);
  const now = performance.now();
  hazard = { x: hx, y: hy, spawnTime: now, expireTime: now + 4500 };
}

document.addEventListener("keydown", changeDirection);

function trySetDirection(dir) {
  if (isPaused) return;
  if (dir === "LEFT" && direction !== "RIGHT") direction = "LEFT";
  else if (dir === "UP" && direction !== "DOWN") direction = "UP";
  else if (dir === "RIGHT" && direction !== "LEFT") direction = "RIGHT";
  else if (dir === "DOWN" && direction !== "UP") direction = "DOWN";
}

function changeDirection(event) {
  const key = event.key;
  if (key === "Escape") {
    if (!menuOpen) showMainMenu();
    return;
  }
  if (key === " " && isPlaying) {
    if (isPaused) resumeGame(); else pauseGame();
    return;
  }
  if ((key === "ArrowLeft" || key === "a")) trySetDirection("LEFT");
  else if ((key === "ArrowUp" || key === "w")) trySetDirection("UP");
  else if ((key === "ArrowRight" || key === "d")) trySetDirection("RIGHT");
  else if ((key === "ArrowDown" || key === "s")) trySetDirection("DOWN");
}

// ===== Swipe controls (mobile) — continuous detection for responsiveness =====
let touchStartX = 0, touchStartY = 0;
const SWIPE_THRESHOLD = 18;

document.addEventListener("touchstart", (e) => {
  if (deviceMode !== "mobile" || !isPlaying || isPaused) return;
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

document.addEventListener("touchmove", (e) => {
  if (deviceMode !== "mobile" || !isPlaying || isPaused) return;
  e.preventDefault();
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    trySetDirection(dx > 0 ? "RIGHT" : "LEFT");
  } else {
    trySetDirection(dy > 0 ? "DOWN" : "UP");
  }

  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: false });

// ===== Unique mechanic: progressive speed ramp based on score =====
function computeSpeedForScore() {
  const base = speedMap[difficulty];
  const reduction = Math.floor(score / 5) * 7;
  return Math.max(base - reduction, Math.floor(base * 0.45));
}

function applySpeedIfChanged() {
  const newSpeed = computeSpeedForScore();
  if (newSpeed !== currentSpeed) {
    const sped = newSpeed < currentSpeed;
    currentSpeed = newSpeed;
    if (isPlaying && !isPaused) {
      clearInterval(moveTimer);
      moveTimer = setInterval(tick, currentSpeed);
    }
    if (sped) showToast("🚀 Speed Up!");
  }
}

function tick() {
  const now = performance.now();

  if (!direction) {
    lastTickTime = now;
    return;
  }

  // Golden/shield food expires if not eaten in time -> respawn
  if ((foodType === "golden" || foodType === "shield") && now - foodSpawnTime > foodLifespan) {
    spawnFood();
  }

  // Hazard lifecycle: spawn periodically, expire if not eaten
  if (!hazard && now >= nextHazardAt) {
    spawnHazard();
  } else if (hazard && now > hazard.expireTime) {
    hazard = null;
    nextHazardAt = now + 5000 + Math.random() * 4000;
  }

  // Shield expiry
  if (shieldActive && now > shieldUntil) {
    shieldActive = false;
    canvas.classList.remove("shielded");
    shieldBadge.classList.add("hidden");
  }

  prevSnake = snake.map(seg => ({ x: seg.x, y: seg.y }));

  let headX = snake[0].x;
  let headY = snake[0].y;

  if (direction === "LEFT") headX -= box;
  if (direction === "UP") headY -= box;
  if (direction === "RIGHT") headX += box;
  if (direction === "DOWN") headY += box;

  // Shield lets the snake wrap around the arena edges instead of dying
  if (shieldActive) {
    if (headX < 0) headX = canvas.width - box;
    else if (headX >= canvas.width) headX = 0;
    if (headY < 0) headY = canvas.height - box;
    else if (headY >= canvas.height) headY = 0;
  }

  const ateFood = headX === food.x && headY === food.y;
  const hitHazard = hazard && headX === hazard.x && headY === hazard.y;

  if (ateFood) {
    const isGolden = foodType === "golden";
    const isShield = foodType === "shield";

    if (now - lastEatTime < COMBO_WINDOW) comboCount++;
    else comboCount = 1;
    lastEatTime = now;

    const basePoints = isGolden ? 3 : (isShield ? 2 : 1);
    const comboBonus = comboCount >= 2 ? comboCount - 1 : 0;
    score += basePoints + comboBonus;

    updateScoreDisplays();
    cornerValue.classList.remove("scorePop");
    void cornerValue.offsetWidth;
    cornerValue.classList.add("scorePop");

    if (isShield) {
      shieldActive = true;
      shieldUntil = now + 4500;
      canvas.classList.add("shielded");
      shieldBadge.classList.remove("hidden");
      spawnParticles(food.x + box / 2, food.y + box / 2, "shield");
      spawnPopup(food.x + box / 2, food.y, "SHIELD!", "#67e8f9");
      beep(520, 0.16, "triangle");
    } else {
      spawnParticles(food.x + box / 2, food.y + box / 2, isGolden ? "golden" : "normal");
      beep(isGolden ? 880 : 660, isGolden ? 0.18 : 0.12, "square");
      if (isGolden) spawnPopup(food.x + box / 2, food.y, "BONUS +" + basePoints, "#ffd54f");
    }
    if (comboBonus > 0) {
      spawnPopup(food.x + box / 2, food.y - 14, "Combo x" + comboCount + "!", "#4ade80");
    }

    checkMilestones();
    applySpeedIfChanged();
    spawnFood();
    prevSnake.push({ ...prevSnake[prevSnake.length - 1] });
  }

  const newHead = { x: headX, y: headY };
  const hitWall = !shieldActive && (headX < 0 || headX >= canvas.width || headY < 0 || headY >= canvas.height);
  const hitSelf = !shieldActive && snake.some(seg => seg.x === headX && seg.y === headY);

  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(newHead);
  if (!ateFood) snake.pop();

  // Hazard penalty: score loss + shrink, avoid it!
  if (hitHazard) {
    score = Math.max(0, score - 2);
    updateScoreDisplays();
    cornerValue.classList.remove("scoreDrop");
    void cornerValue.offsetWidth;
    cornerValue.classList.add("scoreDrop");
    if (snake.length > 3) snake.pop();
    spawnParticles(hazard.x + box / 2, hazard.y + box / 2, "hazard");
    spawnPopup(hazard.x + box / 2, hazard.y, "-2", "#ef4444");
    beep(140, 0.22, "sawtooth");
    hazardFlash.classList.remove("flashActive");
    void hazardFlash.offsetWidth;
    hazardFlash.classList.add("flashActive");
    applySpeedIfChanged();
    hazard = null;
    nextHazardAt = now + 5000 + Math.random() * 4000;
  }

  lastTickTime = now;
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += box) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += box) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFood(x, y, t) {
  const spawnElapsed = t - foodSpawnTime;
  const spawnGrow = Math.min(1, spawnElapsed / 200);
  const spawnScale = spawnGrow < 1 ? (0.2 + 0.8 * (1 - Math.pow(1 - spawnGrow, 3))) : 1;

  if (foodType === "golden" || foodType === "shield") {
    const remaining = Math.max(0, 1 - (t - foodSpawnTime) / foodLifespan);
    const pulse = 1 + Math.sin(t / 140) * 0.12;
    const size = (box - 6) * pulse * (0.7 + remaining * 0.3) * spawnScale;
    const offset = (box - size) / 2;
    const cx = x + box / 2;
    const cy = y + box / 2;
    const color = foodType === "golden" ? "#ffd54f" : "#22d3ee";
    const ringColor = foodType === "golden" ? "rgba(255, 213, 79, 0.55)" : "rgba(34, 211, 238, 0.6)";

    ctx.save();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, box / 2 + 2, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
    ctx.stroke();

    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    if (foodType === "shield") {
      // diamond shape for shield power-up
      ctx.beginPath();
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx + size / 2, cy);
      ctx.lineTo(cx, cy + size / 2);
      ctx.lineTo(cx - size / 2, cy);
      ctx.closePath();
      ctx.fill();
    } else {
      roundedRect(x + offset, y + offset, size, size, 6);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const pulse = 1 + Math.sin(t / 260) * 0.08;
  const size = (box - 6) * pulse * spawnScale;
  const offset = (box - size) / 2;

  ctx.save();
  ctx.shadowColor = "#4ade80";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#4ade80";
  roundedRect(x + offset, y + offset, size, size, 6);
  ctx.fill();
  ctx.restore();
}

function drawHazard(x, y, t) {
  if (!hazard) return;
  const spawnElapsed = t - hazard.spawnTime;
  const spawnGrow = Math.min(1, spawnElapsed / 200);
  const spawnScale = spawnGrow < 1 ? (0.2 + 0.8 * (1 - Math.pow(1 - spawnGrow, 3))) : 1;
  const totalLife = hazard.expireTime - hazard.spawnTime;
  const remaining = Math.max(0, 1 - (t - hazard.spawnTime) / totalLife);
  const pulse = 1 + Math.sin(t / 130) * 0.1;
  const size = (box - 6) * pulse * spawnScale;
  const offset = (box - size) / 2;
  const cx = x + box / 2;
  const cy = y + box / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, box / 2 + 2, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
  ctx.stroke();

  ctx.shadowColor = "#ef4444";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#7f1d1d";
  roundedRect(x + offset, y + offset, size, size, 6);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.font = Math.max(8, box * 0.55 * spawnScale) + "px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☠", cx, cy + 1);
  ctx.restore();
}

function spawnParticles(x, y, kind) {
  const palette = {
    golden: ["#ffd54f", "#ffb300", "#ffffff", "#fff3c4"],
    shield: ["#22d3ee", "#67e8f9", "#ffffff", "#a5f3fc"],
    hazard: ["#ef4444", "#7f1d1d", "#ffffff", "#fca5a5"],
    normal: ["#4ade80", "#22c55e", "#ffffff", "#a7f3d0"]
  };
  const colors = palette[kind] || palette.normal;
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
    const speed = 1 + Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 2 + Math.random() * 2
    });
  }
}

function updateAndDrawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt * 0.06;
    p.y += p.vy * dt * 0.06;
    p.vy += 0.01 * dt * 0.06;
    p.life -= dt * 0.0022;

    if (p.life <= 0) { particles.splice(i, 1); continue; }

    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawSnake(t) {
  const interp = [];
  for (let i = 0; i < snake.length; i++) {
    const cur = snake[i];
    const prev = prevSnake[i] || cur;
    interp.push({
      x: prev.x + (cur.x - prev.x) * t,
      y: prev.y + (cur.y - prev.y) * t
    });
  }

  const now = performance.now();

  ctx.save();
  if (shieldActive) {
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 18;
  } else {
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 10;
  }

  for (let i = interp.length - 1; i >= 0; i--) {
    const seg = interp[i];
    const isHead = i === 0;
    const pad = isHead ? 0 : 1;

    const wave = Math.sin(now / 180 - i * 0.9) * (isHead ? 0 : 1.2);
    const wx = seg.x + (direction === "UP" || direction === "DOWN" ? wave : 0);
    const wy = seg.y + (direction === "LEFT" || direction === "RIGHT" ? wave : 0);

    if (shieldActive) {
      ctx.fillStyle = isHead ? "#a5f3fc" : "#22d3ee";
    } else {
      ctx.fillStyle = isHead ? "#4ade80" : "#22c55e";
    }
    roundedRect(wx + pad, wy + pad, box - pad * 2, box - pad * 2, isHead ? 7 : 6);
    ctx.fill();
  }
  ctx.restore();

  if (interp.length > 0) {
    const head = interp[0];
    const cx = head.x + box / 2;
    const cy = head.y + box / 2;
    let eyeOffset = { x: 5, y: -5 };
    if (direction === "LEFT") eyeOffset = { x: -5, y: 0 };
    else if (direction === "RIGHT") eyeOffset = { x: 5, y: 0 };
    else if (direction === "UP") eyeOffset = { x: 0, y: -5 };
    else if (direction === "DOWN") eyeOffset = { x: 0, y: 5 };

    ctx.fillStyle = "#06210f";
    ctx.beginPath();
    ctx.arc(cx + eyeOffset.x * 0.6, cy + eyeOffset.y * 0.6, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderLoop(now) {
  if (menuOpen) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (countdownOverlay.style.display !== "none") countdownOverlay.style.display = "none";
    renderLoopId = requestAnimationFrame(renderLoop);
    return;
  }

  ctx.fillStyle = "#0a0f1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  if (hazard) drawHazard(hazard.x, hazard.y, now);
  if (food) drawFood(food.x, food.y, isCountdownActive ? foodSpawnTime + 250 : now);
  if (snake) {
    const t = (isPlaying && !isPaused) ? Math.min(1, (now - lastTickTime) / currentSpeed) : 1;
    drawSnake(t);
  }

  if (shieldActive) {
    const remainingMs = Math.max(0, shieldUntil - now);
    shieldTimeText.textContent = (remainingMs / 1000).toFixed(1) + "s";
  }

  const dt = now - lastFrameTime;
  lastFrameTime = now;
  if (particles.length) updateAndDrawParticles(dt);
  if (popups.length) updateAndDrawPopups(dt);

  renderLoopId = requestAnimationFrame(renderLoop);
}
renderLoopId = requestAnimationFrame(renderLoop);

function endGame() {
  isPlaying = false;
  isPaused = false;
  clearInterval(moveTimer);
  beep(160, 0.35, "sawtooth");

  const gameWrapperEl = document.getElementById("gameWrapper");
  gameWrapperEl.classList.remove("shake");
  void gameWrapperEl.offsetWidth;
  gameWrapperEl.classList.add("shake");

  let isNewRecord = false;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("snakeHighScore", highScore);
    isNewRecord = true;
  }

  finalScoreEl.innerText = score;
  newRecordText.classList.toggle("hidden", !isNewRecord);

  hideFullScreens();
  bestScorePanel.classList.add("hidden");
  controlsHint.classList.add("hidden");
  swipeHint.classList.add("hidden");
  pauseBtn.classList.add("hidden");
  soundBtn.classList.remove("hidden");
  shieldBadge.classList.add("hidden");
  canvas.classList.remove("shielded");
  menuOpen = true;
  updateScoreDisplays();

  setTimeout(() => {
    gameWrapperEl.classList.remove("shake");
    gameWrapperEl.classList.add("gameOverExit");
    gameOverScreen.classList.remove("hidden");
    gameOverScreen.classList.remove("gameOverReveal");
    void gameOverScreen.offsetWidth;
    gameOverScreen.classList.add("gameOverReveal");
  }, 220);

  setTimeout(() => {
    gameWrapperEl.style.visibility = "hidden";
  }, 660);
}
