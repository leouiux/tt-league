let masterData = JSON.parse(localStorage.getItem('league_db')) || {};
let curId = null;
let groupSortOptions = {};

/* ───────────────────────────── helpers ─────────────────────────────── */
function shuffle(arr) {
  let a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getGrade(league, name) {
  if (!name) return null;
  for (let g in league.groups || {}) {
    const gr = league.groups[g].grades;
    if (gr && gr[name] !== undefined && gr[name] !== 9999) return gr[name];
  }
  if (league.tournament?.seeds) {
    const s = league.tournament.seeds.find(x => x.name === name);
    if (s && s.grade !== 9999) return s.grade;
  }
  return null;
}

function displayName(league, name) {
  if (!name) return '';
  const g = getGrade(league, name);
  return g !== null ? `${name}(${g})` : name;
}

/* ───────────────────────────── init ─────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('leagueDate').value = new Date().toISOString().split('T')[0];

  document.getElementById('initialImportBtn').addEventListener('click', () => document.getElementById('initialJsonFileInput').click());
  document.getElementById('initialJsonFileInput').addEventListener('change', e => importJson(e, true));
  document.getElementById('startNewLeagueBtn').addEventListener('click', () => {
    document.getElementById('initialImport').classList.add('hidden');
    document.getElementById('setupArea').classList.remove('hidden');
  });
  document.getElementById('prepareNamesBtn').addEventListener('click', prepareNames);
  document.getElementById('startLeagueBtn').addEventListener('click', createLeague);
  document.getElementById('saveDataBtn').addEventListener('click', () => save(false));
  document.getElementById('viewHistoryBtn').addEventListener('click', openHistory);
  document.getElementById('closeHistoryBtn').addEventListener('click', closeHistory);
  document.getElementById('leagueHistorySelector').addEventListener('change', e => { if (e.target.value) loadLeague(e.target.value); });
  document.getElementById('goToTournamentBtn').addEventListener('click', createTournament);
  document.getElementById('backToLeagueBtn').addEventListener('click', backToLeague);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
  document.getElementById('importJsonBtn').addEventListener('click', () => document.getElementById('jsonFileInput').click());
  document.getElementById('jsonFileInput').addEventListener('change', importJson);
  document.getElementById('bulkInputBtn').addEventListener('click', () => {
    document.getElementById('bulkModal').classList.add('active');
    setTimeout(() => document.getElementById('bulkTextarea').focus(), 80);
  });
  document.getElementById('bulkCancelBtn').addEventListener('click', closeBulk);
  document.getElementById('bulkCancelBtn2').addEventListener('click', closeBulk);
  document.getElementById('bulkConfirmBtn').addEventListener('click', processBulk);
  document.getElementById('directTournamentBtn').addEventListener('click', directTournament);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeHistory(); closeBulk(); }
  });
  updateSelector();
});

function closeBulk() { document.getElementById('bulkModal').classList.remove('active'); document.getElementById('bulkTextarea').value = ''; }
function openHistory() { renderHistory(); document.getElementById('historyModal').classList.add('active'); }
function closeHistory() { document.getElementById('historyModal').classList.remove('active'); }

/* ───────────────────────────── name input ─────────────────────────────── */
function prepareNames() {
  const gc = parseInt(document.getElementById('groupCount').value);
  const pc = parseInt(document.getElementById('playerCount').value);
  if (gc < 1 || pc < 2) { alert('⚠️ 조 개수 1개 이상, 조별 인원 2명 이상'); return; }

  const container = document.getElementById('nameInputs');
  container.innerHTML = '';
  for (let i = 0; i < gc; i++) {
    const gn = String.fromCharCode(65 + i) + '조';
    let inputs = '';
    for (let j = 0; j < pc; j++) inputs += `<input type="text" class="p-name" data-group="${gn}" placeholder="" oninput="applyAffilColors()">`;
    container.innerHTML += `
      <div class="group-input-card">
        <div class="group-input-label">${gn} 명단</div>
        <div class="name-grid">${inputs}</div>
      </div>`;
  }
  document.getElementById('nameInputArea').classList.remove('hidden');
  setTimeout(() => document.getElementById('nameInputArea').scrollIntoView({ behavior: 'smooth' }), 100);
}

function processBulk() {
  const text = document.getElementById('bulkTextarea').value.trim();
  if (!text) { closeBulk(); return; }

  // ── 입력 정제 헬퍼 ──────────────────────────────────────────
  // 이름 정제: 앞쪽 숫자·공백 제거, 이름 내 숫자 제거, 이모지·특수문자 제거
  function cleanName(raw) {
    let s = raw
      .replace(/^[\d\s]+/, '')           // 앞쪽 숫자·공백 제거
      .replace(/[0-9]/g, '')             // 이름 내 숫자 제거
      .replace(/[^\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF\uF900-\uFAFFa-zA-Z\s]/g, '') // 한중일·영문·공백만
      .trim();
    return s;
  }
  // 등급 정제: 숫자만 추출 (이모지·특수문자·문자 모두 제거)
  function cleanGrade(raw) {
    const digits = raw.replace(/[^\d]/g, '');
    return digits ? parseInt(digits) : 9999;
  }

  // ── 줄별 파싱: "이름 소속 등급" 또는 "이름 등급" 또는 "이름등급" ─
  const players = text.split('\n').map(l => l.trim()).filter(l => l).map(line => {
    const tokens = line.trim().split(/\s+/);
    let rawName = '', rawAffil = '', rawGrade = '';

    if (tokens.length >= 3) {
      // 마지막 토큰에 숫자 있으면 → 이름 소속 등급
      const last = tokens[tokens.length - 1];
      if (/\d/.test(last)) {
        rawGrade = last;
        rawAffil = tokens[tokens.length - 2];
        rawName  = tokens.slice(0, tokens.length - 2).join(' ');
      } else {
        // 숫자 없음: 이름 소속 (등급 없음)
        rawAffil = tokens[tokens.length - 1];
        rawName  = tokens.slice(0, tokens.length - 1).join(' ');
      }
    } else if (tokens.length === 2) {
      const last = tokens[1];
      if (/^\d+$/.test(last)) {
        // "홍길동 2" — 이름 등급, 소속 없음
        rawGrade = last; rawName = tokens[0];
      } else if (/\d/.test(last)) {
        // "홍길동 조아2" — 마지막 토큰에 숫자 섞임 → 소속+등급 붙여쓰기
        rawGrade = last; rawName = tokens[0];
      } else {
        // 두 토큰 모두 문자: 이름 소속
        rawName = tokens[0]; rawAffil = tokens[1];
      }
    } else {
      // 토큰 1개: "홍길동2" 붙여쓰기 또는 이름만
      rawName = tokens[0] || '';
      // 붙여쓰기 이름+등급 분리는 cleanName/cleanGrade가 처리
    }

    const name  = cleanName(rawName);
    const affil = rawAffil.trim();
    const grade = rawGrade ? cleanGrade(rawGrade) : (cleanGrade(rawName) !== 9999 ? cleanGrade(rawName) : 9999);

    return { name, affil, grade };
  }).filter(p => p.name);

  if (!players.length) { closeBulk(); return; }

  // ── 등급 오름차순 정렬 (낮을수록 강함) ───────────────────────
  players.sort((a, b) => a.grade - b.grade);

  const containers = document.querySelectorAll('.group-input-card');
  if (!containers.length) { alert('먼저 입력창을 생성해주세요.'); return; }
  document.querySelectorAll('.p-name').forEach(el => el.value = '');

  const groups = Array.from(containers).map(c => Array.from(c.querySelectorAll('.p-name')));
  const gc = groups.length;

  // ── 스네이크 드래프트 + 소속 분산 + 랜덤 셔플 ────────────────
  // 같은 등급끼리는 랜덤 셔플 (등급별 묶음 내에서)
  const shuffled = [];
  let i = 0;
  while (i < players.length) {
    let j = i + 1;
    while (j < players.length && players[j].grade === players[i].grade) j++;
    const sameGrade = players.slice(i, j);
    // 같은 등급 내 랜덤
    for (let k = sameGrade.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [sameGrade[k], sameGrade[r]] = [sameGrade[r], sameGrade[k]];
    }
    shuffled.push(...sameGrade);
    i = j;
  }

  const queue = [...shuffled];
  const groupAffils = Array.from({ length: gc }, () => []);

  // ── 랜덤 스네이크 드래프트 ──────────────────────────────────────
  // 각 라운드(gc명 배분 단위)마다 조 순서를 랜덤 셔플하여 완전 랜덤 배분
  let si = 0;
  while (queue.length > 0) {
    // 이번 라운드: gc개 조를 랜덤 순서로
    const roundOrder = Array.from({ length: gc }, (_, i) => i);
    for (let k = roundOrder.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [roundOrder[k], roundOrder[r]] = [roundOrder[r], roundOrder[k]];
    }

    let assignedThisRound = 0;
    for (const gi of roundOrder) {
      if (queue.length === 0) break;
      const slot = groups[gi].find(el => !el.value);
      if (!slot) continue;

      // 소속 겹치지 않는 선수 우선 선택
      const curAffils = groupAffils[gi];
      let pickedIdx = queue.findIndex(p => !p.affil || !curAffils.includes(p.affil));
      if (pickedIdx === -1) pickedIdx = 0;

      const picked = queue.splice(pickedIdx, 1)[0];
      const affilPart = picked.affil ? `(${picked.affil})` : '';
      const gradeStr  = picked.grade !== 9999 ? ` ${picked.grade}` : '';
      slot.value = `${picked.name}${affilPart}${gradeStr}`;
      if (picked.affil) groupAffils[gi].push(picked.affil);
      assignedThisRound++;
    }

    // 이번 라운드에 아무도 배정 못했으면(모든 조가 꽉 참) 종료
    if (assignedThisRound === 0) break;
    si++;
    if (si > (groups[0]?.length || 10) * 5 + 50) break;
  }
  closeBulk();
  applyAffilColors();
}

// 소속별 배경색 — 뚜렷한 파스텔 단색 + 굵은 왼쪽 컬러 테두리로 깔끔하게 구분
const AFFIL_STYLES = [
  { bg: '#fde8e8', border: '#e05252' }, // 빨강 계열
  { bg: '#dbeafe', border: '#2563eb' }, // 파랑 계열
  { bg: '#d1fae5', border: '#059669' }, // 초록 계열
  { bg: '#fef9c3', border: '#ca8a04' }, // 노랑 계열
  { bg: '#ede9fe', border: '#7c3aed' }, // 보라 계열
  { bg: '#fce7f3', border: '#db2777' }, // 분홍 계열
  { bg: '#ffedd5', border: '#ea580c' }, // 주황 계열
  { bg: '#cffafe', border: '#0891b2' }, // 청록 계열
  { bg: '#ecfccb', border: '#65a30d' }, // 라임 계열
  { bg: '#e0e7ff', border: '#4338ca' }, // 인디고 계열
  { bg: '#fdf4ff', border: '#9333ea' }, // 자주 계열
  { bg: '#fff1f2', border: '#e11d48' }, // 로즈 계열
  { bg: '#f0fdf4', border: '#16a34a' }, // 연초록 계열
  { bg: '#fff7ed', border: '#d97706' }, // 앰버 계열
  { bg: '#f0f9ff', border: '#0284c7' }, // 하늘 계열
];

function applyAffilColors() {
  const inputs = Array.from(document.querySelectorAll('.p-name'));
  // 소속 수집
  const affilStyleMap = {};
  let styleIdx = 0;
  inputs.forEach(el => {
    const m = el.value.trim().match(/\(([^)]+)\)/);
    const affil = m ? m[1] : '';
    if (affil && !(affil in affilStyleMap)) {
      affilStyleMap[affil] = AFFIL_STYLES[styleIdx % AFFIL_STYLES.length];
      styleIdx++;
    }
  });

  // 중복 감지
  const seen = {}, dupKeys = new Set();
  inputs.forEach(el => {
    const key = el.value.trim().toLowerCase().replace(/\s+/g,'');
    if (!key) return;
    if (seen[key]) dupKeys.add(key);
    seen[key] = true;
  });

  inputs.forEach(el => {
    const raw = el.value.trim();
    // 스타일 초기화
    el.style.background = '';
    el.style.borderLeft = '';
    el.style.borderColor = '';
    el.style.outline = '';

    if (!raw) return;

    const key = raw.toLowerCase().replace(/\s+/g,'');
    if (dupKeys.has(key)) {
      el.style.background = '#fee2e2';
      el.style.borderLeft = '4px solid #ef4444';
    } else {
      const m = raw.match(/\(([^)]+)\)/);
      const affil = m ? m[1] : '';
      if (affil && affilStyleMap[affil]) {
        const s = affilStyleMap[affil];
        el.style.background = s.bg;
        el.style.borderLeft = `4px solid ${s.border}`;
      }
    }
  });

  // 중복 안내 메시지
  const existing = document.getElementById('dupWarning');
  if (existing) existing.remove();
  if (dupKeys.size > 0) {
    const msg = document.createElement('div');
    msg.id = 'dupWarning';
    msg.style.cssText = 'margin-top:10px;padding:10px 14px;background:#fee2e2;border:1.5px solid #ef4444;border-radius:8px;font-size:0.82rem;font-weight:700;color:#991b1b;';
    msg.textContent = '⚠️ 중복 등록 인원이 있습니다. 해당 인원 수정 바랍니다.';
    document.getElementById('nameInputs').after(msg);
  }
}

