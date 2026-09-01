(() => {
  const STORAGE_KEY = 'focusring_data_v1';
  const CIRCUMFERENCE = 2 * Math.PI * 135;

  const MODE_META = {
    focus:  { label: 'Focus',       color: '#e0763a', inputId: 'focus-len' },
    short:  { label: 'Short Break', color: '#4a8f6b', inputId: 'short-len' },
    long:   { label: 'Long Break',  color: '#4a6fa5', inputId: 'long-len' },
  };

  const els = {
    modeBtns: document.querySelectorAll('.mode-btn'),
    ringProgress: document.getElementById('ring-progress'),
    timeDisplay: document.getElementById('time-display'),
    cycleDisplay: document.getElementById('cycle-display'),
    startBtn: document.getElementById('start-btn'),
    resetBtn: document.getElementById('reset-btn'),
    skipBtn: document.getElementById('skip-btn'),
    streakCount: document.getElementById('streak-count'),
    todayCount: document.getElementById('today-count'),
    todayMinutes: document.getElementById('today-minutes'),
    totalCount: document.getElementById('total-count'),
    focusLen: document.getElementById('focus-len'),
    shortLen: document.getElementById('short-len'),
    longLen: document.getElementById('long-len'),
    soundToggle: document.getElementById('sound-toggle'),
    root: document.documentElement,
  };

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadData() {
    let data;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      data = {};
    }
    const defaults = {
      date: todayStr(),
      todayCount: 0,
      todayMinutes: 0,
      totalCount: 0,
      streak: 0,
      lastCompletionDate: null,
      focusesCompleted: 0,
    };
    data = { ...defaults, ...data };
    if (data.date !== todayStr()) {
      data.date = todayStr();
      data.todayCount = 0;
      data.todayMinutes = 0;
    }
    return data;
  }

  let data = loadData();

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function refreshStatsUI() {
    els.streakCount.textContent = data.streak;
    els.todayCount.textContent = data.todayCount;
    els.todayMinutes.textContent = data.todayMinutes;
    els.totalCount.textContent = data.totalCount;
  }

  function recordFocusCompletion(minutes) {
    data.todayCount += 1;
    data.todayMinutes += minutes;
    data.totalCount += 1;
    data.focusesCompleted += 1;

    const today = todayStr();
    if (data.lastCompletionDate !== today) {
      if (data.lastCompletionDate === yesterdayStr()) {
        data.streak += 1;
      } else {
        data.streak = 1;
      }
      data.lastCompletionDate = today;
    }
    saveData();
    refreshStatsUI();
  }

  // --- Timer state ---
  let mode = 'focus';
  let totalSeconds = getModeSeconds('focus');
  let secondsLeft = totalSeconds;
  let running = false;
  let intervalId = null;

  function getModeSeconds(m) {
    const input = document.getElementById(MODE_META[m].inputId);
    const minutes = Math.max(1, parseInt(input.value, 10) || 1);
    return minutes * 60;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function updateRing() {
    const fraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
    const offset = CIRCUMFERENCE * (1 - fraction);
    els.ringProgress.style.strokeDashoffset = offset;
  }

  function updateDisplay() {
    els.timeDisplay.textContent = formatTime(secondsLeft);
    updateRing();
    if (mode === 'focus') {
      els.cycleDisplay.textContent = `Session ${data.focusesCompleted + 1}`;
    } else {
      els.cycleDisplay.textContent = MODE_META[mode].label;
    }
  }

  function setMode(newMode, { autoStart = false } = {}) {
    mode = newMode;
    els.modeBtns.forEach(btn => {
      const active = btn.dataset.mode === newMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    els.root.style.setProperty('--accent', MODE_META[newMode].color);
    stopTimer();
    totalSeconds = getModeSeconds(newMode);
    secondsLeft = totalSeconds;
    updateDisplay();
    if (autoStart) startTimer();
  }

  function playChime() {
    if (!els.soundToggle.checked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.55);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch {
      // audio unavailable; ignore
    }
  }

  function handleTimerComplete() {
    stopTimer();
    playChime();

    if (mode === 'focus') {
      const minutes = Math.round(totalSeconds / 60);
      recordFocusCompletion(minutes);
      const nextMode = data.focusesCompleted % 4 === 0 ? 'long' : 'short';
      setMode(nextMode, { autoStart: false });
    } else {
      setMode('focus', { autoStart: false });
    }
  }

  function tick() {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      secondsLeft = 0;
      updateDisplay();
      handleTimerComplete();
      return;
    }
    updateDisplay();
  }

  function startTimer() {
    if (running) return;
    running = true;
    els.startBtn.textContent = 'Pause';
    intervalId = setInterval(tick, 1000);
  }

  function stopTimer() {
    running = false;
    els.startBtn.textContent = 'Start';
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function toggleTimer() {
    if (running) stopTimer();
    else startTimer();
  }

  function resetTimer() {
    stopTimer();
    totalSeconds = getModeSeconds(mode);
    secondsLeft = totalSeconds;
    updateDisplay();
  }

  function skipTimer() {
    stopTimer();
    if (mode === 'focus') {
      const nextMode = (data.focusesCompleted + 1) % 4 === 0 ? 'long' : 'short';
      setMode(nextMode);
    } else {
      setMode('focus');
    }
  }

  els.modeBtns.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  els.startBtn.addEventListener('click', toggleTimer);
  els.resetBtn.addEventListener('click', resetTimer);
  els.skipBtn.addEventListener('click', skipTimer);

  [els.focusLen, els.shortLen, els.longLen].forEach(input => {
    input.addEventListener('change', () => {
      if (!running && MODE_META[mode].inputId === input.id) {
        resetTimer();
      }
    });
  });

  // init
  els.root.style.setProperty('--accent', MODE_META.focus.color);
  refreshStatsUI();
  updateDisplay();
})();
