# Gzowo Tennis

Two-player motion tennis on one TV. Each player swings their own iPhone as the racket.

- **Mac** runs `server.js`: serves the game (three.js, no build) on :8792 and relays phones over the local network (TCP :8793, Bonjour `_gzmotion._tcp`).
- **iPhone** runs **Gzowo Motion** (`ios/`): a generic ARKit motion controller. It streams the phone pose 60×/s, plays Core Haptics taps and shows whatever screen the game sends (pointer, player card, menu).
- Split screen with a camera behind each player, tie-break to 7, four courts (hard, grass, clay, rooftop at night) with different bounce, a bot fills any empty slot.

## Run

```bash
npm install
npm start
```

Open http://localhost:8792 on the Mac connected to the TV, open Gzowo Motion on the phones (same Wi-Fi).

## Play

- Menu: point the phone at the TV, tap the screen to click, hold to re-center the cursor.
- Calibration: stand ~2 m apart facing the TV, hold the phone upright in front of you, screen facing you.
- Phone = racket handle, screen = strings. Walking in the room moves your player (×3), assist pulls you toward the ball.
- Serve: when the ball is tossed, any fast swing serves. Lay the phone screen-up to pause.

## iOS build

```bash
cd ios && xcodegen generate
xcodebuild -project GzowoMotion.xcodeproj -scheme GzowoMotion -destination 'generic/platform=iOS' -allowProvisioningUpdates build
```

Sounds: CC0 recordings from Freesound, see `sounds/CREDITS.md`.