/* ───────────────────────────── create league ─────────────────────────────── */
function parsePlayer(rawVal) {
  // "홍길동(조아) 2" 형식: 괄호 안 소속 제거 후 파싱
  const withoutAffil = rawVal.replace(/\([^)]*\)/g, '').trim();
  const tokens = withoutAffil.split(/\s+/);
  let name = '', grade = 9999;

  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    if (/^\d+$/.test(last)) {
      grade = parseInt(last);
      name  = tokens.slice(0, tokens.length - 1).join(' ').trim();
    } else {
      const digits = last.replace(/\D/g, '');
      if (digits) {
        grade = parseInt(digits);
        name  = tokens.slice(0, tokens.length - 1).join(' ').trim();
      } else {
        name = tokens.join(' ').trim();
      }
    }
  } else {
    // 단일 토큰: 이름숫자 붙여쓰기 fallback
    const nm = withoutAffil.match(/^[^\d]+/);
    const gm = withoutAffil.match(/\d+/);
    name  = nm ? nm[0].trim() : withoutAffil.trim();
    grade = gm ? parseInt(gm[0]) : 9999;
  }

  // 이름에서 혹시 남은 숫자·앞쪽 공백 제거
  name = name.replace(/^[\d\s]+/, '').replace(/[0-9]/g, '').trim();
  return { name, grade };
}

function createLeague() {
  const id = Date.now().toString();
  const league = {
    id,
    date: document.getElementById('leagueDate').value,
    title: document.getElementById('leagueTitle').value || '용문리그',
    targetWins: parseInt(document.querySelector('input[name="gameRule"]:checked').value),
    eliminateCount: parseInt(document.getElementById('eliminateCount').value) || 0,
    groups: {}
  };

  document.querySelectorAll('.p-name').forEach(el => {
    const g = el.dataset.group; const raw = el.value.trim();
    if (!raw) return;
    if (!league.groups[g]) league.groups[g] = { names: [], results: {}, playerIds: {}, grades: {} };
    const { name, grade } = parsePlayer(raw);
    if (name) { league.groups[g].names.push(name); league.groups[g].grades[name] = grade; }
  });

  for (let g in league.groups) {
    league.groups[g].names = shuffle(league.groups[g].names);
    league.groups[g].names.forEach((n, i) => { league.groups[g].playerIds[n] = i + 1; });
    league.groups[g].names.forEach(n1 => {
      league.groups[g].results[n1] = {};
      league.groups[g].names.forEach(n2 => {
        if (n1 !== n2) league.groups[g].results[n1][n2] = { s1: 0, s2: 0, done: false };
      });
    });
    groupSortOptions[g] = { key: 'rank', order: 'asc' };
  }

  masterData[id] = league;
  save(true);
  document.getElementById('initialImport').classList.add('hidden');
  loadLeague(id);
}

/* ───────────────────────────── direct tournament ─────────────────────────────── */
function directTournament() {
  const all = [];
  document.querySelectorAll('.p-name').forEach(el => {
    const raw = el.value.trim(); if (!raw) return;
    const { name, grade } = parsePlayer(raw);
    if (name) all.push({ name, grade, seed: '', isEliminated: false, rank: 1, group: '-' });
  });
  if (all.length < 2) { alert('최소 2명 이상 입력해주세요.'); return; }

  const players = shuffle(all);
  players.forEach((p, i) => { p.seed = `${i + 1}번`; });

  const id = Date.now().toString();
  const bracket = buildBracket(players, true);
  masterData[id] = {
    id,
    date: document.getElementById('leagueDate').value,
    title: document.getElementById('leagueTitle').value || '용문리그',
    targetWins: 2, eliminateCount: 0, groups: {},
    tournament: { seeds: players, rounds: bracket, champion: null }
  };
  curId = id;
  save(true);
  document.getElementById('setupArea').classList.add('hidden');
  document.getElementById('activeControls').classList.remove('hidden');
  document.getElementById('mainDashboard').classList.add('hidden');
  showTournament();
}

/* ───────────────────────────── load league ─────────────────────────────── */
function loadLeague(id) {
  if (!id) return;
  curId = id;
  const d = masterData[id];
  document.getElementById('initialImport').classList.add('hidden');
  document.getElementById('setupArea').classList.add('hidden');
  document.getElementById('activeControls').classList.remove('hidden');

  if (!d.groups || Object.keys(d.groups).length === 0) {
    document.getElementById('mainDashboard').classList.add('hidden');
    showTournament(); return;
  }

  document.getElementById('mainDashboard').classList.remove('hidden');
  document.getElementById('tournamentArea').classList.add('hidden');

  // 대회명 배너 렌더
  const banner = document.getElementById('leagueTitleBanner');
  banner.innerHTML = `
    <div class="title-banner" style="justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0;">
        <div class="title-banner-icon">🏓</div>
        <div class="title-banner-text">
          <div class="title-banner-name">${d.title || '용문리그'}</div>
          <div class="title-banner-meta">${d.date || ''} &nbsp;·&nbsp; 리그전 대진표 &nbsp;·&nbsp; ${Object.keys(d.groups).length}개 조 &nbsp;·&nbsp; 조별 ${Object.values(d.groups)[0]?.names?.length || 0}명</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;">
        <button onclick="openTiebreaker()" style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.5);padding:9px 16px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;backdrop-filter:blur(4px);transition:background 0.18s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">⚖️ 동률간 승자 계산하기</button>
        <button onclick="printAllPlayers()" style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.5);padding:9px 16px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;backdrop-filter:blur(4px);transition:background 0.18s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">🗒️ 전체 명단 인쇄</button>
      </div>
    </div>`;

  const container = document.getElementById('allGroupsContainer');
  container.innerHTML = '';

  Object.keys(d.groups).forEach(gn => {
    if (!groupSortOptions[gn]) groupSortOptions[gn] = { key: 'rank', order: 'asc' };
    const sec = document.createElement('div');
    sec.className = 'group-section';
    sec.innerHTML = `
      <div class="group-header">
        <div class="group-header-left">
          <div class="group-badge">${gn}</div>
        </div>
        <div class="group-header-actions">
          <button class="btn btn-purple" style="font-size:0.95rem;padding:10px 20px;" onclick="printGroupMatrix('${gn}')">🖨️ 대진표 인쇄</button>
        </div>
      </div>
      <div class="group-layout">
        <div>
          <div class="section-label">결과 매트릭스</div>
          <div class="table-wrap"><table><thead id="head-${gn}"></thead><tbody id="body-${gn}"></tbody></table></div>
        </div>
        <div>
          <div class="section-label">순위표 <span style="font-size:0.68rem;font-weight:500;text-transform:none;letter-spacing:0;color:var(--text3);">(마우스로 순위 변경하세요. Drag &amp; Drop)</span></div>
          <div class="table-wrap">
            <table id="standings-${gn}">
              <thead><tr>
                <th class="sortable" onclick="handleSort('${gn}','id')">ID↕</th>
                <th>이름</th><th>전적</th><th>득실</th><th>승점</th>
                <th class="sortable" onclick="handleSort('${gn}','rank')">순위↕</th><th>결과</th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>`;
    container.appendChild(sec);
    renderMatrix(gn);
    updateStandings(gn);
  });

  // 최하단 토너먼트 진행 버튼
  const tournBtn = document.createElement('div');
  tournBtn.style.cssText = 'margin-top:28px;text-align:center;';
  tournBtn.innerHTML = `<button class="btn btn-primary btn-lg" style="padding:16px 48px;font-size:1.05rem;box-shadow:0 6px 24px rgba(91,108,245,0.35);" onclick="createTournament()">🏆 토너먼트 진행</button>`;
  container.appendChild(tournBtn);

  setTimeout(() => document.getElementById('mainDashboard').scrollIntoView({ behavior: 'smooth' }), 100);
}

