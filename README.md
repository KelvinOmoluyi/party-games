# Stick Party 🎉

Team stickman mini-games for up to **16 players (4 teams × 4)**. Everyone plays on their own phone,
and **your PC is the server**. Nothing goes over the internet; it all runs on your local Wi-Fi.

## Games

| Game | Controls | How you win |
|---|---|---|
| 🏃 **Stick Sprint** | Mash RUN | Team with the fastest average finish time |
| 🪢 **Team Tug** | Mash PULL | Drag the knot into your team's zone (fair for uneven teams) |
| 💥 **Sumo Smash** | Joystick + DASH | Last team standing on the shrinking platform |
| ⚡ **Quick Draw** | Tap when it says TAP! | Lowest average reaction time over 3 rounds (false start = +1000 ms) |
| 🚩 **Tank Flag Clash** | Joystick + FIRE | Most enemy flags captured in 100 s (hits break ties) |
| 🐔 **Chicken Roundup** | Joystick + DASH | Most chickens packed into your pen in 60 s. DASH into enemies to knock their chickens loose |
| 🏙️ **Rooftop Run** | JUMP (tap again to double jump) | Side-scrolling rooftop parkour. Fastest team average to the finish; falls and spikes send you back to the last flag |
| ⛵ **Ice Boat Derby** | Joystick + BOOST | 3 slippery laps around a frozen lake. Boats drift, so turn early |
| 🪨 **Boulder Rush** | Joystick + DODGE | Boulders roll in after a red warning and get faster. DODGE gives a moment of invincibility. Last team standing |
| 🧨 **Hot Dynamite** | Joystick + DASH | Bump someone to pass the lit dynamite. Whoever holds it when it blows is out. Last team standing |
| 🚀 **Missile Mayhem** | Joystick + FIRE | 3 lives each. Grab 🚀 crates for missiles (+2) and rare ❤️ pickups for a life back. No friendly fire. Last team standing |

Each round: 1st place gets **3 points**, 2nd **2**, 3rd **1**. Points add up across rounds on the scoreboard.

**Bigger maps for bigger groups:** with **5+ players**, Tank Flag Clash switches to a wider maze map, and
Chicken Roundup switches to a wider farm with more chickens and a 70-second round.

## Party-day setup

1. **Connect the PC and every phone to the same network**: your home Wi-Fi router, *or* turn on a
   phone's hotspot and connect the PC and all the other phones to it.
2. On the PC, in this folder:
   ```bash
   npm run party
   ```
   This builds the app and starts the server. The terminal prints the address, e.g.
   `http://192.168.0.125:3000`.
3. Everyone opens that address on their phone (or scans the **QR code** shown in the app),
   types a name, and taps a team.
4. The first person to join is the **host** 👑. The host picks the games. You can also play from the PC
   browser at `http://localhost:3000`, using WASD/arrows + Space.

After the first `npm run party`, you can start faster next time with `npm run start`.

**Tips for phones**
- Games **always play in landscape** on phones. If the phone is upright, the game screen is drawn
  sideways, so just turn the phone. On Android, your first touch in a game also goes fullscreen and
  locks landscape. Menus stay upright.
- 🔊 toggles sound effects, 🎵 toggles music, and ⛶ toggles fullscreen.
- Sound starts after your first tap, because phones block audio until you touch the page.
- The first build needs internet once to download the two fonts. After that, everything works offline.

## If phones can't connect

- **Windows Firewall:** the first time the server starts, Windows asks whether to allow Node.js on
  networks. Tick **Private networks** and click Allow. If you missed it, open *Windows Security →
  Firewall & network protection → Allow an app through firewall* and enable Node.js for Private.
- **Network set to Public:** in *Settings → Network & internet → Wi-Fi → (your network)*, set the
  network profile to **Private**.
- **Guest Wi-Fi / "AP isolation":** some routers' guest networks block devices from seeing each other.
  Use the main network, or a phone hotspot.
- **Wrong address:** if the terminal lists more than one address, try the `192.168.x.x` one first.
- **Phone locked or dropped out:** just reopen the page. You'll rejoin with the same name and team.

## Tips

- With uneven teams, Team Tug evens things out automatically. The other games count every player,
  so balance the teams for the fairest scores.
- The host can remove ghost players (✕ next to their name), end a game early (✕ in the top bar), or reset scores.
- A phone hotspot works fine for 16 players. A router usually works even better.

## Development

```bash
npm install
npm run dev        # dev mode with hot reload (slower on phones)
npm run typecheck
```

- `server.ts`: custom Next.js server + Socket.IO
- `src/server/room.ts`: lobby, teams, rounds and scoring
- `src/server/games/*`: game logic, run on the server at 30 ticks/s
- `src/client/*`: phone UI, canvas views and touch controls
