const DEFAULT_POINTS = 10;
const PLAYER_ID_KEY = 'party-tracker-player-id';
const PLAYER_CODE_KEY = 'party-tracker-player-code';

const landingScreen = document.getElementById('landingScreen');
const sessionScreen = document.getElementById('sessionScreen');
const chooseHostBtn = document.getElementById('chooseHostBtn');
const choosePlayerBtn = document.getElementById('choosePlayerBtn');
const backBtn = document.getElementById('backBtn');
const modeLabel = document.getElementById('modeLabel');
const addForm = document.getElementById('addForm');
const joinForm = document.getElementById('joinForm');
const joinedPanel = document.getElementById('joinedPanel');
const joinedName = document.getElementById('joinedName');
const leaveGameBtn = document.getElementById('leaveGameBtn');
const nameInput = document.getElementById('nameInput');
const codeInput = document.getElementById('codeInput');
const joinNameInput = document.getElementById('joinNameInput');
const characterList = document.getElementById('characterList');
const summary = document.getElementById('summary');
const status = document.getElementById('status');
const sessionCode = document.getElementById('sessionCode');
const resetAllBtn = document.getElementById('resetAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');


let socket;
let reconnectTimer;
let hostCode = ''
let hostToken = ''
const requestedMode = new URLSearchParams(window.location.search).get('mode');
let mode = requestedMode === 'host' || requestedMode === 'player' ? requestedMode : '';
let myCharacterId = localStorage.getItem(PLAYER_ID_KEY) || '';
let playerSessionCode = localStorage.getItem(PLAYER_CODE_KEY) || '';
let game = { code: '', characters: [] };

if (mode) setMode(mode);
connect();

addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    send('add-character', { name });
    nameInput.value = '';
    nameInput.focus();
});

joinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = codeInput.value.trim().toUpperCase();
    const name = joinNameInput.value.trim();
    if (!code || !name) return;
    send('join', { code, name });
});

chooseHostBtn.addEventListener('click', () => setMode('host'));
choosePlayerBtn.addEventListener('click', () => setMode('player'));
leaveGameBtn.addEventListener('click', () => {
    if (!myCharacterId) return;
    send('delete-character', { characterId: myCharacterId });
    myCharacterId = '';
    playerSessionCode = '';
    localStorage.removeItem(PLAYER_ID_KEY);
    localStorage.removeItem(PLAYER_CODE_KEY);
    status.textContent = 'You left the game.';
    updatePlayerJoinState();
    render();
});

backBtn.addEventListener('click', () => {
    mode = '';
    landingScreen.classList.remove('hidden');
    sessionScreen.classList.add('hidden');
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url);
});

resetAllBtn.addEventListener('click', () => send('reset-all'));

clearAllBtn.addEventListener('click', () => {
    if (!game.characters.length) return;
    if (window.confirm('Clear this session for everyone?')) {
    myCharacterId = '';
    playerSessionCode = '';
    localStorage.removeItem(PLAYER_ID_KEY);
    localStorage.removeItem(PLAYER_CODE_KEY);
    send('clear-all');
    }
});

characterList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const { id, action, stat, amount } = button.dataset;
    if (mode === 'player' && id !== myCharacterId) return;

    if (action === 'delete') send('delete-character', { characterId: id });
    if (action === 'change') send('change-stat', { characterId: id, stat, amount: Number(amount) });
    if (action === 'reset') send('reset-character', { characterId: id });
});

function connect() {
    clearTimeout(reconnectTimer);
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${window.location.host}`);
    status.textContent = 'Connecting...';

    socket.addEventListener('open', () => {
    status.textContent = 'Live session connected';
    if (mode === 'host') {
        openHostSession()
    }
    });

    socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'session-created') {
        hostCode = message.data.code;
        hostToken = message.data.hostToken;
        game = { code: message.data.code, characters: [] };
        status.textContent = 'Host session ready. Share the play code with your players.';
        render();
    }
    if (message.type === 'state') {
        game = message.data;
        render();
    }
    if (message.type === 'joined') {
        myCharacterId = message.data.characterId;
        playerSessionCode = message.data.code;
        localStorage.setItem(PLAYER_ID_KEY, myCharacterId);
        localStorage.setItem(PLAYER_CODE_KEY, playerSessionCode);
        status.textContent = 'Joined. Your controls are active.';
        render();
    }
    if (message.type === 'error') {
        status.textContent = message.data.message;
    }

    if (message.type === 'host-session-rejected') {
    hostCode = '';
    hostToken = '';
    openHostSession();
    }
    });

    socket.addEventListener('close', () => {
    status.textContent = 'Disconnected. Reconnecting...';
    reconnectTimer = setTimeout(connect, 1000);
    });
}

function openHostSession() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    if (hostCode && hostToken) {
        send('host-session', { code: hostCode, hostToken });
    } else {
        send('create-session');
    }
}


function send(type, data = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
    status.textContent = 'Still connecting. Try again in a moment.';
    return;
    }
    socket.send(JSON.stringify({ type, data }));
}

function setMode(nextMode) {
    mode = nextMode;
    landingScreen.classList.add('hidden');
    sessionScreen.classList.remove('hidden');
    document.querySelectorAll('.host-only').forEach((element) => element.classList.toggle('hidden', mode !== 'host'));
    modeLabel.textContent = mode === 'host' ? 'Host Board' : 'Player Control';
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    window.history.replaceState({}, '', url);
    updatePlayerJoinState();
    if (mode === 'player' && !getMyCharacter()) codeInput.focus();
    if (mode === 'host') {
    openHostSession()
    nameInput.focus();
    }
    render();
}

function render() {
    sessionCode.textContent = mode === 'host' ? game.code || '------' : '------';
    if (!mode) return;

    updatePlayerJoinState();
    summary.textContent = `${game.characters.length} character${game.characters.length === 1 ? '' : 's'}`;

    if (!game.characters.length) {
    characterList.innerHTML = '<div class="empty">No characters yet. Add one from the host board or join as a player.</div>';
    return;
    }

    characterList.innerHTML = game.characters.map((character) => renderCharacterCard(character, {
        mode,
        myCharacterId,
        defaultPoints: DEFAULT_POINTS,
    })).join('')
}

function updatePlayerJoinState() {
    const isPlayer = mode === 'player';
    const mine = getMyCharacter();
    document.querySelectorAll('.player-only').forEach((element) => element.classList.toggle('hidden', !isPlayer));
    joinForm.classList.toggle('hidden', !isPlayer || Boolean(mine));
    joinedPanel.classList.toggle('hidden', !isPlayer || !mine);
    if (mine) {
    joinedName.textContent = `Joined as ${mine.name}`;
    }
}

function getMyCharacter() {
    return game.characters.find((character) => character.id === myCharacterId);
}