/* ───────────────────────────── matrix ─────────────────────────────── */
function renderMatrix(gn) {
  const d = masterData[curId]; const g = d.groups[gn];
  document.getElementById(`head-${gn}`).innerHTML =
    `<th>선수</th>` + g.names.map(n => `<th style="white-space:nowrap;">${displayName(d, n)}</th>`).join('');
  document.getElementById(`body-${gn}`).innerHTML = g.names.map(n1 => `
    <tr>
      <td style="font-weight:700;background:var(--surface2);white-space:nowrap;text-align:center;padding-left:4px;">${displayName(d, n1)}</td>
      ${g.names.map(n2 => {
        if (n1 === n2) return `<td style="background:#f1f5f9;color:#94a3b8;">—</td>`;
        const r = g.results[n1][n2];
        return `<td class="${r.done && r.s1 > r.s2 ? 'cell-winner' : ''}">
          <select class="matrix-select" onchange="updateScore('${gn}','${n1}','${n2}',this.value)">
            ${getOptions(d.targetWins, `${r.s1}:${r.s2}`)}
          </select></td>`;
      }).join('')}
    </tr>`).join('');
}

function getOptions(max, cur) {
  let h = `<option value="0:0" ${cur==='0:0'?'selected':''}>—</option>`;
  for (let i = 0; i < max; i++) h += `<option value="${max}:${i}" ${cur===`${max}:${i}`?'selected':''}>${max}:${i}</option>`;
  for (let i = 0; i < max; i++) h += `<option value="${i}:${max}" ${cur===`${i}:${max}`?'selected':''}>${i}:${max}</option>`;
  return h;
}

window.updateScore = (gn, p1, p2, val) => {
  const [s1, s2] = val.split(':').map(Number);
  const g = masterData[curId].groups[gn];
  g.results[p1][p2] = { s1, s2, done: s1 > 0 || s2 > 0 };
  g.results[p2][p1] = { s1: s2, s2: s1, done: s1 > 0 || s2 > 0 };
  // 승패 수정 시 수동 순위(drag) 초기화 → 승패 결과가 최종 순위
  g.manualOrder = null;
  g.manualRanks = {};
  renderMatrix(gn); updateStandings(gn);
};

/* ───────────────────────────── standings ─────────────────────────────── */
function computeStats(gn) {
  const g = masterData[curId].groups[gn];
  const manualRanks = g.manualRanks || {};

  // 1. 기본 스탯 계산
  let stats = g.names.map(name => {
    let s = { id: g.playerIds[name], name, w: 0, l: 0, sW: 0, sL: 0, pts: 0 };
    g.names.forEach(opp => {
      if (name === opp) return;
      const m = g.results[name][opp];
      if (m?.done) {
        s.sW += m.s1; s.sL += m.s2;
        m.s1 > m.s2 ? (s.w++, s.pts += 2) : (s.l++, s.pts += 1);
      }
    });
    s.diff = s.sW - s.sL;
    return s;
  });

  const totalMatches = g.names.length * (g.names.length - 1) / 2;
  const done = g.names.reduce((c, n1) => c + g.names.filter(n2 => n1 < n2 && g.results[n1][n2]?.done).length, 0);
  const noRes = done === 0;
  const allMatchesDone = done === totalMatches;
  const ec = masterData[curId].eliminateCount || 0;

  // 2. 1차 정렬: 승점만으로 (동률 그룹을 정확히 묶기 위해)
  let ranked = [...stats].sort((a, b) => b.pts - a.pts);

  // 3. 동률 그룹별 타이브레이크 적용 (재귀적 서브그룹 분리)
  function resolveTieGroup(group, depth) {
    if (group.length <= 1 || noRes) return group;

    // 동률 그룹 내 h2h 통계 계산
    const enriched = group.map(p => {
      let h2hW = 0, h2hSW = 0, h2hSL = 0;
      group.forEach(o => {
        if (p.name === o.name) return;
        const m = g.results[p.name][o.name];
        if (m?.done) {
          h2hSW += m.s1; h2hSL += m.s2;
          if (m.s1 > m.s2) h2hW++;
        }
      });
      return { ...p, h2hW, h2hDiff: h2hSW - h2hSL };
    });

    // depth 0: h2hW 기준 정렬 및 서브그룹 분리
    // depth 1: h2hDiff 기준
    // depth 2: 전체 diff 기준
    // depth 3: 완전 동률 (needsManual)
    const sortKey = (a, b) => {
      if (depth === 0) return b.h2hW - a.h2hW;
      if (depth === 1) return b.h2hDiff - a.h2hDiff;
      if (depth === 2) return b.diff - a.diff;
      // depth 3: 수동선택
      const mA = manualRanks[a.name], mB = manualRanks[b.name];
      if (mA !== undefined && mB !== undefined) return mA - mB;
      if (mA !== undefined) return -1;
      if (mB !== undefined) return 1;
      return 0;
    };

    enriched.sort(sortKey);

    // 같은 기준값으로 묶인 서브그룹을 재귀적으로 처리
    const result = [];
    let si = 0;
    while (si < enriched.length) {
      let sj = si + 1;
      // 현재 depth 기준값이 같은 서브그룹 찾기
      const getVal = (p) => {
        if (depth === 0) return p.h2hW;
        if (depth === 1) return p.h2hDiff;
        if (depth === 2) return p.diff;
        return null; // depth 3: 수동
      };
      while (sj < enriched.length && getVal(enriched[sj]) === getVal(enriched[si])) sj++;
      const sub = enriched.slice(si, sj);
      if (sub.length > 1 && depth < 3) {
        // 서브그룹이 2명 이상이고 다음 기준이 있으면 재귀
        // 단, depth 0 (h2hW) 에서 나뉜 서브그룹은 그 서브그룹끼리만 h2h 재계산 필요
        result.push(...resolveTieGroup(sub.map(p => stats.find(s => s.name === p.name)), depth + 1));
      } else {
        result.push(...sub);
      }
      si = sj;
    }
    return result;
  }

  let i = 0;
  while (i < ranked.length) {
    let j = i + 1;
    while (j < ranked.length && ranked[j].pts === ranked[i].pts) j++;
    const tieGroup = ranked.slice(i, j);

    if (tieGroup.length > 1) {
      const resolved = resolveTieGroup(tieGroup.map(p => stats.find(s => s.name === p.name)), 0);
      resolved.forEach((p, k) => { ranked[i + k] = p; });
    }
    i = j;
  }

  // 4. 최종 rank 부여
  //    resolveTieGroup 이후에도 모든 기준이 동일한 인접 선수는 동순위
  let cr = 1;
  ranked.forEach((p, idx) => {
    p.isTied = false;
    p.needsManual = false;
    if (idx === 0) {
      p.rank = cr;
    } else {
      const prev = ranked[idx - 1];
      const samePts = p.pts === prev.pts;

      // 완전 동률 판단: 승점 + h2hW + h2hDiff + 전체diff 모두 같아야
      const fullyTied = samePts && (
        p.h2hW !== undefined && prev.h2hW !== undefined
          ? (p.h2hW === prev.h2hW && p.h2hDiff === prev.h2hDiff && p.diff === prev.diff)
          : (p.diff === prev.diff)
      );

      if (!noRes && fullyTied) {
        const mA = manualRanks[prev.name], mB = manualRanks[p.name];
        if (mA !== undefined && mB !== undefined && mA !== mB) {
          cr = idx + 1; p.rank = cr;
        } else {
          p.rank = prev.rank;
          p.isTied = prev.isTied = true;
          if (allMatchesDone) { p.needsManual = prev.needsManual = true; }
        }
      } else {
        cr = idx + 1; p.rank = cr;
      }
    }
    p.isEliminated = ec > 0 && p.rank > ranked.length - ec;
    const x = stats.find(s => s.name === p.name);
    Object.assign(x, {
      rank: p.rank, isTied: p.isTied, needsManual: p.needsManual,
      isEliminated: p.isEliminated, h2hW: p.h2hW, h2hDiff: p.h2hDiff
    });
  });

  return { stats, ranked };
}

