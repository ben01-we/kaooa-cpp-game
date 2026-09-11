# Changelog

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
