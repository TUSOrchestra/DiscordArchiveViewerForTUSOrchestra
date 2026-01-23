/**
 * Minimal CSV parser (supports quoted fields and commas/newlines inside quotes).
 */
function parseCsv(text){
    const rows = [];
    let row = [];
    let field = '';
    let i = 0;
    let inQuotes = false;

    const pushField = () => {
        row.push(field);
        field = '';
    };
    const pushRow = () => {
        // ignore completely empty trailing lines
        const allEmpty = row.every(v => (v ?? '').trim() === '');
        if(!allEmpty) rows.push(row);
        row = [];
    };

    while(i < text.length){
        const c = text[i];
        if(inQuotes){
            if(c === '"'){
                const next = text[i+1];
                if(next === '"'){ // escaped quote
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            field += c;
            i++;
            continue;
        }
        if(c === '"'){
            inQuotes = true;
            i++;
            continue;
        }
        if(c === ','){
            pushField();
            i++;
            continue;
        }
        if(c === '\r'){
            // ignore CR
            i++;
            continue;
        }
        if(c === '\n'){
            pushField();
            pushRow();
            i++;
            continue;
        }
        field += c;
        i++;
    }
    pushField();
    pushRow();
    return rows;
}

function toGraphemes(s){
    // Best-effort: spread by code points. (Good enough for English and most inputs.)
    return [...String(s ?? '')];
}

function normalizeWord(s){
    // Keep as-is except trimming. Use lowercase for Latin letters.
    return String(s ?? '').trim().toLowerCase();
}

function insertAtCursor(inputEl, text){
    const start = inputEl.selectionStart ?? inputEl.value.length;
    const end = inputEl.selectionEnd ?? inputEl.value.length;
    const before = inputEl.value.slice(0, start);
    const after = inputEl.value.slice(end);
    inputEl.value = before + text + after;
    const nextPos = start + text.length;
    inputEl.setSelectionRange(nextPos, nextPos);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

let candidateState = null; // { options: string[], index: number }

function hideCandidates(){
    candidateState = null;
    if(el.candidates){
        el.candidates.classList.add('hidden');
        el.candidates.innerHTML = '';
    }
}

function renderCandidates(){
    if(!candidateState || !el.candidates) return;
    el.candidates.innerHTML = '';

    const list = document.createElement('ul');
    list.className = 'cand-list';
    list.setAttribute('role', 'listbox');

    candidateState.options.forEach((opt, idx) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(idx === candidateState.index));

        const b = document.createElement('div');
        b.className = 'cand' + (idx === candidateState.index ? ' sel' : '');
        b.textContent = opt;
        b.addEventListener('mousedown', (e) => {
            // prevent input blur
            e.preventDefault();
        });
        b.addEventListener('click', () => {
            commitCandidate(idx);
        });

        li.appendChild(b);
        list.appendChild(li);
    });

    el.candidates.appendChild(list);
}

function showCandidates(options, preferredIndex = 0){
    if(!el.candidates) return;
    candidateState = {
        options: options.map(v => normalizeWord(v)),
        index: Math.max(0, Math.min(options.length - 1, preferredIndex)),
    };
    renderCandidates();
    el.candidates.classList.remove('hidden');
}

function cycleCandidate(delta){
    if(!candidateState) return;
    const n = candidateState.options.length;
    candidateState.index = (candidateState.index + delta + n) % n;
    renderCandidates();
}

function commitCandidate(indexOverride = null){
    if(!candidateState) return;
    const idx = indexOverride == null ? candidateState.index : indexOverride;
    const ch = candidateState.options[idx];
    hideCandidates();
    addChar(ch);
}

/** Wordle scoring with duplicates handling */
function scoreGuess(answerChars, guessChars){
    const n = answerChars.length;
    const res = Array(n).fill('no');
    const counts = new Map();
    for(let i=0;i<n;i++){
        const a = answerChars[i];
        counts.set(a, (counts.get(a) ?? 0) + 1);
    }

    // First pass: exact matches
    for(let i=0;i<n;i++){
        if(guessChars[i] === answerChars[i]){
            res[i] = 'ok';
            counts.set(answerChars[i], counts.get(answerChars[i]) - 1);
        }
    }
    // Second pass: present elsewhere
    for(let i=0;i<n;i++){
        if(res[i] === 'ok') continue;
        const g = guessChars[i];
        const left = counts.get(g) ?? 0;
        if(left > 0){
            res[i] = 'hit';
            counts.set(g, left - 1);
        }
    }
    return res;
}

    const el = {
    loadBtn: document.getElementById('loadBtn'),
    newBtn: document.getElementById('newBtn'),
    ruleBtn: document.getElementById('ruleBtn'),
    rulePanel: document.getElementById('rulePanel'),
    filteredCount: document.getElementById('filteredCount'),
    diff1: document.getElementById('diff1'),
    diff2: document.getElementById('diff2'),
    diff3: document.getElementById('diff3'),
    diff4: document.getElementById('diff4'),
    diff5: document.getElementById('diff5'),
    count1: document.getElementById('count1'),
    count2: document.getElementById('count2'),
    count3: document.getElementById('count3'),
    count4: document.getElementById('count4'),
    count5: document.getElementById('count5'),
    status: document.getElementById('status'),
    game: document.getElementById('game'),
    len: document.getElementById('len'),
    left: document.getElementById('left'),
    grid: document.getElementById('grid'),
    giveUpBtn: document.getElementById('giveUpBtn'),
    msg: document.getElementById('msg'),
    candidates: document.getElementById('candidates'),
    kbd1: document.getElementById('kbd1'),
    kbd2: document.getElementById('kbd2'),
    kbd3: document.getElementById('kbd3'),
    kbd4: document.getElementById('kbd4'),
    resultModal: document.getElementById('resultModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalAnswer: document.getElementById('modalAnswer'),
    modalDesc: document.getElementById('modalDesc'),
    modalShareBtn: document.getElementById('modalShareBtn'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
};

let allEntries = []; // {word, description, abbreviation, difficulty}
let entries = []; // filtered by difficulty
let current = null; // {word, description, abbreviation, difficulty}
let answerChars = [];
let maxTries = 6;
let turn = 0;
let over = false;
let lastResult = null; // { success, answer, description, turns, maxTries }
const keyState = new Map(); // letter -> ok/hit/no
let currentInput = ''; // 現在の入力文字列
let inputEnabled = false; // 入力が有効かどうか

// 入力有効/無効を切り替える関数
function enableGameUI(flag) {
    inputEnabled = !!flag;
    // ギブアップボタンの有効/無効
    if (el.giveUpBtn) el.giveUpBtn.disabled = !flag;
    // 新しい問題ボタンは常に有効（entriesがあれば）
    if (el.newBtn) el.newBtn.disabled = (entries.length === 0);
}

// Allowed characters (must match on-screen keyboard)
const ALLOWED_CHARS = new Set([
    'q','w','e','r','t','y','u','i','o','p',
    'a','s','d','f','g','h','j','k','l',
    'z','x','c','v','b','n','m',
    'ä','ö','ü','ë','ï','ß','é','è','à','ù','â','ê','î','ô','û','ç',"'",'-'
]);

function setStatus(text){
    el.status.textContent = text;
}

function setMsg(text, kind = ''){
    if(kind === 'error' && text){
        // トーストで表示
        showToast(text);
    } else {
        el.msg.textContent = text;
        el.msg.className = 'msg' + (kind ? ' ' + kind : '');
    }
}

function showToast(text){
    const container = document.getElementById('toastContainer');
    if(!container) return;

    // 現在の入力行の位置を取得
    const row = el.grid.children[turn];
    if(row && row.classList.contains('grid-row')){
        const rowRect = row.getBoundingClientRect();
        const gridRect = el.grid.getBoundingClientRect();
        const topPos = rowRect.top - gridRect.top + rowRect.height / 2;
        container.style.top = `${topPos}px`;
    }

    // トーストを表示
    container.innerHTML = `<div class="toast">${text}</div>`;

    // 入力セルの更新は別関数で行う
    updateInputCells();
}

function clearKeyboard(){
    keyState.clear();
    renderKeyboard();
}

function renderKeyboard(){
    const rows = [
        ['q','w','e','r','t','y','u','i','o','p'],
        ['a','s','d','f','g','h','j','k','l','BKSP'],
        ['z','x','c','v','b','n','m','ENTER'],
        ['ä','ö','ü','ë','ï','ß','é','è','à','ù','â','ê','î','ô','û','ç','\'','-'],
    ];
    const targets = [el.kbd1, el.kbd2, el.kbd3, el.kbd4];
    targets.forEach(t => t.innerHTML = '');

    rows.forEach((r, idx) => {
        r.forEach(k => {
            const b = document.createElement('div');
            b.className = 'k' + ((k === 'ENTER' || k === 'BKSP') ? ' wide' : '');
            b.textContent = k === 'BKSP' ? '⌫' : (k === 'ENTER' ? 'Enter' : k);

            const state = keyState.get(k);
            if(state) b.classList.add(state);

            b.addEventListener('click', () => {
                if(!inputEnabled) return;
                if(k === 'ENTER'){
                    submitGuess();
                    return;
                }
                if(k === 'BKSP'){
                    deleteLastChar();
                    return;
                }
                // regular letter
                addChar(k);
            });

            targets[idx].appendChild(b);
        });
    });
}

function updateKeyboardFromScore(guessChars, score){
    // Priority: ok > hit > no
    const rank = { no: 0, hit: 1, ok: 2 };
    for(let i=0;i<guessChars.length;i++){
        const ch = guessChars[i];
        if(ch === ' ') continue;
        const next = score[i];
        const prev = keyState.get(ch);
        if(!prev || rank[next] > rank[prev]) keyState.set(ch, next);
    }
    renderKeyboard();
}

function buildGrid(cols, rows){
    el.grid.innerHTML = '';
    // toastContainerを必ず再生成
    const toastDiv = document.createElement('div');
    toastDiv.id = 'toastContainer';
    toastDiv.className = 'toast-container';
    el.grid.appendChild(toastDiv);

    // Calculate cell size to fit within panel width (shrink only, not expand)
    const maxCellSize = 42;
    const maxGap = 8;
    const containerWidth = el.grid.parentElement?.clientWidth ?? 600;
    const neededWidth = cols * maxCellSize + (cols - 1) * maxGap;

    let cellSize = maxCellSize;
    let cellGap = maxGap;
    if(neededWidth > containerWidth){
        // Shrink proportionally
        const ratio = containerWidth / neededWidth;
        cellSize = Math.floor(maxCellSize * ratio);
        cellGap = Math.max(2, Math.floor(maxGap * ratio));
    }

    el.grid.style.setProperty('--cell-size', `${cellSize}px`);
    el.grid.style.setProperty('--grid-gap', `${cellGap}px`);
    el.grid.style.setProperty('--cell-font', `${Math.max(10, Math.floor(cellSize * 0.35))}px`);
    el.grid.style.gridTemplateRows = `repeat(${rows}, auto)`;

    for(let r=0;r<rows;r++){
        const row = document.createElement('div');
        row.className = 'grid-row';
        row.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size, 42px))`;
        for(let c=0;c<cols;c++){
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.textContent = '';
            row.appendChild(cell);
        }
        el.grid.appendChild(row);
    }

    // 現在のターン行の入力を更新
    updateInputCells();
}

function updateInputCells(){
    // 現在のターン行を取得
    const row = el.grid.children[turn+1];
    if(!row) return;
    console.log('Updating input cells:', currentInput);
    const chars = toGraphemes(currentInput.toLowerCase());
    const cells = row.children;
    console.log(inputEnabled, turn, row);
    for(let i=0;i<cells.length;i++){
        const cell = cells[i];
        // 入力中の行のみ入力文字を表示
        cell.textContent = chars[i] ?? '';
        cell.classList.remove('input-cell', 'current');
        if(inputEnabled){
            cell.classList.add('input-cell');
            // 入力が空のときも最初のセルをハイライト
            if((chars.length === 0 && i === 0) || (i === chars.length && i < cells.length)){
                cell.classList.add('current');
            }
        }
    }
}

// 文字を追加
function addChar(ch){
    if(!inputEnabled) return;
    const chars = toGraphemes(currentInput);
    if(chars.length >= answerChars.length) return;
    if(!ALLOWED_CHARS.has(ch.toLowerCase())) return;
    currentInput = currentInput + ch.toLowerCase();
    updateInputCells();
}

// 最後の文字を削除
function deleteLastChar(){
    if(!inputEnabled) return;
    const chars = toGraphemes(currentInput);
    if(chars.length === 0) return;
    chars.pop();
    currentInput = chars.join('');
    updateInputCells();
}

function writeRow(rowIndex, guessChars, score){
    const row = el.grid.children[rowIndex];
    if(!row) return;
    for(let i=0;i<answerChars.length;i++){
        const cell = row.children[i];
        const ch = guessChars[i] ?? '';
        cell.textContent = ch;
        cell.classList.remove('ok','hit','no');
        cell.classList.add(score[i]);
    }
}

function getSelectedDifficulties(){
    const selected = [];
    if(el.diff1?.checked) selected.push(1);
    if(el.diff2?.checked) selected.push(2);
    if(el.diff3?.checked) selected.push(3);
    if(el.diff4?.checked) selected.push(4);
    if(el.diff5?.checked) selected.push(5);
    return selected;
}

function updateFilteredEntries(){
    const selected = getSelectedDifficulties();
    if(selected.length === 0){
        entries = [...allEntries];
    } else {
        entries = allEntries.filter(e => selected.includes(e.difficulty));
    }
    // Per-level counts
    for(let lv = 1; lv <= 5; lv++){
        const countEl = el['count' + lv];
        if(countEl){
            const c = allEntries.filter(e => e.difficulty === lv).length;
            countEl.textContent = `(${c})`;
        }
    }
    if(el.filteredCount){
        el.filteredCount.textContent = `対象: ${entries.length}件 / 全${allEntries.length}件`;
    }
    // Disable newBtn if no entries available
    if(el.newBtn){
        el.newBtn.disabled = (allEntries.length === 0 || entries.length === 0);
    }
}

function pickRandomEntry(){
    updateFilteredEntries();
    if(entries.length === 0) return null;
    const idx = Math.floor(Math.random() * entries.length);
    return entries[idx];
}

function startNewGame(){
    current = pickRandomEntry();
    if(!current){
        setMsg('CSVを先に読み込んでください', 'error');
        return;
    }

    const word = normalizeWord(current.word);
    const chars = toGraphemes(word);
    if(chars.length === 0){
        setMsg('wordが空の行があります', 'error');
        return;
    }

    answerChars = chars;
    maxTries = chars.length;
    turn = 0;
    over = false;
    clearKeyboard();

    el.game.classList.remove('hidden');
    el.len.textContent = String(answerChars.length);
    updateRemainingDisplay();
    buildGrid(answerChars.length, maxTries);

    currentInput = '';

    enableGameUI(true);
    setMsg('');
    updateInputCells();
    document.activeElement.blur(); // ← 追加: フォーカスを外してキーボード入力を受け付ける
}

function endGame(success){
    over = true;
    enableGameUI(false);
    const ans = answerChars.join('');
    updateRemainingDisplay();

    // Store result for sharing
    lastResult = {
        success,
        answer: ans,
        description: current?.description ?? '',
        turns: turn,
        maxTries
    };

    // Show result modal
    if(el.resultModal){
        el.modalTitle.textContent = success ? '正解！' : '終了';
        el.modalTitle.className = 'modal-title ' + (success ? 'success' : 'error');
        el.modalAnswer.textContent = ans + (current?.abbreviation ? ` (${current.abbreviation})` : '');
        el.modalDesc.textContent = current?.description ?? '';
        el.resultModal.classList.remove('hidden');
    }
}

function submitGuess(){
    if(over || !inputEnabled) return;
    const guessWord = normalizeWord(currentInput);
    const guessChars = toGraphemes(guessWord);

    if(guessChars.length !== answerChars.length){
        shakeCurrentRow();
        setMsg('Not enough letters', 'error');
        return;
    }
    if(guessChars.some(ch => ch.trim() === '')){
        shakeCurrentRow();
        setMsg('Not enough letters', 'error');
        return;
    }

    const score = scoreGuess(answerChars, guessChars);
    writeRow(turn, guessChars, score);
    updateKeyboardFromScore(guessChars, score);

    turn++;
    updateRemainingDisplay();
    currentInput = '';
    updateInputCells();

    const isCorrect = score.every(s => s === 'ok');
    if(isCorrect){
        endGame(true);
        return;
    }
    if(turn >= maxTries){
        endGame(false);
        return;
    }
    setMsg('');
}

function escapeHtml(s){
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function updateRemainingDisplay(){
    const remaining = Math.max(0, maxTries - turn);
    const used = turn;
    let html = '';
    // 残りは塗りつぶし
    for(let i = 0; i < remaining; i++){
        html += '<span class="note filled">♪</span>';
    }
    // 使用済みは枠だけ
    for(let i = 0; i < used; i++){
        html += '<span class="note empty">♪</span>';
    }
    el.left.innerHTML = html;
}

function shakeCurrentRow(){
    const row = el.grid.children[turn];
    if(!row) return;
    row.classList.remove('shake');
    // Force reflow to restart animation
    void row.offsetWidth;
    row.classList.add('shake');
    setTimeout(() => row.classList.remove('shake'), 500);
}

    const CSV_URL = './quizzes.csv';

    async function loadCsvUrl(url){
        const res = await fetch(url, { cache: 'no-store' });
        if(!res.ok){
            throw new Error(`quizzes.csv の取得に失敗しました（HTTP ${res.status}）`);
        }
        return await res.text();
    }

function normalizeHeader(s){
    return String(s ?? '').trim().toLowerCase();
}

    async function handleLoad(){
        setStatus('読み込み中...');
    setMsg('');
    try{
        const text = await loadCsvUrl(CSV_URL);
        const rows = parseCsv(text);
        if(rows.length < 2) throw new Error('CSVにデータ行がありません');

        const header = rows[0].map(normalizeHeader);
        const wordIdx = header.indexOf('word');
        const descIdx = header.indexOf('description');
        const abbrIdx = header.indexOf('abbreviation');
        const diffIdx = header.indexOf('difficulty_level');
        if(wordIdx === -1 || descIdx === -1){
            throw new Error('ヘッダーは word,description が必要です');
        }

        const parsed = [];
        for(let i=1;i<rows.length;i++){
            const r = rows[i];
            const w = normalizeWord(r[wordIdx]);
            const d = String(r[descIdx] ?? '').trim();
            const abbr = abbrIdx !== -1 ? String(r[abbrIdx] ?? '').trim() : '';
            const diff = diffIdx !== -1 ? parseInt(r[diffIdx], 10) || 1 : 1;
            if(!w) continue;
            parsed.push({ word: w, description: d, abbreviation: abbr, difficulty: diff });
        }
        if(parsed.length === 0) throw new Error('有効なwordがありません');

        allEntries = parsed;
        updateFilteredEntries();
        el.newBtn.disabled = false;
        setStatus(`読み込み完了: ${allEntries.length}件（quizzes.csv）`);
        startNewGame();
        document.activeElement.blur(); // ← 追加: フォーカスを外してキーボード入力を受け付ける
    }catch(err){
        console.error("詳細エラー:", err); // コンソールに赤文字で出す
        entries = [];
        el.newBtn.disabled = true;
        el.game.classList.add('hidden');
        setStatus('読み込み失敗: ' + err.message); // ステータス欄に理由を表示
    }
}
el.newBtn.addEventListener('click', () => {
    startNewGame();
});
el.ruleBtn.addEventListener('click', () => {
    const panel = el.rulePanel;
    if(panel.classList.contains('hidden')){
        panel.classList.remove('hidden');
        updateFilteredEntries();
    } else {
        panel.classList.add('hidden');
    }
});
[el.diff1, el.diff2, el.diff3, el.diff4, el.diff5].forEach(cb => {
    if(cb) cb.addEventListener('change', () => {
        updateFilteredEntries();
    });
});
el.giveUpBtn.addEventListener('click', () => {
    if(over) return;
    endGame(false);
});
el.modalCloseBtn.addEventListener('click', () => {
    el.resultModal.classList.add('hidden');
    if(entries.length > 0){
        startNewGame();
    }
});
el.modalShareBtn.addEventListener('click', async () => {
    if(!lastResult) return;
    const emoji = lastResult.success ? '🎉' : '😢';
    const status = lastResult.success ? `${lastResult.turns}/${lastResult.maxTries}回で正解！` : `不正解...`
    const answer = `答え: ${lastResult.answer}`;
    const shareText = `${emoji} Word Quiz ${emoji}\n${status}\n${answer}\n説明: ${lastResult.description}`;
    
    try {
        await navigator.clipboard.writeText(shareText);
        el.modalShareBtn.textContent = 'クリップボードにコピーしました！';
        setTimeout(() => {
            el.modalShareBtn.textContent = '📝 共有';
        }, 2000);
    } catch(e) {
        console.error('Clipboard copy failed', e);
    }
    
    // Open Discord channel
    const discordChannelUrl = 'https://discord.com/channels/1181531577373696090/1383762455783542994';
    setTimeout(() => {
        window.open(discordChannelUrl, '_blank');
    },2000);
});
// キーボード入力を直接受け付ける
document.addEventListener('keydown', (e) => {
    // モーダルが表示中は無視
    if(!el.resultModal.classList.contains('hidden')) return;
    // 入力が無効なら無視
    if(!inputEnabled) return;
    // 他の入力要素にフォーカスがある場合は無視
    const tag = document.activeElement?.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if(candidateState){
        if(e.key === 'Tab'){
            e.preventDefault();
            cycleCandidate(e.shiftKey ? -1 : 1);
            return;
        }
        if(String(e.key).startsWith('Arrow')){
            e.preventDefault();
            const k = String(e.key);
            if(k === 'ArrowLeft' || k === 'ArrowUp') cycleCandidate(-1);
            else cycleCandidate(1);
            return;
        }
        if(e.key === 'Enter'){
            e.preventDefault();
            commitCandidate();
            return;
        }
        if(e.key === 'Escape'){
            e.preventDefault();
            hideCandidates();
            return;
        }
        // Any other key closes candidate UI
        hideCandidates();
    }

    if(e.key === 'Enter'){
        e.preventDefault();
        submitGuess();
        return;
    }

    if(e.key === 'Backspace'){
        e.preventDefault();
        deleteLastChar();
        return;
    }

    // Shift + a/o/u/s => show candidates (Tab / arrows / Enter / click to choose)
    if(e.shiftKey){
        const k = String(e.key ?? '');
        const base = k.length === 1 ? k.toLowerCase() : k;
        const map = {
            a: ['ä','à','â', 'a'],
            e: ['ë','é','è','ê', 'e'],
            i: ['ï','î', 'i'],
            o: ['ö','ô', 'o'],
            u: ['ü','ù','û', 'u'],
            s: ['ß', 's'], // ß is default for Shift+S
            c: ['ç', 'c'],
        };
        if(map[base]){
            e.preventDefault();
            showCandidates(map[base], 0);
            return;
        }
    }

    // 通常の文字入力
    if(e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
        e.preventDefault();
        addChar(e.key);
    }
});

// 読み込みボタンのイベントリスナー
el.loadBtn.addEventListener('click', () => {
    handleLoad();
});

// テーマ切り替え
const themeToggle = document.getElementById('themeToggle');
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        document.body.setAttribute('data-theme', savedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
}
themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    // ユーザー操作時のみlocalStorageに保存
    localStorage.setItem('theme', newTheme);
});
initTheme();

// 初期化: キーボード描画と自動読み込み
renderKeyboard();
// GitHub Pages向け: 初回は自動で quizzes.csv を読み込む
handleLoad();