function updateStandings(gn) {
  const { stats, ranked } = computeStats(gn);
  const ec = masterData[curId].eliminateCount || 0;
  const d = masterData[curId];
  const g = d.groups[gn];
  const manualRanks = g.manualRanks || {};

  // manualOrder가 있으면 그 순서로, 없으면 rank 기준 오름차순
  let sorted;
  if (g.manualOrder && g.manualOrder.length) {
    sorted = g.manualOrder.map(name => stats.find(s => s.name === name)).filter(Boolean);
    stats.forEach(s => { if (!sorted.includes(s)) sorted.push(s); });
  } else {
    sorted = [...ranked]; // computeStats에서 이미 rank순 정렬됨
  }

  // manualOrder 기반으로 rank 재계산 (드래그 후 순위 갱신)
  if (g.manualOrder && g.manualOrder.length) {
    sorted.forEach((s, i) => {
      s.rank = i + 1;
      s.isEliminated = ec > 0 && s.rank > sorted.length - ec;
    });
  }

  const tbody = document.querySelector(`#standings-${gn} tbody`);
  tbody.innerHTML = sorted.map((s, idx) => {
    const rowBg = s.needsManual ? 'background:#fff7ed;' : (s.isTied ? 'background:#fef3c7;' : '');
    let badge = '';
    // 탈락/진출 표시: 경기 결과 여부 무관하게 항상 표시 (ec > 0이면)
    if (ec > 0) badge = s.isEliminated ? '<span class="badge badge-elim">탈락</span>' : '<span class="badge badge-promote">진출</span>';

    let rankCell = '';
    if (s.needsManual) {
      const allTied = sorted.filter(x => x.needsManual);
      const groupRanks = allTied.map(x => x.rank);
      const minRank = Math.min(...groupRanks);
      const maxRank = Math.min(minRank + allTied.length - 1, ranked.length);
      const options = [];
      for (let r = minRank; r <= maxRank; r++) {
        const sel = (manualRanks[s.name] === r) ? 'selected' : '';
        options.push(`<option value="${r}" ${sel}>${r}위</option>`);
      }
      rankCell = `<select onchange="setManualRank('${gn}','${s.name}',this.value)" style="font-size:0.78rem;border:1.5px solid var(--warning);border-radius:5px;padding:2px 6px;background:#fff7ed;font-weight:700;cursor:pointer;color:var(--text);outline:none;">
        <option value="">순위선택</option>${options.join('')}
      </select>`;
    } else {
      rankCell = `<span style="font-weight:800;">${s.rank}</span>${s.isTied ? ' <span style="font-size:0.7rem;color:var(--warning);">동률</span>' : ''}`;
    }

    return `<tr data-player="${s.name}" style="${rowBg}cursor:grab;">
      <td style="color:var(--text3);">${s.id}</td>
      <td style="font-weight:700;white-space:nowrap;text-align:left;padding-left:8px;">${displayName(d, s.name)}</td>
      <td>${s.w} / ${s.l}</td>
      <td style="font-weight:700;color:${s.diff>0?'var(--success)':s.diff<0?'var(--danger)':'var(--text3)'};">${s.diff>0?'+':''}${s.diff}</td>
      <td style="font-weight:700;color:var(--primary);">${s.pts}</td>
      <td>${rankCell}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');

  // 항상 드래그앤드롭 활성화
  attachDragDrop(gn);
}

function attachDragDrop(gn) {
  const tbody = document.querySelector(`#standings-${gn} tbody`);
  if (!tbody) return;
  let dragSrc = null;
  const tooltip = document.getElementById('dragRankTooltip');

  const showTooltip = (targetRow, rank) => {
    if (!tooltip) return;
    const rect = targetRow.getBoundingClientRect();
    tooltip.textContent = `→ ${rank}위`;
    tooltip.style.display = 'block';
    // 행 위 중앙에 배치
    const tooltipW = tooltip.offsetWidth || 80;
    const centerX = rect.left + rect.width / 2 - tooltipW / 2;
    const topY = rect.top - 38; // 행 위 38px
    tooltip.style.left = Math.max(4, centerX) + 'px';
    tooltip.style.top = topY + 'px';
  };
  const hideTooltip = () => { if (tooltip) tooltip.style.display = 'none'; };

  Array.from(tbody.querySelectorAll('tr')).forEach(row => {
    row.draggable = true;
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => { row.style.opacity = '0.4'; }, 0);
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '';
      dragSrc = null;
      hideTooltip();
      // 모든 행 outline 해제
      Array.from(tbody.querySelectorAll('tr')).forEach(r => { r.style.outline = ''; });
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // 현재 hover 행 강조
      Array.from(tbody.querySelectorAll('tr')).forEach(r => { r.style.outline = ''; });
      row.style.outline = '2px solid var(--primary)';
      // 드롭 시 위치될 순위 계산 후 행 위에 풍선 표시
      if (dragSrc) {
        const allRows = Array.from(tbody.querySelectorAll('tr'));
        const tgtIdx = allRows.indexOf(row);
        showTooltip(row, tgtIdx + 1);
      }
    });
    row.addEventListener('dragleave', () => { row.style.outline = ''; });
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.style.outline = '';
      hideTooltip();
      if (!dragSrc || dragSrc === row) return;
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const srcIdx = allRows.indexOf(dragSrc);
      const tgtIdx = allRows.indexOf(row);
      if (srcIdx < tgtIdx) tbody.insertBefore(dragSrc, row.nextSibling);
      else tbody.insertBefore(dragSrc, row);
      // 새 순서 저장 & 순위번호·탈락 즉시 갱신
      const newOrder = Array.from(tbody.querySelectorAll('tr')).map(r => r.dataset.player);
      const g = masterData[curId].groups[gn];
      g.manualOrder = newOrder;
      g.manualRanks = {};
      newOrder.forEach((name, i) => { if (name) g.manualRanks[name] = i + 1; });
      save(true);
      // 순위번호·탈락 인라인 업데이트 (re-render 없이)
      const ec = masterData[curId].eliminateCount || 0;
      const total = newOrder.length;
      Array.from(tbody.querySelectorAll('tr')).forEach((r, i) => {
        const rankTd = r.querySelector('td:nth-child(6)');
        const badgeTd = r.querySelector('td:nth-child(7)');
        if (rankTd) rankTd.innerHTML = `<span style="font-weight:800;">${i + 1}</span>`;
        if (badgeTd && ec > 0) {
          const isElim = (i + 1) > total - ec;
          badgeTd.innerHTML = isElim
            ? '<span class="badge badge-elim">탈락</span>'
            : '<span class="badge badge-promote">진출</span>';
        }
      });
    });
  });
}

window.handleSort = (gn, key) => {
  const o = groupSortOptions[gn];
  if (o.key === key) o.order = o.order === 'asc' ? 'desc' : 'asc'; else { o.key = key; o.order = 'asc'; }
  updateStandings(gn);
};

window.setManualRank = function(gn, playerName, rankVal) {
  const g = masterData[curId].groups[gn];
  if (!g.manualRanks) g.manualRanks = {};
  if (rankVal === '' || rankVal === null) {
    delete g.manualRanks[playerName];
  } else {
    g.manualRanks[playerName] = parseInt(rankVal);
  }
  save(true);
  updateStandings(gn);
};

/* ───────────────────────────── tournament ─────────────────────────────── */
function createTournament() {
  if (!curId) { alert('⚠️ 먼저 리그전을 생성해주세요.'); return; }
  const league = masterData[curId];
  const ec = league.eliminateCount || 0;
  const seeds = [];
  const gnames = Object.keys(league.groups).sort();
  if (!gnames.length) { showTournament(); return; }

  const maxPPG = Math.max(...gnames.map(g => league.groups[g].names.length));
  for (let rank = 1; rank <= maxPPG; rank++) {
    gnames.forEach(gn => {
      const g = league.groups[gn];
      let playerAtRank = null;

      if (g.manualOrder && g.manualOrder.length) {
        // drag & drop 으로 순위 변경된 경우 → manualOrder 순서 우선
        const name = g.manualOrder[rank - 1];
        if (name) {
          const isElim = ec > 0 && rank > g.manualOrder.length - ec;
          playerAtRank = { name, rank, isEliminated: isElim };
        }
      } else {
        // 승패 결과 기반 순위
        const ranked = computeStats(gn).ranked;
        const p = ranked.find(x => x.rank === rank);
        if (p) playerAtRank = { name: p.name, rank, isEliminated: ec > 0 && p.rank > ranked.length - ec };
      }

      if (playerAtRank) {
        seeds.push({
          name: playerAtRank.name, group: gn, rank: playerAtRank.rank,
          seed: `${gn} ${playerAtRank.rank}위`,
          isEliminated: playerAtRank.isEliminated,
          grade: g.grades[playerAtRank.name] || 9999
        });
      }
    });
  }

  if (league.tournament && !confirm('기존 토너먼트가 있습니다. 새로 생성할까요?')) { showTournament(); return; }

  league.tournament = { seeds, rounds: buildBracket(seeds, false), champion: null };
  // 토너먼트 진행 시 자동 저장 (알림 없이)
  localStorage.setItem('league_db', JSON.stringify(masterData));
  updateSelector();
  showTournament();
}

function getSeedOrder(n) {
  if (n === 1) return [0];
  const half = getSeedOrder(n / 2);
  const res = [];
  for (const v of half) { res.push(v); res.push(n - 1 - v); }
  return res;
}

