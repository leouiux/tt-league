/**
 * League Master Logic (Clean UI & Alert)
 */
let masterData = JSON.parse(localStorage.getItem('league_db')) || {};
let curId = null;
let groupSortOptions = {}; 

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('leagueDate').value = new Date().toISOString().split('T')[0];
    
    document.getElementById('prepareNamesBtn').addEventListener('click', prepareNames);
    document.getElementById('startLeagueBtn').addEventListener('click', createNewLeague);
    document.getElementById('saveDataBtn').addEventListener('click', saveToStorage);
    document.getElementById('viewHistoryBtn').addEventListener('click', () => toggleLayer(true));
    document.getElementById('closeLayerBtn').addEventListener('click', () => toggleLayer(false));
    document.getElementById('leagueHistorySelector').addEventListener('change', (e) => loadLeague(e.target.value));
    
    updateHistorySelector();
});

// 1. 이름 입력창 생성
function prepareNames() {
    const gc = document.getElementById('groupCount').value;
    const pc = document.getElementById('playerCount').value;
    const container = document.getElementById('nameInputs');
    container.innerHTML = '';
    
    for (let i = 0; i < gc; i++) {
        const gName = String.fromCharCode(65 + i) + "조";
        let html = `
            <div class="name-inputs-container">
                <strong style="font-size: 1.2rem; color: var(--primary);">${gName} 명단 입력</strong>
                <div class="name-inputs-grid">`;
        for (let j = 1; j <= pc; j++) {
            html += `<input type="text" class="p-name" data-group="${gName}" placeholder="${gName} 선수${j}">`;
        }
        html += `</div></div>`;
        container.innerHTML += html;
    }
    document.getElementById('nameInputArea').classList.remove('hidden');
}

// 2. 새 리그 생성
function createNewLeague() {
    const id = Date.now().toString();
    const date = document.getElementById('leagueDate').value;
    const title = document.getElementById('leagueTitle').value || "무제 대회";
    const rule = parseInt(document.querySelector('input[name="gameRule"]:checked').value);

    const league = { id, date, title, targetWins: rule, groups: {} };
    
    document.querySelectorAll('.p-name').forEach((el) => {
        const g = el.dataset.group;
        if (!league.groups[g]) league.groups[g] = { names: [], results: {}, playerIds: {} };
        const pName = el.value || el.placeholder;
        league.groups[g].names.push(pName);
        league.groups[g].playerIds[pName] = league.groups[g].names.length;
    });

    for (let g in league.groups) {
        const names = league.groups[g].names;
        names.forEach(n1 => {
            league.groups[g].results[n1] = {};
            names.forEach(n2 => {
                if (n1 !== n2) league.groups[g].results[n1][n2] = { s1: 0, s2: 0, done: false };
            });
        });
        groupSortOptions[g] = { key: 'rank', order: 'asc' };
    }

    masterData[id] = league;
    saveToStorage(true); // 처음 생성 시엔 무음 저장
    loadLeague(id);
}

// 3. 데이터 로드 및 렌더링
function loadLeague(id) {
    if (!id) return;
    curId = id;
    const d = masterData[id];
    
    document.getElementById('setupArea').classList.add('hidden');
    document.getElementById('activeControls').classList.remove('hidden');
    document.getElementById('mainDashboard').classList.remove('hidden');

    const container = document.getElementById('allGroupsContainer');
    container.innerHTML = '';

    Object.keys(d.groups).forEach(gn => {
        if(!groupSortOptions[gn]) groupSortOptions[gn] = { key: 'rank', order: 'asc' };
        container.innerHTML += `
            <section class="group-section">
                <div class="group-title">${gn}</div>
                <div class="group-layout">
                    <div class="matrix-section">
                        <h3>📊 결과 입력 (Matrix)</h3>
                        <table><thead id="head-${gn}"></thead><tbody id="body-${gn}"></tbody></table>
                    </div>
                    <div class="standing-section">
                        <h3>🏅 순위표</h3>
                        <table id="standings-${gn}">
                            <thead>
                                <tr>
                                    <th class="sortable" onclick="handleSort('${gn}', 'id')">ID</th>
                                    <th>이름</th><th>전적</th><th>득실</th><th>승점</th>
                                    <th class="sortable" onclick="handleSort('${gn}', 'rank')">순위</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </section>`;
        renderMatrix(gn);
        updateStandings(gn);
    });
}

function renderMatrix(gn) {
    const d = masterData[curId];
    const g = d.groups[gn];
    document.getElementById(`head-${gn}`).innerHTML = `<th>선수</th>` + g.names.map(n => `<th>${n}</th>`).join('');
    document.getElementById(`body-${gn}`).innerHTML = g.names.map(n1 => `
        <tr>
            <td style="font-weight:bold; background:#f8fafc;">${n1}</td>
            ${g.names.map(n2 => {
                if (n1 === n2) return `<td style="background:#f1f5f9;">-</td>`;
                const res = g.results[n1][n2];
                const win = res.done && res.s1 > res.s2;
                return `<td class="${win ? 'cell-winner' : ''}">
                    <select onchange="updateMatrixScore('${gn}','${n1}','${n2}',this.value)" class="matrix-select">
                        ${getOptions(d.targetWins, `${res.s1}:${res.s2}`)}
                    </select></td>`;
            }).join('')}
        </tr>`).join('');
}

