// End-to-end checks for Math Racer, driven by a real browser.
//
//   npm install && npm test
//
// Controllers are simulated by replacing navigator.getGamepads with a fake the
// test drives directly, so the whole flow can be exercised without hardware.
// The game is served by a small built-in static server and every request that
// would leave it is blocked, so the test also proves the game works offline.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.json': 'application/json'
};

function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const results = [];
const offlineViolations = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Injected before any page script: a fake Gamepad API plus recorders for the
// keys the game synthesizes and the rumble effects it asks for.
function installHarness() {
  window.__pads = [];
  window.__keys = [];
  window.__rumbles = [];
  navigator.getGamepads = () => window.__pads.slice();

  window.__connect = (index, opts = {}) => {
    const pad = {
      index,
      id: opts.id || `Fake Pad ${index}`,
      connected: true,
      mapping: opts.mapping === undefined ? 'standard' : opts.mapping,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0, 0, 0, 0, 0],
      timestamp: 0,
      vibrationActuator: {
        playEffect: (type, effect) => {
          window.__rumbles.push({ index, type, effect });
          return Promise.resolve('complete');
        }
      }
    };
    window.__pads[index] = pad;
    if (opts.heldButton !== undefined) {
      pad.buttons[opts.heldButton].pressed = true;
      pad.buttons[opts.heldButton].value = 1;
    }
    if (opts.fireEvent) {
      const ev = new Event('gamepadconnected');
      ev.gamepad = pad;
      window.dispatchEvent(ev);
    }
    return pad.id;
  };
  window.__disconnect = (index, fireEvent) => {
    const pad = window.__pads[index];
    window.__pads[index] = null;
    if (fireEvent && pad) {
      pad.connected = false;
      const ev = new Event('gamepaddisconnected');
      ev.gamepad = pad;
      window.dispatchEvent(ev);
    }
  };
  window.__press = (index, btn, down = true) => {
    const b = window.__pads[index].buttons[btn];
    b.pressed = down;
    b.value = down ? 1 : 0;
  };
  window.__axis = (index, axis, v) => { window.__pads[index].axes[axis] = v; };
  window.__frames = (n) => new Promise(res => {
    const step = () => (n-- > 0 ? requestAnimationFrame(step) : res());
    step();
  });
  document.addEventListener('keydown', e => window.__keys.push({
    key: e.key, fromGamepad: !!e.fromGamepad, player: e.gamepadPlayer || 0
  }));
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1100, height: 950 } });
  await context.route('**', route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    offlineViolations.push(url);
    return route.abort();
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console.error: ' + m.text()); });
  await page.addInitScript(installHarness);

  // --- Small helpers over the page ---
  const frames = (n = 3) => page.evaluate(n => window.__frames(n), n);
  const keys = () => page.evaluate(() => window.__keys.splice(0));
  const rumbles = () => page.evaluate(() => window.__rumbles.splice(0));
  const text = (sel) => page.locator(sel).first().evaluate(el => el.textContent.trim());
  const visible = (sel) => page.locator(sel).first()
    .evaluate(el => el.getClientRects().length > 0 && !el.classList.contains('hidden'));
  const slots = () => page.evaluate(() => gamepadSlots.slice());
  const tap = async (index, btn) => {
    await page.evaluate(([i, b]) => window.__press(i, b, true), [index, btn]);
    await frames(2);
    await page.evaluate(([i, b]) => window.__press(i, b, false), [index, btn]);
    await frames(2);
  };
  const stick = async (index, axis, value) => {
    await page.evaluate(([i, a, v]) => window.__axis(i, a, v), [index, axis, value]);
    await frames(2);
    await page.evaluate(([i, a]) => window.__axis(i, a, 0), [index, axis]);
    await frames(2);
  };
  const dpadFor = (idx) => [14, 13, 15][idx];
  const highlighted = () => page.locator('#emoji-grid .emoji-btn.focused').first()
    .evaluate(el => el.textContent.trim()).catch(() => null);

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await sleep(400);

  // ---------------------------------------------------------------- offline
  check('styles load with no network access',
    await page.evaluate(() => getComputedStyle(document.getElementById('game-area')).display === 'none'));

  // ------------------------------------------------------------ title screen
  check('title shows the controller connect hint',
    (await text('#gamepad-title-status')).includes('Press any button on it to connect'));
  check('title offers settings', await visible('#open-settings-btn'));
  // Nothing may run behind the setup screens
  await sleep(3200);
  await page.keyboard.press('a');
  await page.keyboard.press('j');
  await sleep(80);
  check('no round runs before the game starts',
    await page.evaluate(() => currentProblem === null && gameStarted === false));
  check('title-screen keys leave the scores alone',
    await page.evaluate(() => p1.score === 0 && p2.score === 0));
  // The title characters can be dragged around
  const tiger = page.locator('#draggable-tiger');
  const box = await tiger.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  check('title characters can be dragged',
    (await tiger.evaluate(el => el.style.transform)).includes('translate3d'),
    await tiger.evaluate(el => el.style.transform));
  await page.screenshot({ path: path.join(SHOTS, '01-title.png') });

  // --------------------------------------------------------------- settings
  await page.locator('#open-settings-btn').click();
  check('settings screen opens', await visible('#setup-step-settings'));
  check('twelve times tables offered',
    await page.locator('#tables-grid .opt-btn').count() === 12);
  check('tables 1-10 are on by default',
    await page.locator('#tables-grid .opt-btn.on').count() === 10);
  await page.locator('#tables-hard-btn').click();
  check('quick pick 6-12 selects seven tables',
    await page.locator('#tables-grid .opt-btn.on').count() === 7);
  // Turn everything off one at a time: the last one must refuse
  for (const n of [6, 7, 8, 9, 10, 11]) {
    await page.locator(`#tables-grid .opt-btn[data-table="${n}"]`).click();
  }
  await page.locator('#tables-grid .opt-btn[data-table="12"]').click();
  check('the last table cannot be switched off',
    await page.evaluate(() => settings.tables.join(',')) === '12', await page.evaluate(() => settings.tables));
  check('a warning explains why', (await text('#tables-warning')).includes('at least one'));
  await page.locator('#length-group .opt-btn[data-value="10"]').click();
  await page.locator('#timer-group .opt-btn[data-value="15"]').click();
  await page.locator('#touch-group .opt-btn[data-value="on"]').click();
  await sleep(250); // let the button colour transition finish before the shot
  await page.screenshot({ path: path.join(SHOTS, '02-settings.png') });
  const optionColours = await page.evaluate(() => Array.from(document.querySelectorAll('#touch-group .opt-btn'))
    .map(b => ({ on: b.classList.contains('on'), bg: getComputedStyle(b).backgroundColor, fg: getComputedStyle(b).color })));
  check('the selected option is legible',
    optionColours.every(o => o.bg !== o.fg), optionColours);
  // A short screen must still reach the bottom of the settings card
  await page.setViewportSize({ width: 420, height: 620 });
  await sleep(150);
  const doneReachable = await page.locator('#settings-done-btn').evaluate(el => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0;
  });
  check('the Done button is reachable on a small screen', doneReachable);
  await page.screenshot({ path: path.join(SHOTS, '02b-settings-small.png') });
  await page.setViewportSize({ width: 1100, height: 950 });
  await sleep(150);
  check('choices are stored',
    await page.evaluate(() => settings.raceLength === 10 && settings.timerSeconds === 15 && settings.touchButtons === 'on'));

  // Settings survive a reload
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  check('settings are remembered after a reload', await page.evaluate(() =>
    settings.tables.join(',') === '12' && settings.raceLength === 10 &&
    settings.timerSeconds === 15 && settings.touchButtons === 'on'));
  // Back to something playable for the rest of the run
  await page.locator('#open-settings-btn').click();
  await page.locator('#tables-all-btn').click();
  await page.locator('#timer-group .opt-btn[data-value="0"]').click();
  await page.locator('#settings-done-btn').click();
  check('Done returns to the title screen', await visible('#setup-step-instructions'));

  // ------------------------------------------------------------ how to play
  await page.locator('#instructions-next-btn').click();
  check('Start Game opens How to Play', await visible('#setup-step-keys'));
  check('each step starts scrolled to its top',
    await page.locator('#setup-card').evaluate(el => el.scrollTop === 0));
  check('no controller section without a controller', !(await visible('#howto-gamepad-block')));
  check('the test hint mentions only keys',
    (await text('#key-test-instructions')) === 'Press A, S, D or J, K, L to see which answer it picks',
    await text('#key-test-instructions'));
  await page.keyboard.press('s');
  await sleep(60);
  check('the key test answers a keyboard press',
    (await text('#key-test-feedback')) === 'Player 1 · "S" picks 12', await text('#key-test-feedback'));
  const p1Colours = await page.locator('#answer-option-2').evaluate(el => ({
    player: el.dataset.player, bg: getComputedStyle(el).backgroundColor
  }));
  await page.keyboard.press('l');
  await sleep(60);
  check('a Player 2 press is attributed to Player 2',
    (await text('#key-test-feedback')) === 'Player 2 · "L" picks 15', await text('#key-test-feedback'));
  const p2Colours = await page.locator('#answer-option-3').evaluate(el => ({
    player: el.dataset.player, bg: getComputedStyle(el).backgroundColor
  }));
  check('each player lights the answer in their own colour',
    p1Colours.player === '1' && p2Colours.player === '2' && p1Colours.bg !== p2Colours.bg,
    [p1Colours, p2Colours]);
  const feedbackColours = await page.locator('#key-test-feedback').evaluate(el => getComputedStyle(el).color);
  check('the feedback text carries that colour too', feedbackColours === 'rgb(79, 70, 229)', feedbackColours);

  // A controller wakes up with a button held down
  await keys();
  await page.evaluate(() => window.__connect(0, { heldButton: 0 }));
  await frames(3);
  check('the wake-up press is swallowed', (await keys()).length === 0);
  await page.evaluate(() => window.__press(0, 0, false));
  await frames(2);
  check('releasing the wake-up button emits nothing', (await keys()).length === 0);
  check('the controller section appears once one is connected', await visible('#howto-gamepad-block'));
  check('controller counted on How to Play',
    (await text('#howto-gamepad-status')).includes('1 controller connected'));
  check('the test hint now mentions controllers',
    (await text('#key-test-instructions')).includes('button on a controller'));
  // One player on a controller: only that player's keyboard column goes away
  check("the controller player's keyboard column is hidden", !(await visible('#howto-keys-1')));
  check("the keyboard player's column stays", await visible('#howto-keys-2'));
  check('the keyboard block stays while one player uses keys', await visible('#howto-keyboard-block'));
  check('the example hint shows a button for one and a key for the other',
    (await text('#answer-hint-1')) === '◀ / J', await text('#answer-hint-1'));
  await tap(0, 14);
  check('the key test answers a controller press',
    (await text('#key-test-feedback')) === 'Player 1 · 🎮 ◀ picks 10', await text('#key-test-feedback'));
  check('only the answer just picked is lit',
    await page.locator('.answer-flash').count() === 1,
    await page.locator('.answer-flash').count());
  check('a controller press on How to Play does not start a round',
    await page.evaluate(() => currentProblem === null));
  await page.screenshot({ path: path.join(SHOTS, '03-how-to-play.png') });

  // ------------------------------------------------- character grid: player 1
  await tap(0, 9); // Start/Options acts as Enter -> Continue
  check('Start advances to Player 1 character choice',
    await visible('#setup-step-player') && (await text('#setup-player-label')).startsWith('Player 1'));
  check('the grid starts with a highlight', (await highlighted()) === '🐯', await highlighted());
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  check('arrow keys move the highlight', (await highlighted()) === '🐸', await highlighted());
  await page.keyboard.press('ArrowDown');
  check('down moves a whole row', (await highlighted()) === '🐧', await highlighted());
  await page.keyboard.press('ArrowUp');
  await tap(0, 15); // D-pad right
  check('a controller moves the highlight', (await highlighted()) === '🐼', await highlighted());
  await stick(0, 0, -1); // left stick left
  check('the stick moves the highlight', (await highlighted()) === '🐸', await highlighted());
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft'); // already at the left edge
  check('the highlight stops at the row edge', (await highlighted()) === '🐯', await highlighted());
  await page.screenshot({ path: path.join(SHOTS, '04-character-grid.png') });
  await tap(0, 0); // bottom face button picks
  check('the face button picks the highlighted character',
    await visible('#selected-emoji-area') && (await text('#selected-emoji')) === '🐯');
  check('the picked character is named', (await text('#selected-emoji-name')) === 'Tina Tiger');

  // ------------------------------------------------------------- key demo
  check('controller caps show in the demo', await visible('#key-demo-pad-1'));
  check('key caps are hidden for a player on a controller', !(await visible('#key-demo-1')));
  check('the demo calls them buttons, not keys',
    (await text('#key-demo-label')) === 'Your Buttons:', await text('#key-demo-label'));
  await page.evaluate(() => window.__press(0, 14, true));
  await frames(2);
  check('the demo lights the controller cap',
    await page.locator('#key-demo-pad-1').evaluate(el => el.classList.contains('pressed')));
  check('the demo names the controller button',
    (await text('#key-demo-feedback')) === '🎮 ◀ = Answer 1', await text('#key-demo-feedback'));
  await page.evaluate(() => window.__press(0, 14, false));
  await frames(2);
  await page.keyboard.press('a');
  await sleep(50);
  check('the demo still names keyboard keys',
    (await text('#key-demo-feedback')) === '"A" = Answer 1', await text('#key-demo-feedback'));
  await page.locator('#selected-emoji-area .key-demo-answer').nth(2).click();
  check('clicking an answer in the demo shows its control',
    (await text('#key-demo-feedback')).includes('Answer 3'), await text('#key-demo-feedback'));
  // Back goes to the grid, and the same character can be picked again
  await page.locator('#back-player-btn').click();
  check('Back returns to the character grid',
    await visible('#emoji-grid') && !(await visible('#selected-emoji-area')));
  await tap(0, 0);
  check('a character can be picked again after Back',
    (await text('#selected-emoji')) === '🐯', await text('#selected-emoji'));

  // --------------------------------------------------- character grid: player 2
  await tap(0, 9);
  check('Start advances to Player 2', (await text('#setup-player-label')).startsWith('Player 2'));
  check("Player 1's character is taken",
    await page.locator('#emoji-grid .emoji-btn[disabled]').count() === 1);
  check('a player with no controller keeps the key caps',
    await page.locator('#key-demo-1').evaluate(el => !el.classList.contains('hidden')));
  check('the highlight skips the taken character', (await highlighted()) === '🦄', await highlighted());

  // Player 1's controller is locked to Player 1 and cannot be stolen
  await tap(0, 15);
  check("Player 1's controller cannot drive Player 2's grid", (await highlighted()) === '🦄');
  check("Player 1's controller stays in slot 1", (await slots()).join(',') === '0,');

  // A second controller claims Player 2 by being pressed on this screen
  await page.evaluate(() => window.__connect(1, { fireEvent: true }));
  await frames(3);
  await tap(1, 15);
  check('a controller pressed here claims Player 2', (await slots()).join(',') === '0,1', await slots());
  check("Player 2's controller drives the grid", (await highlighted()) === '🐸', await highlighted());
  await tap(1, 0);
  check('Player 2 picked a character', (await text('#selected-emoji')) === '🐸');
  await page.screenshot({ path: path.join(SHOTS, '05-player2-demo.png') });

  // ------------------------------------------------------------------ game
  await tap(1, 9);
  check('the game area is shown', await visible('#game-area') && !(await visible('#setup-screen')));
  check('both controller badges are shown', await visible('#p1-pad') && await visible('#p2-pad'));
  check('the race length comes from settings', await page.evaluate(() => maxQuestions === 10));
  await keys();
  await tap(0, 14);
  check('presses during the countdown do not score', (await text('#p1-score-top')) === '0');
  await sleep(3600);
  check('a question is shown after the countdown', (await text('#problem')).includes('×'), await text('#problem'));
  check('the tap buttons are rendered', await page.locator('.answer-tap-btn').count() === 6);
  // Answer tiles carry the number only, no key letters
  const tileText = await page.locator('#choices > div').evaluateAll(
    els => els.map(el => el.textContent.replace(/\s+/g, '')));
  check('answer tiles show no key letters',
    tileText.every(t => !/[ASDJKL]/.test(t)), tileText);
  check('answer tiles still show their number',
    tileText.every(t => /\d/.test(t)), tileText);
  // Both players on controllers: no keyboard hints anywhere
  check('keyboard hints are hidden when both use controllers',
    !(await visible('#p1-keys')) && !(await visible('#p2-keys')));
  check('controller hints are shown instead',
    await visible('#p1-pad') && await visible('#p2-pad'));
  check('the timer bar is hidden when the timer is off', !(await visible('#question-timer')));
  await page.screenshot({ path: path.join(SHOTS, '06-game.png') });

  // Correct answer from a controller, with rumble
  await rumbles();
  let correct = await page.evaluate(() => currentProblem.correctIndex);
  await tap(0, dpadFor(correct));
  check('a correct controller answer scores', (await text('#p1-score-top')) === '1');
  const goodRumble = await rumbles();
  check('a correct answer rumbles twice', goodRumble.length >= 1 && goodRumble.every(r => r.index === 0),
    goodRumble.map(r => r.effect.duration));
  await sleep(700);

  // Wrong answer: point lost, lock-out, other player can still answer
  correct = await page.evaluate(() => currentProblem.correctIndex);
  await rumbles();
  await tap(1, dpadFor((correct + 1) % 3));
  check('a wrong answer says who has to wait', (await text('#message')).includes('has to wait'), await text('#message'));
  check('a wrong answer rumbles once', (await rumbles()).length === 1);
  check('the locked lane is marked',
    await page.locator('#p2-lane').evaluate(el => el.classList.contains('lane-locked')));
  check("the locked player's tap buttons are disabled",
    await page.locator('.answer-tap-btn[data-player="2"]').first().evaluate(el => el.disabled));
  await tap(1, dpadFor(correct));
  check('the locked player cannot answer again yet', (await text('#p2-score-top')) === '0');
  await page.screenshot({ path: path.join(SHOTS, '07-lockout.png') });
  await tap(0, dpadFor(correct));
  check('the other player can answer during the lock-out', (await text('#p1-score-top')) === '2');
  await sleep(1400);
  check('the lock-out ends by itself',
    !(await page.locator('#p2-lane').evaluate(el => el.classList.contains('lane-locked'))));

  // Mute is the one quiet switch: it covers rumble as well as sound
  await rumbles();
  await page.locator('#mute-btn').click();
  await page.evaluate(() => rumbleGamepad(1, 'wrong'));
  check('mute silences rumble too', (await rumbles()).length === 0);
  await page.locator('#mute-btn').click();
  await page.evaluate(() => rumbleGamepad(1, 'wrong'));
  check('rumble returns when unmuted', (await rumbles()).length === 1);

  // Touch play
  correct = await page.evaluate(() => currentProblem.correctIndex);
  await page.locator(`.answer-tap-btn[data-player="2"][data-idx="${correct}"]`).click();
  check('tapping a button answers for that player', (await text('#p2-score-top')) === '1');
  await sleep(700);

  // Only one point is lost per player per question
  correct = await page.evaluate(() => currentProblem.correctIndex);
  await page.evaluate(() => { p1.score = 5; document.getElementById('p1-score-top').textContent = '5'; });
  await tap(0, dpadFor((correct + 1) % 3));
  await sleep(1300);
  await tap(0, dpadFor((correct + 2) % 3));
  check('a second wrong guess costs nothing more', (await text('#p1-score-top')) === '4', await text('#p1-score-top'));
  await page.evaluate(() => { p1.score = 0; document.getElementById('p1-score-top').textContent = '0'; });
  await sleep(1300);

  // Practised tables really drive the questions
  await page.evaluate(() => { settings.tables = [7]; });
  const factors = await page.evaluate(() => {
    const seen = [];
    for (let i = 0; i < 40; i++) {
      const q = generateProblem().question.match(/(\d+) × (\d+)/);
      seen.push([Number(q[1]), Number(q[2])]);
    }
    return seen;
  });
  check('every question uses the practised table', factors.every(([a, b]) => a === 7 || b === 7));
  await page.evaluate(() => { settings.tables = [1,2,3,4,5,6,7,8,9,10]; });

  // Question timer
  await page.evaluate(() => { settings.timerSeconds = 1; displayProblem(); });
  check('the timer bar shows when the timer is on', await visible('#question-timer'));
  await sleep(1500);
  check("time running out says so", (await text('#message')).includes("Time's up"), await text('#message'));
  await sleep(1200);
  check('a new question follows a timeout', (await text('#problem')).includes('×'));
  await page.evaluate(() => { settings.timerSeconds = 0; displayProblem(); });

  // ----------------------------------------- disconnect, reconnect, extra pads
  await page.evaluate(() => window.__disconnect(1, true));
  await frames(2);
  check('a disconnected controller hides its badge', !(await visible('#p2-pad')) && await visible('#p1-pad'));
  check('the keyboard hints come back for that player',
    await visible('#p2-keys') && !(await visible('#p1-keys')));
  await page.evaluate(() => window.__connect(2, { id: 'Generic Pad', mapping: '' }));
  await frames(3);
  check('a new controller takes the free slot', (await slots()).join(',') === '0,2', await slots());
  await keys();
  await page.evaluate(() => window.__axis(2, 6, 1));
  await frames(2);
  await page.evaluate(() => window.__axis(2, 6, 0));
  await frames(2);
  const hatKeys = await keys();
  check('a hat-axis D-pad answers for Player 2', hatKeys.length === 1 && hatKeys[0].key === 'l', hatKeys);
  await sleep(900);
  await page.evaluate(() => window.__disconnect(2, false)); // vanishes with no event
  await frames(3);
  check('a vanished controller is released by polling', (await slots()).join(',') === '0,', await slots());
  await page.evaluate(() => window.__disconnect(0, true));
  await frames(2);
  await page.evaluate(() => window.__connect(3, { id: 'Generic Pad' }));
  await frames(3);
  check('a reconnected controller returns to its player', (await slots()).join(',') === ',3', await slots());
  await page.evaluate(() => window.__connect(4, { id: 'Fake Pad 0' }));
  await frames(3);
  check('the next controller takes the other slot', (await slots()).join(',') === '4,3', await slots());
  await page.evaluate(() => window.__connect(5));
  await frames(3);
  check('a third controller is ignored', (await slots()).join(',') === '4,3', await slots());
  await keys();
  await tap(5, 14);
  check('a third controller emits nothing', (await keys()).length === 0);

  // ------------------------------------------------------------- end of race
  await page.evaluate(() => { maxQuestions = p1.score + 1; });
  correct = await page.evaluate(() => currentProblem.correctIndex);
  await tap(4, dpadFor(correct));
  await sleep(1600);
  check('the victory overlay appears', await visible('#victory-overlay'));
  await page.screenshot({ path: path.join(SHOTS, '08-victory.png') });
  await tap(4, 9);
  check('Start presses Continue', !(await visible('#victory-overlay')) && await visible('#restart-btn'));
  await page.keyboard.press('Enter');
  await sleep(120);
  check('Enter presses Play Again', await visible('#countdown-overlay') && (await text('#p1-score-top')) === '0');
  check('Play Again uses the race length from settings', await page.evaluate(() => maxQuestions === 10));

  // Characters are remembered for next time
  check('the chosen characters were saved', await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('mathRacerSettings') || '{}');
    return saved.avatars && saved.avatars['1'] === '🐯' && saved.avatars['2'] === '🐸';
  }));

  check('no page errors', pageErrors.length === 0, pageErrors);
  check('nothing was requested from the network', offlineViolations.length === 0, offlineViolations);

  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) console.log('failed: ' + failed.map(f => f.name).join(' | '));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
