const p1Keys = ['a', 's', 'd'];
const p2Keys = ['j', 'k', 'l'];
let p1 = { avatar: '', score: 0 };
let p2 = { avatar: '', score: 0 };
let maxQuestions = 20;
let answered = false;
let gameStarted = false;

// --- Settings, remembered on this device ---
const SETTINGS_KEY = 'mathRacerSettings';
const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const RACE_LENGTHS = [10, 20, 30];
const TIMER_CHOICES = [0, 15, 10, 5];
const TOUCH_CHOICES = ['auto', 'on', 'off'];
const DEFAULT_SETTINGS = {
  tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  raceLength: 20,
  timerSeconds: 0,       // 0 = no timer
  touchButtons: 'auto'   // 'auto' shows tap buttons on touch devices
};

// Anything stored could be stale or hand-edited, so every field is validated
function loadSettings() {
  const merged = Object.assign({}, DEFAULT_SETTINGS, { avatars: { 1: '', 2: '' } });
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  } catch (err) {
    saved = null; // storage blocked (private window) or corrupt: defaults are fine
  }
  if (saved && typeof saved === 'object') {
    if (Array.isArray(saved.tables)) {
      const tables = ALL_TABLES.filter(n => saved.tables.includes(n));
      if (tables.length) merged.tables = tables;
    }
    if (RACE_LENGTHS.includes(saved.raceLength)) merged.raceLength = saved.raceLength;
    if (TIMER_CHOICES.includes(saved.timerSeconds)) merged.timerSeconds = saved.timerSeconds;
    if (TOUCH_CHOICES.includes(saved.touchButtons)) merged.touchButtons = saved.touchButtons;
    if (saved.avatars) {
      merged.avatars = { 1: saved.avatars[1] || '', 2: saved.avatars[2] || '' };
    }
  }
  return merged;
}

let settings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    // Nothing to do: the game still plays, it just will not remember settings
  }
}

// Tap-to-answer buttons: on by default wherever touch is the main input
function touchButtonsVisible() {
  if (settings.touchButtons === 'on') return true;
  if (settings.touchButtons === 'off') return false;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateProblem() {
  // One factor comes from the tables being practiced, the other is 1-10.
  // Their order is random so the practiced number is not always first.
  const tables = settings.tables.length ? settings.tables : DEFAULT_SETTINGS.tables;
  const table = tables[randomInt(0, tables.length - 1)];
  const other = randomInt(1, 10);
  const [a, b] = Math.random() < 0.5 ? [table, other] : [other, table];
  const correct = a * b;
  // Generate believable wrong answers
  let choices = [correct];
  while (choices.length < 3) {
    let wrong = correct + randomInt(-5, 5);
    if (wrong === correct || wrong < 1 || choices.includes(wrong)) continue;
    choices.push(wrong);
  }
  choices = shuffle(choices);
  const correctIndex = choices.indexOf(correct);
  return {
    question: `${a} × ${b} = ?`,
    choices,
    correctIndex
  };
}

// Store current problem state globally
let currentProblem = null;
function displayProblem() {
  answered = false;
  pointLost = { 1: false, 2: false };
  clearLockouts();
  currentProblem = generateProblem();
  document.getElementById('problem').textContent = currentProblem.question;
  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';
  currentProblem.choices.forEach((choice, idx) => {
    choicesDiv.appendChild(buildChoiceCard(choice, idx));
  });
  document.getElementById('message').textContent = '';
  startQuestionTimer();
}

// One answer option: the value, the key that picks it, and (for touch play) a
// tap button per player carrying that player's character
function buildChoiceCard(choice, idx) {
  const card = document.createElement('div');
  card.className = 'w-full bg-yellow-200 rounded-xl shadow-md px-2 py-3 flex flex-col items-center';

  const value = document.createElement('div');
  value.className = 'font-bold text-2xl sm:text-3xl text-gray-800';
  value.textContent = choice;
  card.appendChild(value);

  const hint = document.createElement('div');
  hint.className = 'text-xs font-mono text-gray-600 mt-1';
  hint.textContent = `${p1Keys[idx].toUpperCase()} / ${p2Keys[idx].toUpperCase()}`;
  card.appendChild(hint);

  if (touchButtonsVisible()) {
    const row = document.createElement('div');
    row.className = 'flex gap-2 mt-2';
    [1, 2].forEach(player => {
      const btn = document.createElement('button');
      btn.className = player === 1
        ? 'answer-tap-btn text-2xl leading-none px-2 py-1 rounded-lg bg-pink-100 hover:bg-pink-200 shadow-sm transition'
        : 'answer-tap-btn text-2xl leading-none px-2 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 shadow-sm transition';
      btn.textContent = player === 1 ? p1.avatar : p2.avatar;
      btn.dataset.player = String(player);
      btn.dataset.idx = String(idx);
      btn.setAttribute('aria-label', `Player ${player} answers ${choice}`);
      btn.onclick = () => handleAnswer(player, idx);
      row.appendChild(btn);
    });
    card.appendChild(row);
  }
  return card;
}

// --- Question timer (optional, from settings) ---
let questionTimerFrame = null;

function clearQuestionTimer() {
  if (questionTimerFrame !== null) {
    cancelAnimationFrame(questionTimerFrame);
    questionTimerFrame = null;
  }
  const wrap = document.getElementById('question-timer');
  if (wrap) wrap.classList.add('hidden');
}

function startQuestionTimer() {
  clearQuestionTimer();
  const wrap = document.getElementById('question-timer');
  const bar = document.getElementById('question-timer-bar');
  if (!wrap || !bar || !settings.timerSeconds) return;
  const total = settings.timerSeconds * 1000;
  const started = performance.now();
  wrap.classList.remove('hidden');
  bar.style.width = '100%';
  const tick = () => {
    const left = Math.max(0, total - (performance.now() - started));
    bar.style.width = `${(left / total) * 100}%`;
    if (left <= 0) {
      questionTimerFrame = null;
      handleQuestionTimeout();
      return;
    }
    questionTimerFrame = requestAnimationFrame(tick);
  };
  questionTimerFrame = requestAnimationFrame(tick);
}

function handleQuestionTimeout() {
  if (answered || !gameStarted) return;
  answered = true;
  clearQuestionTimer();
  document.getElementById('message').textContent = "⏱ Time's up! Here comes another one.";
  playSound('wrong', 1);
  setTimeout(() => {
    if (gameStarted && answered) displayProblem();
  }, 900);
}

// --- Lock-out after a wrong answer ---
// A wrong guess costs a point and briefly locks that player out, so the other
// player gets a clear window instead of a race to mash every button.
const LOCKOUT_MS = 1200;
const lockedUntil = { 1: 0, 2: 0 };
let lockoutTimers = { 1: null, 2: null };
let pointLost = { 1: false, 2: false };

function isLockedOut(player) {
  return performance.now() < lockedUntil[player];
}

function lockOut(player) {
  lockedUntil[player] = performance.now() + LOCKOUT_MS;
  if (lockoutTimers[player]) clearTimeout(lockoutTimers[player]);
  lockoutTimers[player] = setTimeout(() => {
    lockoutTimers[player] = null;
    updateLockoutUI();
  }, LOCKOUT_MS + 30);
  updateLockoutUI();
}

function clearLockouts() {
  [1, 2].forEach(player => {
    lockedUntil[player] = 0;
    if (lockoutTimers[player]) {
      clearTimeout(lockoutTimers[player]);
      lockoutTimers[player] = null;
    }
  });
  updateLockoutUI();
}

function updateLockoutUI() {
  [1, 2].forEach(player => {
    const locked = isLockedOut(player);
    const lane = document.getElementById(`p${player}-lane`);
    if (lane) lane.classList.toggle('lane-locked', locked);
    document.querySelectorAll(`.answer-tap-btn[data-player="${player}"]`).forEach(btn => {
      btn.disabled = locked;
      btn.classList.toggle('tap-locked', locked);
    });
  });
}


// --- Global audio references ---
let isMuted = false;
let bgMusic;
let musicState = 'intro'; // 'intro' or 'boss'

function playMusic(forceBoss = false) {
  if (!bgMusic) return;
  if (forceBoss || musicState === 'boss') {
    if (bgMusic.src.indexOf('video-game-boss-fiight-259885.mp3') === -1) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
      bgMusic.src = 'video-game-boss-fiight-259885.mp3';
      bgMusic.load();
    }
    musicState = 'boss';
  } else {
    if (bgMusic.src.indexOf('save-as-115826.mp3') === -1) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
      bgMusic.src = 'save-as-115826.mp3';
      bgMusic.load();
    }
    musicState = 'intro';
  }
  bgMusic.muted = isMuted;
  bgMusic.volume = 0.7;
  bgMusic.loop = true;
  bgMusic.play().catch(() => {
    // Autoplay was blocked: retry on the next real user gesture. Key presses
    // synthesized from a controller are not user gestures, so skip those.
    const tryPlay = (e) => {
      if (e && !e.isTrusted) return;
      bgMusic.play().catch(()=>{});
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('keydown', tryPlay);
    };
    document.addEventListener('click', tryPlay);
    document.addEventListener('keydown', tryPlay);
  });
}

