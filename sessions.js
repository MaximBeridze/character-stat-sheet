const crypto = require('crypto');
const DEFAULT_POINTS = 10;
const sessions = new Map();

function createSession() {
  let code = makeCode();
  while (sessions.has(code)) {
    code = makeCode();
  }

    const session = {
    code,
    hostToken: crypto.randomBytes(32).toString('hex'),
    characters: [],
    };

    sessions.set(code, session);
    return session;
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createCharacter(name) {
  return {
    id: crypto.randomUUID(),
    name,
    health: DEFAULT_POINTS,
    mana: DEFAULT_POINTS,
  };
}

function publicSession(session) {
  return {
    code: session.code,
    characters: session.characters,
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

module.exports = {
  DEFAULT_POINTS,
  sessions,
  createSession,
  createCharacter,
  publicSession,
  getSocketSession,
  findCharacter,
  cleanName,
  cleanCode,
};
