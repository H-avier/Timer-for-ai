const WORK_DURATION_SECONDS = 30; // 30 seconds for testing/demo
const BREAK_DURATION_SECONDS = 30; // 30 seconds break

const state = {
  timerId: null,
  isRunning: false,
  isPaused: false,
  phase: 'work',
  currentSeconds: WORK_DURATION_SECONDS,
  totalSeconds: WORK_DURATION_SECONDS,
  sessionsCompleted: 0,
  audioContext: null,
  audioUnlocked: false,
};

const elements = {
  modeLabel: null,
  timeLabel: null,
  startButton: null,
  pauseButton: null,
  resumeButton: null,
  resetButton: null,
  sessionCount: null,
  progressCircle: null,
};

function initializeApp() {
  cacheElements();
  state.sessionsCompleted = loadSessionCount();
  updateDisplay(state.currentSeconds);
  updateSessionCounter();
  setButtonStates(false, false);
  attachEventListeners();
}

function cacheElements() {
  elements.modeLabel = document.getElementById('mode-label');
  elements.timeLabel = document.getElementById('time-label');
  elements.startButton = document.getElementById('start-button');
  elements.pauseButton = document.getElementById('pause-button');
  elements.resumeButton = document.getElementById('resume-button');
  elements.resetButton = document.getElementById('reset-button');
  elements.sessionCount = document.getElementById('session-count');
  elements.progressCircle = document.querySelector('.progress-circle');
}

function attachEventListeners() {
  elements.startButton.addEventListener('click', () => {
    unlockAudio();
    startTimer(state.totalSeconds);
  });
  elements.pauseButton.addEventListener('click', pauseTimer);
  elements.resumeButton.addEventListener('click', resumeTimer);
  elements.resetButton.addEventListener('click', resetTimer);
}

function unlockAudio() {
  if (state.audioUnlocked) {
    return;
  }
  
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // Resume audio context if suspended (required by browsers)
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
  
  state.audioUnlocked = true;
}

function playBeepWorkToBreak() {
  if (!state.audioContext || !state.audioUnlocked) {
    return;
  }
  
  const ctx = state.audioContext;
  const now = ctx.currentTime;
  
  // Create oscillator for a high-pitched beep (800 Hz)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 800;
  
  // Create gain for volume control
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  
  // Connect and play
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

function playBeepBreakToWork() {
  if (!state.audioContext || !state.audioUnlocked) {
    return;
  }
  
  const ctx = state.audioContext;
  const now = ctx.currentTime;
  
  // Create oscillator for a lower-pitched beep (600 Hz)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 600;
  
  // Create gain for volume control
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  
  // Connect and play
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

function loadSessionCount() {
  try {
    const raw = localStorage.getItem('sessionsCompleted');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

function saveSessionCount(count) {
  try {
    localStorage.setItem('sessionsCompleted', String(count));
  } catch (e) {
    // ignore storage errors
  }
}

function startTimer(duration) {
  if (state.isRunning) {
    return;
  }

  const wasResuming = state.isPaused;

  state.totalSeconds = duration;
  
  // Only reset currentSeconds if we're not resuming from pause
  if (!wasResuming) {
    state.currentSeconds = duration;
  }
  
  updateDisplay(state.currentSeconds);
  setButtonStates(true, false);

  state.timerId = setInterval(tick, 1000);
}

function pauseTimer() {
  if (!state.isRunning) {
    return;
  }
  
  clearInterval(state.timerId);
  state.timerId = null;
  setButtonStates(false, true);
}

function resumeTimer() {
  if (!state.isPaused) {
    return;
  }
  
  setButtonStates(true, false);
  state.timerId = setInterval(tick, 1000);
}

function resetTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
  state.phase = 'work';
  state.currentSeconds = WORK_DURATION_SECONDS;
  state.totalSeconds = WORK_DURATION_SECONDS;
  elements.modeLabel.textContent = 'Work';
  elements.progressCircle.style.strokeDashoffset = 0;
  updateDisplay(state.currentSeconds);
  setButtonStates(false, false);
}

function tick() {
  if (!state.isRunning || state.isPaused) {
    return;
  }

  state.currentSeconds -= 1;
  if (state.currentSeconds < 0) {
    state.currentSeconds = 0;
  }

  updateDisplay(state.currentSeconds);

  if (state.currentSeconds === 0) {
    switchPhase();
  }
}

function switchPhase() {
  // Determine which transition is happening before switching
  const isWorkToBreak = state.phase === 'work';
  
  // Switch phase
  state.phase = state.phase === 'work' ? 'break' : 'work';
  
  // Load duration for new phase
  state.totalSeconds = state.phase === 'work' ? WORK_DURATION_SECONDS : BREAK_DURATION_SECONDS;
  state.currentSeconds = state.totalSeconds;
  
  // Update display
  elements.modeLabel.textContent = state.phase === 'work' ? 'Work' : 'Break';
  
  // Reset ring to full for new phase
  elements.progressCircle.style.strokeDashoffset = 0;
  
  updateDisplay(state.currentSeconds);
  
  // Play transition sound
  if (isWorkToBreak) {
    playBeepWorkToBreak();
    // Completed a work session — increment and persist
    state.sessionsCompleted += 1;
    saveSessionCount(state.sessionsCompleted);
    updateSessionCounter();
  } else {
    playBeepBreakToWork();
  }
  
  // Interval continues automatically - tick will be called again
}


function updateDisplay(seconds) {
  elements.timeLabel.textContent = formatTime(seconds);
  updateProgressRing();
}

function updateProgressRing() {
  const progress = state.currentSeconds / state.totalSeconds;
  const circumference = 2 * Math.PI * 90;
  const offset = circumference * (1 - progress);
  elements.progressCircle.style.strokeDashoffset = offset;
}

function switchMode(mode) {
}

function updateSessionCounter() {
  elements.sessionCount.textContent = state.sessionsCompleted;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function setButtonStates(isRunning, isPaused) {
  state.isRunning = isRunning;
  state.isPaused = isPaused;
  elements.startButton.disabled = isRunning;
  elements.pauseButton.disabled = !isRunning || isPaused;
  elements.resumeButton.disabled = !isPaused;
}

document.addEventListener('DOMContentLoaded', initializeApp);