// Clicks whichever "next step" button is on screen right now. Used by the Enter
// key and by the Start/Options button on a controller. Returns true if a button was clicked.
function activatePrimaryButton() {
  // Prioritize confirm-player-btn (Next), then keys-next-btn (Continue), then instructions-next-btn,
  // then the victory screen's Continue and Play Again buttons
  const btnOrder = [
    'confirm-player-btn',
    'keys-next-btn',
    'settings-done-btn',
    'instructions-next-btn',
    'continue-btn',
    'restart-btn'
  ];
  for (const id of btnOrder) {
    const btn = document.getElementById(id);
    if (btn && !btn.classList.contains('hidden') && !btn.disabled && btn.offsetParent !== null) {
      btn.click();
      return true;
    }
  }
  return false;
}

window.addEventListener('DOMContentLoaded', () => {
  // --- Randomize title screen emojis ---
  function pickTwoRandomEmojis(arr) {
    const shuffled = arr.slice().sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }
  const [emoji1, emoji2] = pickTwoRandomEmojis(emojiChoices);
  const tigerDiv = document.getElementById('draggable-tiger');
  const unicornDiv = document.getElementById('draggable-unicorn');
  if (tigerDiv && unicornDiv) {
    tigerDiv.textContent = emoji1;
    unicornDiv.textContent = emoji2;
  }

  // --- Arrow keys move the character grid; Enter presses Next/Continue/Start ---
  document.addEventListener('keydown', function(e) {
    if (handleEmojiGridKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Return') {
      if (activatePrimaryButton()) e.preventDefault();
    }
  });
  // --- Play background music on load ---
  bgMusic = document.getElementById('bg-music');
  // --- Mute button logic ---
  const muteBtn = document.getElementById('mute-btn');
  const muteIcon = document.getElementById('mute-icon');
  if (muteBtn && muteIcon && bgMusic) {
    muteBtn.onclick = () => {
      isMuted = !isMuted;
      bgMusic.muted = isMuted;
      muteIcon.textContent = isMuted ? '🔇' : '🔊';
    };
    // Sync icon with actual mute state
    bgMusic.muted = isMuted;
    muteIcon.textContent = isMuted ? '🔇' : '🔊';
  }
  if (bgMusic) {
    playMusic(false);
  }
  // Start with instructions screen
  showInstructions();

  // --- Dynamic favicon rotation ---

  // Title screen -> How to Play -> character picking
  document.getElementById('instructions-next-btn').onclick = () => {
    showKeysInstructions();
  };
  document.getElementById('keys-next-btn').onclick = () => {
    showPlayerSetup(1);
  };
  // Settings, reachable from the title screen
  document.getElementById('open-settings-btn').onclick = () => {
    showSettings();
  };
  document.getElementById('settings-done-btn').onclick = () => {
    saveSettings();
    showInstructions();
  };
  setupSettingsControls();

  
  // --- Interactive key test for How to Play page ---
  setupKeyTest();
  
  // Click handlers for the example answer options
  document.querySelectorAll('#answer-option-1, #answer-option-2, #answer-option-3').forEach(option => {
    option.addEventListener('click', function() {
      highlightAnswerOption(this.id.split('-')[2]);
    });
  });
  
  // Click handlers for the key buttons
  document.querySelectorAll('.key-button').forEach(keyBtn => {
    keyBtn.addEventListener('click', function() {
      const key = this.id.split('-')[1];
      simulateKeyPress(key);
    });
  });


  // --- Draggable emoji characters with physics ---
  setupDraggableEmojis();

  // --- Bluetooth / USB controller support ---
  startGamepadPolling();
  updateGamepadUI();


  let faviconIdx = 0;
  function setFavicon(emoji) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='50%' x='50%' text-anchor='middle' dominant-baseline='central' font-size='48'>${emoji}</text></svg>`;
    const url = 'data:image/svg+xml,' + encodeURIComponent(svg);
    let link = document.getElementById('dynamic-favicon');
    if (!link) {
      link = document.createElement('link');
      link.id = 'dynamic-favicon';
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = url;
  }
  setFavicon(emojiChoices[0]);
  setInterval(() => {
    faviconIdx = (faviconIdx + 1) % emojiChoices.length;
    setFavicon(emojiChoices[faviconIdx]);
  }, 5000);


});

// --- Countdown logic ---
function playCountdownBeep(n) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  if (n === 'GO!') {
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } else {
    osc.frequency.setValueAtTime(350 + 90 * (3 - n), ctx.currentTime);
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  }
  osc.onended = () => ctx.close();
}

function startCountdown(cb) {
  // Clear equation, choices and any timer before counting down
  clearQuestionTimer();
  document.getElementById('problem').textContent = '';
  document.getElementById('choices').innerHTML = '';
  const overlay = document.getElementById('countdown-overlay');
  const numSpan = document.getElementById('countdown-num');
  let count = 3;
  answered = true; // block input
  overlay.classList.remove('hidden');
  function next() {
    if (count > 0) {
      numSpan.textContent = count;
      playCountdownBeep(count);
      count--;
      setTimeout(next, 800);
    } else {
      numSpan.textContent = 'GO!';
      playCountdownBeep('GO!');
      setTimeout(() => {
        overlay.classList.add('hidden');
        answered = false;
        cb();
      }, 700);
    }
  }
  next();
}

// --- New Setup Flow ---
const emojiChoices = [
  '🐯','🦄','🐸','🐼','🐵','🦊','🐙','🐧','🐶','🦁'
];

const emojiNames = {
  '🐯': 'Tina Tiger',
  '🦄': 'Uma Unicorn',
  '🐸': 'Freddy Frog',
  '🐼': 'Penny Panda',
  '🐵': 'Milo Monkey',
  '🦊': 'Fiona Fox',
  '🐙': 'Olly Octopus',
  '🐧': 'Percy Penguin',
  '🐶': 'Daisy Dog',
  '🦁': 'Leo Lion'
};
let setupStep = 1;
let tempPlayers = [
  {avatar: ''},
  {avatar: ''}
];
function showPlayerSetup(step) {
  setupStep = step;
  if (step === 1) unlockAllGamepads(); // a fresh run: both controllers are up for grabs
  showSetupStep('setup-step-player');
  const label = document.getElementById('setup-player-label');
  const grid = document.getElementById('emoji-grid');
  const selectedArea = document.getElementById('selected-emoji-area');
  const selectedEmoji = document.getElementById('selected-emoji');
  const selectedName = document.getElementById('selected-emoji-name');
  const confirmBtn = document.getElementById('confirm-player-btn');
  const backBtn = document.getElementById('back-player-btn');
  label.textContent = `Player ${step}: Choose your character`;
  grid.innerHTML = '';
  emojiGridButtons = [];
  let used = step === 2 ? [tempPlayers[0].avatar] : [];
  emojiChoices.forEach(e => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn text-3xl transition-all';
    btn.textContent = e;
    btn.setAttribute('aria-label', `Pick ${emojiNames[e] || e}`);
    if (used.includes(e)) btn.disabled = true;
    emojiGridButtons.push(btn);
    btn.onclick = () => {
      selectedEmoji.textContent = e;
      selectedName.textContent = emojiNames[e] || '';
      selectedArea.classList.remove('hidden');
      grid.classList.add('hidden');
      confirmBtn.textContent = (step === 1) ? 'Next' : 'Start';
      confirmBtn.disabled = false;

      // --- Key Demo Setup ---
      const keyDemoArea = document.getElementById('key-demo-area');
      const keyDemoBtns = [
        document.getElementById('key-demo-1'),
        document.getElementById('key-demo-2'),
        document.getElementById('key-demo-3')
      ];
      // Controller caps shown under the key caps when this player has a controller
      const keyDemoPadBtns = [
        document.getElementById('key-demo-pad-1'),
        document.getElementById('key-demo-pad-2'),
        document.getElementById('key-demo-pad-3')
      ];
      const keyDemoAnswerBtns = Array.from(selectedArea.querySelectorAll('.key-demo-answer'));
      const keyDemoFeedback = document.getElementById('key-demo-feedback');
      // Set key labels for player 1 or 2
      const keys = (step === 1) ? ['A','S','D'] : ['J','K','L'];
      keyDemoBtns.forEach((btn, i) => btn.textContent = keys[i]);
      // Animate keys being pressed in sequence
      function animateSequence() {
        keyDemoBtns.forEach(btn => btn.classList.remove('pressed'));
        let i = 0;
        function pressNext() {
          if (i >= keyDemoBtns.length) return;
          keyDemoBtns[i].classList.add('pressed');
          setTimeout(() => {
            keyDemoBtns[i].classList.remove('pressed');
            i++;
            pressNext();
          }, 200);
        }
        setTimeout(pressNext, 350);
      }
      animateSequence();
      // Interactive: clicking key or answer animates and shows mapping
      function showFeedback(idx, fromGamepad) {
        keyDemoFeedback.textContent = fromGamepad
          ? `🎮 ${GAMEPAD_ANSWER_LABELS[idx]} = Answer ${idx+1}`
          : `"${keys[idx]}" = Answer ${idx+1}`;
      }
      keyDemoBtns.forEach((btn, idx) => {
        btn.onclick = () => {
          btn.classList.add('pressed');
          setTimeout(() => btn.classList.remove('pressed'), 180);
          showFeedback(idx);
        };
      });
      keyDemoPadBtns.forEach((btn, idx) => {
        btn.onclick = () => {
          btn.classList.add('pressed');
          setTimeout(() => btn.classList.remove('pressed'), 180);
          showFeedback(idx, true);
        };
      });
      keyDemoAnswerBtns.forEach((btn, idx) => {
        btn.onclick = () => {
          keyDemoBtns[idx].classList.add('pressed');
          setTimeout(() => keyDemoBtns[idx].classList.remove('pressed'), 180);
          showFeedback(idx);
        };
      });
      keyDemoFeedback.textContent = '';
      // Animate when actual keys are pressed
      function keydownHandler(e) {
        const key = e.key.toLowerCase();
        let idx = -1;
        if (step === 1) {
          if (key === 'a') idx = 0;
          else if (key === 's') idx = 1;
          else if (key === 'd') idx = 2;
        } else {
          if (key === 'j') idx = 0;
          else if (key === 'k') idx = 1;
          else if (key === 'l') idx = 2;
        }
        if (idx !== -1) {
          // Light up the controller cap for controller presses, the key cap otherwise
          const cap = e.fromGamepad ? keyDemoPadBtns[idx] : keyDemoBtns[idx];
          cap.classList.add('pressed');
          showFeedback(idx, e.fromGamepad);
          setTimeout(() => cap.classList.remove('pressed'), 180);
        }
      }
      document.addEventListener('keydown', keydownHandler);
      // Remove handler when leaving this screen
      backBtn.onclick = () => {
        document.removeEventListener('keydown', keydownHandler);
        selectedArea.classList.add('hidden');
        grid.classList.remove('hidden');
      };
      confirmBtn.onclick = () => {
        document.removeEventListener('keydown', keydownHandler);
        tempPlayers[step-1] = {avatar: e};
        settings.avatars[step] = e;
        saveSettings();
        lockGamepadForPlayer(step); // this controller now belongs to this player
        selectedArea.classList.add('hidden');
        grid.classList.remove('hidden');
        if (step === 1) {
          showPlayerSetup(2);
        } else {
          // Start game immediately after both characters are picked
          p1.avatar = tempPlayers[0].avatar;
          p2.avatar = tempPlayers[1].avatar;
          p1.score = 0;
          p2.score = 0;
          maxQuestions = settings.raceLength;
          document.getElementById('setup-screen').classList.add('hidden');
          document.getElementById('game-area').classList.remove('hidden');
          document.getElementById('p1-avatar').textContent = p1.avatar;
          document.getElementById('p2-avatar').textContent = p2.avatar;
          document.getElementById('p1-char').textContent = p1.avatar;
          document.getElementById('p2-char').textContent = p2.avatar;
          document.getElementById('p1-score-top').textContent = p1.score;
          document.getElementById('p2-score-top').textContent = p2.score;
          moveCharacters();
          playMusic(true); // Switch to boss music and play
          gameStarted = true; // From here on A/S/D and J/K/L (or a controller) answer questions
          startCountdown(() => displayProblem());
        }
      };
    };
    grid.appendChild(btn);
  }); // <-- CLOSE forEach HERE

  selectedArea.classList.add('hidden');
  grid.classList.remove('hidden');
  const remembered = emojiChoices.indexOf(settings.avatars[step]);
  const startAt = (remembered !== -1 && !emojiGridButtons[remembered].disabled) ? remembered : 0;
  setEmojiGridHighlight(emojiGridButtons[startAt] && !emojiGridButtons[startAt].disabled
    ? startAt
    : emojiGridButtons.findIndex(btn => !btn.disabled));
  updateGamepadUI();
}

// --- Character grid navigation (arrow keys, and controllers through them) ---
const EMOJI_GRID_COLUMNS = 5;
let emojiGridButtons = [];
let emojiGridIndex = 0;

function setEmojiGridHighlight(index) {
  if (index < 0 || index >= emojiGridButtons.length) return;
  emojiGridIndex = index;
  emojiGridButtons.forEach((btn, i) => btn.classList.toggle('focused', i === index));
}

// Steps through the grid in one direction, skipping characters already taken
function moveEmojiGridHighlight(dx, dy) {
  const step = dx + dy * EMOJI_GRID_COLUMNS;
  if (!step) return;
  let index = emojiGridIndex;
  for (let tries = 0; tries < emojiGridButtons.length; tries++) {
    const next = index + step;
    if (next < 0 || next >= emojiGridButtons.length) return;
    // Left/right must stay on the same row
    if (dx !== 0 && Math.floor(next / EMOJI_GRID_COLUMNS) !== Math.floor(index / EMOJI_GRID_COLUMNS)) return;
    index = next;
    if (!emojiGridButtons[index].disabled) {
      setEmojiGridHighlight(index);
      return;
    }
  }
}

// Returns true when the key belonged to the grid, so nothing else handles it
function handleEmojiGridKey(e) {
  if (gamepadContext() !== 'grid' || !emojiGridButtons.length) return false;
  switch (e.key) {
    case 'ArrowLeft': moveEmojiGridHighlight(-1, 0); return true;
    case 'ArrowRight': moveEmojiGridHighlight(1, 0); return true;
    case 'ArrowUp': moveEmojiGridHighlight(0, -1); return true;
    case 'ArrowDown': moveEmojiGridHighlight(0, 1); return true;
    case 'Enter':
    case 'Return':
    case ' ':
    case 'Spacebar': {
      const btn = emojiGridButtons[emojiGridIndex];
      if (btn && !btn.disabled) btn.click();
      return true;
    }
    default: return false;
  }
}



// The setup card shows exactly one of these at a time
const SETUP_STEPS = [
  'setup-step-instructions',
  'setup-step-keys',
  'setup-step-settings',
  'setup-step-player'
];

function showSetupStep(id) {
  SETUP_STEPS.forEach(stepId => {
    const el = document.getElementById(stepId);
    if (el) el.classList.toggle('hidden', stepId !== id);
  });
  // The card scrolls on short screens, so every step starts at its top
  const card = document.getElementById('setup-card');
  if (card) card.scrollTop = 0;
}

function showInstructions() {
  showSetupStep('setup-step-instructions');
}

function showKeysInstructions() {
  showSetupStep('setup-step-keys');
  updateGamepadUI();
}

function showSettings() {
  showSetupStep('setup-step-settings');
  renderSettings();
}

// --- Settings screen controls ---
const SETTINGS_OPTION_GROUPS = [
  {
    id: 'length-group',
    key: 'raceLength',
    options: [[10, 'Short · 10'], [20, 'Normal · 20'], [30, 'Long · 30']]
  },
  {
    id: 'timer-group',
    key: 'timerSeconds',
    options: TIMER_CHOICES.map(n => [n, n === 0 ? 'Off' : `${n} seconds`])
  },
  {
    id: 'touch-group',
    key: 'touchButtons',
    options: [['auto', 'Auto'], ['on', 'Always on'], ['off', 'Off']]
  }
];
const TABLE_QUICK_PICKS = [
  ['tables-all-btn', ALL_TABLES],
  ['tables-easy-btn', [1, 2, 3, 4, 5]],
  ['tables-hard-btn', [6, 7, 8, 9, 10, 11, 12]]
];
let settingsTableButtons = [];

function setupSettingsControls() {
  const tablesGrid = document.getElementById('tables-grid');
  if (tablesGrid && !settingsTableButtons.length) {
    ALL_TABLES.forEach(n => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opt-btn';
      btn.textContent = String(n);
      btn.dataset.table = String(n);
      btn.setAttribute('aria-label', `${n} times table`);
      btn.onclick = () => toggleTable(n);
      tablesGrid.appendChild(btn);
      settingsTableButtons.push(btn);
    });
  }
  SETTINGS_OPTION_GROUPS.forEach(group => {
    const holder = document.getElementById(group.id);
    if (!holder || holder.children.length) return;
    group.options.forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opt-btn';
      btn.textContent = label;
      btn.dataset.value = String(value);
      btn.onclick = () => {
        settings[group.key] = value;
        saveSettings();
        renderSettings();
      };
      holder.appendChild(btn);
    });
  });
  TABLE_QUICK_PICKS.forEach(([id, tables]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = () => {
        settings.tables = tables.slice();
        saveSettings();
        renderSettings();
      };
    }
  });
  renderSettings();
}

function toggleTable(n) {
  const next = settings.tables.includes(n)
    ? settings.tables.filter(t => t !== n)
    : ALL_TABLES.filter(t => settings.tables.includes(t) || t === n);
  if (!next.length) {
    // There has to be something left to practice
    const warn = document.getElementById('tables-warning');
    if (warn) {
      warn.textContent = 'Keep at least one table switched on.';
      clearTimeout(toggleTable.warningTimer);
      toggleTable.warningTimer = setTimeout(() => { warn.textContent = ''; }, 2000);
    }
    return;
  }
  settings.tables = next;
  saveSettings();
  renderSettings();
}

function renderSettings() {
  settingsTableButtons.forEach(btn => {
    const on = settings.tables.includes(Number(btn.dataset.table));
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  SETTINGS_OPTION_GROUPS.forEach(group => {
    const holder = document.getElementById(group.id);
    if (!holder) return;
    Array.from(holder.children).forEach(btn => {
      const on = String(settings[group.key]) === btn.dataset.value;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });
}

// --- Draggable emoji functions ---
function setupDraggableEmojis() {
  const emojis = document.querySelectorAll('.draggable-emoji');

  emojis.forEach(emoji => {
    let isDragging = false;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;
    let startX = 0;
    let startY = 0;

    // Mouse/Touch events
    emoji.addEventListener('mousedown', dragStart);
    emoji.addEventListener('touchstart', dragStart, { passive: false });

    window.addEventListener('mouseup', dragEnd);
    window.addEventListener('touchend', dragEnd);

    window.addEventListener('mousemove', dragMove);
    window.addEventListener('touchmove', dragMove, { passive: false });

    // Start dragging
    function dragStart(e) {
      e.preventDefault();
      
      // Get current position from any existing transform
      const transform = window.getComputedStyle(emoji).getPropertyValue('transform');
      if (transform && transform !== 'none') {
        // Extract the current translate values
        const matrix = new DOMMatrixReadOnly(transform);
        xOffset = matrix.m41; // translateX
        yOffset = matrix.m42; // translateY
      } else {
        xOffset = 0;
        yOffset = 0;
      }
      
      // Get the initial cursor position
      if (e.type === 'touchstart') {
        startX = e.touches[0].clientX - xOffset;
        startY = e.touches[0].clientY - yOffset;
      } else {
        startX = e.clientX - xOffset;
        startY = e.clientY - yOffset;
      }
      
      isDragging = true;
    }

    // End dragging
    function dragEnd() {
      isDragging = false;
    }

    // Handle dragging - maintain the proper offset
    function dragMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      
      // Get current cursor position
      let currentX, currentY;
      if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
      } else {
        currentX = e.clientX;
        currentY = e.clientY;
      }
      
      // Calculate new position maintaining the initial offset
      const newX = currentX - startX;
      const newY = currentY - startY;
      
      // Set the element's position
      emoji.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
    }
  });
}

// --- Interactive key test functions ---
function setupKeyTest() {
  // Listen for key presses when on the How to Play screen
  document.addEventListener('keydown', (e) => {
    // Only process if we're on the keys instruction screen
    if (document.getElementById('setup-step-keys').classList.contains('hidden')) {
      return;
    }
    
    simulateKeyPress(e.key.toLowerCase(), !!e.fromGamepad);
  });
}

function simulateKeyPress(key, fromGamepad) {
  // Map keys to answer options
  let answerOption = null;
  let keyElement = null;
  
  if (key === 'a' || key === 'j') {
    answerOption = '1';
    keyElement = key === 'a' ? 'key-a' : 'key-j';
  } else if (key === 's' || key === 'k') {
    answerOption = '2';
    keyElement = key === 's' ? 'key-s' : 'key-k';
  } else if (key === 'd' || key === 'l') {
    answerOption = '3';
    keyElement = key === 'd' ? 'key-d' : 'key-l';
  }
  
  if (answerOption && keyElement) {
    // Highlight the pressed key
    highlightKey(keyElement);

    // Highlight the corresponding answer option
    highlightAnswerOption(answerOption);

    // Update feedback text
    const option = document.querySelector(`#answer-option-${answerOption}`);
    const val = option ? option.firstChild.textContent.trim() : '';
    const feedback = document.getElementById('key-test-feedback');
    if (feedback) {
      feedback.textContent = fromGamepad
        ? `🎮 ${GAMEPAD_ANSWER_LABELS[Number(answerOption) - 1]} picks ${val}`
        : `"${key.toUpperCase()}" picks ${val}`;
      feedback.classList.remove('text-gray-500');
      feedback.classList.add('text-blue-600');
    }
  }
}

