function renderCharacterCard(character, context) {
    const { mode, myCharacterId, defaultPoints } = context;
    const isMine = character.id === myCharacterId;
    const canControl = mode === 'host' || isMine;
    const healthPercent = getStatPercent(character.health, defaultPoints);
    const manaPercent = getStatPercent(character.mana, defaultPoints);

    return `
        <article class="character-card ${isMine ? 'mine' : ''}">
            <div class="card-top">
                <div>
                    <h2 class="character-name">${escapeHtml(character.name)}</h2>
                    <div class="small">${getCharacterStatusText(isMine, canControl)}</div>
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

function getStatPercent(value, defaultPoints) {
    return Math.max(0, Math.min(100, (value / defaultPoints) * 100));
}

function getCharacterStatusText(isMine, canControl) {
    if (isMine) return 'Your character';
    if (canControl) return 'Host controls enabled';
    return 'Viewing only';
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}