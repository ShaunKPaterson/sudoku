# Sudoku

A Sudoku game for your phone that grades puzzles the way experienced solvers do, and teaches you how to solve them.

**Play it here: https://shaunkpaterson.github.io/sudoku/**

On Android, open the link in Chrome and choose **⋮ → Add to Home screen** (or **Install app**). The game then runs full screen like a normal app and works offline.

## What makes it different

**Puzzles are graded by technique, not by clue count.** The number of starting clues says very little about how hard a Sudoku is. Every puzzle here is solved by a built-in solver that works like a person: at each step it tries the easiest technique first and only reaches for a harder one when it is stuck. A puzzle's level is the hardest technique it needs, the same idea as the SE rating used by enthusiasts.

| Level | Techniques needed |
|---|---|
| Beginner | Hidden singles, with lots of numbers filled in to start |
| Easy | Full house, hidden singles |
| Medium | Naked singles |
| Hard | Pointing, box/line reduction, naked and hidden pairs and triples |
| Expert | X-Wing, Skyscraper, Two-String Kite, XY-Wing, Swordfish, quads |
| Master | XYZ-Wing, Jellyfish, Simple Colouring, XY-Chains |

Every puzzle has exactly one solution and can be solved by logic alone, with no guessing.

**Ideas teach rather than reveal.** Tapping **Idea** first names the technique and where to look. **Show me** highlights the pattern on the board and explains why it works. You fill in the move yourself, or let the game do it. Before anything else, an Idea points out a wrong number or a broken pencilmark.

**Training mode** puts a coach beside the board. It shows the next step, explains it in plain English and links to a short lesson on each technique. Training games aren't scored.

**Learn techniques** on the home screen has a lesson for every technique: what it is, how to spot it and why it works.

## Features

- Six levels, from Beginner to Master, with a fresh puzzle every game
- Pencilmarks, undo, clear, and ideas (1, 3, 5, 10 or unlimited per game)
- A mistake limit you choose (1 to 10, or none), with a second chance
- Scoring with bonuses for finished rows, columns and boxes, plus a time bonus for beating the target time
- Small celebrations when you complete a row, column, box or number
- Puzzle style preferences: favourite techniques, pace (flowing or tight) and symmetric layouts
- Statistics for each level: win rate, best and average time, best score and streaks
- Light and dark mode, eight accent colours plus a custom colour, and six fonts
- Saves your game automatically and works offline once installed

## How it's built

Plain HTML, CSS and JavaScript, with no frameworks and no build step.

| File | Purpose |
|---|---|
| `index.html` | The whole interface: screens, styles and game logic |
| `engine.js` | Puzzle generator, uniqueness checker, the human-style solver and grader, and the technique explanations. It also runs as a background worker so puzzle creation never freezes the screen. |
| `sw.js` | Service worker that makes the game work offline |
| `manifest.webmanifest` and icons | Let the game install as an app |

To run it on your own computer, serve the folder with any static web server, for example:

```
python -m http.server 8060
```

Then open `http://localhost:8060`.

## Background reading

The grading approach and technique definitions draw on:

- [sudoku.coach — Sudoku Difficulty](https://sudoku.coach/en/learn/sudoku-difficulty)
- [SudokuWiki — Grading Puzzles](https://www.sudokuwiki.org/Grading_Puzzles)
- [Kristanix — Sudoku Solving Techniques](https://www.kristanix.com/sudokuepic/sudoku-solving-techniques.php)
- [HoDoKu technique guides](https://hodoku.sourceforge.net/en/techniques.php)
