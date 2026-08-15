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
const diceSelect = document.getElementById('diceSelect');
const rollDiceBtn = document.getElementById('rollDiceBtn');
const diceResult = document.getElementById('diceResult');
const rollSound = new Audio('roll.WAV');

let socket;
let reconnectTimer;
let diceRollTimer;
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

rollDiceBtn.addEventListener('click', () => {
    const sides = Number(diceSelect.value);
    animateDiceRoll(sides);
});

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
        send(game.code ? 'host-session' : 'create-session', { code: game.code });
    }
    });

    socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'session-created') {
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
    });

    socket.addEventListener('close', () => {
    status.textContent = 'Disconnected. Reconnecting...';
    reconnectTimer = setTimeout(connect, 1000);
    });
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
    if (!game.code) send('create-session');
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

    characterList.innerHTML = game.characters.map((character) => {
    const isMine = character.id === myCharacterId;
    const canControl = mode === 'host' || isMine;
    const healthPercent = Math.max(0, Math.min(100, (character.health / DEFAULT_POINTS) * 100));
    const manaPercent = Math.max(0, Math.min(100, (character.mana / DEFAULT_POINTS) * 100));

    return `
        <article class="character-card ${isMine ? 'mine' : ''}">
        <div class="card-top">
            <div>
            <h2 class="character-name">${escapeHtml(character.name)}</h2>
            <div class="small">${isMine ? 'Your character' : canControl ? 'Host controls enabled' : 'Viewing only'}</div>
            </div>
            ${mode === 'host' ? `<button class="btn btn-danger" data-action="delete" data-id="${character.id}" type="button">Delete</button>` : ''}
        </div>

        ${renderStat(character, 'health', character.health, healthPercent, canControl)}
        ${renderStat(character, 'mana', character.mana, manaPercent, canControl)}

        ${canControl ? `
            <div class="card-actions">
            <button class="btn btn-secondary" data-action="reset" data-id="${character.id}" type="button">Reset to 10/10</button>
            </div>
        ` : ''}
        </article>
    `;
    }).join('');
}

function renderStat(character, stat, value, percent, canControl) {
    const label = stat === 'health' ? 'Health' : 'Mana';
    return `
    <section class="stat-block">
        <div class="stat-header">
        <span class="label ${stat}">${label}</span>
        <span class="value">${value}</span>
        </div>
        <div class="bar"><div class="fill ${stat}" style="width:${percent}%"></div></div>
        ${canControl ? `
        <div class="controls">
            <button data-action="change" data-stat="${stat}" data-amount="-3" data-id="${character.id}" type="button">-3</button>
            <button data-action="change" data-stat="${stat}" data-amount="-1" data-id="${character.id}" type="button">-1</button>
            <button data-action="change" data-stat="${stat}" data-amount="1" data-id="${character.id}" type="button">+1</button>
            <button data-action="change" data-stat="${stat}" data-amount="3" data-id="${character.id}" type="button">+3</button>
        </div>
        ` : ''}
    </section>
    `;
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

function rollDie(sides) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return (values[0] % sides) + 1;
}

function animateDiceRoll(sides) {
    clearInterval(diceRollTimer);
    rollDiceBtn.disabled = true;
    diceSelect.disabled = true;
    diceResult.classList.add('rolling');
    playRollSound();

    const finalResult = rollDie(sides);
    const startedAt = Date.now();
    diceRollTimer = setInterval(() => {
    diceResult.textContent = `D${sides}: ${rollDie(sides)}`;

    if (Date.now() - startedAt >= 850) {
        clearInterval(diceRollTimer);
        diceResult.textContent = `D${sides}: ${finalResult}`;
        diceResult.classList.remove('rolling');
        rollDiceBtn.disabled = false;
        diceSelect.disabled = false;
    }
    }, 70);
}

function playRollSound() {
    rollSound.currentTime = 0;
    rollSound.play().catch(() => {});
}

function escapeHtml(value) {
    return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}