function getOptions(max, current) {
    let html = `<option value="0:0" ${current === '0:0' ? 'selected' : ''}>-</option>`;
    for (let i = 0; i < max; i++) html += `<option value="${max}:${i}" ${current === `${max}:${i}` ? 'selected' : ''}>${max}:${i}</option>`;
    for (let i = 0; i < max; i++) html += `<option value="${i}:${max}" ${current === `${i}:${max}` ? 'selected' : ''}>${i}:${max}</option>`;
    return html;
}

window.updateMatrixScore = (gn, p1, p2, val) => {
    const [s1, s2] = val.split(':').map(Number);
    const g = masterData[curId].groups[gn];
    g.results[p1][p2] = { s1, s2, done: (s1 > 0 || s2 > 0) };
    g.results[p2][p1] = { s1: s2, s2: s1, done: (s1 > 0 || s2 > 0) };
    renderMatrix(gn);
    updateStandings(gn);
};

function updateStandings(gn) {
    const g = masterData[curId].groups[gn];
    let stats = g.names.map(name => {
        let s = { id: g.playerIds[name], name, w: 0, l: 0, sW: 0, sL: 0, pts: 0 };
        g.names.forEach(opp => {
            if (name === opp) return;
            const m = g.results[name][opp];
            if (m.done) {
                s.sW += m.s1; s.sL += m.s2;
                if (m.s1 > m.s2) { s.w++; s.pts += 2; } else { s.l++; s.pts += 1; }
            }
        });
        s.diff = s.sW - s.sL;
        return s;
    });

    const ranked = [...stats].sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.diff - a.diff);
    ranked.forEach((p, i) => {
        let r = i + 1;
        if (i > 0 && p.pts === ranked[i - 1].pts && p.diff === ranked[i - 1].diff) r = ranked[i - 1].rank;
        stats.find(x => x.name === p.name).rank = r;
    });

    const opt = groupSortOptions[gn];
    stats.sort((a, b) => {
        const vA = a[opt.key], vB = b[opt.key];
        return opt.order === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });

    document.querySelector(`#standings-${gn} tbody`).innerHTML = stats.map(s => `
        <tr>
            <td>${s.id}</td><td><strong>${s.name}</strong></td>
            <td>${s.w}승 ${s.l}패</td><td>${s.diff > 0 ? '+' + s.diff : s.diff}</td>
            <td style="color:blue; font-weight:bold;">${s.pts}</td>
            <td style="background:#f8fafc; font-weight:bold;">${s.rank}</td>
        </tr>`).join('');
}

window.handleSort = (gn, key) => {
    const opt = groupSortOptions[gn];
    if (opt.key === key) opt.order = opt.order === 'asc' ? 'desc' : 'asc';
    else { opt.key = key; opt.order = 'asc'; }
    updateStandings(gn);
};

// --- 저장 및 알림 ---
function saveToStorage(silent = false) {
    if (!curId) return;
    localStorage.setItem('league_db', JSON.stringify(masterData));
    updateHistorySelector();
    if (!silent) alert("✅ 모든 데이터가 브라우저에 안전하게 저장되었습니다.");
}

function toggleLayer(show) {
    document.getElementById('listLayer').style.display = show ? 'flex' : 'none';
    if (show) renderHistoryList();
}

function renderHistoryList() {
    const container = document.getElementById('saveListContainer');
    const keys = Object.keys(masterData).sort((a, b) => masterData[b].date.localeCompare(masterData[a].date));
    
    container.innerHTML = keys.map(id => `
        <tr>
            <td>${masterData[id].date}</td>
            <td style="text-align:left; font-weight:bold;">${masterData[id].title}</td>
            <td>
                <button class="btn-sm btn-edit" onclick="handleEdit('${id}')">불러오기</button>
                <button class="btn-sm btn-del" onclick="handleDelete('${id}')">삭제</button>
            </td>
        </tr>`).join('');
}

window.handleEdit = (id) => { toggleLayer(false); loadLeague(id); };
window.handleDelete = (id) => {
    if (confirm("정말 삭제하시겠습니까?")) {
        delete masterData[id];
        localStorage.setItem('league_db', JSON.stringify(masterData));
        renderHistoryList();
        updateHistorySelector();
        if (curId === id) location.reload();
    }
};

function updateHistorySelector() {
    const sel = document.getElementById('leagueHistorySelector');
    const ids = Object.keys(masterData).sort((a, b) => masterData[b].date.localeCompare(masterData[a].date));
    sel.innerHTML = '<option value="">-- 과거 대회 바로가기 --</option>' + 
        ids.map(id => `<option value="${id}">${masterData[id].date} | ${masterData[id].title}</option>`).join('');
}