function highlightKey(keyId) {
  // Remove highlights from all keys
  document.querySelectorAll('.key-button').forEach(btn => {
    btn.classList.remove('scale-110', 'shadow-md');
    if (btn.id.includes('key-a') || btn.id.includes('key-s') || btn.id.includes('key-d')) {
      btn.classList.remove('bg-pink-200');
    } else {
      btn.classList.remove('bg-indigo-200');
    }
  });
  
  // Add highlight to the pressed key
  const keyElement = document.getElementById(keyId);
  if (keyElement) {
    keyElement.classList.add('scale-110', 'shadow-md');
    if (keyId.includes('key-a') || keyId.includes('key-s') || keyId.includes('key-d')) {
      keyElement.classList.add('bg-pink-200');
    } else {
      keyElement.classList.add('bg-indigo-200');
    }
    
    // Remove the highlight after a short delay
    setTimeout(() => {
      keyElement.classList.remove('scale-110', 'shadow-md');
      if (keyId.includes('key-a') || keyId.includes('key-s') || keyId.includes('key-d')) {
        keyElement.classList.remove('bg-pink-200');
      } else {
        keyElement.classList.remove('bg-indigo-200');
      }
    }, 500);
  }
}

function highlightAnswerOption(optionNum) {
  // Remove highlights from all answer options
  document.querySelectorAll('[id^="answer-option-"]').forEach(option => {
    option.classList.remove('bg-yellow-100', 'scale-110', 'shadow-md');
  });
  
  // Add highlight to the selected answer option
  const optionElement = document.getElementById(`answer-option-${optionNum}`);
  if (optionElement) {
    optionElement.classList.add('bg-yellow-100', 'scale-110', 'shadow-md');
    
    // Remove the highlight after a short delay
    setTimeout(() => {
      optionElement.classList.remove('bg-yellow-100', 'scale-110', 'shadow-md');
    }, 500);
  }
}

