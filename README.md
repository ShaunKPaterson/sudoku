# Sudoku

A Sudoku game for your phone that grades puzzles the way experienced solvers do, and teaches you how to solve them.

**Play it here: https://shaunkpaterson.github.io/sudoku/**

On Android, open the link in Chrome and choose **⋮ → Add to Home screen** (or **Install app**). The game then runs full screen like a normal app and works offline.

## What makes it different

**Puzzles are graded by technique, not by clue count.** The number of starting clues says very little about how hard a Sudoku is. Every puzzle here is solved by a built-in solver that works like a person: at each step it tries the easiest technique first and only reaches for a harder one when it is stuck. A puzzle's level is the hardest technique it needs, the same idea as the SE rating used by enthusiasts.

| Level | Techniques needed |
|---|---|
| Beginner | Full house and hidden singles in boxes; about 45 numbers to start |
| Easy | Adds hidden singles in rows and columns; about 36 numbers to start |
| Semi-Easy | Like Medium (needs a naked single), with about 32 numbers to start |
| Medium | Adds naked singles; about 28 numbers to start |
| Hard | Pointing, box/line reduction, naked and hidden pairs and triples |
| Expert | X-Wing, Skyscraper, Two-String Kite, XY-Wing, Swordfish, quads |
| Master | XYZ-Wing, Jellyfish, Simple Colouring, XY-Chains |

Every puzzle has exactly one solution and can be solved by logic alone, with no guessing.

**The gentler levels never leave you stuck.** Beginner, Easy and Medium are built so that at every point of the solve there are several squares you could fill next (at least 4 on Beginner, 3 on Easy, 2 on Medium), and every box starts with a few numbers. A Beginner game is about a 5–10 minute play.

**A scanning routine instead of jumping around.** The game teaches one fixed way to look at the board: pick a number, go band by band (three boxes at a time), scan across the rows and then down the columns. Only when that finds nothing does it move on to nearly-full lines, squares where only one number fits, and finally pencilmarks. Ideas and the Training coach both follow this order.

**Ideas teach rather than reveal.** Tapping **Idea** first names the technique and where to look. **Show me** explains it on the board (a scanning step is animated) and you fill in the move yourself, or let the game do it. Ideas never fill the board with every possible pencilmark: they add only the number a step is about, and on harder steps **Pencil in the 5s** marks just where that one number can go. Before anything else, an Idea points out a wrong number or a broken pencilmark.

**Training mode** puts a coach beside the board. It works through the scanning routine with an animation: the number's copies light up, lines sweep across rows and down columns, ruled-out squares are crossed off and the one square left pulses. A strip shows which number and band the coach is on. Training games aren't scored.

**Learn techniques** on the home screen starts with **How to scan the board** (two animated pictures and the routine), then has a lesson for every technique: what it is, a picture of it on the board, how to spot it and why it works.

**Number helper.** Tap a number on the board (or on the number pad with no square selected) and the board shows where it can go, on every level. Choose in Settings: **Shade** greys out every square the number can't go in, so the open squares stand out; **Lines** only tints the rows and columns its copies cover, so you still do the last step yourself; or **Off**.

## Features

- Seven levels, from Beginner to Master, with a fresh puzzle every game
- Pencilmarks, undo, clear, and ideas (1, 3, 5, 10 or unlimited per game)
- A mistake limit you choose (1 to 10, or none), with a second chance
- Scoring with bonuses for finished rows, columns and boxes, plus a time bonus for beating the target time; your best single game is shown as **Best**
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
- [Conceptis Puzzles — Sudoku techniques](https://www.conceptispuzzles.com/index.aspx?uri=puzzle/sudoku/techniques) (the scanning routine)
