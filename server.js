/* Custom server to attach Socket.IO and serve Next.js */
const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Random.org API key from original dice.py
const RANDOM_ORG_API_KEY = 'f6e74d7b-070e-4f85-865d-d859fc0d078b';

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, { cors: { origin: '*' } });

  // Simple in-memory rooms tracking (not persistent)
  const rooms = {};

  io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on('join', ({ room, username }, cb) => {
      if (!room || !username) return cb && cb({ error: 'room and username required' });
      socket.join(room);
      rooms[room] = rooms[room] || { users: {} };
      rooms[room].users[socket.id] = { username };
      io.to(room).emit('users', Object.values(rooms[room].users));
      cb && cb({ ok: true });
    });

    socket.on('leave', ({ room }) => {
      socket.leave(room);
      if (rooms[room]) {
        delete rooms[room].users[socket.id];
        io.to(room).emit('users', Object.values(rooms[room].users));
      }
    });

    socket.on('requestRoll', async ({ room, notation }, ack) => {
      try {
        // notation: { set: ['d6','d6',...], constant: 0 }
        const n = notation.set.length;
        if (!n) return ack && ack({ error: 'empty notation' });

        // Ask random.org for n decimal fractions
        const payload = {
          jsonrpc: '2.0',
          method: 'generateDecimalFractions',
          params: {
            apiKey: RANDOM_ORG_API_KEY,
            n: n,
            decimalPlaces: 6
          },
          id: 1
        };

        const r = await fetch('https://api.random.org/json-rpc/1/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json-rpc' },
          body: JSON.stringify(payload)
        });
        const data = await r.json();
        let decimals = (data && data.result && data.result.random && data.result.random.data) || [];
        if (decimals.length < n) {
          // fallback to pseudo random
          for (let i = decimals.length; i < n; ++i) decimals.push(Math.random());
        }

        // Map decimals to dice faces according to dice_face_range (same as dice.js)
        const faceRanges = { 'd4': [1,4],'d6':[1,6],'d8':[1,8],'d10':[0,9],'d12':[1,12],'d20':[1,20],'d100':[0,9] };
        const results = [];
        for (let i = 0; i < n; ++i) {
          const type = notation.set[i];
          const rrange = faceRanges[type];
          const min = rrange[0], max = rrange[1];
          const span = max - min + 1;
          const v = Math.floor(decimals[i] * span) + min;
          // handle d10 where 10 -> 0 mapping in original code
          if (type === 'd10' && v === 10) results.push(0);
          else results.push(v);
        }

        // Broadcast roll to room
        io.to(room).emit('roll', { notation, results, by: rooms[room] && rooms[room].users[socket.id] ? rooms[room].users[socket.id].username : 'unknown' });
        ack && ack({ ok: true, results });
      }
      catch (e) {
        console.error('requestRoll error', e);
        ack && ack({ error: e.message });
      }
    });

    socket.on('disconnect', () => {
      // remove from any rooms
      for (const room in rooms) {
        if (rooms[room].users && rooms[room].users[socket.id]) delete rooms[room].users[socket.id];
        io.to(room).emit('users', Object.values((rooms[room] && rooms[room].users) || {}));
      }
    });
  });

  // Keep Next.js handling everything else
  server.all('*', (req, res) => handle(req, res));

  const port = parseInt(process.env.PORT || '3000', 10);
  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:' + port);
  });
});
