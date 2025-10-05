const express = require('express');
const compression = require('compression');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

// gzip/brotli where supported
app.use(compression());

// serve everything in the repo root (adjust if your app is in a subfolder)
const PUB_DIR = path.join(__dirname);
app.use(express.static(PUB_DIR, {
  etag: true,
  lastModified: true,
  maxAge: '1d',
  setHeaders(res, filePath) {
    if (/\.(html)$/.test(filePath)) {
      // don’t aggressively cache HTML
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// fallback to index.html (if you ever route client-side)
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUB_DIR, 'index.html'));
});

// Create HTTP + WebSocket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// In-memory matchmaking/rooms (stateless deployments like Render will keep this per-instance)
const rooms = new Map(); // code -> { code, sockets:Set<string>, ready:{p1:null|Sel, p2:null|Sel}, createdAt:number }
const queued = []; // random matchmaking queue (array of socket IDs)

function genCode(len = 6){
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
  let out = '';
  for(let i=0;i<len;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)];
  return out;
}
function ensureUniqueCode(){
  let code = genCode(); let attempts = 0;
  while(rooms.has(code) && attempts < 100){ code = genCode(); attempts++; }
  return code;
}
function getRoomForSocket(socket){
  const code = socket.data?.roomCode;
  if (!code) return null;
  return rooms.get(code) || null;
}
function roomSockets(room){
  return Array.from(room.sockets).map(id => io.sockets.sockets.get(id)).filter(Boolean);
}
function emitToRoomExcept(roomCode, exceptId, event, payload){
  roomSockets(rooms.get(roomCode) || {sockets:new Set()}).forEach(s => {
    if (s.id !== exceptId){ s.emit(event, payload); }
  });
}

io.on('connection', (socket) => {
  socket.data = socket.data || {};

  socket.on('createRoom', ({ name } = {}) => {
    const code = ensureUniqueCode();
    rooms.set(code, { code, sockets: new Set([socket.id]), ready: { p1:null, p2:null }, createdAt: Date.now() });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = 'p1';
    socket.data.name = name || '';
    socket.emit('roomCreated', { code, role: 'p1' });
  });

  socket.on('joinRoom', ({ code, name } = {}) => {
    code = (code||'').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room){ socket.emit('errorMsg', { message: 'Room not found' }); return; }
    if (room.sockets.size >= 2){ socket.emit('errorMsg', { message: 'Room full' }); return; }
    room.sockets.add(socket.id);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = 'p2';
    socket.data.name = name || '';
    socket.emit('roomJoined', { code, role: 'p2' });
    emitToRoomExcept(code, socket.id, 'playerJoined', { role: 'p2', name: socket.data.name });
  });

  socket.on('randomQueue', ({ name } = {}) => {
    socket.data.name = name || '';
    // If there is someone waiting, pair them
    if (queued.length > 0){
      const otherId = queued.shift();
      const other = io.sockets.sockets.get(otherId);
      if (!other || other.data.roomCode){
        // other is gone or already matched; try again or queue self
        if (!socket.data.roomCode) queued.push(socket.id);
        return;
      }
      const code = ensureUniqueCode();
      rooms.set(code, { code, sockets: new Set([other.id, socket.id]), ready: { p1:null, p2:null }, createdAt: Date.now() });
      // Assign roles deterministically: first queued becomes p1
      other.join(code); other.data.roomCode = code; other.data.role = 'p1';
      socket.join(code); socket.data.roomCode = code; socket.data.role = 'p2';
      other.emit('matched', { code, role: 'p1' });
      socket.emit('matched', { code, role: 'p2' });
    } else {
      // enqueue
      if (!queued.includes(socket.id)) queued.push(socket.id);
      socket.emit('queued');
    }
  });

  // Player declares ready with local selection; server will start match when both sides are ready
  // payload: { charId, alt, rules?, stageId? }
  socket.on('ready', (payload = {}) => {
    const room = getRoomForSocket(socket); if (!room) return;
    const role = socket.data.role === 'p1' ? 'p1' : 'p2';
    room.ready[role] = {
      charId: String(payload.charId || ''),
      alt: Math.max(0, parseInt(payload.alt||0, 10) || 0),
      // only trust p1 for these
      rules: role === 'p1' ? (payload.rules || null) : null,
      stageId: role === 'p1' ? (payload.stageId || null) : null,
    };

    // If both ready, emit start config
    if (room.ready.p1 && room.ready.p2){
      const rules = room.ready.p1.rules || { stocks:3, time:0, ratio:1.0, itemsOn:true, itemFreq:8, cpuLevel:0, shake:true, sparks:true };
      const stageId = room.ready.p1.stageId || 'trainingRoom';
      const init = {
        code: room.code,
        p1: { id: room.ready.p1.charId || 'bruiser', alt: room.ready.p1.alt||0 },
        p2: { id: room.ready.p2.charId || 'ninja', alt: room.ready.p2.alt||0 },
        rules,
        stageId
      };
      io.to(room.code).emit('start', init);
      // reset readiness for potential rematch
      room.ready.p1 = null; room.ready.p2 = null;
    } else {
      emitToRoomExcept(room.code, socket.id, 'peerReady', { role });
    }
  });

  // Input relay
  // payload: { controls: {left,right,attack,...}, t?:number }
  socket.on('input', (payload = {}) => {
    const room = getRoomForSocket(socket); if (!room) return;
    emitToRoomExcept(room.code, socket.id, 'peerInput', { controls: payload.controls || {}, t: payload.t || Date.now() });
  });

  socket.on('leaveRoom', () => {
    const room = getRoomForSocket(socket); if (!room) return;
    // notify peer and clean up
    emitToRoomExcept(room.code, socket.id, 'peerLeft', {});
    room.sockets.delete(socket.id);
    socket.leave(room.code);
    socket.data.roomCode = null; socket.data.role = null;
    if (room.sockets.size === 0){ rooms.delete(room.code); }
  });

  socket.on('disconnect', () => {
    // remove from queue
    const idx = queued.indexOf(socket.id); if (idx >= 0) queued.splice(idx,1);
    // handle room cleanup
    const room = getRoomForSocket(socket);
    if (room){
      emitToRoomExcept(room.code, socket.id, 'peerLeft', {});
      room.sockets.delete(socket.id);
      if (room.sockets.size === 0){ rooms.delete(room.code); }
    }
  });
});

server.listen(PORT, () => {
  console.log(`SuperStrikeUltamate running on :${PORT}`);
});