function buildBracket(seeds, isRandom) {
  const active = seeds.filter(s => !s.isEliminated).sort((a, b) => {
    if (isRandom) return 0;
    return a.rank !== b.rank ? a.rank - b.rank : a.grade - b.grade;
  });

  let size = 2;
  while (size < active.length) size *= 2;

  const full = [...active];
  while (full.length < size) full.push(null);

  const order = getSeedOrder(size);
  const slots = order.map(i => full[i]);

  const allRounds = [];
  const round1 = [];
  for (let i = 0; i < size / 2; i++) {
    const p1 = slots[i * 2], p2 = slots[i * 2 + 1];
    let winner = null, completed = false, isWalkover = false;
    if (p1 && !p2) { winner = p1.name; completed = true; isWalkover = true; }
    else if (!p1 && p2) { winner = p2.name; completed = true; isWalkover = true; }
    round1.push({
      id: `r1_${i}`,
      player1: p1?.name || null, player2: p2?.name || null,
      seed1: p1?.seed || '', seed2: p2?.seed || '',
      winner, completed, isWalkover, p1Elim: false, p2Elim: false
    });
  }
  allRounds.push(round1);

  let prev = round1;
  while (prev.length > 1) {
    const next = [];
    for (let i = 0; i < prev.length / 2; i++) {
      const m1 = prev[i * 2], m2 = prev[i * 2 + 1];
      let p1 = m1.winner || null, p2 = m2.winner || null;
      let s1 = m1.winner ? (m1.winner === m1.player1 ? m1.seed1 : m1.seed2) : '';
      let s2 = m2.winner ? (m2.winner === m2.player1 ? m2.seed1 : m2.seed2) : '';
      // 첫 라운드 이후 부전승 없음: 자동 진출 처리 안 함
      next.push({ id: `r${allRounds.length + 1}_${i}`, player1: p1, player2: p2, seed1: s1, seed2: s2, winner: null, completed: false, isWalkover: false, fromMatches: [m1.id, m2.id] });
    }
    allRounds.push(next);
    prev = next;
  }

  const labels = ['결승','준결승','8강','16강','32강','64강'];
  return allRounds.map((m, idx) => {
    const fe = allRounds.length - 1 - idx;
    return { name: labels[fe] || `${Math.pow(2, fe + 1)}강`, matches: m };
  });
}

function showTournament() {
  document.getElementById('mainDashboard').classList.add('hidden');
  document.getElementById('tournamentArea').classList.remove('hidden');

  // 토너먼트 대회명 배너
  const d = masterData[curId];
  if (d) {
    const seeds = d.tournament?.seeds || [];
    const playerCount = seeds.filter(s => !s.isEliminated).length;
    document.getElementById('tournamentTitleBanner').innerHTML = `
      <div class="title-banner" style="background:linear-gradient(135deg,#f59e0b 0%,#7c3aed 100%);margin-bottom:16px;">
        <div class="title-banner-icon">🏆</div>
        <div class="title-banner-text">
          <div class="title-banner-name">${d.title || '용문리그'}</div>
          <div class="title-banner-meta">${d.date || ''} &nbsp;·&nbsp; 토너먼트 대진표 &nbsp;·&nbsp; ${playerCount}강</div>
        </div>
      </div>`;
    // 토너먼트 카드 서브타이틀에도 대회명 표시
    const sub = document.getElementById('tournamentSubtitle');
    if (sub) sub.textContent = d.title || 'Single Elimination';
  }

  renderTournament();
  setTimeout(() => document.getElementById('tournamentArea').scrollIntoView({ behavior: 'smooth' }), 100);
}

function backToLeague() {
  document.getElementById('tournamentArea').classList.add('hidden');
  if (masterData[curId] && Object.keys(masterData[curId].groups).length > 0) {
    document.getElementById('mainDashboard').classList.remove('hidden');
    setTimeout(() => document.getElementById('mainDashboard').scrollIntoView({ behavior: 'smooth' }), 100);
  }
}

function renderTournament() {
  const league = masterData[curId];
  if (!league?.tournament) return;
  const container = document.getElementById('tournamentBracket');
  container.innerHTML = '';

  const rounds = league.tournament.rounds;
  if (!rounds?.length) return;

  /*
   * 레이아웃 구조 (각 열):
   *  [LABEL_W] [BOX_W] [PRINT_W] [GAP] [LABEL_W] [BOX_W] ...
   *
   * 각 대진(match-card)은 relative div 안에:
   *   왼쪽: 라운드 레이블 (32강 등)
   *   가운데: 매치 박스
   *   오른쪽: 인쇄 버튼 (부전승 제외)
   */
  const LABEL_W = 50;
  const BOX_W   = 190;
  const PRINT_W = 40;
  const COL_W   = LABEL_W + BOX_W + PRINT_W;  // 308
  const COL_GAP = 32;
  const BOX_H   = 72;
  const SLOT_GAP = 20;
  const SLOT_H  = BOX_H + SLOT_GAP;
  const HEADER_H = 42;
  const PAD_V   = 14;

  const ROUND_N      = rounds.length;
  const FIRST_N      = rounds[0].matches.length;
  const TOTAL_W      = ROUND_N * COL_W + (ROUND_N - 1) * COL_GAP;
  const TOTAL_H      = FIRST_N * SLOT_H + HEADER_H + PAD_V * 2;

  /* ── outer wrapper (scroll 컨테이너) ── */
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'tournament-wrap';

  /* ── inner absolute canvas ── */
  const canvas = document.createElement('div');
  canvas.style.cssText = `position:relative;width:${TOTAL_W}px;height:${TOTAL_H}px;`;

  /* ── SVG for connector lines ── */
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width', TOTAL_W);
  svg.setAttribute('height', TOTAL_H);
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
  canvas.appendChild(svg);

  const centerYs = []; // centerYs[ri][mi] = center Y of that match card

  rounds.forEach((round, ri) => {
    const isFinal = round.name === '결승';
    const matchN  = round.matches.length;
    const slotH   = (FIRST_N * SLOT_H) / matchN; // 후반 라운드는 더 넓은 슬롯
    const colLeft = ri * (COL_W + COL_GAP);
    const boxLeft = colLeft + LABEL_W;
    const cys = [];
    centerYs.push(cys);

    /* 상단 라운드 이름 헤더 */
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      `position:absolute`,
      `left:${boxLeft}px`,`top:${PAD_V}px`,
      `width:${BOX_W}px`,`height:${HEADER_H - 6}px`,
      `display:flex`,`align-items:center`,`justify-content:center`,
      `font-weight:800`,`font-size:0.8rem`,`letter-spacing:0.4px`,
      `border-radius:100px`,`box-sizing:border-box`,
      isFinal
        ? `color:white;background:linear-gradient(135deg,#f59e0b,#d97706);border:1.5px solid #f59e0b;`
        : `color:var(--primary);background:var(--primary-light);border:1.5px solid var(--primary);`
    ].join(';');
    hdr.textContent = round.name;
    canvas.appendChild(hdr);

    round.matches.forEach((match, mi) => {
      const slotTop = HEADER_H + PAD_V + mi * slotH;
      const boxTop  = slotTop + (slotH - BOX_H) / 2;
      const cy      = boxTop + BOX_H / 2;
      cys.push(cy);

      const isWO     = match.isWalkover || false;
      const canVote  = match.player1 && match.player2 && !isWO;

      /* ── 왼쪽 라운드 레이블 ── */
      const lbl = document.createElement('div');
      lbl.style.cssText = [
        `position:absolute`,
        `left:${colLeft}px`,`top:${boxTop}px`,
        `width:${LABEL_W - 4}px`,`height:${BOX_H}px`,
        `display:flex`,`align-items:center`,`justify-content:center`,
      ].join(';');
      lbl.innerHTML = `<span style="
        font-size:0.68rem;font-weight:800;line-height:1.3;text-align:center;
        white-space:nowrap;padding:4px 5px;border-radius:6px;
        ${isFinal
          ? 'color:#92400e;background:#fef3c7;border:1.5px solid #f59e0b;'
          : 'color:var(--primary);background:var(--primary-light);border:1.5px solid var(--primary);'
        }
      ">${round.name}</span>`;
      canvas.appendChild(lbl);

      /* ── 매치 카드 ── */
      const makeRow = (name, isP1) => {
        const seed   = isP1 ? match.seed1 : match.seed2;
        const isWin  = !!(match.winner && match.winner === name);
        const isBye  = isWO && !name;
        const dname  = name ? displayName(league, name) : '';
        const label  = isBye ? 'BYE' : (isWO && isWin ? `${dname} (부전승)` : (dname || ''));
        let rowCls   = 'mrow';
        if (isWin && !isWO) rowCls += ' mwinner';
        if (isWin && isWO)  rowCls += ' mwalkover';
        if (isBye)          rowCls += ' mbye';
        const radio  = canVote && name
          ? `<input type="radio" name="m_${match.id}" id="${match.id}_p${isP1?1:2}" ${isWin?'checked':''} onchange="selectWinner('${match.id}',${isP1?1:2})">`
          : '';
        const badge  = ri === 0 && seed
          ? `<span class="seed-pill">${seed}</span>` : '';
        return `<div class="${rowCls}" style="height:${BOX_H/2 - 0.5}px;min-height:0;">
          <label for="${match.id}_p${isP1?1:2}" style="${isBye?'color:#94a3b8;font-style:italic;':''}">
            ${radio}${badge}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</span>
          </label>
        </div>`;
      };

      const card = document.createElement('div');
      card.className = `match-card${isFinal ? ' final-card' : ''}`;
      card.style.cssText = `position:absolute;left:${boxLeft}px;top:${boxTop}px;width:${BOX_W}px;height:${BOX_H}px;overflow:hidden;`;
      card.innerHTML = `
        ${makeRow(match.player1, true)}
        <div style="height:1px;background:var(--border);flex-shrink:0;"></div>
        ${makeRow(match.player2, false)}
      `;
      canvas.appendChild(card);

      /* ── 인쇄 버튼 (부전승 제외) ── */
      if (!isWO) {
        const pBtn = document.createElement('button');
        pBtn.className = 'btn-print-match';
        pBtn.title = '경기 카드 인쇄';
        pBtn.innerHTML = '🖨️';
        pBtn.style.cssText = [
          `position:absolute`,
          `left:${boxLeft + BOX_W + 6}px`,
          `top:${cy - 15}px`,
          `width:30px`,`height:30px`,
          `padding:0`,`font-size:0.82rem`,
          `border-radius:50%`,`z-index:5`,
          `display:flex`,`align-items:center`,`justify-content:center`,
        ].join(';');
        pBtn.addEventListener('click', () => printMatchCard(match.id));
        canvas.appendChild(pBtn);
      }
    });
  });

  /* ── SVG connector lines ── */
  rounds.forEach((_, ri) => {
    if (ri >= rounds.length - 1) return;
    const curr  = centerYs[ri];
    const next  = centerYs[ri + 1];
    const fromX = ri * (COL_W + COL_GAP) + LABEL_W + BOX_W;
    const toX   = (ri + 1) * (COL_W + COL_GAP) + LABEL_W;
    const midX  = fromX + (toX - fromX) / 2;

    for (let i = 0; i < curr.length; i += 2) {
      const y1   = curr[i];
      const y2   = curr[i + 1] ?? y1;
      const midY = (y1 + y2) / 2;
      const yn   = next[Math.floor(i / 2)] ?? midY;

      [`M ${fromX} ${y1} H ${midX} V ${midY}`,
       `M ${fromX} ${y2} H ${midX} V ${midY}`,
       `M ${midX} ${midY} V ${yn} H ${toX}`
      ].forEach(d => {
        const p = document.createElementNS('http://www.w3.org/2000/svg','path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#c7d2e8');
        p.setAttribute('stroke-width', '1.5');
        p.setAttribute('stroke-linecap', 'round');
        svg.appendChild(p);
      });
    }
  });

  scrollWrap.appendChild(canvas);
  container.appendChild(scrollWrap);

  if (league.tournament.champion) {
    const cb = document.createElement('div');
    cb.className = 'champion-banner';
    cb.innerHTML = `<h3>🏆 우승자</h3><div class="champion-name">${displayName(league, league.tournament.champion)}</div>`;
    container.appendChild(cb);
  }
}