function playSound(type, idx) {
  // type: 'correct' or 'wrong', idx: 0, 1, or 2 (for which key)
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type === 'correct' ? 'triangle' : 'square';
  // Key-based pitch variation
  const baseFreq = type === 'correct' ? 440 : 220;
  const offset = idx * 80;
  if (type === 'correct') {
    osc.frequency.setValueAtTime(baseFreq + offset, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(baseFreq + offset + 180, ctx.currentTime + 0.23);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } else {
    osc.frequency.setValueAtTime(baseFreq + offset, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(baseFreq + offset - 60, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }
  osc.onended = () => ctx.close();
}

function moveCharacters() {
  const pct1 = Math.min(100, (p1.score / maxQuestions) * 100);
  const pct2 = Math.min(100, (p2.score / maxQuestions) * 100);
  // Prevent avatar from overflowing past finish line
  document.getElementById('p1-char').style.left = `calc(${pct1}% - 1.5rem)`;
  document.getElementById('p2-char').style.left = `calc(${pct2}% - 1.5rem)`;
}

function handleAnswer(player, idx) {
  if (answered || !currentProblem) return;
  if (isLockedOut(player)) return; // still serving the penalty for a wrong guess
  let message = '';
  if (idx === currentProblem.correctIndex) {
    answered = true;
    clearQuestionTimer();
    playSound('correct', idx);
    rumbleGamepad(player, 'correct');
    if (player === 1) {
      p1.score++;
    } else {
      p2.score++;
    }
    document.getElementById('p1-score-top').textContent = p1.score;
    document.getElementById('p2-score-top').textContent = p2.score;
    moveCharacters();
    // Check for win
    if (p1.score >= maxQuestions || p2.score >= maxQuestions) {
      clearLockouts();
      setTimeout(endGame, 800);
      return;
    }
    // Animate equation out to winner
    const problemDiv = document.getElementById('problem');
    const winnerSide = player === 1 ? 'left' : 'right';
    // Animate out, then clear text, then animate in after delay
    problemDiv.classList.remove('animate-in-center');
    problemDiv.classList.add('animate-out-' + winnerSide);
    
    // When animation ends, completely hide the element
    setTimeout(() => {
      problemDiv.classList.add('hidden-equation');
      problemDiv.classList.remove('animate-out-left', 'animate-out-right');
      problemDiv.textContent = '';
      
      // After short delay, prepare new equation
      setTimeout(() => {
        // Generate and display new problem
        displayProblem();
        
        // Get new problem div and prepare for animation
        const newProblemDiv = document.getElementById('problem');
        newProblemDiv.classList.remove('hidden-equation');
        // Force reflow before adding animation class
        void newProblemDiv.offsetWidth;
        newProblemDiv.classList.add('animate-in-center');
      }, 50);
    }, 350); // Reduced to ensure it completes before animation ends

  } else {
    playSound('wrong', idx);
    rumbleGamepad(player, 'wrong');
    message = `Oops! That's not right. ${player === 1 ? p1.avatar : p2.avatar} has to wait a moment.`;
    // One point lost per equation per player, so a second wrong guess by the
    // same player does not keep draining their score
    if (!pointLost[player]) {
      if (player === 1) {
        p1.score = Math.max(0, p1.score - 1);
        document.getElementById('p1-score-top').textContent = p1.score;
      } else {
        p2.score = Math.max(0, p2.score - 1);
        document.getElementById('p2-score-top').textContent = p2.score;
      }
      pointLost[player] = true;
    }
    lockOut(player);
    moveCharacters();
    document.getElementById('message').textContent = message;
    // Do NOT set answered=true: the other player can still answer this question
  }
}

document.addEventListener('keydown', (e) => {
  if (!gameStarted || answered) return;
  const key = e.key.toLowerCase();
  let idx;
  if ((idx = p1Keys.indexOf(key)) !== -1) {
    handleAnswer(1, idx);
  } else if ((idx = p2Keys.indexOf(key)) !== -1) {
    handleAnswer(2, idx);
  }
});

// --- Bluetooth / USB controller support ---
// Controllers are read through the browser's Gamepad API. Bluetooth controllers
// are paired with the computer or tablet as usual; the browser then lists them
// like any other gamepad. Controller presses are turned into the same key
// presses the keyboard produces, so every screen that reacts to the keyboard
// reacts to a controller in exactly the same way.
//
// Which player a controller drives:
//   - a controller takes the first free player slot when it first appears;
//   - pressing anything on a controller while a character screen is open claims
//     it for that player, so whoever presses on "Player 1: choose your
//     character" gets Player 1 regardless of connection order;
//   - once a player has confirmed their character, their controller is locked to
//     them and the other player cannot take it;
//   - a controller that reconnects returns to the player it had before.
//
// What the buttons do, depending on what is on screen:
//   character grid  D-pad / stick move the highlight, bottom face button or
//                   Start picks the highlighted character
//   everywhere else D-pad left / down-or-up / right (also the left /
//                   bottom-or-top / right face buttons, or the left stick)
//                   pick answers 1 / 2 / 3, and Start acts as Enter
const GAMEPAD_ANSWER_LABELS = ['◀', '▼', '▶'];
const GAMEPAD_STICK_THRESHOLD = 0.6;
const GAMEPAD_STATE_KEYS = [
  'left', 'right', 'up', 'down',
  'faceLeft', 'faceRight', 'faceTop', 'faceBottom',
  'start'
];
const gamepadSlots = [null, null];        // gamepad.index driving Player 1 / Player 2
const gamepadSlotLastId = ['', ''];       // controller id last seen in each slot, so a reconnect keeps its player
const gamepadSlotLocked = [false, false]; // set once that player has confirmed their character
const gamepadPrevState = {};              // gamepad.index -> button state on the previous poll
let gamepadPollingStarted = false;

function gamepadsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
}

function getConnectedGamepads() {
  if (!gamepadsSupported()) return [];
  let list;
  try {
    list = navigator.getGamepads();
  } catch (err) {
    return []; // e.g. blocked by a permissions policy inside an iframe
  }
  const pads = [];
  for (let i = 0; i < list.length; i++) {
    const gp = list[i];
    if (gp && gp.connected !== false) pads.push(gp);
  }
  return pads;
}

function gamepadPlayerFor(index) {
  return gamepadSlots.indexOf(index) + 1; // 1 or 2, or 0 if this controller has no player
}

function gamepadFor(player) {
  const index = gamepadSlots[player - 1];
  if (index === null) return null;
  return getConnectedGamepads().find(gp => gp.index === index) || null;
}

function assignGamepad(gp) {
  if (!gp || gamepadSlots.includes(gp.index)) return;
  // Prefer the slot this controller used before, otherwise the lowest free one
  let slot = gamepadSlots.findIndex((used, i) => used === null && gamepadSlotLastId[i] === gp.id);
  if (slot === -1) slot = gamepadSlots.indexOf(null);
  if (slot === -1) return; // only two players
  gamepadSlots[slot] = gp.index;
  gamepadSlotLastId[slot] = gp.id;
  updateGamepadUI();
}

// Can this controller be moved to this player right now?
function canClaimGamepad(player, index) {
  const current = gamepadSlots.indexOf(index);
  if (current === player - 1) return false;            // already theirs
  if (current !== -1 && gamepadSlotLocked[current]) return false; // belongs to a player who is done
  return true;
}

function claimGamepadFor(player, gp) {
  const target = player - 1;
  const current = gamepadSlots.indexOf(gp.index);
  const displaced = gamepadSlots[target];
  if (current === -1) {
    // Move whoever held the slot to the other slot if it is free
    const other = 1 - target;
    if (displaced !== null && gamepadSlots[other] === null) {
      gamepadSlots[other] = displaced;
      gamepadSlotLastId[other] = gamepadSlotLastId[target];
    }
  } else {
    gamepadSlots[current] = displaced; // straight swap
    gamepadSlotLastId[current] = displaced === null ? '' : gamepadSlotLastId[target];
  }
  gamepadSlots[target] = gp.index;
  gamepadSlotLastId[target] = gp.id;
  updateGamepadUI();
}

// Called when a player confirms their character, so the other player cannot
// take a controller that is already in use
function lockGamepadForPlayer(player) {
  gamepadSlotLocked[player - 1] = gamepadSlots[player - 1] !== null;
}

function unlockAllGamepads() {
  gamepadSlotLocked[0] = false;
  gamepadSlotLocked[1] = false;
}

function releaseGamepad(index) {
  const slot = gamepadSlots.indexOf(index);
  if (slot !== -1) {
    gamepadSlots[slot] = null;
    gamepadSlotLocked[slot] = false;
  }
  delete gamepadPrevState[index];
  updateGamepadUI();
}

function gamepadButtonPressed(gp, i) {
  const button = gp.buttons[i];
  if (button === undefined || button === null) return false;
  return typeof button === 'object' ? (button.pressed || button.value > 0.5) : button > 0.5;
}

// Everything held on a controller right now, before any screen-specific meaning
function readGamepadState(gp) {
  const press = (i) => gamepadButtonPressed(gp, i);
  // Standard mapping: 12-15 are the D-pad, 0-3 the face buttons, 9 is Start
  const state = {
    left: press(14), right: press(15), up: press(12), down: press(13),
    faceBottom: press(0), faceRight: press(1), faceLeft: press(2), faceTop: press(3),
    start: press(9)
  };
  // Left stick, plus the D-pad "hat" axes that some non-standard controllers report
  const sticks = [[gp.axes[0] || 0, gp.axes[1] || 0]];
  if (gp.mapping !== 'standard') sticks.push([gp.axes[6] || 0, gp.axes[7] || 0]);
  sticks.forEach(([x, y]) => {
    if (Math.max(Math.abs(x), Math.abs(y)) < GAMEPAD_STICK_THRESHOLD) return;
    if (Math.abs(x) > Math.abs(y)) {
      if (x < 0) state.left = true; else state.right = true;
    } else if (y < 0) {
      state.up = true;
    } else {
      state.down = true;
    }
  });
  return state;
}

// True only while a character is actually being chosen. The setup card keeps
// its step markup in place once the game starts, so the whole setup screen has
// to be checked as well, or controllers would still think they are on the grid.
function characterScreenActive() {
  const screen = document.getElementById('setup-screen');
  const step = document.getElementById('setup-step-player');
  return !!screen && !screen.classList.contains('hidden') &&
    !!step && !step.classList.contains('hidden');
}

// 'grid' while a character is being chosen, 'keys' everywhere else
function gamepadContext() {
  const grid = document.getElementById('emoji-grid');
  if (characterScreenActive() && grid && !grid.classList.contains('hidden')) return 'grid';
  return 'keys';
}

// Dispatches a keydown on the document so every existing keyboard handler reacts
function pressVirtualKey(key, player) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  event.fromGamepad = true;
  event.gamepadPlayer = player;
  document.dispatchEvent(event);
}

function emitGamepadKeys(player, edges) {
  if (gamepadContext() === 'grid') {
    // Only the controller of the player currently choosing drives the grid
    if (player !== setupStep) return;
    if (edges.left) pressVirtualKey('ArrowLeft', player);
    if (edges.right) pressVirtualKey('ArrowRight', player);
    if (edges.up) pressVirtualKey('ArrowUp', player);
    if (edges.down) pressVirtualKey('ArrowDown', player);
    if (edges.faceBottom || edges.start) pressVirtualKey('Enter', player);
    return;
  }
  const keys = player === 1 ? p1Keys : p2Keys;
  if (edges.left || edges.faceLeft) pressVirtualKey(keys[0], player);
  if (edges.down || edges.up || edges.faceBottom || edges.faceTop) pressVirtualKey(keys[1], player);
  if (edges.right || edges.faceRight) pressVirtualKey(keys[2], player);
  if (edges.start) pressVirtualKey('Enter', player);
}

function pollGamepads() {
  const pads = getConnectedGamepads();
  const seen = [];
  pads.forEach(gp => {
    seen.push(gp.index);
    const now = readGamepadState(gp);
    // Browsers only expose a controller once a button is pressed on it, so on
    // first sight there are no edges and that wake-up press is ignored
    const firstSight = !(gp.index in gamepadPrevState);
    const prev = firstSight ? now : gamepadPrevState[gp.index];
    gamepadPrevState[gp.index] = now;

    const edges = {};
    let anyEdge = false;
    GAMEPAD_STATE_KEYS.forEach(key => {
      edges[key] = now[key] && !prev[key];
      if (edges[key]) anyEdge = true;
    });

    if (anyEdge && characterScreenActive() && canClaimGamepad(setupStep, gp.index)) {
      claimGamepadFor(setupStep, gp);
    } else {
      assignGamepad(gp);
    }

    const player = gamepadPlayerFor(gp.index);
    if (player && anyEdge) emitGamepadKeys(player, edges);
  });
  // Forget controllers that vanished without a disconnect event
  gamepadSlots.forEach(index => {
    if (index !== null && !seen.includes(index)) releaseGamepad(index);
  });
  requestAnimationFrame(pollGamepads);
}

function startGamepadPolling() {
  if (gamepadPollingStarted || !gamepadsSupported()) return;
  gamepadPollingStarted = true;
  requestAnimationFrame(pollGamepads);
}

// Haptic feedback: a double tap for a correct answer, one long buzz for a wrong
// one. Follows the mute button, since a controller on a table is audible too.
function rumbleGamepad(player, kind) {
  if (isMuted) return;
  const gp = gamepadFor(player);
  if (!gp) return;
  const actuator = gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0]);
  if (!actuator || typeof actuator.playEffect !== 'function') return;
  const play = (effect) => {
    try {
      const result = actuator.playEffect('dual-rumble', effect);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (err) {
      // Some browsers reject unsupported effect types: silently do without
    }
  };
  if (kind === 'correct') {
    play({ duration: 90, strongMagnitude: 0.45, weakMagnitude: 0.8 });
    setTimeout(() => play({ duration: 150, strongMagnitude: 0.7, weakMagnitude: 1 }), 140);
  } else {
    play({ duration: 300, strongMagnitude: 1, weakMagnitude: 0.4 });
  }
}

