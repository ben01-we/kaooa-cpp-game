# Kaooa — Vulture and Crows

A native Windows C++17 adaptation of the traditional Indian hunt game Kaooa, built for a GitHub version-control lab. No Python, browser runtime, downloaded assets, or third-party game engine is used in the game.

## Run

Latest release: **v1.2.1**. Repository: [ben01-we/kaooa-cpp-game](https://github.com/ben01-we/kaooa-cpp-game). [Download the latest executable](https://github.com/ben01-we/kaooa-cpp-game/releases/latest).

Download `Kaooa.exe` from the project's GitHub Releases (once published), or run the supplied executable. Double-click it to open the graphical game. Windows 10/11 x64 is the target platform. All artwork is drawn by the app, and the C++ runtime is statically linked.

## Play

Seven teal crows try to trap one gold vulture on ten points of a star. Crows place first; the vulture enters next. Alternate turns. Crows must place all seven pieces before moving. Click a piece and then an available destination along a board line.

The vulture jumps over an adjacent crow onto the next empty point in a straight line. This edition requires a capture when one is available and permits one jump per turn. Crows cannot jump. The vulture wins after four captures; crows win when it has no legal move. Repeating the same position with the same player to move three times is a draw. A player with no move also triggers a draw unless the vulture is trapped.

Modes: play crows against the computer, play the vulture against the computer, or pass and play with another person. Change mode starts a fresh match. Undo rolls back your turn and the computer response when appropriate. Toggle hints to show available destinations. H opens or closes the rules; Escape closes them.

Click **AI: strategic** to switch to **AI: easy** and back. Easy selects a random legal move. Strategic searches ahead with minimax. Difficulty can change mid-match. It is a session preference; the saved match restores board, mode, and move history while keeping the current difficulty setting.

## Build

Install Visual Studio 2022 or newer with **Desktop development with C++**. Double-click `build.bat`, or run it in a terminal. It discovers the installed compiler and builds `Kaooa.exe`.

Alternatively, on Windows with CMake and the MSVC toolchain:

```text
cmake -S . -B build
cmake --build build --config Release
```

## Implementation

Save game writes `Kaooa-save.txt` beside the executable. Load game restores the match and undo history. Keep the executable in a writable folder. Invalid or incompatible files are rejected without changing the current game.

- `game.h`: board geometry, legal move generation, state transitions, wins, and minimax with alpha-beta pruning.
- `main.cpp`: Win32 window events, GDI+ 2D rendering, interactions, computer turn scheduling, and verification.
- `build.bat` and `CMakeLists.txt`: reproducible native builds.
- `Kaooa.exe --test`: deterministic engine tests; results written to `test-results.txt`.
- `Kaooa.exe --snapshot`: exports an actual app-rendered demonstration position to `preview.png`. `--snapshot rules` exports the rules screen. These are render outputs, not photographs of a live window.

The engine uses a ten-element board array and separates rules from rendering. The star has five straight lines, each containing four points, with fifteen adjacent edges. Only consecutive collinear triples permit a capture. The computer searches five plies including its candidate move; its evaluation balances captures and vulture mobility. It is a heuristic opponent, not a perfect solver.

## Historical context and rule sources

Kaooa is a traditional game recorded in India's central provinces. Its exact origin date is uncertain; this project does not assert a proven ancient date. The Indian Boardgames Archive describes early twentieth-century documentation and potentially older board patterns at medieval sites.

- [Indian Boardgames Archive](https://www.indiaboardgamesarchive.in/omekas/s/ancientindianboardgames/item?Search=&property%5B0%5D%5Bproperty%5D=39&property%5B0%5D%5Btext%5D=Bagh+Chal&property%5B0%5D%5Btype%5D=eq)
- [Kaooa rules with compulsory captures](https://www.whatdowedoallday.com/kaooa/)
- [Kaooa overview and rule variants](https://en.wikipedia.org/wiki/Kaooa)

Sources differ on compulsory captures. This implementation explicitly uses compulsory captures and adds threefold repetition to make endless back-and-forth play end in a draw.

## Version control lab

Version history records actual development steps performed on this project. Author identity used for automated local commits is `Codex <codex@localhost>`; it is not a claim that either student's identity was supplied. Student names and registration numbers are left as placeholders in the lab report.

Build outputs, local saves, and document QA files are excluded from Git. Executables belong in release assets; source code and documentation belong in the repository.