window.selectWinner = function(matchId, playerNum) {
  const league = masterData[curId];
  if (!league.tournament) return;
  let match = null, ri = -1;
  for (let i = 0; i < league.tournament.rounds.length; i++) {
    const m = league.tournament.rounds[i].matches.find(x => x.id === matchId);
    if (m) { match = m; ri = i; break; }
  }
  if (!match) return;

  const winner = playerNum === 1 ? match.player1 : match.player2;
  const winnerSeed = playerNum === 1 ? match.seed1 : match.seed2;
  match.winner = winner; match.completed = true;

  if (ri < league.tournament.rounds.length - 1) {
    const nextRound = league.tournament.rounds[ri + 1];
    const mi = league.tournament.rounds[ri].matches.findIndex(x => x.id === matchId);
    const nmi = Math.floor(mi / 2), pos = mi % 2;
    if (nextRound.matches[nmi]) {
      const nm = nextRound.matches[nmi];
      if (pos === 0) { nm.player1 = winner; nm.seed1 = winnerSeed; }
      else { nm.player2 = winner; nm.seed2 = winnerSeed; }
      // 첫 라운드 이후 부전승 자동 처리 없음
    }
  } else {
    league.tournament.champion = winner;
    // 결승 완료 시 자동 저장
    localStorage.setItem('league_db', JSON.stringify(masterData));
    updateSelector();
  }

  save(true); renderTournament();
};

