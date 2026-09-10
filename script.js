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
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration
    );

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
  document
    .getElementById("deviceSwitchMobile")
    .classList.toggle("active", deviceMode === "mobile");

  document
    .getElementById("deviceSwitchPc")
    .classList.toggle("active", deviceMode === "pc");
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
  closeModal(
    document.getElementById("playDifficultyModal"),
    () => mainMenu.classList.remove("hidden")
  );
}

function chooseDifficultyAndPlay(level) {
  setDifficulty(level);

  closeModal(
    document.getElementById("playDifficultyModal"),
    startGame
  );
}

// ===== Settings & Leaderboard =====
function openSettings() {
  openModal(settingsModal);
  syncSoundToggleUI();
  syncDeviceSwitchUI();

  if (isPlaying) pauseGame();
}

function closeSettings() {
  closeModal(settingsModal);
}

gearBtn.addEventListener("click", openSettings);

function openLeaderboard() {
  leaderboardValueEl.innerText = highScore;
  openModal(leaderboardModal);
}

function closeLeaderboard() {
  closeModal(leaderboardModal);
}

function openCredits() {
  openModal(document.getElementById("creditsModal"));
}

function closeCredits() {
  closeModal(document.getElementById("creditsModal"));
}

// ===== Achievement toast =====
let toastTimeoutId = null;

function showToast(text) {
  const toastEl = document.getElementById("achievementToast");

  clearTimeout(toastTimeoutId);

  toastEl.textContent = text;
  toastEl.classList.add("show");

  toastTimeoutId = setTimeout(
    () => toastEl.classList.remove("show"),
    2200
  );
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
  popups.push({
    x,
    y,
    text,
    color,
    life: 1
  });
}

function updateAndDrawPopups(dt) {
  ctx.save();

  ctx.font = "bold 13px Poppins, sans-serif";
  ctx.textAlign = "center";

  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];

    p.y -= dt * 0.03;
    p.life -= dt * 0.0016;

    if (p.life <= 0) {
      popups.splice(i, 1);
      continue;
    }

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
    easy: {
      border: "rgba(34, 197, 94, 0.7)",
      glow: "rgba(34, 197, 94, 0.18)"
    },
    normal: {
      border: "rgba(255, 179, 0, 0.72)",
      glow: "rgba(255, 179, 0, 0.18)"
    },
    hard: {
      border: "rgba(239, 68, 68, 0.72)",
      glow: "rgba(239, 68, 68, 0.2)"
    }
  };

  const theme = arenaThemes[level];

  document.documentElement.style.setProperty(
    "--arena-border",
    theme.border
  );

  document.documentElement.style.setProperty(
    "--arena-glow",
    theme.glow
  );

  document.querySelectorAll(".diffBtn").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.diff === level
    );
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
  nextHazardAt =
    performance.now() + 5000 + Math.random() * 3000;

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

    if (deviceMode === "mobile") {
      showSwipeHintTemporarily();
    }
  });

  if (!renderLoopId) {
    renderLoopId = requestAnimationFrame(renderLoop);
  }
}
