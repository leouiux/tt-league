let league;
let currentSortCol = 'id'; 
let currentSortOrder = 'asc'; 

class MatrixLeague {
    constructor(names, targetWins) {
        this.names = names;
        this.targetWins = targetWins;
        this.results = {};
        names.forEach(n1 => {
            this.results[n1] = {};
            names.forEach(n2 => {
                if(n1 !== n2) this.results[n1][n2] = { s1: 0, s2: 0, done: false };
            });
        });
    }

    updateMatch(p1, p2, s1, s2) {
        const isDone = (s1 > 0 || s2 > 0);
        this.results[p1][p2] = { s1, s2, done: isDone };
        this.results[p2][p1] = { s1: s2, s2: s1, done: isDone };
        return isDone;
    }

    getTiedStats(playerName, tiedGroupNames) {
        let tiedPoints = 0, tiedSetsWon = 0, tiedSetsLost = 0;
        tiedGroupNames.forEach(oppName => {
            if (playerName === oppName) return;
            const m = this.results[playerName][oppName];
            if (m && m.done) {
                if (m.s1 > m.s2) tiedPoints += 2;
                else tiedPoints += 1;
                tiedSetsWon += m.s1; tiedSetsLost += m.s2;
            }
        });
        return { points: tiedPoints, diff: tiedSetsWon - tiedSetsLost };
    }

    getRankedStats() {
        const stats = this.names.map((name, index) => {
            let res = { id: index + 1, name, wins: 0, losses: 0, setsWon: 0, setsLost: 0, points: 0 };
            this.names.forEach(opp => {
                if(name === opp) return;
                const m = this.results[name][opp];
                if(m.done) {
                    res.setsWon += m.s1; res.setsLost += m.s2;
                    if(m.s1 > m.s2) { res.wins++; res.points += 2; }
                    else { res.losses++; res.points += 1; }
                }
            });
            return res;
        });

        const sortedForRank = [...stats].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const tiedGroupNames = stats.filter(s => s.points === a.points).map(s => s.name);
            if (tiedGroupNames.length >= 2) {
                const aTied = this.getTiedStats(a.name, tiedGroupNames);
                const bTied = this.getTiedStats(b.name, tiedGroupNames);
                if (bTied.points !== aTied.points) return bTied.points - aTied.points;
                if (bTied.diff !== aTied.diff) return bTied.diff - aTied.diff;
            }
            return (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost);
        });

        let lastRank = 1;
        sortedForRank.forEach((p, i) => {
            if (i > 0) {
                const prev = sortedForRank[i - 1];
                const tiedGroup = stats.filter(s => s.points === p.points).map(s => s.name);
                const pStats = this.getTiedStats(p.name, tiedGroup);
                const prevStats = this.getTiedStats(prev.name, tiedGroup);
                const isFullTie = p.points === prev.points && pStats.points === prevStats.points && 
                                  pStats.diff === prevStats.diff && (p.setsWon - p.setsLost) === (prev.setsWon - prev.setsLost);
                if (!isFullTie) lastRank = i + 1;
            }
            p.rank = lastRank;

            const tiedNames = stats.filter(s => s.points === p.points).map(s => s.name);
            const pStats = this.getTiedStats(p.name, tiedNames);
            const next = sortedForRank[i+1];
            const isNextTie = next && p.points === next.points && 
                              pStats.points === this.getTiedStats(next.name, tiedNames).points && 
                              pStats.diff === this.getTiedStats(next.name, tiedNames).diff && 
                              (p.setsWon - p.setsLost) === (next.setsWon - next.setsLost);
            const prev = i > 0 && sortedForRank[i-1];
            const isPrevTie = prev && p.points === prev.points && 
                              pStats.points === this.getTiedStats(prev.name, tiedNames).points && 
                              pStats.diff === this.getTiedStats(prev.name, tiedNames).diff && 
                              (p.setsWon - p.setsLost) === (prev.setsWon - prev.setsLost);
            p.isTieHighlight = (isNextTie || isPrevTie);
        });
        return stats;
    }
}

// 초기 로드 시 입력창 생성 실행
window.onload = () => {
    generateNameInputs();
};