/* ───────────────────────────── print match card ─────────────────────────────── */
window.printMatchCard = function(matchId) {
  const league = masterData[curId];
  let match = null, roundName = '';
  for (const r of league.tournament.rounds) {
    const f = r.matches.find(m => m.id === matchId);
    if (f) { match = f; roundName = r.name; break; }
  }
  if (!match) return;
  const title = `${league.title || '용문리그'} ${roundName}`;
  const today = new Date().toLocaleDateString('ko-KR');
  const p1 = displayName(league, match.player1) || '';
  const p2 = displayName(league, match.player2) || '';

  const w = window.open('', '_blank', 'width=1100,height=750');
  w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${title}</title>
<style>
@page { size: A4 landscape; margin: 15mm; }
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100%;height:100%;font-family:'Malgun Gothic',sans-serif;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;padding:10px;}
.card{width:100%;height:calc(100vh - 20px);display:flex;flex-direction:column;border:2.5px solid #1a1f36;border-radius:12px;overflow:hidden;}
.hd{background:#fff;color:#1a1f36;text-align:center;padding:18px;font-size:26pt;font-weight:900;letter-spacing:-0.5px;flex-shrink:0;border-bottom:2px solid #1a1f36;}
.body{flex:1;display:flex;flex-direction:column;}
.players{display:flex;flex:1;}
.pl{flex:1;display:flex;align-items:center;justify-content:center;font-size:44pt;font-weight:900;color:#1a1f36;text-align:center;padding:16px;word-break:keep-all;}
.pl:first-child{border-right:2px dashed #cbd5e1;}
.score-row{display:flex;flex:2;border-top:2px solid #1a1f36;}
.sc{flex:1;} .sc:first-child{border-right:2px dashed #cbd5e1;}
.ft{background:#fff;padding:10px;text-align:center;font-size:12pt;color:#1a1f36;font-weight:600;border-top:2px solid #e4e8f0;flex-shrink:0;}
.pbtn{display:block;margin:12px auto 0;padding:10px 28px;font-size:13pt;background:#5b6cf5;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;}
@media print{.pbtn{display:none;}}
</style></head><body>
<div class="card">
  <div class="hd">${title}</div>
  <div class="body">
    <div class="players"><div class="pl">${p1}</div><div class="pl">${p2}</div></div>
    <div class="score-row"><div class="sc"></div><div class="sc"></div></div>
  </div>
  <div class="ft">${today}</div>
</div>
<button class="pbtn" onclick="window.print()">🖨️ 인쇄</button>
</body></html>`);
  w.document.close();
};

/* ───────────────────────────── print all players ─────────────────────────────── */
window.printAllPlayers = function() {
  const league = masterData[curId];
  if (!league) return;

  // 전체 선수 수집 후 가나다 순 정렬
  const all = [];
  Object.keys(league.groups).sort().forEach(gn => {
    league.groups[gn].names.forEach(name => {
      all.push({ name, display: displayName(league, name) });
    });
  });
  all.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const total = all.length;
  if (!total) { alert('선수 명단이 없습니다.'); return; }

  // 4열 고정, 세로우선 배치
  const cols = 4;
  const rows = Math.ceil(total / cols);

  // 세로우선 배치: [col][row] = player index
  const grid = [];
  for (let c = 0; c < cols; c++) {
    grid[c] = [];
    for (let r = 0; r < rows; r++) {
      const idx = c * rows + r;
      grid[c][r] = idx < total ? all[idx] : null;
    }
  }

  // 셀 폰트: 행 수에 따라 자동 조절
  const cellFontPt = Math.min(13, Math.max(8, Math.floor(160 / rows)));
  const titleFontPt = 20;

  // 열 너비 계산: 4열 × (번호 + 이름 + 참가) + 간격
  // 번호 고정, 이름·참가 동일 너비로 나머지 분배
  // table-layout:fixed + % 사용
  // 전체 = 4 × (num% + name% + check%) + 3 × gap%
  // gap = 0.8%, num = 4%, name = check = 자동
  const numW = 5;      // % per col
  const gapW = 0.8;    // % between col groups
  const nameCheckW = (100 - cols * numW - (cols - 1) * gapW) / (cols * 2); // name == check

  // HTML 생성: 번호 | 이름 | 참가란
  let colgroup = `<colgroup>`;
  for (let c = 0; c < cols; c++) {
    colgroup += `<col style="width:${numW}%"><col style="width:${nameCheckW.toFixed(2)}%"><col style="width:${nameCheckW.toFixed(2)}%">`;
    if (c < cols - 1) colgroup += `<col style="width:${gapW}%">`;
  }
  colgroup += `</colgroup>`;

  let tableInner = `${colgroup}<thead><tr>`;
  for (let c = 0; c < cols; c++) {
    tableInner += `<th class="th-num">번호</th><th class="th-name">이름</th><th class="th-check">참가</th>`;
    if (c < cols - 1) tableInner += `<th class="th-gap"></th>`;
  }
  tableInner += `</tr></thead><tbody>`;

  for (let r = 0; r < rows; r++) {
    tableInner += `<tr>`;
    for (let c = 0; c < cols; c++) {
      const p = grid[c][r];
      const num = c * rows + r + 1;
      if (p) {
        tableInner += `<td class="td-num">${num}</td><td class="td-name">${p.display}</td><td class="td-check"></td>`;
      } else {
        tableInner += `<td class="td-num"></td><td class="td-name"></td><td class="td-check"></td>`;
      }
      if (c < cols - 1) tableInner += `<td class="td-gap"></td>`;
    }
    tableInner += `</tr>`;
  }
  tableInner += `</tbody>`;

  const w = window.open('', '_blank');
  // A4 landscape: margin 상 5mm, 좌우 15mm, 하 10mm → 가용: 267mm × 195mm
  // 제목 24pt(line-height 1.1≈26.4pt) + mb 8pt = 34.4pt
  // thead 20pt → tbody 가용 ≈ 195mm×(72/25.4) - 34.4 - 20 ≈ 553 - 54 = 499pt
  const theadPt = 30;
  const rowHPt  = Math.floor(499 / rows) - 8 + 2;

  w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${league.title} 참가자명단</title>
<style>
@page { size: A4 landscape; margin: 10mm 15mm 10mm 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: 'Malgun Gothic', sans-serif; background: #fff; }
h1 { text-align: center; font-size: 24pt; font-weight: 900; margin-bottom: 10pt; letter-spacing: -0.3px; line-height: 1.1; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead tr { height: ${theadPt}pt; }
th { background: #e8eaf0; border: 1px solid #000; font-size: 12pt; font-weight: 800; text-align: center; vertical-align: middle; padding: 0 2pt; }
tbody tr { height: ${rowHPt}pt; }
td { border: 1px solid #000; font-size: 12pt; vertical-align: middle; padding: 0 2pt; }
.th-num, .td-num { text-align: center; font-weight: 700; color: #555; }
.th-name, .td-name { text-align: center; font-weight: 700; }
.th-check, .td-check { text-align: center; }
.th-gap, .td-gap { background: transparent; border: none; padding: 0; }
.pbtn { display: block; margin: 10px auto; padding: 8px 28px; font-size: 11pt; background: #5b6cf5; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
@media print {
  .pbtn { display: none; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tbody tr { height: ${rowHPt}pt; max-height: ${rowHPt}pt; overflow: hidden; }
  td { overflow: hidden; }
}
</style></head><body>
<h1>${league.title} 참가자명단</h1>
<table>${tableInner}</table>
<button class="pbtn" onclick="window.print()">🖨️ 인쇄</button>
</body></html>`);
  w.document.close();
};

/* ───────────────────────────── print group matrix ─────────────────────────────── */
window.printGroupMatrix = function(gn) {
  const league = masterData[curId];
  const g = league.groups[gn];
  const nMap = {};
  g.names.forEach(n => { nMap[n] = displayName(league, n); });

  // 경기 순서 생성 (리그 방식)
  const schedule = [];
  let list = [...g.names]; if (list.length % 2 === 1) list.push('BYE');
  for (let round = 0; round < list.length - 1; round++) {
    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i], b = list[list.length - 1 - i];
      if (a !== 'BYE' && b !== 'BYE') schedule.push([schedMap[a], schedMap[b]]);
    }
    list.splice(1, 0, list.pop());
  }

  const w = window.open('', '_blank');
  const n = g.names.length;
  // 셀 폰트: 인원수에 따라 자동 조절
  const cellFontPt = Math.min(15, Math.max(7, Math.floor(120 / (n + 2))));
  // 경기순서 표기용: 이름+등급 (괄호 없이) 예) 홍길동2
  const schedMap = {};
  g.names.forEach(nm => {
    const g2 = getGrade(league, nm);
    schedMap[nm] = g2 !== null ? `${nm}${g2}` : nm;
  });
  // A4 landscape: margin 좌우/상단 6mm, 하단 5mm → 가용: 285mm × 199mm
  // h2 18pt(line-height 1.1≈20pt) + mb 5pt, sched ≈18pt, mt 6pt → 여백 합계 ≈ 49pt
  // 테이블 가용 ≈ 199mm×(72/25.4) - 49 ≈ 564 - 49 = 515pt
  const tableAvailPt = 515;
  const rowHPt = Math.floor(tableAvailPt / (n + 1)) - 5;

  w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${league.title} - ${gn}</title>
<style>
@page{size:A4 landscape;margin:6mm 12mm 5mm 12mm;}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{font-family:'Malgun Gothic',sans-serif;background:#fff;}
h2{text-align:center;font-size:18pt;font-weight:900;margin-bottom:8pt;display:flex;align-items:baseline;justify-content:center;gap:8pt;line-height:1.1;}
.print-hint{font-size:7pt;font-weight:700;color:#dc2626;white-space:nowrap;}
table{width:100%;border-collapse:collapse;table-layout:fixed;}
th,td{border:1px solid #000;padding:0 2pt;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle;height:${rowHPt}pt;}
th{background:#f0f0f0;}
.pn{text-align:center;padding-left:0;word-break:keep-all;}
.sched{margin-top:6pt;}
.sched-matches{text-align:left;line-height:2;font-size:6.5pt;font-weight:600;}
.sched-item{display:inline-block;white-space:nowrap;border:1px solid #000;padding:2px;margin:0 4px 5px 0;line-height:1.4;}
.pbtn{display:block;margin:10px auto;padding:8px 28px;font-size:11pt;background:#5b6cf5;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;}
@media print{
  .pbtn{display:none;}
  .print-hint{display:none;}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  th,td{height:${rowHPt}pt;max-height:${rowHPt}pt;overflow:hidden;}
}
</style></head><body>
<h2>${league.title} — ${gn} 대진표 <span class="print-hint">인쇄 시 머리글/바닥글 체크해제, 배경그래픽 체크 필수!</span></h2>
  <table>
    <thead><tr><th style="width:9%;">선수</th>${g.names.map(n=>`<th style="width:${72/g.names.length}%;">${nMap[n]}</th>`).join('')}<th style="width:7%;">승/패</th><th style="width:5%;">득실</th><th style="width:5%;">순위</th></tr></thead>
    <tbody>${g.names.map(n1=>`<tr><td class="pn">${nMap[n1]}</td>${g.names.map(n2=>n1===n2?'<td style="background:#e5e7eb;">-</td>':'<td>&nbsp;</td>').join('')}<td>/</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}</tbody>
  </table>
  <div class="sched">
    <div class="sched-matches">${schedule.map(([p1, p2]) => `<span class="sched-item">${p1}<br>${p2}</span>`).join('')}</div>
  </div>
  <button class="pbtn" onclick="window.print()">🖨️ 인쇄</button>
</body></html>`);
  w.document.close();
};

/* ───────────────────────────── storage ─────────────────────────────── */
function save(silent = false) {
  if (!curId) return;
  // silent=true 는 메모리(masterData)만 업데이트, localStorage 저장 안 함
  if (!silent) {
    localStorage.setItem('league_db', JSON.stringify(masterData));
    updateSelector();
    alert('✅ 저장되었습니다.');
  }
}

function exportJson() {
  if (!Object.keys(masterData).length) { alert('저장된 데이터가 없습니다.'); return; }
  const blob = new Blob([JSON.stringify(masterData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `용문리그_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function importJson(event, isInitial = false) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      masterData = { ...masterData, ...data };
      localStorage.setItem('league_db', JSON.stringify(masterData));
      updateSelector();
      alert(`✅ ${Object.keys(data).length}개 대회 데이터를 불러왔습니다.`);
      if (isInitial) document.getElementById('initialImport').classList.add('hidden');
    } catch { alert('❌ 올바른 JSON 파일이 아닙니다.'); }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function updateSelector() {
  const sel = document.getElementById('leagueHistorySelector');
  const ids = Object.keys(masterData).sort((a, b) => b - a);
  sel.innerHTML = '<option value="">-- 과거 대회 선택 --</option>' +
    ids.map(id => {
      const ts = parseInt(id);
      let timeStr = '';
      if (!isNaN(ts)) {
        const d = new Date(ts);
        const h = String(d.getHours()).padStart(2,'0');
        const m = String(d.getMinutes()).padStart(2,'0');
        timeStr = ` ${h}:${m}`;
      }
      return `<option value="${id}">${masterData[id].date}${timeStr} | ${masterData[id].title}</option>`;
    }).join('');
}

function renderHistory() {
  const tbody = document.getElementById('histTableBody');
  const ids = Object.keys(masterData).sort((a, b) => b - a); // 최신순
  if (!ids.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text3);">저장된 대회가 없습니다.</td></tr>'; return; }
  tbody.innerHTML = ids.map(id => {
    const ts = parseInt(id);
    let timeStr = '';
    if (!isNaN(ts)) {
      const d = new Date(ts);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      timeStr = `${h}:${m}`;
    }
    return `<tr>
      <td style="color:var(--text3);white-space:nowrap;">${masterData[id].date || '-'}</td>
      <td style="color:var(--text3);white-space:nowrap;">${timeStr}</td>
      <td style="font-weight:700;text-align:left;">${masterData[id].title}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-success-s btn-xs" onclick="handleEdit('${id}')">불러오기</button>
        <button class="btn btn-danger btn-xs" onclick="handleDelete('${id}')" style="margin-left:4px;">삭제</button>
      </td>
    </tr>`;
  }).join('');
}

window.handleEdit = id => { closeHistory(); loadLeague(id); };
window.handleDelete = id => {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  delete masterData[id];
  localStorage.setItem('league_db', JSON.stringify(masterData));
  renderHistory(); updateSelector();
  if (curId === id) location.reload();
};

/* ───────────────────────────── tiebreaker ─────────────────────────────── */
let tbData = { players: [], results: {}, targetWins: 2 };

function openTiebreaker() {
  resetTiebreaker();
  document.getElementById('tiebreakerModal').classList.add('active');
}
function closeTiebreaker() {
  document.getElementById('tiebreakerModal').classList.remove('active');
}
function resetTiebreaker() {
  tbData = { players: [], results: {}, targetWins: 2 };
  document.getElementById('tbPlayerCount').value = 3;
  document.querySelector('input[name="tbRule"][value="2"]').checked = true;
  document.getElementById('tbStep1').classList.remove('hidden');
  document.getElementById('tbStep2').classList.add('hidden');
}

function initTiebreaker() {
  const n = parseInt(document.getElementById('tbPlayerCount').value) || 3;
  if (n < 2 || n > 10) { alert('2~10명 사이로 입력해주세요.'); return; }
  tbData.targetWins = parseInt(document.querySelector('input[name="tbRule"]:checked').value);
  tbData.players = Array.from({ length: n }, (_, i) => ({ name: '', grade: 9999, id: i }));
  tbData.results = {};

  document.getElementById('tbStep1').classList.add('hidden');
  document.getElementById('tbStep2').classList.remove('hidden');
  renderTbMatrix();
  renderTbStandings();
}

function parseTbName(raw) {
  const nm = raw.match(/^[^\d]+/); const gm = raw.match(/\d+/);
  const name  = nm ? nm[0].trim() : raw.trim();
  const grade = gm ? parseInt(gm[0]) : 9999;
  return { name, grade };
}

function renderTbMatrix() {
  const players = tbData.players;
  const n = players.length;
  const tw = tbData.targetWins;
  const scoreOpts = [['선택','']];
  for (let w = tw; w >= 0; w--) {
    for (let l = tw; l >= 0; l--) {
      if (w === tw && l < tw) scoreOpts.push([`${w}:${l}`, `${w}:${l}`]);
      else if (l === tw && w < tw) scoreOpts.push([`${w}:${l}`, `${w}:${l}`]);
    }
  }

  // 헤더: 이름(부수)로 수정
  document.getElementById('tbHead').innerHTML =
    `<tr><th>이름(부수)</th>${players.map((p, i) => `<th>${p.name || 'P'+(i+1)}</th>`).join('')}</tr>`;

  // 바디 (승일 경우 셀 배경 연두색)
  document.getElementById('tbBody').innerHTML = players.map((p, r) => {
    const nameCell = `<td><input type="text" value="${p.name ? (p.grade!==9999?p.name+p.grade:p.name) : ''}"
      placeholder="홍길동2" style="width:90px;border:1.5px solid var(--border);border-radius:5px;padding:4px 6px;font-size:0.82rem;font-family:inherit;outline:none;"
      oninput="tbUpdateName(${r},this.value)"></td>`;
    const cells = players.map((_, c) => {
      if (r === c) return `<td style="background:var(--surface2);">-</td>`;
      const key = `${r}_${c}`;
      const val = tbData.results[key] || '';
      const isWin = val ? (()=>{ const [s1,s2]=val.split(':').map(Number); return s1>s2; })() : false;
      const winBg = isWin ? 'background:var(--success-light);' : '';
      const opts = scoreOpts.map(([label, v]) =>
        `<option value="${v}" ${val===v?'selected':''}>${label}</option>`).join('');
      return `<td style="${winBg}"><select class="matrix-select" style="min-width:58px;"
        onchange="tbUpdateScore(${r},${c},this.value)">${opts}</select></td>`;
    }).join('');
    return `<tr>${nameCell}${cells}</tr>`;
  }).join('');
}

function tbUpdateName(idx, raw) {
  const { name, grade } = parseTbName(raw);
  tbData.players[idx].name  = name;
  tbData.players[idx].grade = grade;
  // 헤더 컬럼명 업데이트
  const ths = document.querySelectorAll('#tbHead th');
  if (ths[idx + 1]) ths[idx + 1].textContent = name || `P${idx+1}`;
  renderTbStandings();
}

function tbUpdateScore(r, c, val) {
  if (!val) {
    delete tbData.results[`${r}_${c}`];
    delete tbData.results[`${c}_${r}`];
  } else {
    const [s1, s2] = val.split(':').map(Number);
    tbData.results[`${r}_${c}`] = val;
    tbData.results[`${c}_${r}`] = `${s2}:${s1}`;
    // 상대 select 자동 반영 + 배경색 업데이트
    const oppSelect = document.querySelector(`#tbBody tr:nth-child(${c+1}) td:nth-child(${r+2}) select`);
    if (oppSelect) {
      oppSelect.value = `${s2}:${s1}`;
      const oppTd = oppSelect.closest('td');
      if (oppTd) oppTd.style.background = s2 > s1 ? 'var(--success-light)' : '';
    }
    // 내 셀 배경색
    const myTd = document.querySelector(`#tbBody tr:nth-child(${r+1}) td:nth-child(${c+2})`);
    if (myTd) myTd.style.background = s1 > s2 ? 'var(--success-light)' : '';
  }
  renderTbStandings();
}

function renderTbStandings() {
  const players = tbData.players;
  const n = players.length;

  // 기본 스탯 계산
  let stats = players.map((p, i) => {
    let w = 0, l = 0, sW = 0, sL = 0, pts = 0;
    players.forEach((_, j) => {
      if (i === j) return;
      const val = tbData.results[`${i}_${j}`];
      if (!val) return;
      const [s1, s2] = val.split(':').map(Number);
      sW += s1; sL += s2;
      if (s1 > s2) { w++; pts += 2; } else { l++; pts += 1; }
    });
    return { idx: i, name: p.name || `P${i+1}`, grade: p.grade, w, l, sW, sL, diff: sW - sL, pts };
  });

  // 1차 정렬: 승점
  stats.sort((a, b) => b.pts - a.pts);

  // 동률 처리: h2hW → h2hDiff → diff → grade
  function resolveTb(group) {
    if (group.length <= 1) return group;
    const enriched = group.map(p => {
      let h2hW = 0, h2hSW = 0, h2hSL = 0;
      group.forEach(o => {
        if (p.idx === o.idx) return;
        const val = tbData.results[`${p.idx}_${o.idx}`];
        if (!val) return;
        const [s1, s2] = val.split(':').map(Number);
        h2hSW += s1; h2hSL += s2;
        if (s1 > s2) h2hW++;
      });
      return { ...p, h2hW, h2hDiff: h2hSW - h2hSL };
    });
    enriched.sort((a, b) => {
      if (b.h2hW !== a.h2hW) return b.h2hW - a.h2hW;
      if (b.h2hDiff !== a.h2hDiff) return b.h2hDiff - a.h2hDiff;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.grade - b.grade;
    });
    return enriched;
  }

  // 동률 그룹 처리
  let ranked = [...stats], gi = 0;
  while (gi < ranked.length) {
    let j = gi + 1;
    while (j < ranked.length && ranked[j].pts === ranked[gi].pts) j++;
    if (j - gi > 1) {
      const resolved = resolveTb(ranked.slice(gi, j));
      resolved.forEach((p, k) => { ranked[gi + k] = p; });
    }
    gi = j;
  }

  // 전경기 입력 여부 확인
  const totalMatches = n * (n - 1); // 양방향
  const filledMatches = Object.keys(tbData.results).length;
  const allFilled = filledMatches >= totalMatches;

  // rank 부여 + 최종동률(연장자) 감지: 전경기 완료 시에만 활성화
  let cr = 1;
  ranked.forEach((p, idx) => {
    p.needsAge = false;
    if (idx === 0) { p.rank = cr; }
    else {
      const prev = ranked[idx - 1];
      const samePts = p.pts === prev.pts;
      const h2hSame = p.h2hW !== undefined && prev.h2hW !== undefined
        ? (p.h2hW === prev.h2hW && p.h2hDiff === prev.h2hDiff && p.diff === prev.diff && p.grade === prev.grade)
        : false;
      if (samePts && h2hSame) {
        p.rank = prev.rank;
        if (allFilled) p.needsAge = prev.needsAge = true;
      } else { cr = idx + 1; p.rank = cr; }
    }
  });

  // 어떤 기준으로 구분됐는지 파악 (rule highlight)
  // 같은 pts 그룹 내 어느 기준이 실제로 순위를 가름했는지 판단
  let activeRule = null; // 'h2h' | 'diff' | 'grade' | null
  // 모든 선수가 같은 pts 그룹인지
  const allSamePts = ranked.every(p => p.pts === ranked[0].pts);
  if (allSamePts && ranked.length > 1) {
    // h2hW로 구분됐는지
    const h2hWVals = ranked.map(p => p.h2hW ?? 0);
    if (h2hWVals.some((v, i) => i > 0 && v !== h2hWVals[0])) {
      activeRule = 'h2h';
    } else {
      const diffVals = ranked.map(p => p.h2hDiff ?? 0);
      if (diffVals.some((v, i) => i > 0 && v !== diffVals[0])) {
        activeRule = 'diff';
      } else {
        const gradeVals = ranked.map(p => p.grade);
        if (gradeVals.some((v, i) => i > 0 && v !== gradeVals[0])) {
          activeRule = 'grade';
        } else {
          activeRule = 'age';
        }
      }
    }
  } else if (ranked.length > 1) {
    // 서로 다른 pts지만 일부 동률 그룹 내 구분 기준 파악 — 가장 처음 동률 그룹 기준
    for (let i = 0; i < ranked.length - 1; i++) {
      if (ranked[i].pts === ranked[i+1].pts) {
        const a = ranked[i], b = ranked[i+1];
        if ((a.h2hW??0) !== (b.h2hW??0)) { activeRule = 'h2h'; break; }
        if ((a.h2hDiff??0) !== (b.h2hDiff??0)) { activeRule = 'diff'; break; }
        if (a.diff !== b.diff) { activeRule = 'diff'; break; }
        if (a.grade !== b.grade) { activeRule = 'grade'; break; }
        activeRule = 'age'; break;
      }
    }
  }

  // 룰 텍스트 강조 업데이트
  const ruleIds = { h2h: 'tb-rule-h2h', diff: 'tb-rule-diff', grade: 'tb-rule-grade', age: 'tb-rule-age' };
  Object.entries(ruleIds).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (key === activeRule) {
      el.style.cssText = 'color:#ea580c;font-weight:900;font-size:1.05em;';
    } else {
      el.style.cssText = '';
    }
  });

  const tbody = document.querySelector('#tbStandings tbody');
  const needsAgeSet = new Set(ranked.filter(p => p.needsAge).map(p => p.idx));
  const ageBg = '#fff7ed';

  tbody.innerHTML = ranked.map(s => {
    const diffColor = s.diff > 0 ? 'var(--success)' : s.diff < 0 ? 'var(--danger)' : 'var(--text3)';
    const rowBg = s.needsAge ? `background:${ageBg};` : '';
    return `<tr style="${rowBg}">
      <td style="font-weight:700;">${s.name}${s.grade !== 9999 ? `(${s.grade})` : ''}</td>
      <td>${s.w} / ${s.l}</td>
      <td style="font-weight:700;color:${diffColor};">${s.diff > 0 ? '+' : ''}${s.diff}</td>
      <td style="font-weight:800;color:var(--primary);">${s.rank}위</td>
    </tr>`;
  }).join('');

  // 연장자 필요 메시지
  const existingMsg = document.getElementById('tbAgeMsg');
  if (existingMsg) existingMsg.remove();
  if (ranked.some(p => p.needsAge)) {
    const msg = document.createElement('div');
    msg.id = 'tbAgeMsg';
    msg.style.cssText = 'margin-top:8px;padding:8px 12px;background:#fff7ed;border:1.5px solid #f59e0b;border-radius:8px;font-size:0.8rem;font-weight:700;color:#92400e;text-align:center;';
    msg.textContent = '⚠️ 연장자 순으로 나이 확인이 필요합니다';
    document.querySelector('#tbStandings').closest('.table-wrap').after(msg);
  }
}
