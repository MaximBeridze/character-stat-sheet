const crypto = require('crypto');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const DEFAULT_POINTS = 10;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const sessions = new Map();

app.use(express.static(__dirname));

app.get('/api/session/:code', (req, res) => {
  const session = sessions.get(cleanCode(req.params.code));
  if (!session) {
    res.status(404).json({ message: 'Session not found.' });
    return;
  }

  res.json({ code: session.code, characters: session.characters.length });
});

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.sessionCode = '';

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  send(socket, 'ready', {});

  socket.on('message', (message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      send(socket, 'error', { message: 'Invalid message.' });
      return;
    }

    handleMessage(socket, payload);
  });
});

setInterval(() => {
  wss.clients.forEach((socket) => {
    if (!socket.isAlive) {
      socket.terminate();
      return;
    }

    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

function handleMessage(socket, payload) {
  const { type, data = {} } = payload;

  if (type === 'create-session') {
    const session = createSession();
    socket.sessionCode = session.code;
    send(socket, 'session-created', { code: session.code });
    send(socket, 'state', publicSession(session));
    return;
  }

  if (type === 'host-session') {
    const session = sessions.get(cleanCode(data.code));
    if (!session) {
      send(socket, 'error', { message: 'That host session no longer exists.' });
      return;
    }

    socket.sessionCode = session.code;
    send(socket, 'state', publicSession(session));
    return;
  }

  if (type === 'join') {
    const session = sessions.get(cleanCode(data.code));
    const name = cleanName(data.name);

    if (!session) {
      send(socket, 'error', { message: 'That play code does not match an active session.' });
      return;
    }

    if (!name) {
      send(socket, 'error', { message: 'Character name is required.' });
      return;
    }

    socket.sessionCode = session.code;
    let character = session.characters.find(
      (entry) => entry.name.toLowerCase() === name.toLowerCase()
    );

    if (character) {
      send(socket, 'error', { message: 'That character name is already taken in this game.' });
      return;
    }

    character = createCharacter(name);
    session.characters.unshift(character);

    send(socket, 'joined', { characterId: character.id, code: session.code });
    broadcastState(session.code);
    return;
  }

  const session = getSocketSession(socket);
  if (!session) {
    send(socket, 'error', { message: 'Choose or join a game session first.' });
    return;
  }

  if (type === 'add-character') {
    const name = cleanName(data.name);
    if (!name) return;
    session.characters.unshift(createCharacter(name));
    broadcastState(session.code);
    return;
  }

  if (type === 'change-stat') {
    const character = findCharacter(session, data.characterId);
    const stat = data.stat === 'mana' ? 'mana' : 'health';
    const amount = Number(data.amount);
    if (!character || !Number.isFinite(amount)) return;

      const nextValue = Math.max(0, character[stat] + amount);
    character[stat] = stat === 'health' ? Math.min(DEFAULT_POINTS, nextValue) : nextValue;;
    broadcastState(session.code);
    return;
  }

  if (type === 'reset-character') {
    const character = findCharacter(session, data.characterId);
    if (!character) return;
    character.health = DEFAULT_POINTS;
    character.mana = DEFAULT_POINTS;
    broadcastState(session.code);
    return;
  }

  if (type === 'delete-character') {
    session.characters = session.characters.filter((character) => character.id !== data.characterId);
    broadcastState(session.code);
    return;
  }

  if (type === 'reset-all') {
    session.characters = session.characters.map((character) => ({
      ...character,
      health: DEFAULT_POINTS,
      mana: DEFAULT_POINTS,
    }));
    broadcastState(session.code);
    return;
  }

  if (type === 'clear-all') {
    session.characters = [];
    broadcastState(session.code);
  }
}

function createSession() {
  let code = makeCode();
  while (sessions.has(code)) {
    code = makeCode();
  }

  const session = { code, characters: [] };
  sessions.set(code, session);
  return session;
}

function publicSession(session) {
  return {
    code: session.code,
    characters: session.characters,
  };
}

function createCharacter(name) {
  return {
    id: crypto.randomUUID(),
    name,
    health: DEFAULT_POINTS,
    mana: DEFAULT_POINTS,
  };
}

function getSocketSession(socket) {
  return sessions.get(socket.sessionCode);
}

function findCharacter(session, characterId) {
  return session.characters.find((character) => character.id === characterId);
}

function cleanName(value) {
  return String(value || '').trim().slice(0, 40);
}

function cleanCode(value) {
  return String(value || '').trim().toUpperCase();
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function send(socket, type, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}

function broadcastState(code) {
  const session = sessions.get(code);
  if (!session) return;

  const payload = JSON.stringify({ type: 'state', data: publicSession(session) });
  wss.clients.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN && socket.sessionCode === code) {
      socket.send(payload);
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Party Tracker running at http://localhost:${PORT}`);
});