// 입력창 생성 함수
function generateNameInputs() {
    const count = parseInt(document.getElementById('playerCount').value) || 0;
    const container = document.getElementById('nameInputs');
    if (!container) return;
    
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'p-name';
        input.placeholder = `선수 ${i}`;
        container.appendChild(input);
    }
}

// 리그 시작 버튼 이벤트
document.getElementById('startBtn').onclick = () => {
    const names = [...document.querySelectorAll('.p-name')].map(i => i.value.trim() || i.placeholder);
    const ruleInput = document.querySelector('input[name="gameRule"]:checked');
    if(!ruleInput) return alert("경기 방식을 선택해주세요.");
    const targetWins = parseInt(ruleInput.value);
    
    league = new MatrixLeague(names, targetWins);

    document.querySelector('.config-group').style.display = 'none';
    document.getElementById('setupSection').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'grid';

    document.getElementById('standingsTable').innerHTML = `
        <thead>
            <tr>
                <th class="sortable" onclick="toggleSort('id')">등록번호</th>
                <th>선수명</th>
                <th>전적</th>
                <th>득실차</th>
                <th>승점</th>
                <th class="sortable" onclick="toggleSort('rank')">순위</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    document.getElementById('matrixHead').innerHTML = `<th class="matrix-name-col">선수명</th>` + names.map(n => `<th>${n}</th>`).join('');
    const options = getOptions(targetWins);
    document.getElementById('matrixBody').innerHTML = names.map(n1 => `
        <tr>
            <td class="matrix-name-col">${n1}</td>
            ${names.map(n2 => {
                if(n1 === n2) return `<td class="self-cell">/</td>`;
                return `<td><select class="matrix-select" data-p1="${n1}" data-p2="${n2}" onchange="syncScore(this)">${options}</select></td>`;
            }).join('')}
        </tr>`).join('');

    updateStandings();
};

function getOptions(max) {
    let opt = `<option value="0:0">-</option>`;
    for(let i=0; i<max; i++) opt += `<option value="${max}:${i}">${max}:${i}</option>`;
    for(let i=0; i<max; i++) opt += `<option value="${i}:${max}">${i}:${max}</option>`;
    return opt;
}

window.syncScore = (el) => {
    const p1 = el.dataset.p1, p2 = el.dataset.p2;
    const [s1, s2] = el.value.split(':').map(Number);
    const isDone = league.updateMatch(p1, p2, s1, s2);
    
    updateCellStyle(el, el.closest('td'), s1, s2, isDone);
    const oppSelect = document.querySelector(`.matrix-select[data-p1="${p2}"][data-p2="${p1}"]`);
    if(oppSelect) {
        oppSelect.value = `${s2}:${s1}`;
        updateCellStyle(oppSelect, oppSelect.closest('td'), s2, s1, isDone);
    }
    updateStandings();
};

function updateCellStyle(selectEl, tdEl, s1, s2, isDone) {
    selectEl.classList.remove('input-winner');
    tdEl.classList.remove('cell-winner');
    if (isDone && s1 > s2) {
        tdEl.classList.add('cell-winner');
        selectEl.classList.add('input-winner');
    }
}

function updateStandings() {
    let stats = league.getRankedStats();
    stats.sort((a, b) => {
        let valA = a[currentSortCol], valB = b[currentSortCol];
        return (currentSortOrder === 'asc') ? valA - valB : valB - valA;
    });

    let anyMatchDone = stats.some(p => p.wins > 0 || p.losses > 0);
    const tbody = document.querySelector('#standingsTable tbody');
    tbody.innerHTML = stats.map(p => `
        <tr class="${(anyMatchDone && p.isTieHighlight) ? 'tie-row' : ''}">
            <td>${p.id}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.wins}승 ${p.losses}패</td>
            <td>${p.setsWon - p.setsLost}</td>
            <td style="color:blue; font-weight:bold;">${p.points}</td>
            <td>${p.rank}</td>
        </tr>`).join('');
}

window.toggleSort = (col) => {
    if (currentSortCol === col) currentSortOrder = (currentSortOrder === 'asc') ? 'desc' : 'asc';
    else { currentSortCol = col; currentSortOrder = 'asc'; }
    updateStandings();
};