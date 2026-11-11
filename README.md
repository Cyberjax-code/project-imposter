# PROJECT: IMPOSTOR — Prototype 0.1

A browser-based 3D multiplayer social-deduction prototype.

## Deploy it as a public website (GitHub + Render)

You need a GitHub account and a Render account. The app is configured for Render using `render.yaml`.

### 1. Put the project on GitHub
1. Download and extract `project_impostor_starter.zip`.
2. Sign in at https://github.com/ and create a new repository named `project-impostor`.
3. Keep it Public or Private (either works when connecting your own Render account).
4. Upload the contents of the extracted `project_impostor` folder to the repository root. Make sure `package.json`, `server.js`, `render.yaml`, and the `public` folder are at the top level.

### 2. Deploy on Render
1. Sign in at https://render.com/ using GitHub.
2. Choose **New +** → **Blueprint**.
3. Select the `project-impostor` GitHub repository.
4. Render reads `render.yaml`; review and create the service.
5. Wait for deployment to finish. Render will show a public URL ending in `onrender.com`.
6. Open that URL on your Android phone and share it with your friends.

If Blueprint is unavailable, choose **New +** → **Web Service**, connect the repository, and set:
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

### 3. Play
1. Open the public URL.
2. Create a room and share its six-character code.
3. Friends open the same URL and join with the code.
4. Start requires 4–8 players.

## Run locally on Windows 11
Install Node.js 18+ from https://nodejs.org/. Extract the ZIP, open Command Prompt in the project folder, then run:
```bash
npm install
npm start
```
Open http://localhost:3000.

## Current prototype features
- Private room codes; 4–8 players
- Host starts the game
- Secret crew/impostor roles
- 3D scene with two map layouts
- Touch-friendly movement buttons
- Crew task counter
- Nearby elimination action for impostor
- Emergency meeting and voting
- Text chat
- Suit color selection

## Important limitations
- This is an early learning prototype, not a production-ready commercial game.
- Voice chat is not included yet. It needs WebRTC audio, microphone permissions, and HTTPS deployment.
- Tasks are currently represented by a simple task button; interactive task minigames are a next step.
- Add rate limits, reconnect handling, robust server-side proximity validation, anti-cheat checks, and room cleanup before public release.
- The free hosting tier may sleep after inactivity; the first visit after sleeping can take a little time to wake up.
- The public URL is created by Render after you deploy; it cannot be generated just by downloading this ZIP.
