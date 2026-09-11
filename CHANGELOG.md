# Changelog

## v1.3.0 (release-2)

- Keyboard shortcuts in the desktop game: N new game, S save, L load, M change mode, T hints; held keys do not repeat and only H and Escape work while the rules are open.
- Configurable computer search depth in `game.h` (default unchanged), with tests for legal moves and finished games.
- Graphical tests for every keyboard shortcut.
- Web edition in `web/`: JavaScript rules engine matching `game.h`, 14 automated rules tests, SVG board with mouse, touch and keyboard play, all three modes, easy and strategic computer, undo, hints, rules screen, browser saves and a phone layout.
- README instructions for running and testing the web edition, and a comparison of both editions.

## v1.2.1

- Fix live-window rendering on Windows displays with scaling above 100 percent.
- Draw the back buffer into an explicit pixel rectangle so graphics and mouse targets align.
- Verify the fix in the running desktop application.

## v1.2.0

- Select Easy (random legal moves) or Strategic (five-ply minimax) computer play.
- Switch difficulty during a match without losing progress.
- Show release version in the game footer.

## v1.1.0

- Save and resume a complete match, including mode and undo history.
- Validate every saved transition against legal moves before loading.
- Preserve the existing game when a save file is missing or invalid.
- Add save round-trip and invalid-file tests.

## v1.0.0

- Native C++17 2D board with mouse controls and resizable layout.
- Legal placement, movement, compulsory capture, wins, and repetition draws.
- Computer opponent for either side and local two-player mode.
- Undo, move hints, and in-app rules.
- Reproducible builds and deterministic engine verification.
