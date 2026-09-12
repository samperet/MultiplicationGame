# Math Racer

A two-player multiplication race. Two characters run down their own track, and
each correct answer moves one of them closer to the finish line.

Open `index.html` in a browser and play. There is no build step and no network
access needed.

## Playing

Each question shows three answers. The three answers sit in a fixed order, so
each player always has the same three controls: left, middle, right. The game
shows each player only the controls they are using: connect a controller and
that player's keyboard hints are replaced by controller buttons.

| Player | Keyboard | Controller | Touch |
| --- | --- | --- | --- |
| Player 1 | `A` `S` `D` | D-pad or face buttons | the pink character on each answer |
| Player 2 | `J` `K` `L` | D-pad or face buttons | the other character on each answer |

A correct answer scores a point. A wrong answer costs a point and locks that
player out for just over a second, which gives the other player a clear window.
A player can only lose one point per question, so a bad guess never spirals.

## Controllers

Bluetooth controllers are paired with the computer or tablet the usual way. The
browser then lists them like any other gamepad, and the game picks them up
through the Gamepad API. Browsers only reveal a controller after a button is
pressed on it, so press anything once to wake it up.

Which player a controller drives:

- A controller takes the first free player slot when it first appears.
- Pressing anything while a character screen is open claims that controller for
  that player, so whoever presses on "Player 1: choose your character" gets
  Player 1 regardless of connection order.
- Once a player has confirmed their character, their controller is locked to
  them and the other player cannot take it.
- A controller that reconnects returns to the player it had before.

Buttons, depending on what is on screen:

| Screen | Controls |
| --- | --- |
| Character grid | D-pad or left stick move the highlight, the bottom face button picks |
| Question | D-pad left / down / right, the face buttons, or the left stick pick answers 1 / 2 / 3 |
| Anywhere | Start or Options works like Enter, for Next, Continue and Play Again |

Controllers that support it also rumble: a double tap for a correct answer, one
longer buzz for a wrong one.

The mute button in the corner is the single quiet switch: it silences the music,
the sound effects and the rumble.

The How to Play screen only shows controller help once a controller is
connected, and its try-it-out area names the player who pressed and lights
their answer in their colour: pink for Player 1, indigo for Player 2.

The keyboard can do everything a controller can. Arrow keys move the character
grid highlight and Enter picks.

## Settings

Reachable from the title screen and remembered on the device, along with each
player's last character.

- **Times tables** to practise, one to twelve, with quick picks for all, 1-5 and 6-12.
- **Race length**: 10, 20 or 30 correct answers to win.
- **Question timer**: off, or 15, 10 or 5 seconds. When time runs out nobody
  scores and a new question appears.
- **Touch buttons**: auto (on wherever touch is the main input), always on, or off.

## Development

```sh
npm install        # dev dependencies: Tailwind CLI and Playwright
npm start          # serve the game at http://localhost:8080
npm test           # run the browser tests
npm run build:css  # rebuild tailwind.css after changing classes
```

`tailwind.css` is committed so the game runs straight from disk with no build
and no CDN. Rebuild it whenever you add or change a Tailwind class in
`index.html` or `script.js`; CI fails if it is stale.

The tests in `tests/game.test.js` drive a real Chromium through the whole game.
Controllers are simulated by replacing `navigator.getGamepads`, so controller
support is covered without hardware. The test serves the game itself and blocks
every outbound request, which is also what proves the game works offline.
Screenshots of each screen land in `tests/shots/`.