function updateGamepadUI() {
  const connected = gamepadSlots.map(index => index !== null);
  const count = connected.filter(Boolean).length;
  // In-game key hints
  connected.forEach((has, i) => {
    const badge = document.getElementById(`p${i + 1}-pad`);
    if (badge) badge.classList.toggle('hidden', !has);
  });
  // Title screen
  const titleStatus = document.getElementById('gamepad-title-status');
  if (titleStatus) {
    titleStatus.classList.toggle('hidden', !gamepadsSupported());
    if (count === 0) {
      titleStatus.textContent = '🎮 Have a Bluetooth controller? Press any button on it to connect.';
    } else if (count === 1) {
      const who = connected[0] ? 1 : 2;
      titleStatus.textContent = `🎮 1 controller connected (Player ${who}). Press any button on another controller for Player ${3 - who}.`;
    } else {
      titleStatus.textContent = '🎮 2 controllers connected. Player 1 and Player 2 are ready!';
    }
  }
  // How to Play screen
  const howtoStatus = document.getElementById('howto-gamepad-status');
  if (howtoStatus) {
    howtoStatus.textContent = count === 0
      ? 'No controller yet. Press any button on a Bluetooth controller to connect it.'
      : `${count} controller${count > 1 ? 's' : ''} connected. Try the buttons below!`;
  }
  // Character screen ("Your Keys" demo)
  const hasForStep = connected[setupStep - 1];
  document.querySelectorAll('.key-demo-pad').forEach(el => el.classList.toggle('hidden', !hasForStep));
  const demoStatus = document.getElementById('key-demo-gamepad-status');
  if (demoStatus) {
    if (!gamepadsSupported()) demoStatus.textContent = '';
    else if (hasForStep) demoStatus.textContent = '🎮 Your controller is connected! Try its D-pad or buttons. Start/Options = Next.';
    else demoStatus.textContent = `🎮 Using a Bluetooth controller? Press any button on it to connect it for Player ${setupStep}.`;
  }
  // Character grid hint
  const gridStatus = document.getElementById('emoji-grid-status');
  if (gridStatus) {
    gridStatus.textContent = connected[setupStep - 1]
      ? '🎮 Move with the D-pad, pick with the A button. Arrow keys and Enter work too.'
      : 'Use the arrow keys and Enter, or tap a character. A controller works here too.';
  }
}

