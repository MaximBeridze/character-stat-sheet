const diceSelect = document.getElementById('diceSelect');
const rollDiceBtn = document.getElementById('rollDiceBtn');
const diceResult = document.getElementById('diceResult');
const rollSound = new Audio('roll.WAV');

let diceRollTimer;

rollDiceBtn.addEventListener('click', () => {
    const sides = Number(diceSelect.value);
    animateDiceRoll(sides);
});

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