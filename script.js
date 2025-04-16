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
  correctIndex = choices.indexOf(correct);
  return {
    question: `${a} × ${b} = ?`,
    choices
  };
}

function displayProblem() {
  answered = false;
  const { question, choices } = generateProblem();
  document.getElementById('problem').textContent = question;
  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';
  choices.forEach((choice, idx) => {
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
let bgMusic; // Make bgMusic global so it can be accessed by start-game-btn

window.addEventListener('DOMContentLoaded', () => {
  // --- Keyboard shortcut for Next/Continue/Start buttons ---
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === 'Return') {
      // Prioritize confirm-player-btn (Next), then keys-next-btn (Continue), then instructions-next-btn, then start-game-btn
      const btnOrder = [
        'confirm-player-btn',
        'keys-next-btn',
        'instructions-next-btn',
        'start-game-btn'
      ];
      for (const id of btnOrder) {
        const btn = document.getElementById(id);
        if (btn && !btn.classList.contains('hidden') && !btn.disabled && btn.offsetParent !== null) {
          btn.click();
          e.preventDefault();
          break;
        }
      }
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
    // Try to play (some browsers require user gesture)
    const playMusic = () => {
      bgMusic.volume = 0.7;
      bgMusic.play().catch(() => {});
      document.removeEventListener('click', playMusic);
      document.removeEventListener('keydown', playMusic);
    };
    // Attempt autoplay, fallback to user gesture
    bgMusic.play().catch(() => {
      document.addEventListener('click', playMusic);
      document.addEventListener('keydown', playMusic);
    });
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
    showQuestionsSetup();
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
let setupStep = 1;
let tempPlayers = [
  {avatar: ''},
  {avatar: ''}
];
function showPlayerSetup(step) {
  document.getElementById('setup-step-player').classList.remove('hidden');
  document.getElementById('setup-step-instructions').classList.add('hidden');
  document.getElementById('setup-step-keys').classList.add('hidden');
  document.getElementById('setup-step-questions').classList.add('hidden');
  const label = document.getElementById('setup-player-label');
  const grid = document.getElementById('emoji-grid');
  const selectedArea = document.getElementById('selected-emoji-area');
  const selectedEmoji = document.getElementById('selected-emoji');
  const confirmBtn = document.getElementById('confirm-player-btn');
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
      selectedArea.classList.remove('hidden');
      grid.classList.add('hidden');
      confirmBtn.textContent = (step === 1) ? 'Next' : 'Start';
      confirmBtn.disabled = false;
      confirmBtn.onclick = () => {
        tempPlayers[step-1] = {avatar: e};
        selectedArea.classList.add('hidden');
        grid.classList.remove('hidden');
        if (step === 1) {
          showPlayerSetup(2);
        } else {
          showKeysInstructions();
        }
      };
    };
    grid.appendChild(btn);
  });
  selectedArea.classList.add('hidden');
  grid.classList.remove('hidden');
}

function showInstructions() {
  document.getElementById('setup-step-instructions').classList.remove('hidden');
  document.getElementById('setup-step-player').classList.add('hidden');
  document.getElementById('setup-step-keys').classList.add('hidden');
  document.getElementById('setup-step-questions').classList.add('hidden');
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
  document.getElementById('setup-step-questions').classList.remove('hidden');
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


document.getElementById('start-game-btn').onclick = function() {
  // Set player objects
  p1.name = tempPlayers[0].name;
  p2.name = tempPlayers[1].name;
  p1.avatar = tempPlayers[0].avatar;
  p2.avatar = tempPlayers[1].avatar;
  p1.score = 0;
  p2.score = 0;
  maxQuestions = parseInt(document.getElementById('num-questions').value, 10) || 20;
  // Update UI
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('game-area').classList.remove('hidden');
  document.getElementById('p1-avatar').textContent = p1.avatar;
  document.getElementById('p2-avatar').textContent = p2.avatar;
  document.getElementById('p1-display').textContent = p1.name;
  document.getElementById('p2-display').textContent = p2.name;
  document.getElementById('p1-char').textContent = p1.avatar;
  document.getElementById('p2-char').textContent = p2.avatar;
  document.getElementById('p1-score-top').textContent = p1.score;
  document.getElementById('p2-score-top').textContent = p2.score;
  moveCharacters();
  gameStarted = true;
  // Switch to boss music when game starts
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    bgMusic.src = 'video-game-boss-fiight-259885.mp3';
    bgMusic.load();
    bgMusic.muted = isMuted;
    bgMusic.volume = 0.7;
    bgMusic.play().catch(()=>{});
  }
  startCountdown(() => displayProblem());
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
  if (idx === correctIndex) {
    answered = true;
    playSound('correct', idx);
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
    document.getElementById('message').textContent = '';
    displayProblem();
  } else {
    playSound('wrong', idx);
    message = `Oops! That's not right. Try again!`;
    // Move the player's character back one space (min 0)
    if (player === 1) {
      p1.score = Math.max(0, p1.score - 1);
      document.getElementById('p1-score-top').textContent = p1.score;
    } else {
      p2.score = Math.max(0, p2.score - 1);
      document.getElementById('p2-score-top').textContent = p2.score;
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