window.addEventListener('gamepadconnected', (e) => {
  assignGamepad(e.gamepad);
  startGamepadPolling();
});
window.addEventListener('gamepaddisconnected', (e) => {
  if (e.gamepad) releaseGamepad(e.gamepad.index);
});

function endGame() {
  clearQuestionTimer();
  clearLockouts();
  // Stop background music
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
  
  // Determine the winner
  let winnerName, winnerEmoji, winningPlayer;
  
  if (p1.score > p2.score) {
    winnerEmoji = p1.avatar;
    winningPlayer = 1;
  } else if (p2.score > p1.score) {
    winnerEmoji = p2.avatar;
    winningPlayer = 2;
  } else {
    // It's a tie
    winnerEmoji = "🤝";
    winningPlayer = 0;
  }
  
  // Play victory sound
  playVictorySound();
  
  // Show the victory animation overlay
  const victoryOverlay = document.getElementById('victory-overlay');
  const winnerText = document.getElementById('winner-text');
  const winnerEmojiElement = document.getElementById('winner-emoji');
  
  winnerText.textContent = winningPlayer ? "WINNER!" : "It's a tie!";
  winnerEmojiElement.textContent = winnerEmoji;
  // Reset bouncing-emoji animation
  winnerEmojiElement.classList.remove('bouncing-emoji');
  void winnerEmojiElement.offsetWidth; // Force reflow to restart animation
  winnerEmojiElement.classList.add('bouncing-emoji');

  // For the winning player, animate their character
  if (winningPlayer > 0) {
    const playerChar = document.getElementById(`p${winningPlayer}-char`);
    playerChar.classList.add('scale-150', 'animate-bounce');
  }
  
  // Show the victory overlay with a slight delay for dramatic effect
  setTimeout(() => {
    victoryOverlay.classList.remove('hidden');
    victoryOverlay.classList.add('animate-fadeIn');
  }, 500);
  
  // Handle the continue button
  document.getElementById('continue-btn').onclick = () => {
    // Hide the victory overlay
    victoryOverlay.classList.add('hidden');
    // Stop bouncing emoji animation
    document.getElementById('winner-emoji').classList.remove('bouncing-emoji');
    
    // Stop any animations on player characters
    document.getElementById('p1-char').classList.remove('scale-150', 'animate-bounce');
    document.getElementById('p2-char').classList.remove('scale-150', 'animate-bounce');
    
    // Setup for new game
    document.getElementById('message').innerHTML = `<button id='restart-btn' class='mt-3 px-4 py-2 bg-pink-400 text-white rounded hover:bg-pink-500 transition'>Play Again</button>`;
    document.getElementById('problem').textContent = '';
    document.getElementById('choices').innerHTML = '';
    document.getElementById('p1-score-top').textContent = p1.score;
    document.getElementById('p2-score-top').textContent = p2.score;
    
    // Setup restart button
    document.getElementById('restart-btn').onclick = () => {
      // Only reset scores and round length; keep names and avatars
      p1.score = 0;
      p2.score = 0;
      maxQuestions = settings.raceLength;
      document.getElementById('p1-score-top').textContent = p1.score;
      document.getElementById('p2-score-top').textContent = p2.score;
      moveCharacters();
      playMusic(true); // Start boss music again
      startCountdown(() => displayProblem());
    };
  };
  
  // Complete the race animation
  moveCharacters();
}

