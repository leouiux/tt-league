/**
 * League Master Logic (Responsive & Accessible)
 * 승자승 로직 추가 버전
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
    
    // ESC 키로 레이어 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggleLayer(false);
    });
    
    updateHistorySelector();
});

// 1. 이름 입력창 생성
function prepareNames() {
    const gc = parseInt(document.getElementById('groupCount').value);
    const pc = parseInt(document.getElementById('playerCount').value);
    
    if (gc < 1 || pc < 2) {
        alert('⚠️ 조 개수는 1개 이상, 조별 인원은 2명 이상이어야 합니다.');
        return;
    }
    
    const container = document.getElementById('nameInputs');
    container.innerHTML = '';
    
    for (let i = 0; i < gc; i++) {
        const gName = String.fromCharCode(65 + i) + "조";
        let html = `
            <div class="name-inputs-container">
                <strong style="font-size: clamp(1rem, 3vw, 1.2rem); color: var(--primary);">${gName} 명단 입력</strong>
                <div class="name-inputs-grid">`;
        for (let j = 1; j <= pc; j++) {
            html += `<input type="text" class="p-name" data-group="${gName}" placeholder="${gName} 선수${j}" aria-label="${gName} 선수${j}">`;
        }
        html += `</div></div>`;
        container.innerHTML += html;
    }
    document.getElementById('nameInputArea').classList.remove('hidden');
    
    // 스크롤 이동
    setTimeout(() => {
        document.getElementById('nameInputArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
        const pName = el.value.trim() || el.placeholder;
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
    saveToStorage(true);
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
                        <div class="table-wrapper">
                            <table>
                                <thead id="head-${gn}"></thead>
                                <tbody id="body-${gn}"></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="standing-section">
                        <h3>🏅 순위표</h3>
                        <div class="table-wrapper">
                            <table id="standings-${gn}">
                                <thead>
                                    <tr>
                                        <th class="sortable" onclick="handleSort('${gn}', 'id')" role="button" tabindex="0">ID ↕</th>
                                        <th>이름</th>
                                        <th>전적</th>
                                        <th>득실</th>
                                        <th>승점</th>
                                        <th class="sortable" onclick="handleSort('${gn}', 'rank')" role="button" tabindex="0">순위 ↕</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>`;
        renderMatrix(gn);
        updateStandings(gn);
    });
    
    // 스크롤 이동
    setTimeout(() => {
        document.getElementById('mainDashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
                    <select onchange="updateMatrixScore('${gn}','${n1}','${n2}',this.value)" class="matrix-select" aria-label="${n1} vs ${n2} 결과">
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
    
    // 모든 경기가 완료되었는지 확인
    const totalMatches = (g.names.length * (g.names.length - 1)) / 2;
    let completedMatches = 0;
    g.names.forEach(n1 => {
        g.names.forEach(n2 => {
            if (n1 < n2 && g.results[n1][n2].done) completedMatches++;
        });
    });
    const allMatchesComplete = completedMatches === totalMatches;
    
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

    // 승자승 로직을 적용한 순위 결정
    const ranked = [...stats].sort((a, b) => {
        // 1차: 승점 비교
        if (a.pts !== b.pts) return b.pts - a.pts;
        
        // 2차: 승점이 같으면 전체 득실차 비교
        if (a.diff !== b.diff) return b.diff - a.diff;
        
        return 0;
    });

    // 동률 그룹을 찾아서 승자승 적용
    let i = 0;
    while (i < ranked.length) {
        // 같은 승점과 득실을 가진 선수들을 찾기
        let tiedGroup = [ranked[i]];
        let j = i + 1;
        
        while (j < ranked.length && 
               ranked[j].pts === ranked[i].pts && 
               ranked[j].diff === ranked[i].diff) {
            tiedGroup.push(ranked[j]);
            j++;
        }
        
        // 동률이 2명 이상이면 승자승 적용
        if (tiedGroup.length > 1) {
            tiedGroup = tiedGroup.map(player => {
                let h2hWins = 0;
                let h2hSW = 0;
                let h2hSL = 0;
                
                // 동률 그룹 내 다른 선수들과의 전적만 계산
                tiedGroup.forEach(opponent => {
                    if (player.name === opponent.name) return;
                    const m = g.results[player.name][opponent.name];
                    if (m.done) {
                        h2hSW += m.s1;
                        h2hSL += m.s2;
                        if (m.s1 > m.s2) h2hWins++;
                    }
                });
                
                return {
                    ...player,
                    h2hWins,
                    h2hDiff: h2hSW - h2hSL
                };
            });
            
            // 승자승 승수 -> 승자승 득실차 순으로 재정렬
            tiedGroup.sort((a, b) => {
                if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
                if (a.h2hDiff !== b.h2hDiff) return b.h2hDiff - a.h2hDiff;
                return 0;
            });
            
            // 재정렬된 순서로 ranked 배열에 다시 넣기
            for (let k = 0; k < tiedGroup.length; k++) {
                ranked[i + k] = tiedGroup[k];
            }
        }
        
        i = j;
    }

    // 순위 부여 및 완전 동률 표시 (모든 경기 완료시에만)
    let currentRank = 1;
    ranked.forEach((p, idx) => {
        p.isTied = false;
        
        if (idx === 0) {
            p.rank = currentRank;
        } else {
            const prev = ranked[idx - 1];
            
            // 모든 경기가 완료되었고, 모든 조건이 같으면 동률
            if (allMatchesComplete &&
                p.pts === prev.pts && 
                p.diff === prev.diff &&
                p.h2hWins === prev.h2hWins &&
                p.h2hDiff === prev.h2hDiff) {
                p.rank = prev.rank; // 같은 순위 부여
                p.isTied = true;
                prev.isTied = true;
            } else {
                currentRank = idx + 1; // 실제 순위로 증가
                p.rank = currentRank;
            }
        }
        
        stats.find(x => x.name === p.name).rank = p.rank;
        stats.find(x => x.name === p.name).isTied = p.isTied;
    });

    const opt = groupSortOptions[gn];
    stats.sort((a, b) => {
        const vA = a[opt.key], vB = b[opt.key];
        return opt.order === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });

    document.querySelector(`#standings-${gn} tbody`).innerHTML = stats.map(s => `
        <tr style="${s.isTied ? 'background-color: #fee2e2;' : ''}">
            <td>${s.id}</td>
            <td><strong>${s.name}</strong></td>
            <td>${s.w}승 ${s.l}패</td>
            <td style="color: ${s.diff > 0 ? '#10b981' : s.diff < 0 ? '#ef4444' : '#64748b'}; font-weight: bold;">${s.diff > 0 ? '+' + s.diff : s.diff}</td>
            <td style="color:#2563eb; font-weight:bold;">${s.pts}</td>
            <td style="background:#f8fafc; font-weight:bold;">${s.rank}${s.isTied ? ' (동률)' : ''}</td>
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
    try {
        localStorage.setItem('league_db', JSON.stringify(masterData));
        updateHistorySelector();
        if (!silent) alert("✅ 모든 데이터가 브라우저에 안전하게 저장되었습니다.");
    } catch (e) {
        alert("❌ 저장 중 오류가 발생했습니다: " + e.message);
    }
}

function toggleLayer(show) {
    const layer = document.getElementById('listLayer');
    layer.style.display = show ? 'flex' : 'none';
    if (show) {
        renderHistoryList();
        // 포커스 이동
        document.getElementById('closeLayerBtn').focus();
    }
}

function renderHistoryList() {
    const tbody = document.querySelector('#saveListContainer tbody');
    const keys = Object.keys(masterData).sort((a, b) => masterData[b].date.localeCompare(masterData[a].date));
    
    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#64748b;">저장된 대회가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = keys.map(id => `
        <tr>
            <td style="white-space: nowrap;">${masterData[id].date}</td>
            <td style="text-align:left; font-weight:bold;">${masterData[id].title}</td>
            <td style="white-space: nowrap;">
                <button class="btn-sm btn-edit" onclick="handleEdit('${id}')">불러오기</button>
                <button class="btn-sm btn-del" onclick="handleDelete('${id}')">삭제</button>
            </td>
        </tr>`).join('');
}

window.handleEdit = (id) => { 
    toggleLayer(false);
    loadLeague(id);
};

window.handleDelete = (id) => {
    if (confirm("⚠️ 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) {
        delete masterData[id];
        localStorage.setItem('league_db', JSON.stringify(masterData));
        renderHistoryList();
        updateHistorySelector();
        if (curId === id) {
            alert("현재 보고 있던 대회가 삭제되었습니다. 페이지를 새로고침합니다.");
            location.reload();
        }
    }
};

function updateHistorySelector() {
    const sel = document.getElementById('leagueHistorySelector');
    const ids = Object.keys(masterData).sort((a, b) => masterData[b].date.localeCompare(masterData[a].date));
    sel.innerHTML = '<option value="">-- 과거 대회 바로가기 --</option>' + 
        ids.map(id => `<option value="${id}">${masterData[id].date} | ${masterData[id].title}</option>`).join('');
}