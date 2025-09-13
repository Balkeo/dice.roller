Teal 3D Dice — Next.js + TypeScript

Run locally:

1. npm install
2. npm run dev
3. Open http://localhost:3000

Notes:
- Copy your three.min.js and cannon.min.js into public/libs/
- public/dice/ contains the original vanilla JS files (teal.js, dice.js, main.js). The React component initializes and drives the dice using the exposed window.teal.dice API.
- The server (server.js) attaches Socket.IO. Rooms are ephemeral and stored in-memory.
- Treat the Random.org API key as sensitive — in production put it in environment variables.
