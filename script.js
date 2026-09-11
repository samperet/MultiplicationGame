const p1Keys = ['a', 's', 'd'];
const p2Keys = ['j', 'k', 'l'];
let p1 = { avatar: '', score: 0 };
let p2 = { avatar: '', score: 0 };
let maxQuestions = 20;
let correctIndex = 0;
let answered = false;
let gameStarted = false;
const avatarOptions = {
  1: ['🐯', '🦄', '🐸', '🐼'],
  2: ['🐵', '🦊', '🐙', '🐧']
};
let selectedAvatar = { 1: avatarOptions[1][0], 2: avatarOptions[2][0] };

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
  const a = randomInt(1, 10);
  const b = randomInt(1, 10);
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
  currentProblem = generateProblem();
  document.getElementById('problem').textContent = currentProblem.question;
  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';
  currentProblem.choices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'px-8 py-5 bg-yellow-200 rounded-xl font-bold text-2xl shadow-md hover:bg-yellow-300 transition cursor-pointer w-full max-w-xs mx-auto my-1';
    btn.textContent = choice;
    btn.dataset.idx = idx;
    btn.disabled = true; // Only keyboard input
    choicesDiv.appendChild(btn);
  });
  document.getElementById('message').textContent = '';
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
    'instructions-next-btn',
    'start-game-btn',
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

  // --- Keyboard shortcut for Next/Continue/Start buttons ---
  document.addEventListener('keydown', function(e) {
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

  // Next button for instructions
  document.getElementById('instructions-next-btn').onclick = () => {
    showPlayerSetup(1);
  };
  // Next button for key instructions
  document.getElementById('keys-next-btn').onclick = () => {
    showPlayerSetup(1);
  };

  
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
  // Clear equation and choices before countdown
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
  document.getElementById('setup-step-player').classList.remove('hidden');
  document.getElementById('setup-step-instructions').classList.add('hidden');
  document.getElementById('setup-step-keys').classList.add('hidden');
  const label = document.getElementById('setup-player-label');
  const grid = document.getElementById('emoji-grid');
  const selectedArea = document.getElementById('selected-emoji-area');
  const selectedEmoji = document.getElementById('selected-emoji');
  const selectedName = document.getElementById('selected-emoji-name');
  const confirmBtn = document.getElementById('confirm-player-btn');
  const backBtn = document.getElementById('back-player-btn');
  label.textContent = `Player ${step}: Choose your character`;
  grid.innerHTML = '';
  let used = step === 2 ? [tempPlayers[0].avatar] : [];
  emojiChoices.forEach(e => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn text-3xl transition-all';
    btn.textContent = e;
    btn.setAttribute('aria-label', `Pick emoji ${e}`);
    if (used.includes(e)) btn.disabled = true;
    btn.onclick = () => {
      selectedEmoji.textContent = e;
      selectedName.textContent = emojiNames[e] || '';
      selectedArea.classList.remove('hidden');
      grid.classList.add('hidden');
      confirmBtn.textContent = (step === 1) ? 'Next' : 'Start';
      confirmBtn.disabled = false;

      // --- Key Demo Setup ---
      const keyDemoArea = document.getElementById('key-demo-area');
      const keyDemoKeys = document.getElementById('key-demo-keys');
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
          maxQuestions = 20;
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
  updateGamepadUI();
}



function showInstructions() {
  document.getElementById('setup-step-instructions').classList.remove('hidden');
  document.getElementById('setup-step-player').classList.add('hidden');
  document.getElementById('setup-step-keys').classList.add('hidden');
}

function showKeysInstructions() {
  document.getElementById('setup-step-instructions').classList.add('hidden');
  document.getElementById('setup-step-player').classList.add('hidden');
  document.getElementById('setup-step-keys').classList.remove('hidden');
  document.getElementById('setup-step-questions').classList.add('hidden');
}

function showQuestionsSetup() {
  document.getElementById('setup-step-instructions').classList.add('hidden');
  document.getElementById('setup-step-player').classList.add('hidden');
  document.getElementById('setup-step-keys').classList.add('hidden');

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
    
    const key = e.key.toLowerCase();
    simulateKeyPress(key);
  });
}

function simulateKeyPress(key) {
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
    const val = document.querySelector(`#answer-option-${answerOption}`).textContent.trim();
    document.getElementById('keyTestFeedback').textContent = `${val}`;
    document.getElementById('keyTestFeedback').classList.remove('text-green-600', 'text-red-600');
    document.getElementById('keyTestFeedback').classList.add('text-blue-600');
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
  if (answered) return;
  let message = '';
  if (idx === currentProblem.correctIndex) {
    answered = true;
    playSound('correct', idx);
    handleAnswer.pointLost = false; // Reset for next equation
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
    message = `Oops! That's not right. Try again!`;
    // Only allow one point loss per equation
    if (!handleAnswer.pointLost) {
      if (player === 1) {
        p1.score = Math.max(0, p1.score - 1);
        document.getElementById('p1-score-top').textContent = p1.score;
      } else {
        p2.score = Math.max(0, p2.score - 1);
        document.getElementById('p2-score-top').textContent = p2.score;
      }
      handleAnswer.pointLost = true;
    }
    moveCharacters();
    document.getElementById('message').textContent = message;
    // Do NOT set answered=true; allow more guesses
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
// like any other gamepad. The first controller to connect drives Player 1, the
// second drives Player 2 (a controller that reconnects goes back to its player).
// Controller presses are turned into the same key presses the keyboard produces
// (A/S/D, J/K/L and Enter), so every screen that reacts to the keyboard reacts to
// a controller in exactly the same way.
//
//   Answer 1: D-pad left,        left face button,           left stick left
//   Answer 2: D-pad down or up,  bottom or top face button,  left stick down or up
//   Answer 3: D-pad right,       right face button,          left stick right
//   Enter:    Start / Options / + button (Next, Continue, Play Again)
const GAMEPAD_ANSWER_LABELS = ['◀', '▼', '▶'];
const GAMEPAD_STICK_THRESHOLD = 0.6;
const gamepadSlots = [null, null];      // gamepad.index driving Player 1 / Player 2 (null = none)
const gamepadSlotLastId = ['', ''];     // controller id last seen in each slot, so a reconnect keeps its player
const gamepadPrevActions = {};          // gamepad.index -> actions held on the previous poll
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

function assignGamepad(gp) {
  if (!gp || gamepadSlots.includes(gp.index)) return;
  // Prefer the slot this controller used before, otherwise the lowest free one
  let slot = gamepadSlots.findIndex((used, i) => used === null && gamepadSlotLastId[i] === gp.id);
  if (slot === -1) slot = gamepadSlots.indexOf(null);
  if (slot === -1) return; // only two players
  gamepadSlots[slot] = gp.index;
  gamepadSlotLastId[slot] = gp.id;
  // Browsers only expose a controller after a button is pressed on it; don't
  // treat that wake-up press as an answer.
  gamepadPrevActions[gp.index] = readGamepadActions(gp);
  updateGamepadUI();
}

function releaseGamepad(index) {
  const slot = gamepadSlots.indexOf(index);
  if (slot !== -1) gamepadSlots[slot] = null;
  delete gamepadPrevActions[index];
  updateGamepadUI();
}

function gamepadButtonPressed(gp, i) {
  const button = gp.buttons[i];
  if (button === undefined || button === null) return false;
  return typeof button === 'object' ? (button.pressed || button.value > 0.5) : button > 0.5;
}

// Which answers (index 0-2) and whether "confirm" are held right now on a controller
function readGamepadActions(gp) {
  const answers = [false, false, false];
  const press = (i) => gamepadButtonPressed(gp, i);
  // D-pad (standard mapping buttons 12 = up, 13 = down, 14 = left, 15 = right)
  if (press(14)) answers[0] = true;
  if (press(12) || press(13)) answers[1] = true;
  if (press(15)) answers[2] = true;
  // Face buttons (standard mapping: 2 = left, 0 = bottom, 3 = top, 1 = right)
  if (press(2)) answers[0] = true;
  if (press(0) || press(3)) answers[1] = true;
  if (press(1)) answers[2] = true;
  // Left stick, plus the D-pad "hat" axes that some non-standard controllers report
  const sticks = [[gp.axes[0] || 0, gp.axes[1] || 0]];
  if (gp.mapping !== 'standard') sticks.push([gp.axes[6] || 0, gp.axes[7] || 0]);
  sticks.forEach(([x, y]) => {
    if (Math.max(Math.abs(x), Math.abs(y)) < GAMEPAD_STICK_THRESHOLD) return;
    if (Math.abs(x) > Math.abs(y)) answers[x < 0 ? 0 : 2] = true;
    else answers[1] = true;
  });
  return { answers, confirm: press(9) };
}

// Dispatches a keydown on the document so every existing keyboard handler reacts
function pressVirtualKey(key, player) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  event.fromGamepad = true;
  event.gamepadPlayer = player;
  document.dispatchEvent(event);
}

function pollGamepads() {
  const pads = getConnectedGamepads();
  const seen = [];
  pads.forEach(gp => {
    seen.push(gp.index);
    assignGamepad(gp);
    const player = gamepadPlayerFor(gp.index);
    if (!player) return;
    const prev = gamepadPrevActions[gp.index] || { answers: [false, false, false], confirm: false };
    const now = readGamepadActions(gp);
    const keys = player === 1 ? p1Keys : p2Keys;
    now.answers.forEach((held, idx) => {
      if (held && !prev.answers[idx]) pressVirtualKey(keys[idx], player);
    });
    if (now.confirm && !prev.confirm) pressVirtualKey('Enter', player);
    gamepadPrevActions[gp.index] = now;
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
  // Character setup screen ("Your Keys" demo)
  const hasForStep = connected[setupStep - 1];
  document.querySelectorAll('.key-demo-pad').forEach(el => el.classList.toggle('hidden', !hasForStep));
  const demoStatus = document.getElementById('key-demo-gamepad-status');
  if (demoStatus) {
    if (!gamepadsSupported()) demoStatus.textContent = '';
    else if (hasForStep) demoStatus.textContent = '🎮 Your controller is connected! Try its D-pad or buttons. Start/Options = Next.';
    else demoStatus.textContent = `🎮 Using a Bluetooth controller? Press any button on it to connect it for Player ${setupStep}.`;
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
      maxQuestions = 20;
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