function playVictorySound() {
  // Create victory fanfare using Web Audio API
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create oscillators for a fanfare
  const playNote = (freq, startTime, duration, type = 'triangle', volume = 0.2) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
    gain.gain.setValueAtTime(volume, startTime + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };
  
  // Play a triumphant fanfare sequence
  const now = ctx.currentTime;
  // Base chord
  playNote(440, now, 0.2);      // A4
  playNote(554.37, now + 0.1, 0.2); // C#5
  playNote(659.25, now + 0.2, 0.6); // E5
  
  // Rising flourish
  playNote(440, now + 0.5, 0.1, 'triangle', 0.15);   // A4
  playNote(493.88, now + 0.6, 0.1, 'triangle', 0.15); // B4
  playNote(554.37, now + 0.7, 0.1, 'triangle', 0.15); // C#5
  playNote(587.33, now + 0.8, 0.1, 'triangle', 0.2);  // D5
  playNote(659.25, now + 0.9, 0.1, 'triangle', 0.2);  // E5
  playNote(739.99, now + 1.0, 0.5, 'triangle', 0.3);  // F#5
  
  // Final chord
  playNote(440, now + 1.5, 0.8, 'sine', 0.1);      // A4
  playNote(554.37, now + 1.5, 0.8, 'sine', 0.1);   // C#5
  playNote(659.25, now + 1.5, 0.8, 'triangle', 0.2); // E5
  playNote(880, now + 1.5, 0.8, 'triangle', 0.25);  // A5
  
  // Percussion
  const noise = () => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.1, now + 0.5);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    noise.start(now + 0.5);
    noise.stop(now + 1);
  };
  
  noise();
}
