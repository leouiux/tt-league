/* ──────────────────────────────────────────
   서버 저장 / 불러오기
────────────────────────────────────────── */
async function serverSave(data) {
	try {
		const res = await fetch("/api/save", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});
		return await res.json();
	} catch (e) {
		console.error("저장 실패:", e);
		return { error: e.message };
	}
}

async function serverLoad() {
	try {
		const res = await fetch("/api/load");
		return await res.json();
	} catch (e) {
		console.error("불러오기 실패:", e);
		return {};
	}
}

let masterData = {};

async function initApp() {
	masterData = await serverLoad();
	updateSelector();
	renderHistory();
}
initApp();

let curId = null;
let isLoadedFromHistory = false; // 기록/과거대회 불러오기 여부
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
		const s = league.tournament.seeds.find((x) => x.name === name);
		if (s && s.grade !== 9999) return s.grade;
	}
	return null;
}

function displayName(league, name) {
	if (!name) return "";
	if (name.startsWith("(공석")) return "-"; // 공석 표시
	const g = getGrade(league, name);
	return g !== null ? `${name}(${g})` : name;
}

/* ───────────────────────────── init ─────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("leagueDate").value = new Date().toISOString().split("T")[0];

	document.getElementById("initialImportBtn").addEventListener("click", () => document.getElementById("initialJsonFileInput").click());
	document.getElementById("initialJsonFileInput").addEventListener("change", (e) => importJson(e, true));
	document.getElementById("startNewLeagueBtn").addEventListener("click", () => {
		document.getElementById("initialImport").classList.add("hidden");
		document.getElementById("setupArea").classList.remove("hidden");
	});
	document.getElementById("prepareNamesBtn").addEventListener("click", prepareNames);
	document.getElementById("startLeagueBtn").addEventListener("click", createLeague);
	document.getElementById("saveDataBtn").addEventListener("click", () => save(false));
	document.getElementById("viewHistoryBtn").addEventListener("click", openHistory);
	document.getElementById("closeHistoryBtn").addEventListener("click", closeHistory);
	document.getElementById("leagueHistorySelector").addEventListener("change", (e) => {
		if (e.target.value) loadLeague(e.target.value);
	});
	const _goToTournBtn = document.getElementById("goToTournamentBtn");
	if (_goToTournBtn) _goToTournBtn.addEventListener("click", createTournament);
	document.getElementById("backToLeagueBtn").addEventListener("click", backToLeague);
	document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
	document.getElementById("importJsonBtn").addEventListener("click", () => document.getElementById("jsonFileInput").click());
	document.getElementById("jsonFileInput").addEventListener("change", importJson);
	document.getElementById("bulkInputBtn").addEventListener("click", () => {
		document.getElementById("bulkModal").classList.add("active");
		setTimeout(() => document.getElementById("bulkTextarea").focus(), 80);
	});
	document.getElementById("bulkCancelBtn").addEventListener("click", closeBulk);
	document.getElementById("bulkCancelBtn2").addEventListener("click", closeBulk);
	document.getElementById("bulkConfirmBtn").addEventListener("click", processBulk);
	document.getElementById("directTournamentBtn").addEventListener("click", directTournament);

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeHistory();
			closeBulk();
		}
	});

	updateSelector();
});

function closeBulk() {
	document.getElementById("bulkModal").classList.remove("active");
	document.getElementById("bulkTextarea").value = "";
}
function openHistory() {
	renderHistory();
	document.getElementById("historyModal").classList.add("active");

	// 전체선택 체크박스
	const checkAll = document.getElementById("histCheckAll");
	if (checkAll) {
		// 이전 리스너 제거 후 재부착
		const newCA = checkAll.cloneNode(true);
		checkAll.parentNode.replaceChild(newCA, checkAll);
		newCA.addEventListener("change", () => {
			document.querySelectorAll(".hist-chk").forEach((c) => {
				c.checked = newCA.checked;
			});
		});
	}

	// 선택삭제 버튼
	const delSelBtn = document.getElementById("deleteSelectedBtn");
	if (delSelBtn) {
		const newBtn = delSelBtn.cloneNode(true);
		delSelBtn.parentNode.replaceChild(newBtn, delSelBtn);
		newBtn.addEventListener("click", deleteSelectedHistory);
	}
}
function closeHistory() {
	document.getElementById("historyModal").classList.remove("active");
}

window.handleEdit = (id) => {
	closeHistory();
	loadLeague(id);
};

/* ③ 개별 삭제 — 직접 delete 방식 (copy-reassign 버그 제거) */
window.handleDelete = async function (id) {
	if (!masterData[id]) {
		alert("해당 데이터를 찾을 수 없습니다.");
		return;
	}
	const title = masterData[id].title || "(제목없음)";
	if (!confirm(`"${title}" 을(를) 삭제하시겠습니까?`)) return;
	delete masterData[id];
	await serverSave(masterData);
	renderHistory();
	updateSelector();
	if (curId === id) {
		curId = null;
		location.reload();
	}
};

/* ④ 선택삭제 — 직접 delete 방식 */
async function deleteSelectedHistory() {
	const checked = Array.from(document.querySelectorAll(".hist-chk:checked")).map((c) => c.dataset.id);
	if (!checked.length) {
		alert("삭제할 항목을 선택해주세요.");
		return;
	}
	const titles = checked.map((id) => masterData[id]?.title || id).join("\n");
	if (!confirm(`아래 ${checked.length}개 항목을 삭제하시겠습니까?\n\n${titles}`)) return;
	checked.forEach((id) => {
		delete masterData[id];
	});
	await serverSave(masterData);
	renderHistory();
	updateSelector();
	if (checked.includes(curId)) {
		curId = null;
		location.reload();
	}
}

/* ───────────────────────────── name input ─────────────────────────────── */
function prepareNames() {
	const titleVal = document.getElementById("leagueTitle").value.trim();
	if (!titleVal) {
		alert("대회명을 입력해 주세요!");
		document.getElementById("leagueTitle").focus();
		return;
	}
	const gc = parseInt(document.getElementById("groupCount").value);
	const pc = parseInt(document.getElementById("playerCount").value);
	if (gc < 1 || pc < 2) {
		alert("⚠️ 조 개수 1개 이상, 조별 인원 2명 이상");
		return;
	}

	const container = document.getElementById("nameInputs");
	container.innerHTML = "";
	for (let i = 0; i < gc; i++) {
		const gn = i + 1 + "조";
		let inputs = "";
		for (let j = 0; j < pc; j++) inputs += `<input type="text" class="p-name" data-group="${gn}" placeholder="" oninput="applyAffilColors()">`;
		container.innerHTML += `
      <div class="group-input-card">
        <div class="group-input-label">${gn} 명단</div>
        <div class="name-grid">${inputs}</div>
      </div>`;
	}
	document.getElementById("nameInputArea").classList.remove("hidden");
	setTimeout(() => document.getElementById("nameInputArea").scrollIntoView({ behavior: "smooth" }), 100);
}

function processBulk() {
	const text = document.getElementById("bulkTextarea").value.trim();
	if (!text) {
		closeBulk();
		return;
	}

	// ── 입력 정제 헬퍼 ──────────────────────────────────────────
	// 이름 정제: 앞쪽 숫자·공백 제거, 이름 내 숫자 제거, 이모지·특수문자 제거
	function cleanName(raw) {
		let s = raw
			.replace(/^[\d\s]+/, "") // 앞쪽 숫자·공백 제거
			.replace(/[0-9]/g, "") // 이름 내 숫자 제거
			.replace(/[^\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF\uF900-\uFAFFa-zA-Z\s]/g, "") // 한중일·영문·공백만
			.trim();
		return s;
	}
	// 등급 정제: 숫자만 추출 (이모지·특수문자·문자 모두 제거)
	function cleanGrade(raw) {
		const digits = raw.replace(/[^\d]/g, "");
		return digits ? parseInt(digits) : 9999;
	}

	// ── 줄별 파싱: "이름 소속 등급" 또는 "이름 등급" 또는 "이름등급" ─
	const players = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l)
		.map((line) => {
			const tokens = line.trim().split(/\s+/);
			let rawName = "",
				rawAffil = "",
				rawGrade = "";

			if (tokens.length >= 3) {
				// 마지막 토큰에 숫자 있으면 → 이름 소속 등급
				const last = tokens[tokens.length - 1];
				if (/\d/.test(last)) {
					rawGrade = last;
					rawAffil = tokens[tokens.length - 2];
					rawName = tokens.slice(0, tokens.length - 2).join(" ");
				} else {
					// 숫자 없음: 이름 소속 (등급 없음)
					rawAffil = tokens[tokens.length - 1];
					rawName = tokens.slice(0, tokens.length - 1).join(" ");
				}
			} else if (tokens.length === 2) {
				const last = tokens[1];
				if (/^\d+$/.test(last)) {
					// "홍길동 2" — 이름 등급, 소속 없음
					rawGrade = last;
					rawName = tokens[0];
				} else if (/\d/.test(last)) {
					// "홍길동 조아2" — 마지막 토큰에 숫자 섞임 → 소속+등급 붙여쓰기
					rawGrade = last;
					rawName = tokens[0];
				} else {
					// 두 토큰 모두 문자: 이름 소속
					rawName = tokens[0];
					rawAffil = tokens[1];
				}
			} else {
				// 토큰 1개: "홍길동2" 붙여쓰기 또는 이름만
				rawName = tokens[0] || "";
				// 붙여쓰기 이름+등급 분리는 cleanName/cleanGrade가 처리
			}

			const name = cleanName(rawName);
			const affil = rawAffil.trim();
			const grade = rawGrade ? cleanGrade(rawGrade) : cleanGrade(rawName) !== 9999 ? cleanGrade(rawName) : 9999;

			return { name, affil, grade };
		})
		.filter((p) => p.name);

	if (!players.length) {
		closeBulk();
		return;
	}

	// ── 등급 오름차순 정렬 (낮을수록 강함) ───────────────────────
	players.sort((a, b) => a.grade - b.grade);

	const containers = document.querySelectorAll(".group-input-card");
	if (!containers.length) {
		alert("먼저 입력창을 생성해주세요.");
		return;
	}
	document.querySelectorAll(".p-name").forEach((el) => (el.value = ""));

	const groups = Array.from(containers).map((c) => Array.from(c.querySelectorAll(".p-name")));
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
			const slot = groups[gi].find((el) => !el.value);
			if (!slot) continue;

			// 소속 겹치지 않는 선수 우선 선택
			const curAffils = groupAffils[gi];
			let pickedIdx = queue.findIndex((p) => !p.affil || !curAffils.includes(p.affil));
			if (pickedIdx === -1) pickedIdx = 0;

			const picked = queue.splice(pickedIdx, 1)[0];
			const affilPart = picked.affil ? `(${picked.affil})` : "";
			const gradeStr = picked.grade !== 9999 ? ` ${picked.grade}` : "";
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
	{ bg: "rgb(253,232,232)", border: "rgb(255,53,53)", side: "left" }, // 빨강  ← 좌
	{ bg: "rgb(224,231,255)", border: "rgb(12,0,154)", side: "top" }, // 파랑  ↑ 상
	{ bg: "rgb(254,249,195)", border: "rgb(255,173,0)", side: "right" }, // 노랑  → 우
	{ bg: "rgb(236,252,203)", border: "rgb(135,229,0)", side: "bottom" }, // 라임  ↓ 하
	{ bg: "rgb(253,244,255)", border: "rgb(204,148,255)", side: "left" }, // 보라  ← 좌
	{ bg: "#fce7f3", border: "#db2777", side: "top" }, // 분홍  ↑ 상
	{ bg: "#ffedd5", border: "#ea580c", side: "right" }, // 주황  → 우
	{ bg: "#cffafe", border: "#0891b2", side: "bottom" }, // 청록  ↓ 하
	{ bg: "#d1fae5", border: "#059669", side: "left" }, // 초록  ← 좌
	{ bg: "#e0e7ff", border: "#4338ca", side: "top" }, // 인디고 ↑ 상
	{ bg: "#fff1f2", border: "#e11d48", side: "right" }, // 로즈  → 우
	{ bg: "#f0fdf4", border: "#16a34a", side: "bottom" }, // 연초록 ↓ 하
	{ bg: "#fff7ed", border: "#d97706", side: "left" }, // 앰버  ← 좌
	{ bg: "#f0f9ff", border: "#0284c7", side: "top" }, // 하늘  ↑ 상
	{ bg: "#fdf4ff", border: "#9333ea", side: "right" }, // 자주  → 우
];

function applyAffilColors() {
	const inputs = Array.from(document.querySelectorAll(".p-name"));
	const affilStyleMap = {};
	let styleIdx = 0;
	inputs.forEach((el) => {
		const m = el.value.trim().match(/\(([^)]+)\)/);
		const affil = m ? m[1] : "";
		if (affil && !(affil in affilStyleMap)) {
			affilStyleMap[affil] = AFFIL_STYLES[styleIdx % AFFIL_STYLES.length];
			styleIdx++;
		}
	});

	const seen = {},
		dupKeys = new Set();
	inputs.forEach((el) => {
		const key = el.value.trim().toLowerCase().replace(/\s+/g, "");
		if (!key) return;
		if (seen[key]) dupKeys.add(key);
		seen[key] = true;
	});

	inputs.forEach((el) => {
		const raw = el.value.trim();
		el.style.background = "";
		el.style.borderTop = "";
		el.style.borderRight = "";
		el.style.borderBottom = "";
		el.style.borderLeft = "";
		el.style.outline = "";

		if (!raw) return;

		const key = raw.toLowerCase().replace(/\s+/g, "");
		if (dupKeys.has(key)) {
			el.style.background = "#fee2e2";
			el.style.borderLeft = "4px solid #ef4444";
		} else {
			const m = raw.match(/\(([^)]+)\)/);
			const affil = m ? m[1] : "";
			if (affil && affilStyleMap[affil]) {
				const s = affilStyleMap[affil];
				el.style.background = s.bg;
				const thick = "4px solid " + s.border;
				const thin = "1px solid " + s.border;
				el.style.borderTop = s.side === "top" ? thick : thin;
				el.style.borderRight = s.side === "right" ? thick : thin;
				el.style.borderBottom = s.side === "bottom" ? thick : thin;
				el.style.borderLeft = s.side === "left" ? thick : thin;
			}
		}
	});

	// 중복 안내 메시지
	const existing = document.getElementById("dupWarning");
	if (existing) existing.remove();
	if (dupKeys.size > 0) {
		const msg = document.createElement("div");
		msg.id = "dupWarning";
		msg.style.cssText =
			"margin-top:10px;padding:10px 14px;background:#fee2e2;border:1.5px solid #ef4444;border-radius:8px;font-size:0.82rem;font-weight:700;color:#991b1b;";
		msg.textContent = "⚠️ 중복 등록 인원이 있습니다. 해당 인원 수정 바랍니다.";
		document.getElementById("nameInputs").after(msg);
	}
}

/* ───────────────────────────── create league ─────────────────────────────── */
function parsePlayer(rawVal) {
	// "홍길동(조아) 2" 형식: 괄호 안 소속 추출 후 파싱
	const affilMatch = rawVal.match(/\(([^)]+)\)/);
	const affil = affilMatch ? affilMatch[1].trim() : "";
	const withoutAffil = rawVal.replace(/\([^)]*\)/g, "").trim();
	const tokens = withoutAffil.split(/\s+/);
	let name = "",
		grade = 9999;

	if (tokens.length >= 2) {
		const last = tokens[tokens.length - 1];
		if (/^\d+$/.test(last)) {
			grade = parseInt(last);
			name = tokens
				.slice(0, tokens.length - 1)
				.join(" ")
				.trim();
		} else {
			const digits = last.replace(/\D/g, "");
			if (digits) {
				grade = parseInt(digits);
				name = tokens
					.slice(0, tokens.length - 1)
					.join(" ")
					.trim();
			} else {
				name = tokens.join(" ").trim();
			}
		}
	} else {
		// 단일 토큰: 이름숫자 붙여쓰기 fallback
		const nm = withoutAffil.match(/^[^\d]+/);
		const gm = withoutAffil.match(/\d+/);
		name = nm ? nm[0].trim() : withoutAffil.trim();
		grade = gm ? parseInt(gm[0]) : 9999;
	}

	// 이름에서 혹시 남은 숫자·앞쪽 공백 제거
	name = name
		.replace(/^[\d\s]+/, "")
		.replace(/[0-9]/g, "")
		.trim();
	return { name, grade, affil };
}

async function createLeague() {
	isLoadedFromHistory = false; // 새 대회 생성
	const now = new Date();
	const _pad = (n) => String(n).padStart(2, "0");
	const id =
		now.getFullYear() +
		_pad(now.getMonth() + 1) +
		_pad(now.getDate()) +
		"_" +
		_pad(now.getHours()) +
		_pad(now.getMinutes()) +
		_pad(now.getSeconds());
	const league = {
		id,
		date: document.getElementById("leagueDate").value,
		title: document.getElementById("leagueTitle").value || "용문리그",
		targetWins: parseInt(document.querySelector('input[name="gameRule"]:checked').value),
		eliminateCount: parseInt(document.getElementById("eliminateCount").value) || 0,
		groups: {},
	};

	document.querySelectorAll(".p-name").forEach((el) => {
		const g = el.dataset.group;
		const raw = el.value.trim();
		if (!raw) return;
		if (!league.groups[g]) league.groups[g] = { names: [], results: {}, playerIds: {}, grades: {}, affiliations: {} };
		const { name, grade, affil } = parsePlayer(raw);
		if (name) {
			league.groups[g].names.push(name);
			league.groups[g].grades[name] = grade;
			if (affil) league.groups[g].affiliations[name] = affil;
		}
	});

	for (let g in league.groups) {
		league.groups[g].names = shuffle(league.groups[g].names);
		league.groups[g].names.forEach((n, i) => {
			league.groups[g].playerIds[n] = i + 1;
		});
		league.groups[g].names.forEach((n1) => {
			league.groups[g].results[n1] = {};
			league.groups[g].names.forEach((n2) => {
				if (n1 !== n2) league.groups[g].results[n1][n2] = { s1: 0, s2: 0, done: false };
			});
		});
		groupSortOptions[g] = { key: "rank", order: "asc" };
	}

	masterData[id] = league;
	updateSelector();
	document.getElementById("initialImport").classList.add("hidden");
	loadLeague(id);
}

/* ───────────────────────────── direct tournament ─────────────────────────────── */
function directTournament() {
	const all = [];
	document.querySelectorAll(".p-name").forEach((el) => {
		const raw = el.value.trim();
		if (!raw) return;
		const { name, grade } = parsePlayer(raw);
		if (name) all.push({ name, grade, seed: "", isEliminated: false, rank: 1, group: "-" });
	});
	if (all.length < 2) {
		alert("최소 2명 이상 입력해주세요.");
		return;
	}

	const players = shuffle(all);
	players.forEach((p, i) => {
		p.seed = `${i + 1}번`;
	});

	const id = Date.now().toString();
	const bracket = buildBracket(players, true);
	masterData[id] = {
		id,
		date: document.getElementById("leagueDate").value,
		title: document.getElementById("leagueTitle").value || "용문리그",
		targetWins: 2,
		eliminateCount: 0,
		groups: {},
		tournament: { seeds: players, rounds: bracket, champion: null },
	};
	curId = id;
	document.getElementById("setupArea").classList.add("hidden");
	document.getElementById("activeControls").classList.remove("hidden");
	document.getElementById("mainDashboard").classList.add("hidden");
	showTournament();
}

/* ───────────────────────────── load league ─────────────────────────────── */
function loadLeague(id) {
	if (!id) return;
	curId = id;
	isLoadedFromHistory = true; // 기록 또는 과거대회 선택으로 불러옴
	const d = masterData[id];
	document.getElementById("initialImport").classList.add("hidden");
	document.getElementById("setupArea").classList.add("hidden");
	document.getElementById("activeControls").classList.remove("hidden");

	if (!d.groups || Object.keys(d.groups).length === 0) {
		document.getElementById("mainDashboard").classList.add("hidden");
		showTournament();
		return;
	}

	document.getElementById("mainDashboard").classList.remove("hidden");
	document.getElementById("tournamentArea").classList.add("hidden");

	// 대회명 배너 렌더
	// 대회명을 브라우저 탭 타이틀에 반영
	document.title = d.title || "용문 리그/토너먼트";

	const banner = document.getElementById("leagueTitleBanner");
	banner.innerHTML = `
    <div class="title-banner" style="justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0;">
        <div class="title-banner-icon">🏓</div>
        <div class="title-banner-text">
          <div class="title-banner-name">${d.title || "용문리그"}</div>
          <div class="title-banner-meta">${d.date || ""} &nbsp;·&nbsp; 리그전 대진표 &nbsp;·&nbsp; ${Object.keys(d.groups).length}개 조 &nbsp;·&nbsp; 조별 ${Object.values(d.groups)[0]?.names?.length || 0}명</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;align-items:center;">
        <button onclick="openBulkEdit()" style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.5);padding:9px 16px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;backdrop-filter:blur(4px);transition:background 0.18s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">✏️ 명단 한번에 수정</button>
        <button onclick="openBandList()" style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.5);padding:9px 16px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;backdrop-filter:blur(4px);transition:background 0.18s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">📋 밴드에 올릴 최종명단 캡쳐하기</button>
        <button onclick="openPrizeWithLeague()" style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.5);padding:9px 16px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;backdrop-filter:blur(4px);transition:background 0.18s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">🎁 전체경품추첨</button>
        <button onclick="openTiebreaker()" style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.5);padding:9px 16px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;backdrop-filter:blur(4px);transition:background 0.18s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">⚖️ 동률간 승자 계산하기</button>
        <button onclick="printAllPlayers()" style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.5);padding:9px 16px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;backdrop-filter:blur(4px);transition:background 0.18s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">🗒️ 전체 명단 인쇄</button>
        <button onclick="createTournament()" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:white;border:2px solid rgba(255,255,255,0.6);padding:11px 22px;border-radius:10px;font-size:1.4rem;font-weight:900;cursor:pointer;white-space:nowrap;box-shadow:0 4px 18px rgba(239,68,68,0.55);letter-spacing:0.3px;transition:all 0.18s;" onmouseover="this.style.background='linear-gradient(135deg,#dc2626,#991b1b)';this.style.transform='scale(1.04)'" onmouseout="this.style.background='linear-gradient(135deg,#ef4444,#b91c1c)';this.style.transform='scale(1)'">🏆 토너먼트 진행</button>
      </div>
    </div>`;

	const container = document.getElementById("allGroupsContainer");
	container.innerHTML = "";

	Object.keys(d.groups).forEach((gn) => {
		if (!groupSortOptions[gn]) groupSortOptions[gn] = { key: "rank", order: "asc" };
		const sec = document.createElement("div");
		sec.className = "group-section";
		sec.innerHTML = `
      <div class="group-header">
        <div class="group-header-left">
          <div class="group-badge">${gn}</div>
        </div>
        <div class="group-header-actions">
          <button class="btn btn-purple" style="font-size:0.95rem;padding:10px 20px;" onclick="printGroupMatrix('${gn}')">🖨️ 대진표 인쇄</button>
        </div>
      </div>
      <div class="group-layout" style="align-items:stretch;">
        <div style="display:flex;flex-direction:column;">
          <div class="section-label">결과 매트릭스</div>
          <div class="table-wrap" id="matrix-wrap-${gn}" style="flex:1;overflow:auto;"><table><thead id="head-${gn}"></thead><tbody id="body-${gn}"></tbody></table></div>
        </div>
        <div style="display:flex;flex-direction:column;">
          <div class="section-label">순위표 <span style="font-size:0.68rem;font-weight:500;text-transform:none;letter-spacing:0;color:var(--text3);">(마우스로 순위 변경하세요. Drag &amp; Drop)</span></div>
          <div class="table-wrap" id="standings-wrap-${gn}" style="flex:1;overflow:auto;">
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
		syncGroupHeight(gn);
	});

	// 이미지 로드·폰트 확정 후 한 번 더 높이 맞춤
	requestAnimationFrame(() => {
		Object.keys(d.groups).forEach((gn) => syncGroupHeight(gn));
	});

	setTimeout(() => document.getElementById("mainDashboard").scrollIntoView({ behavior: "smooth" }), 100);
}

/* ── 매트릭스와 순위표 wrap 높이 동기화 ── */
function syncGroupHeight(gn) {
	const mw = document.getElementById(`matrix-wrap-${gn}`);
	const sw = document.getElementById(`standings-wrap-${gn}`);
	if (!mw || !sw) return;

	const matrixTable = mw.querySelector("table");
	const standTable = sw.querySelector("table");
	if (!matrixTable || !standTable) return;

	const matrixH = matrixTable.offsetHeight;
	if (!matrixH) return;

	const standHead = standTable.querySelector("thead");
	const standRows = standTable.querySelectorAll("tbody tr");
	if (!standRows.length) return;

	// 매트릭스 전체 높이에서 순위표 thead 높이를 빼고 row 수로 균등 분배
	const theadH = standHead ? standHead.offsetHeight : 0;
	const targetBodyH = matrixH - theadH;
	const baseRowH = Math.floor(targetBodyH / standRows.length);
	const remainder = targetBodyH - baseRowH * standRows.length;

	standRows.forEach((r, i) => {
		// 마지막 행에 나머지 픽셀 추가 → 공백 없이 꽉 채움
		const h = i === standRows.length - 1 ? baseRowH + remainder : baseRowH;
		r.style.height = h + "px";
		r.querySelectorAll("td").forEach((td) => {
			td.style.height = h + "px";
		});
	});

	// wrap 높이 고정
	sw.style.height = matrixH + "px";
	sw.style.maxHeight = matrixH + "px";
	sw.style.overflowY = "hidden";
}

/* ───────────────────────────── matrix ─────────────────────────────── */
function renderMatrix(gn) {
	const d = masterData[curId];
	const g = d.groups[gn];
	// 헤더: 이름 th에 data-hname 속성 부여 (실시간 동기화용)
	document.getElementById(`head-${gn}`).innerHTML =
		`<th>선수</th>` +
		g.names
			.map((n) => {
				if (n.startsWith("(공석")) return `<th data-hname="${n}" style="white-space:nowrap;">-</th>`;
				const isModified = g.modifiedNames && g.modifiedNames[n];
				const grade = g.grades && g.grades[n] !== undefined && g.grades[n] !== 9999 ? g.grades[n] : null;
				const label = isModified
					? grade !== null
						? `${n}(${grade})`
						: n // 수정된 명단: 소속 없이 이름(등급)
					: displayName(d, n); // 일반 명단: 기존 displayName
				return `<th data-hname="${n}" style="white-space:nowrap;">${label}</th>`;
			})
			.join("");
	// 바디: 좌측 이름 열 → 이름+부수 하나의 input으로
	document.getElementById(`body-${gn}`).innerHTML = g.names
		.map((n1) => {
			const gradeVal = g.grades && g.grades[n1] !== undefined && g.grades[n1] !== 9999 ? g.grades[n1] : "";
			const isModified = g.modifiedNames && g.modifiedNames[n1];
			const isVacant = n1.startsWith("(공석");
			// 수정된 명단: 이름+등급(소속 없이), 일반 명단: 기존대로
			const inputVal = isVacant ? "-" : gradeVal !== "" ? `${n1}${gradeVal}` : n1;
			return `
    <tr>
      <td style="background:${g.modifiedNames && g.modifiedNames[n1] ? "#e0f2fe" : "var(--surface2)"};white-space:nowrap;padding:2px 4px;text-align:center;">
          <input type="text" class="name-edit-input"
            data-gn="${gn}" data-oldname="${n1}"
            value="${inputVal}"
            oninput="syncMatrixHeader('${gn}','${n1}',this.value)"
            onfocus="this.style.border='2px solid var(--primary)';this.style.padding='4px 5px';this.style.background='#fff'"
            onblur="this.style.border='1px solid var(--border)';this.style.padding='3px 5px';this.style.background='transparent';renamePlayer('${gn}','${n1}',this.value,this)"
            style="width:92px;min-width:64px;max-width:120px;border:1px solid var(--border);border-radius:5px;padding:3px 5px;font-weight:700;font-size:0.82rem;text-align:center;background:transparent;font-family:inherit;outline:none;">
      </td>
      ${g.names
			.map((n2) => {
				if (n1 === n2) return `<td style="background:#f1f5f9;color:#94a3b8;">—</td>`;
				const r = g.results[n1][n2];
				return `<td class="${r.done && r.s1 > r.s2 ? "cell-winner" : ""}">
          <select class="matrix-select" onchange="updateScore('${gn}','${n1}','${n2}',this.value)">
            ${getOptions(d.targetWins, `${r.s1}:${r.s2}`)}
          </select></td>`;
			})
			.join("")}
    </tr>`;
		})
		.join("");
}

/* ── 이름+부수 파싱 헬퍼 (예: "홍길동2" → {name:"홍길동", grade:2}) ── */
function parseNameGrade(raw) {
	raw = raw.trim();
	const m = raw.match(/^(.*?)(\d+)$/);
	if (m && m[1].trim()) {
		return { name: m[1].trim(), grade: parseInt(m[2]) };
	}
	return { name: raw, grade: 9999 };
}

/* ── 이름 실시간 동기화 (입력 중) ── */
window.syncMatrixHeader = function (gn, oldName, newVal) {
	const { name, grade } = parseNameGrade(newVal);
	const display = grade !== 9999 ? `${name}(${grade})` : name;
	const th = document.querySelector(`#head-${gn} th[data-hname="${oldName}"]`);
	if (th) th.textContent = display || oldName;
};

/* ── 이름+부수 최종 변경 (blur) ── */
window.renamePlayer = async function (gn, oldName, rawVal, inputEl) {
	rawVal = rawVal.trim();

	// 공백 또는 "-" 입력 → 공석 처리
	const toVacant = !rawVal || rawVal === "-";

	if (toVacant) {
		const d = masterData[curId];
		const g = d.groups[gn];
		const idx = g.names.indexOf(oldName);

		// 이미 공석이면 그냥 복원
		if (oldName.startsWith("(공석")) {
			if (inputEl) inputEl.value = "-";
			return;
		}

		if (idx === -1) return;

		// 공석 번호: 기존 공석 개수 + 1
		const existingVacants = g.names.filter((n) => n.startsWith("(공석")).length;
		const placeholder = "(공석" + (existingVacants + 1) + ")";

		g.names[idx] = placeholder;
		if (g.grades) {
			delete g.grades[oldName];
			g.grades[placeholder] = 9999;
		}
		const nr = {};
		for (const k1 in g.results) {
			const nk1 = k1 === oldName ? placeholder : k1;
			nr[nk1] = {};
			for (const k2 in g.results[k1]) {
				nr[nk1][k2 === oldName ? placeholder : k2] = g.results[k1][k2];
			}
		}
		g.results = nr;
		if (g.playerIds) {
			g.playerIds[placeholder] = g.playerIds[oldName];
			delete g.playerIds[oldName];
		}
		if (g.manualRanks) {
			delete g.manualRanks[oldName];
		}
		if (!g.modifiedNames) g.modifiedNames = {};
		g.modifiedNames[placeholder] = true;

		renderMatrix(gn);
		updateStandings(gn);
		return;
	}

	const { name: newName, grade: newGrade } = parseNameGrade(rawVal);

	const d = masterData[curId];
	const g = d.groups[gn];
	const idx = g.names.indexOf(oldName);
	if (idx === -1) return;

	// 이름이 바뀐 경우에만 모든 키 업데이트
	if (newName !== oldName) {
		g.names[idx] = newName;

		// results 키 업데이트
		const newResults = {};
		for (const k1 in g.results) {
			const nk1 = k1 === oldName ? newName : k1;
			newResults[nk1] = {};
			for (const k2 in g.results[k1]) {
				const nk2 = k2 === oldName ? newName : k2;
				newResults[nk1][nk2] = g.results[k1][k2];
			}
		}
		g.results = newResults;

		// playerIds 키 업데이트
		if (g.playerIds && g.playerIds[oldName] !== undefined) {
			g.playerIds[newName] = g.playerIds[oldName];
			delete g.playerIds[oldName];
		}

		// manualRanks 키 업데이트
		if (g.manualRanks && g.manualRanks[oldName] !== undefined) {
			g.manualRanks[newName] = g.manualRanks[oldName];
			delete g.manualRanks[oldName];
		}

		// grades 키: oldName 삭제 후 newName으로
		if (g.grades && g.grades[oldName] !== undefined) {
			delete g.grades[oldName];
		}

		// tournament 업데이트
		if (d.tournament) {
			(d.tournament.seeds || []).forEach((s) => {
				if (s.name === oldName) s.name = newName;
			});
			(d.tournament.rounds || []).forEach((round) =>
				round.forEach((match) => {
					if (match.player1 === oldName) match.player1 = newName;
					if (match.player2 === oldName) match.player2 = newName;
					if (match.winner === oldName) match.winner = newName;
				}),
			);
			if (d.tournament.champion === oldName) d.tournament.champion = newName;
		}

		// grades에 새 이름으로 등록
		if (!g.grades) g.grades = {};
		g.grades[newName] = newGrade;
	} else {
		// 이름은 같고 부수만 바뀐 경우
		if (!g.grades) g.grades = {};
		g.grades[newName] = newGrade;
	}

	// 화면 재렌더링
	renderMatrix(gn);
	updateStandings(gn);
};

function getOptions(max, cur) {
	let h = `<option value="0:0" ${cur === "0:0" ? "selected" : ""}>—</option>`;
	for (let i = 0; i < max; i++) h += `<option value="${max}:${i}" ${cur === `${max}:${i}` ? "selected" : ""}>${max}:${i}</option>`;
	for (let i = 0; i < max; i++) h += `<option value="${i}:${max}" ${cur === `${i}:${max}` ? "selected" : ""}>${i}:${max}</option>`;
	return h;
}

window.updateScore = (gn, p1, p2, val) => {
	const [s1, s2] = val.split(":").map(Number);
	const g = masterData[curId].groups[gn];
	g.results[p1][p2] = { s1, s2, done: s1 > 0 || s2 > 0 };
	g.results[p2][p1] = { s1: s2, s2: s1, done: s1 > 0 || s2 > 0 };
	// 승패 수정 시 수동 순위(drag) 초기화 → 승패 결과가 최종 순위
	g.manualOrder = null;
	g.manualRanks = {};
	renderMatrix(gn);
	updateStandings(gn);
};

/* ───────────────────────────── standings ─────────────────────────────── */
function computeStats(gn) {
	const g = masterData[curId].groups[gn];
	const manualRanks = g.manualRanks || {};

	// 1. 기본 스탯 계산
	let stats = g.names.map((name) => {
		let s = { id: g.playerIds[name], name, w: 0, l: 0, sW: 0, sL: 0, pts: 0 };
		g.names.forEach((opp) => {
			if (name === opp) return;
			const m = g.results[name][opp];
			if (m?.done) {
				s.sW += m.s1;
				s.sL += m.s2;
				m.s1 > m.s2 ? (s.w++, (s.pts += 2)) : (s.l++, (s.pts += 1));
			}
		});
		s.diff = s.sW - s.sL;
		return s;
	});

	const totalMatches = (g.names.length * (g.names.length - 1)) / 2;
	const done = g.names.reduce((c, n1) => c + g.names.filter((n2) => n1 < n2 && g.results[n1][n2]?.done).length, 0);
	const noRes = done === 0;
	const allMatchesDone = done === totalMatches;
	const ec = masterData[curId].eliminateCount || 0;

	// 2. 1차 정렬: 승점만으로 (동률 그룹을 정확히 묶기 위해)
	let ranked = [...stats].sort((a, b) => b.pts - a.pts);

	// 3. 동률 그룹별 타이브레이크 적용 (재귀적 서브그룹 분리)
	function resolveTieGroup(group, depth) {
		if (group.length <= 1 || noRes) return group;

		// 동률 그룹 내 h2h 통계 계산
		const enriched = group.map((p) => {
			let h2hW = 0,
				h2hSW = 0,
				h2hSL = 0;
			group.forEach((o) => {
				if (p.name === o.name) return;
				const m = g.results[p.name][o.name];
				if (m?.done) {
					h2hSW += m.s1;
					h2hSL += m.s2;
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
			const mA = manualRanks[a.name],
				mB = manualRanks[b.name];
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
				result.push(
					...resolveTieGroup(
						sub.map((p) => stats.find((s) => s.name === p.name)),
						depth + 1,
					),
				);
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
			const resolved = resolveTieGroup(
				tieGroup.map((p) => stats.find((s) => s.name === p.name)),
				0,
			);
			resolved.forEach((p, k) => {
				ranked[i + k] = p;
			});
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
			const fullyTied =
				samePts &&
				(p.h2hW !== undefined && prev.h2hW !== undefined
					? p.h2hW === prev.h2hW && p.h2hDiff === prev.h2hDiff && p.diff === prev.diff
					: p.diff === prev.diff);

			if (!noRes && fullyTied) {
				const mA = manualRanks[prev.name],
					mB = manualRanks[p.name];
				if (mA !== undefined && mB !== undefined && mA !== mB) {
					cr = idx + 1;
					p.rank = cr;
				} else {
					p.rank = prev.rank;
					p.isTied = prev.isTied = true;
					if (allMatchesDone) {
						p.needsManual = prev.needsManual = true;
					}
				}
			} else {
				cr = idx + 1;
				p.rank = cr;
			}
		}
		p.isEliminated = ec > 0 && p.rank > ranked.length - ec;
		const x = stats.find((s) => s.name === p.name);
		Object.assign(x, {
			rank: p.rank,
			isTied: p.isTied,
			needsManual: p.needsManual,
			isEliminated: p.isEliminated,
			h2hW: p.h2hW,
			h2hDiff: p.h2hDiff,
		});
	});

	// 5. 공석 강제 최하위 처리
	const vacants = ranked.filter((p) => p.name.startsWith("(공석"));
	const nonVacants = ranked.filter((p) => !p.name.startsWith("(공석"));
	if (vacants.length) {
		const vCount = vacants.length;
		const nCount = nonVacants.length;

		// 공석을 맨 뒤로 재배열
		ranked.length = 0;
		ranked.push(...nonVacants, ...vacants);

		// ── 비공석 순위 재번호 부여 (1부터, 동률 유지)
		let cr2 = 1;
		nonVacants.forEach((p, idx) => {
			if (idx === 0) {
				p.rank = 1;
				cr2 = 1;
			} else {
				const prev = nonVacants[idx - 1];
				if (p.isTied && prev.isTied) {
					p.rank = prev.rank; // 동률이면 같은 순위 유지
				} else {
					cr2 = idx + 1;
					p.rank = cr2;
				}
			}
		});

		// ── 공석 순위 재번호 부여 (비공석 다음부터)
		vacants.forEach((p, i) => {
			p.rank = nCount + 1 + i;
			p.isTied = false;
			p.needsManual = false;
		});

		// ── 탈락 재계산
		// x >= n : 공석만 탈락 (비공석 탈락 없음)
		// x < n  : 공석 전부 + 비공석 하위 (n-x)명 탈락
		const extraElim = vCount >= ec ? 0 : ec - vCount;

		ranked.forEach((p) => {
			if (p.name.startsWith("(공석")) {
				p.isEliminated = ec > 0;
			} else {
				p.isEliminated = ec > 0 && p.rank > nCount - extraElim;
			}
			const sx = stats.find((s) => s.name === p.name);
			if (sx)
				Object.assign(sx, {
					rank: p.rank,
					isTied: p.isTied,
					needsManual: p.needsManual || false,
					isEliminated: p.isEliminated,
				});
		});
	}

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
		sorted = g.manualOrder.map((name) => stats.find((s) => s.name === name)).filter(Boolean);
		stats.forEach((s) => {
			if (!sorted.includes(s)) sorted.push(s);
		});
	} else {
		sorted = [...ranked]; // computeStats에서 이미 rank순 정렬됨
	}

	// manualOrder 기반으로 rank 재계산 (드래그 후 순위 갱신)
	if (g.manualOrder && g.manualOrder.length) {
		const nonVacantSorted = sorted.filter((s) => !s.name.startsWith("(공석"));
		const vacantSorted = sorted.filter((s) => s.name.startsWith("(공석"));
		const nCount = nonVacantSorted.length;
		const vCount = vacantSorted.length;
		const extraElim = vCount >= ec ? 0 : ec - vCount;
		sorted.forEach((s, i) => {
			s.rank = i + 1;
		});
		nonVacantSorted.forEach((s) => {
			s.isEliminated = ec > 0 && s.rank > nCount - extraElim;
		});
		vacantSorted.forEach((s) => {
			s.isEliminated = ec > 0;
		});
	}

	const tbody = document.querySelector(`#standings-${gn} tbody`);
	tbody.innerHTML = sorted
		.map((s, idx) => {
			const rowBg = s.needsManual ? "background:#fff7ed;" : s.isTied ? "background:#fef3c7;" : "";
			let badge = "";
			// 탈락/진출 표시: 경기 결과 여부 무관하게 항상 표시 (ec > 0이면)
			if (ec > 0) badge = s.isEliminated ? '<span class="badge badge-elim">탈락</span>' : '<span class="badge badge-promote">진출</span>';

			let rankCell = "";
			if (s.needsManual) {
				const allTied = sorted.filter((x) => x.needsManual);
				const groupRanks = allTied.map((x) => x.rank);
				const minRank = Math.min(...groupRanks);
				const maxRank = Math.min(minRank + allTied.length - 1, ranked.length);
				const options = [];
				for (let r = minRank; r <= maxRank; r++) {
					const sel = manualRanks[s.name] === r ? "selected" : "";
					options.push(`<option value="${r}" ${sel}>${r}위</option>`);
				}
				rankCell = `<select onchange="setManualRank('${gn}','${s.name}',this.value)" style="font-size:0.78rem;border:1.5px solid var(--warning);border-radius:5px;padding:2px 6px;background:#fff7ed;font-weight:700;cursor:pointer;color:var(--text);outline:none;">
        <option value="">순위선택</option>${options.join("")}
      </select>`;
			} else {
				rankCell = `<span style="font-weight:800;">${s.rank}</span>${s.isTied ? ' <span style="font-size:0.7rem;color:var(--warning);">동률</span>' : ""}`;
			}

			return `<tr data-player="${s.name}" style="${rowBg}cursor:grab;">
      <td style="color:var(--text3);">${s.id}</td>
      <td style="font-weight:700;white-space:nowrap;text-align:left;padding-left:8px;">${displayName(d, s.name)}</td>
      <td>${s.w} / ${s.l}</td>
      <td style="font-weight:700;color:${s.diff > 0 ? "var(--success)" : s.diff < 0 ? "var(--danger)" : "var(--text3)"};">${s.diff > 0 ? "+" : ""}${s.diff}</td>
      <td style="font-weight:700;color:var(--primary);">${s.pts}</td>
      <td>${rankCell}</td>
      <td>${badge}</td>
    </tr>`;
		})
		.join("");

	// 항상 드래그앤드롭 활성화
	attachDragDrop(gn);
	// 순위표 높이를 매트릭스에 맞춤
	requestAnimationFrame(() => syncGroupHeight(gn));
}

function attachDragDrop(gn) {
	const tbody = document.querySelector(`#standings-${gn} tbody`);
	if (!tbody) return;
	let dragSrc = null;
	const tooltip = document.getElementById("dragRankTooltip");

	const showTooltip = (targetRow, rank) => {
		if (!tooltip) return;
		const rect = targetRow.getBoundingClientRect();
		tooltip.textContent = `→ ${rank}위`;
		tooltip.style.display = "block";
		// 행 위 중앙에 배치
		const tooltipW = tooltip.offsetWidth || 80;
		const centerX = rect.left + rect.width / 2 - tooltipW / 2;
		const topY = rect.top - 38; // 행 위 38px
		tooltip.style.left = Math.max(4, centerX) + "px";
		tooltip.style.top = topY + "px";
	};
	const hideTooltip = () => {
		if (tooltip) tooltip.style.display = "none";
	};

	Array.from(tbody.querySelectorAll("tr")).forEach((row) => {
		row.draggable = true;
		row.addEventListener("dragstart", (e) => {
			dragSrc = row;
			e.dataTransfer.effectAllowed = "move";
			setTimeout(() => {
				row.style.opacity = "0.4";
			}, 0);
		});
		row.addEventListener("dragend", () => {
			row.style.opacity = "";
			dragSrc = null;
			hideTooltip();
			// 모든 행 outline 해제
			Array.from(tbody.querySelectorAll("tr")).forEach((r) => {
				r.style.outline = "";
			});
		});
		row.addEventListener("dragover", (e) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			// 현재 hover 행 강조
			Array.from(tbody.querySelectorAll("tr")).forEach((r) => {
				r.style.outline = "";
			});
			row.style.outline = "2px solid var(--primary)";
			// 드롭 시 위치될 순위 계산 후 행 위에 풍선 표시
			if (dragSrc) {
				const allRows = Array.from(tbody.querySelectorAll("tr"));
				const tgtIdx = allRows.indexOf(row);
				showTooltip(row, tgtIdx + 1);
			}
		});
		row.addEventListener("dragleave", () => {
			row.style.outline = "";
		});
		row.addEventListener("drop", (e) => {
			e.preventDefault();
			row.style.outline = "";
			hideTooltip();
			if (!dragSrc || dragSrc === row) return;
			const allRows = Array.from(tbody.querySelectorAll("tr"));
			const srcIdx = allRows.indexOf(dragSrc);
			const tgtIdx = allRows.indexOf(row);
			if (srcIdx < tgtIdx) tbody.insertBefore(dragSrc, row.nextSibling);
			else tbody.insertBefore(dragSrc, row);
			// 새 순서 저장 & 순위번호·탈락 즉시 갱신
			const newOrder = Array.from(tbody.querySelectorAll("tr")).map((r) => r.dataset.player);
			const g = masterData[curId].groups[gn];
			g.manualOrder = newOrder;
			g.manualRanks = {};
			newOrder.forEach((name, i) => {
				if (name) g.manualRanks[name] = i + 1;
			});
			// 순위번호·탈락 인라인 업데이트 (re-render 없이)
			const ec = masterData[curId].eliminateCount || 0;
			const total = newOrder.length;
			Array.from(tbody.querySelectorAll("tr")).forEach((r, i) => {
				const rankTd = r.querySelector("td:nth-child(6)");
				const badgeTd = r.querySelector("td:nth-child(7)");
				if (rankTd) rankTd.innerHTML = `<span style="font-weight:800;">${i + 1}</span>`;
				if (badgeTd && ec > 0) {
					const isElim = i + 1 > total - ec;
					badgeTd.innerHTML = isElim ? '<span class="badge badge-elim">탈락</span>' : '<span class="badge badge-promote">진출</span>';
				}
			});
		});
	});
}

window.handleSort = (gn, key) => {
	const o = groupSortOptions[gn];
	if (o.key === key) o.order = o.order === "asc" ? "desc" : "asc";
	else {
		o.key = key;
		o.order = "asc";
	}
	updateStandings(gn);
};

window.setManualRank = function (gn, playerName, rankVal) {
	const g = masterData[curId].groups[gn];
	if (!g.manualRanks) g.manualRanks = {};
	if (rankVal === "" || rankVal === null) {
		delete g.manualRanks[playerName];
	} else {
		g.manualRanks[playerName] = parseInt(rankVal);
	}
	updateStandings(gn);
};

/* ───────────────────────────── tournament ─────────────────────────────── */
async function createTournament() {
	if (!curId) {
		alert("⚠️ 먼저 리그전을 생성해주세요.");
		return;
	}
	const league = masterData[curId];
	const ec = league.eliminateCount || 0;
	const seeds = [];
	const gnames = Object.keys(league.groups).sort();
	if (!gnames.length) {
		showTournament();
		return;
	}

	const maxPPG = Math.max(...gnames.map((g) => league.groups[g].names.length));
	for (let rank = 1; rank <= maxPPG; rank++) {
		gnames.forEach((gn) => {
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
				const nCount = ranked.filter((r) => !r.name.startsWith("(공석")).length;
				const p = ranked.find((x) => x.rank === rank);
				if (p) playerAtRank = { name: p.name, rank, isEliminated: ec > 0 && p.rank > nCount - ec };
			}

			if (playerAtRank) {
				seeds.push({
					name: playerAtRank.name,
					group: gn,
					rank: playerAtRank.rank,
					seed: `${gn} ${playerAtRank.rank}위`,
					isEliminated: playerAtRank.isEliminated,
					grade: g.grades[playerAtRank.name] || 9999,
				});
			}
		});
	}

	// ── 공석 처리: 조별로 공석 확인 후 탈락/부전승 처리
	if (ec > 0) {
		gnames.forEach((gn) => {
			const g = league.groups[gn];
			const vacants = g.names.filter((n) => n.startsWith("(공석"));
			if (!vacants.length) return;

			// 공석 선수들을 seeds에서 찾아서 isEliminated 처리
			vacants.forEach((vn) => {
				const seed = seeds.find((s) => s.name === vn);
				if (!seed) return;
				// 공석은 최하위 순위로 강제 설정
				seed.rank = g.names.length + 99;
			});

			// 공석 중 1명만 탈락, 나머지는 진출(부전승 상대)
			const vacantSeeds = seeds.filter((s) => vacants.includes(s.name));
			// 첫 번째 공석 → 탈락
			if (vacantSeeds.length >= 1) vacantSeeds[0].isEliminated = true;
			// 나머지 공석(2개 이상) → 진출하되 isVacant 마킹 (부전승 상대로 처리)
			for (let vi = 1; vi < vacantSeeds.length; vi++) {
				vacantSeeds[vi].isEliminated = false;
				vacantSeeds[vi].isVacant = true; // 부전승 상대 마킹
			}
		});
	}

	if (league.tournament && !confirm("기존 토너먼트가 있습니다. 새로 생성할까요?")) {
		showTournament();
		return;
	}

	league.tournament = { seeds, rounds: buildBracket(seeds, false), champion: null };

	// ── ITF 표준 배정 최종 검수 ──────────────────────────────────────
	(() => {
		const activeSeeds = seeds.filter((s) => !s.isEliminated).sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.grade - b.grade));
		const realActive = activeSeeds.filter((s) => !s.isVacant);
		let sz = 2;
		while (sz < activeSeeds.length) sz *= 2;
		const byeCount = sz - activeSeeds.length;

		// ① 부전승 검수 — 상위 N명이 bye를 받아야 함
		if (byeCount > 0) {
			const shouldByeNames = new Set(realActive.slice(0, byeCount).map((s) => s.name));
			const getByeWinners = () =>
				(league.tournament.rounds[0]?.matches || [])
					.filter((m) => m.isWalkover && (m.player1 === null || m.player2 === null))
					.map((m) => m.winner);
			let byeOk = getByeWinners().every((n) => shouldByeNames.has(n));
			for (let r = 0; !byeOk && r < 3; r++) {
				league.tournament.rounds = buildBracket(seeds, false);
				byeOk = getByeWinners().every((n) => shouldByeNames.has(n));
			}
			console.info(`[ITF검수] 부전승: ${byeOk ? "✅ 정상" : "⚠️ 구조적 불가피"}`);
		}

		// ② 동조 1회전 충돌 최종 검수
		const getConflicts = () => {
			const r1 = league.tournament.rounds[0];
			if (!r1) return [];
			return r1.matches.filter((m) => {
				const s1 = seeds.find((s) => s.name === m.player1);
				const s2 = seeds.find((s) => s.name === m.player2);
				return s1 && s2 && s1.group && s2.group && s1.group === s2.group;
			});
		};

		let conflicts = getConflicts();
		// buildBracket v4가 내부에서 이미 10회 폴백 처리함
		// 여기서는 최대 3회 추가 재시도만
		for (let retry = 0; conflicts.length > 0 && retry < 3; retry++) {
			league.tournament.rounds = buildBracket(seeds, false);
			conflicts = getConflicts();
		}

		if (conflicts.length > 0) {
			const detail = conflicts.map((m) => `${m.player1} vs ${m.player2}`).join("\n");
			console.warn(`[ITF검수] 동조 충돌 ${conflicts.length}건 — 진출 인원 구조상 불가피\n${detail}`);
			alert(`⚠️ 아래 1라운드 대전이 같은 조로 배정되었습니다.\n진출 인원 구조상 불가피한 경우입니다.\n\n${detail}`);
		} else {
			console.info(`[ITF검수] ✅ 동조 1회전 충돌 없음 — ITF 표준 배치 완료`);
		}
	})();

	updateSelector();
	showTournament();
}

function getSeedOrder(n) {
	if (n === 1) return [0];
	const half = getSeedOrder(n / 2);
	const res = [];
	for (const v of half) {
		res.push(v);
		res.push(n - 1 - v);
	}
	return res;
}

/* ═══════════════════════════════════════════════════════════════════
   부전승 배정 검증 / 교정
   ─ active 상위 byeCount명이 null-bye를 받아야 함
═══════════════════════════════════════════════════════════════════ */
function fixByeAssignments(slots, active) {
	const byeCount = slots.length - active.length;
	if (byeCount <= 0) return false;

	const realActive = active.filter((p) => !p.isVacant);
	const shouldByeNames = new Set(realActive.slice(0, byeCount).map((p) => p.name));

	let fixed = false;
	for (let iter = 0; iter < 80; iter++) {
		let wrongIdx = -1,
			correctIdx = -1;
		for (let i = 0; i < slots.length; i += 2) {
			const a = slots[i],
				b = slots[i + 1];
			if (a && !b && !shouldByeNames.has(a.name) && !a.isVacant && wrongIdx === -1) wrongIdx = i;
			if (b && !a && !shouldByeNames.has(b.name) && !b.isVacant && wrongIdx === -1) wrongIdx = i + 1;
			if (a && b && shouldByeNames.has(a.name) && !b.isVacant && correctIdx === -1) correctIdx = i;
			if (a && b && shouldByeNames.has(b.name) && !a.isVacant && correctIdx === -1) correctIdx = i + 1;
		}
		if (wrongIdx === -1 || correctIdx === -1) break;
		[slots[wrongIdx], slots[correctIdx]] = [slots[correctIdx], slots[wrongIdx]];
		fixed = true;
	}
	return fixed;
}

/* ═══════════════════════════════════════════════════════════════════
   buildBracket  v4  ─ ITF 표준 시드 + 동조 1회전 완전 분리

   [정렬 원칙]  rank → group → grade
     • 같은 rank 내에서 조(group) 순으로 정렬 = 조별 균등 인터리빙 보장
     • ITF getSeedOrder는 이 인터리브 구조 위에서 자연스럽게 동조 분리

   [충돌 해소]  best-single-swap  (기존 pair-swap 대비 해소율 대폭 향상)
     • 충돌 쌍의 두 슬롯 각각을 전체 슬롯과 1:1 스왑 시도
     • 총 충돌 수를 가장 많이 줄이는 스왑 선택 (greedy)
     • 최대 500회 반복

   [폴백]  groupBalancedSort  (회전 오프셋 변경 10회)
     • 조 회전 offset을 바꿔 다른 인터리빙으로 재시도
     • 전체 10회 시도 후에도 해소 불가 시 최선 결과 사용

   [검수]  ITF 표준 검증 단계 (createTournament에서 추가 호출)
     • 부전승은 반드시 상위 시드에게 (fixByeAssignments)
══════════════════════════════════════════════════════════════════ */
function buildBracket(seeds, isRandom) {
	/* ─ 진출 선수 정렬 ─────────────────────────────────────────── */
	const active = seeds
		.filter((s) => !s.isEliminated)
		.sort((a, b) => {
			if (isRandom) return 0;
			// [핵심] rank → group → grade 순 정렬
			// rank 내에서 group 순으로 정렬해야 조별 인터리빙이 보장되어
			// ITF 시드 배치 시 자동으로 동조 1회전 분리가 이뤄짐
			if (a.rank !== b.rank) return a.rank - b.rank;
			if (a.group !== b.group) return a.group < b.group ? -1 : 1;
			return a.grade - b.grade;
		});

	let size = 2;
	while (size < active.length) size *= 2;

	/* ─ 헬퍼 ──────────────────────────────────────────────────── */
	function hasSameGroup(a, b) {
		return a && b && a.group && b.group && a.group === b.group;
	}
	function countConflicts(sl) {
		let n = 0;
		for (let i = 0; i < sl.length; i += 2) if (hasSameGroup(sl[i], sl[i + 1])) n++;
		return n;
	}

	/* ─ ITF 슬롯 생성 ──────────────────────────────────────────── */
	function makeSlots(playerList) {
		const full = [...playerList];
		while (full.length < size) full.push(null);
		return getSeedOrder(size).map((i) => full[i]);
	}

	/* ─ best-single-swap 충돌 해소 ────────────────────────────── */
	function resolveConflicts(slots) {
		const n = slots.length;
		for (let iter = 0; iter < 500; iter++) {
			if (countConflicts(slots) === 0) break;

			// 첫 충돌 쌍
			let ci = -1;
			for (let i = 0; i < n; i += 2) {
				if (hasSameGroup(slots[i], slots[i + 1])) {
					ci = i;
					break;
				}
			}
			if (ci === -1) break;

			// 전체 슬롯과의 1:1 스왑 중 최적 탐색
			const curConflicts = countConflicts(slots);
			let bestScore = curConflicts;
			let bestI = -1,
				bestJ = -1;

			for (let j = 0; j < n; j++) {
				if (j === ci || j === ci + 1) continue;

				// b = slots[ci+1] 스왑 시도
				[slots[ci + 1], slots[j]] = [slots[j], slots[ci + 1]];
				const s1 = countConflicts(slots);
				if (s1 < bestScore) {
					bestScore = s1;
					bestI = ci + 1;
					bestJ = j;
				}
				[slots[ci + 1], slots[j]] = [slots[j], slots[ci + 1]]; // 복원

				// a = slots[ci] 스왑 시도
				[slots[ci], slots[j]] = [slots[j], slots[ci]];
				const s2 = countConflicts(slots);
				if (s2 < bestScore) {
					bestScore = s2;
					bestI = ci;
					bestJ = j;
				}
				[slots[ci], slots[j]] = [slots[j], slots[ci]]; // 복원
			}

			if (bestI !== -1 && bestScore < curConflicts) {
				[slots[bestI], slots[bestJ]] = [slots[bestJ], slots[bestI]];
			} else {
				break; // 개선 불가
			}
		}
	}

	/* ─ 조 균형 인터리빙 정렬 (폴백용) ────────────────────────── */
	function groupBalancedSort(playerList, rotOffset) {
		// rank 별로 플레이어 수집
		const byRank = new Map();
		for (const p of playerList) {
			if (!byRank.has(p.rank)) byRank.set(p.rank, []);
			byRank.get(p.rank).push(p);
		}
		const result = [];
		for (const [, players] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
			// 조별로 분류
			const byGroup = new Map();
			for (const p of players) {
				if (!byGroup.has(p.group)) byGroup.set(p.group, []);
				byGroup.get(p.group).push(p);
			}
			const groups = [...byGroup.keys()].sort();
			// rotOffset 만큼 조 시작점 회전
			const rot = rotOffset % groups.length;
			const rotGroups = [...groups.slice(rot), ...groups.slice(0, rot)];
			// 조 순으로 1명씩 번갈아 추가 (균등 인터리빙)
			let added = true;
			while (added) {
				added = false;
				for (const g of rotGroups) {
					const arr = byGroup.get(g);
					if (arr && arr.length > 0) {
						result.push(arr.shift());
						added = true;
					}
				}
			}
		}
		return result;
	}

	/* ─ 1차 시도: rank→group 정렬 + ITF 배치 ───────────────────── */
	const slots1 = makeSlots(active);
	resolveConflicts(slots1);

	if (countConflicts(slots1) === 0) {
		fixByeAssignments(slots1, active);
		return buildRoundsFromSlots(slots1, size);
	}

	/* ─ 2차 시도: 조 균형 인터리빙 (10회 회전) ─────────────────── */
	let bestSlots = slots1;
	let bestConflictCount = countConflicts(slots1);

	for (let attempt = 1; attempt <= 10; attempt++) {
		const balanced = groupBalancedSort(active, attempt);
		const slotsN = makeSlots(balanced);
		resolveConflicts(slotsN);
		const cc = countConflicts(slotsN);
		if (cc < bestConflictCount) {
			bestConflictCount = cc;
			bestSlots = slotsN;
		}
		if (cc === 0) break;
	}

	if (bestConflictCount > 0) {
		console.warn(`[토너먼트] 동조 1회전 충돌 ${bestConflictCount}쌍 — 구조적 한계 (조 수 부족)`);
	}

	fixByeAssignments(bestSlots, active);
	return buildRoundsFromSlots(bestSlots, size);
}

/* ─ 슬롯 배열에서 라운드 구조 생성 ────────────────────────────── */
function buildRoundsFromSlots(slots, size) {
	const allRounds = [];
	const round1 = [];

	for (let i = 0; i < size / 2; i++) {
		const p1 = slots[i * 2],
			p2 = slots[i * 2 + 1];
		let winner = null,
			completed = false,
			isWalkover = false;
		if (p1 && !p2) {
			winner = p1.name;
			completed = true;
			isWalkover = true;
		} else if (!p1 && p2) {
			winner = p2.name;
			completed = true;
			isWalkover = true;
		} else if (p1 && p2 && p2.isVacant) {
			winner = p1.name;
			completed = true;
			isWalkover = true;
		} else if (p1 && p2 && p1.isVacant) {
			winner = p2.name;
			completed = true;
			isWalkover = true;
		}
		round1.push({
			id: `r1_${i}`,
			player1: p1?.name || null,
			player2: p2?.name || null,
			seed1: p1?.seed || "",
			seed2: p2?.seed || "",
			winner,
			completed,
			isWalkover,
			p1Elim: false,
			p2Elim: false,
		});
	}
	allRounds.push(round1);

	let prev = round1;
	while (prev.length > 1) {
		const next = [];
		for (let i = 0; i < prev.length / 2; i++) {
			const m1 = prev[i * 2],
				m2 = prev[i * 2 + 1];
			const p1 = m1.winner || null,
				p2 = m2.winner || null;
			const s1 = m1.winner ? (m1.winner === m1.player1 ? m1.seed1 : m1.seed2) : "";
			const s2 = m2.winner ? (m2.winner === m2.player1 ? m2.seed1 : m2.seed2) : "";
			next.push({
				id: `r${allRounds.length + 1}_${i}`,
				player1: p1,
				player2: p2,
				seed1: s1,
				seed2: s2,
				winner: null,
				completed: false,
				isWalkover: false,
				fromMatches: [m1.id, m2.id],
			});
		}
		allRounds.push(next);
		prev = next;
	}

	const labels = ["결승", "준결승", "8강", "16강", "32강", "64강"];
	return allRounds.map((m, idx) => {
		const fe = allRounds.length - 1 - idx;
		return { name: labels[fe] || `${Math.pow(2, fe + 1)}강`, matches: m };
	});
}

function showTournament() {
	document.getElementById("mainDashboard").classList.add("hidden");
	document.getElementById("tournamentArea").classList.remove("hidden");

	// 토너먼트 대회명 배너
	const d = masterData[curId];
	if (d) {
		const seeds = d.tournament?.seeds || [];
		const playerCount = seeds.filter((s) => !s.isEliminated).length;
		document.getElementById("tournamentTitleBanner").innerHTML = `
      <div class="title-banner" style="background:linear-gradient(135deg,#f59e0b 0%,#7c3aed 100%);margin-bottom:16px;">
        <div class="title-banner-icon">🏆</div>
        <div class="title-banner-text">
          <div class="title-banner-name">${d.title || "용문리그"}</div>
          <div class="title-banner-meta">${d.date || ""} &nbsp;·&nbsp; 토너먼트 대진표 &nbsp;·&nbsp; ${playerCount}강</div>
        </div>
      </div>`;
		// 토너먼트 카드 서브타이틀에도 대회명 표시
		const sub = document.getElementById("tournamentSubtitle");
		if (sub) sub.textContent = d.title || "Single Elimination";
	}

	renderTournament();
	setTimeout(() => document.getElementById("tournamentArea").scrollIntoView({ behavior: "smooth" }), 100);
}

function backToLeague() {
	document.getElementById("tournamentArea").classList.add("hidden");
	if (masterData[curId] && Object.keys(masterData[curId].groups).length > 0) {
		document.getElementById("mainDashboard").classList.remove("hidden");
		setTimeout(() => document.getElementById("mainDashboard").scrollIntoView({ behavior: "smooth" }), 100);
	}
}

// 한번 클릭된 인쇄 버튼 matchId 집합 — renderTournament 재호출 후에도 활성 유지
if (!window._printedMatchIds) window._printedMatchIds = new Set();

function renderTournament() {
	const league = masterData[curId];
	if (!league?.tournament) return;
	const container = document.getElementById("tournamentBracket");
	container.innerHTML = "";

	const rounds = league.tournament.rounds;
	if (!rounds?.length) return;

	/*
	 * 레이아웃: 1회전 BOX_W=190, 2회전부터 BOX_W=133(70%)
	 * 각 라운드별 colLeft를 누적 계산
	 */
	const LABEL_W = 50;
	const BOX_W1 = 190; // 1회전
	const BOX_W2 = Math.round(BOX_W1 * 0.7); // 133 (2회전+)
	const PRINT_W = 40;
	const COL_GAP = 32;
	const BOX_H = 72;
	const SLOT_GAP = 20;
	const SLOT_H = BOX_H + SLOT_GAP;
	const HEADER_H = 42;
	const PAD_V = 14;

	const ROUND_N = rounds.length;
	const FIRST_N = rounds[0].matches.length;

	// 각 라운드별 BOX_W와 colLeft 사전 계산
	const roundBoxW = rounds.map((_, ri) => (ri === 0 ? BOX_W1 : BOX_W2));
	const roundColW = roundBoxW.map((bw) => LABEL_W + bw + PRINT_W);
	const roundColLeft = [];
	let _cx = 0;
	for (let ri = 0; ri < ROUND_N; ri++) {
		roundColLeft.push(_cx);
		_cx += roundColW[ri] + COL_GAP;
	}

	const TOTAL_W = roundColLeft[ROUND_N - 1] + roundColW[ROUND_N - 1];
	const TOTAL_H = FIRST_N * SLOT_H + HEADER_H + PAD_V * 2;

	/* ── outer wrapper (scroll 컨테이너) ── */
	const scrollWrap = document.createElement("div");
	scrollWrap.className = "tournament-wrap";

	/* ── inner absolute canvas ── */
	const canvas = document.createElement("div");
	canvas.style.cssText = `position:relative;width:${TOTAL_W}px;height:${TOTAL_H}px;`;

	/* ── SVG for connector lines ── */
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("width", TOTAL_W);
	svg.setAttribute("height", TOTAL_H);
	svg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;";
	canvas.appendChild(svg);

	const centerYs = []; // centerYs[ri][mi] = center Y of that match card

	rounds.forEach((round, ri) => {
		const isFinal = round.name === "결승";
		const matchN = round.matches.length;
		const BOX_W = roundBoxW[ri];
		const colLeft = roundColLeft[ri];
		const boxLeft = colLeft + LABEL_W;
		const slotH = (FIRST_N * SLOT_H) / matchN;
		const cys = [];
		centerYs.push(cys);

		/* 상단 라운드 이름 헤더 */
		const hdr = document.createElement("div");
		hdr.style.cssText = [
			`position:absolute`,
			`left:${boxLeft}px`,
			`top:${PAD_V}px`,
			`width:${BOX_W}px`,
			`height:${HEADER_H - 6}px`,
			`display:flex`,
			`align-items:center`,
			`justify-content:center`,
			`font-weight:800`,
			`font-size:0.8rem`,
			`letter-spacing:0.4px`,
			`border-radius:100px`,
			`box-sizing:border-box`,
			isFinal
				? `color:white;background:linear-gradient(135deg,#f59e0b,#d97706);border:1.5px solid #f59e0b;`
				: `color:var(--primary);background:var(--primary-light);border:1.5px solid var(--primary);`,
		].join(";");
		hdr.textContent = round.name;
		canvas.appendChild(hdr);

		round.matches.forEach((match, mi) => {
			const slotTop = HEADER_H + PAD_V + mi * slotH;
			const boxTop = slotTop + (slotH - BOX_H) / 2;
			const cy = boxTop + BOX_H / 2;
			cys.push(cy);

			const isWO = match.isWalkover || false;
			const canVote = match.player1 && match.player2 && !isWO;

			/* ── 왼쪽 라운드 레이블 ── */
			const lbl = document.createElement("div");
			lbl.style.cssText = [
				`position:absolute`,
				`left:${colLeft}px`,
				`top:${boxTop}px`,
				`width:${LABEL_W - 4}px`,
				`height:${BOX_H}px`,
				`display:flex`,
				`align-items:center`,
				`justify-content:center`,
			].join(";");
			lbl.innerHTML = `<span style="
        font-size:0.68rem;font-weight:800;line-height:1.3;text-align:center;
        white-space:nowrap;padding:4px 5px;border-radius:6px;
        ${
			isFinal
				? "color:#92400e;background:#fef3c7;border:1.5px solid #f59e0b;"
				: "color:var(--primary);background:var(--primary-light);border:1.5px solid var(--primary);"
		}
      ">${round.name}</span>`;
			canvas.appendChild(lbl);

			/* ── 매치 카드 ── */
			const makeRow = (name, isP1) => {
				const seed = isP1 ? match.seed1 : match.seed2;
				const isWin = !!(match.winner && match.winner === name);
				const isBye = isWO && !name;
				const dname = name ? displayName(league, name) : "";
				let rowCls = "mrow";
				if (isWin && !isWO) rowCls += " mwinner";
				if (isWin && isWO) rowCls += " mwalkover";
				if (isBye) rowCls += " mbye";
				const radio =
					canVote && name
						? `<input type="radio" name="m_${match.id}" id="${match.id}_p${isP1 ? 1 : 2}" ${isWin ? "checked" : ""} onchange="selectWinner('${match.id}',${isP1 ? 1 : 2})">`
						: "";
				const badge = ri === 0 && seed ? `<span class="seed-pill">${seed}</span>` : "";

				// BYE 처리 (null slot)
				if (isBye) {
					return `<div class="${rowCls}" style="height:${BOX_H / 2 - 0.5}px;min-height:0;">
            <label style="color:#94a3b8;font-style:italic;">${badge}<span style="flex:1;">BYE</span></label>
          </div>`;
				}

				const isWalkoverWinner = isWO && isWin;
				const fs = BOX_W <= 133 ? "0.76rem" : "0.82rem";
				const fw = isWin ? "800" : "600";

				// ── 1회전: 이름+등급 통합 input (편집 가능) ──
				if (ri === 0) {
					const inputVal = isWalkoverWinner ? `${dname} (부전승)` : dname;
					const inputStyle = [
						"flex:1",
						"min-width:0",
						"border:none",
						"outline:none",
						"background:transparent",
						"font-family:inherit",
						`font-size:${fs}`,
						`font-weight:${fw}`,
						"color:inherit",
						"padding:0 2px",
						"white-space:nowrap",
						"overflow:hidden",
						"text-overflow:ellipsis",
						isWalkoverWinner ? "font-style:italic;color:#f97316;" : "",
					]
						.filter(Boolean)
						.join(";");
					return `<div class="${rowCls}" style="height:${BOX_H / 2 - 0.5}px;min-height:0;">
            <label for="${match.id}_p${isP1 ? 1 : 2}">
              ${radio}${badge}<input
                type="text"
                class="tourn-name-input"
                data-match="${match.id}"
                data-player="${isP1 ? 1 : 2}"
                value="${inputVal.replace(/"/g, "&quot;")}"
                style="${inputStyle}"
                title="이름(등급) 형식으로 수정 가능합니다. 예) 홍길동(2)"
                onchange="updateTournamentPlayerName('${match.id}',${isP1 ? 1 : 2},this.value)"
                onfocus="this.style.background='rgba(91,108,245,0.07)';this.style.borderRadius='4px'"
                onblur="this.style.background='transparent';this.style.borderRadius=''"
              >
            </label>
          </div>`;
				}

				// ── 2회전+: 텍스트 전용 (편집 불가) ──
				const spanStyle = [
					"flex:1",
					"min-width:0",
					`font-size:${fs}`,
					`font-weight:${fw}`,
					"white-space:nowrap",
					"overflow:hidden",
					"text-overflow:ellipsis",
					isWalkoverWinner ? "font-style:italic;color:#f97316;" : "",
				]
					.filter(Boolean)
					.join(";");
				const label = isWalkoverWinner ? `${dname} (부전승)` : dname || "";
				return `<div class="${rowCls}" style="height:${BOX_H / 2 - 0.5}px;min-height:0;">
          <label for="${match.id}_p${isP1 ? 1 : 2}">
            ${radio}${badge}<span style="${spanStyle}">${label}</span>
          </label>
        </div>`;
			};

			const card = document.createElement("div");
			card.className = `match-card${isFinal ? " final-card" : ""}`;
			card.style.cssText = `position:absolute;left:${boxLeft}px;top:${boxTop}px;width:${BOX_W}px;height:${BOX_H}px;overflow:hidden;`;
			card.innerHTML = `
        ${makeRow(match.player1, true)}
        <div style="height:1px;background:var(--border);flex-shrink:0;"></div>
        ${makeRow(match.player2, false)}
      `;
			canvas.appendChild(card);

			/* ── 인쇄 버튼 (부전승 제외) — 클릭 시 영구 활성 ── */
			if (!isWO) {
				const pBtn = document.createElement("button");
				pBtn.className = "btn-print-match";
				pBtn.title = "경기 카드 인쇄";
				pBtn.innerHTML = "🖨️";
				pBtn.style.cssText = [
					`position:absolute`,
					`left:${boxLeft + BOX_W + 6}px`,
					`top:${cy - 15}px`,
					`width:30px`,
					`height:30px`,
					`padding:0`,
					`font-size:0.85rem`,
					`border-radius:50%`,
					`z-index:5`,
					`display:flex`,
					`align-items:center`,
					`justify-content:center`,
				].join(";");
				// ① 이미 클릭된 match면 즉시 활성 상태 복원 (재렌더 후에도 유지)
				if (window._printedMatchIds.has(match.id)) {
					pBtn.style.background = "#f97316";
					pBtn.style.color = "white";
					pBtn.style.cursor = "default";
				}
				pBtn.addEventListener("click", () => {
					window._printedMatchIds.add(match.id); // Set에 등록 — 이후 재렌더 시 복원
					printMatchCard(match.id);
					pBtn.style.background = "#f97316";
					pBtn.style.color = "white";
					pBtn.style.cursor = "default";
				});
				canvas.appendChild(pBtn);
			}
		});
	});

	/* ── SVG connector lines (각 라운드별 실제 BOX_W 기반 좌표) ── */
	rounds.forEach((_, ri) => {
		if (ri >= ROUND_N - 1) return;
		const curr = centerYs[ri];
		const next = centerYs[ri + 1];
		const fromX = roundColLeft[ri] + LABEL_W + roundBoxW[ri];
		const toX = roundColLeft[ri + 1] + LABEL_W;
		const midX = fromX + (toX - fromX) / 2;

		for (let i = 0; i < curr.length; i += 2) {
			const y1 = curr[i];
			const y2 = curr[i + 1] ?? y1;
			const midY = (y1 + y2) / 2;
			const yn = next[Math.floor(i / 2)] ?? midY;

			[`M ${fromX} ${y1} H ${midX} V ${midY}`, `M ${fromX} ${y2} H ${midX} V ${midY}`, `M ${midX} ${midY} V ${yn} H ${toX}`].forEach((d) => {
				const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
				p.setAttribute("d", d);
				p.setAttribute("fill", "none");
				p.setAttribute("stroke", "#c7d2e8");
				p.setAttribute("stroke-width", "1.5");
				p.setAttribute("stroke-linecap", "round");
				svg.appendChild(p);
			});
		}
	});

	scrollWrap.appendChild(canvas);
	container.appendChild(scrollWrap);

	if (league.tournament.champion) {
		const cb = document.createElement("div");
		cb.className = "champion-banner";
		cb.innerHTML = `<h3>🏆 우승자</h3><div class="champion-name">${displayName(league, league.tournament.champion)}</div>`;
		container.appendChild(cb);
	}
}

/* ── 토너먼트 선수명(+등급) 인라인 수정 — 1회전 input 전용 ─────── */
window.updateTournamentPlayerName = function (matchId, playerNum, rawVal) {
	const league = masterData[curId];
	if (!league?.tournament) return;

	// "(부전승)" 제거 후 파싱
	const cleaned = rawVal.replace(/\s*\(부전승\)\s*$/, "").trim();
	if (!cleaned) return;

	// 이름+등급 파싱: "홍길동(2)" → name=홍길동, grade=2
	// 또는 "홍길동 2" / "홍길동2" 형식도 지원
	let newName = cleaned;
	let newGrade = null;
	const mParen = cleaned.match(/^(.+?)\s*\((\d+)\)\s*$/);
	if (mParen) {
		newName = mParen[1].trim();
		newGrade = parseInt(mParen[2]);
	} else {
		const mTrail = cleaned.match(/^(.*[^\d\s])\s*(\d+)$/);
		if (mTrail && mTrail[1].trim()) {
			newName = mTrail[1].trim();
			newGrade = parseInt(mTrail[2]);
		}
	}
	if (!newName) return;

	// 기존 이름 파악
	let oldName = null;
	for (const round of league.tournament.rounds) {
		const m = round.matches.find((x) => x.id === matchId);
		if (m) {
			oldName = playerNum === 1 ? m.player1 : m.player2;
			break;
		}
	}
	if (!oldName) return;

	// 등급 업데이트 (이름 변경 여부와 무관)
	if (newGrade !== null) {
		const seed = (league.tournament.seeds || []).find((s) => s.name === oldName);
		if (seed) seed.grade = newGrade;
		// 리그 그룹 grades 업데이트
		for (const gn in league.groups || {}) {
			const g = league.groups[gn];
			if (g.grades && oldName in g.grades) {
				g.grades[oldName] = newGrade;
				if (oldName !== newName) {
					g.grades[newName] = newGrade;
					delete g.grades[oldName];
				}
			}
		}
	}

	if (oldName === newName) {
		// 이름 같고 등급만 변경 → 리렌더만
	} else {
		// seeds 이름 교체
		const seed = (league.tournament.seeds || []).find((s) => s.name === oldName);
		if (seed) seed.name = newName;

		// 전체 라운드 이름 교체
		league.tournament.rounds.forEach((round) => {
			round.matches.forEach((m) => {
				if (m.player1 === oldName) m.player1 = newName;
				if (m.player2 === oldName) m.player2 = newName;
				if (m.winner === oldName) m.winner = newName;
			});
		});
		if (league.tournament.champion === oldName) league.tournament.champion = newName;
	}

	const _tw = document.querySelector(".tournament-wrap");
	const _sx = _tw ? _tw.scrollLeft : 0;
	const _sy = window.scrollY || 0;
	renderTournament();
	requestAnimationFrame(() => {
		const _tw2 = document.querySelector(".tournament-wrap");
		if (_tw2) _tw2.scrollLeft = _sx;
		window.scrollTo({ top: _sy, behavior: "instant" });
	});
};

window.selectWinner = async function (matchId, playerNum) {
	const league = masterData[curId];
	if (!league.tournament) return;
	let match = null,
		ri = -1;
	for (let i = 0; i < league.tournament.rounds.length; i++) {
		const m = league.tournament.rounds[i].matches.find((x) => x.id === matchId);
		if (m) {
			match = m;
			ri = i;
			break;
		}
	}
	if (!match) return;

	const winner = playerNum === 1 ? match.player1 : match.player2;
	const winnerSeed = playerNum === 1 ? match.seed1 : match.seed2;
	match.winner = winner;
	match.completed = true;

	if (ri < league.tournament.rounds.length - 1) {
		const nextRound = league.tournament.rounds[ri + 1];
		const mi = league.tournament.rounds[ri].matches.findIndex((x) => x.id === matchId);
		const nmi = Math.floor(mi / 2),
			pos = mi % 2;
		if (nextRound.matches[nmi]) {
			const nm = nextRound.matches[nmi];
			if (pos === 0) {
				nm.player1 = winner;
				nm.seed1 = winnerSeed;
			} else {
				nm.player2 = winner;
				nm.seed2 = winnerSeed;
			}
			// 첫 라운드 이후 부전승 자동 처리 없음
		}
	} else {
		league.tournament.champion = winner;
		updateSelector();
	}

	// 토너먼트 결과는 자동저장 없음 — 💾 저장 버튼으로 수동 저장
	const _tw = document.querySelector(".tournament-wrap");
	const _sx = _tw ? _tw.scrollLeft : 0;
	const _sy = window.scrollY || 0;
	renderTournament();
	requestAnimationFrame(() => {
		const _tw2 = document.querySelector(".tournament-wrap");
		if (_tw2) _tw2.scrollLeft = _sx;
		window.scrollTo({ top: _sy, behavior: "instant" });
	});
};

/* ───────────────────────────── print match card ─────────────────────────────── */
window.printMatchCard = function (matchId) {
	const league = masterData[curId];
	let match = null,
		roundName = "";
	for (const r of league.tournament.rounds) {
		const f = r.matches.find((m) => m.id === matchId);
		if (f) {
			match = f;
			roundName = r.name;
			break;
		}
	}
	if (!match) return;
	const title = `${league.title || "용문리그"} ${roundName}`;
	const today = new Date().toLocaleDateString("ko-KR");
	const p1 = displayName(league, match.player1) || "";
	const p2 = displayName(league, match.player2) || "";

	const w = window.open("", "_blank", "width=900,height=650");
	w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${title}</title>
<style>
@page { size: A5 landscape; margin: 15mm; }
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100%;height:100%;font-family:'Malgun Gothic',sans-serif;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;padding:10px;}
.card{width:100%;height:calc(100vh - 20px);display:flex;flex-direction:column;border:1px solid #1a1f36;border-radius:12px;overflow:hidden;}
.hd{background:#fff;color:#1a1f36;text-align:center;padding:18px;font-size:22pt;font-weight:900;letter-spacing:-0.5px;flex-shrink:0;border-bottom:1px solid #1a1f36;}
.body{flex:1;display:flex;flex-direction:column;}
.players{display:flex;flex:1;}
.pl{flex:1;display:flex;align-items:center;justify-content:center;font-size:36pt;font-weight:900;color:#1a1f36;text-align:center;padding:16px;word-break:keep-all;}
.pl:first-child{border-right:1px dashed #000;}
.score-row{display:flex;flex:2;border-top:1px solid #1a1f36;}
.sc{flex:1;} .sc:first-child{border-right:1px dashed #000;}
.ft{background:#fff;padding:10px;text-align:center;font-size:12pt;color:#1a1f36;font-weight:normal;border-top:1px solid #e4e8f0;flex-shrink:0;}
.pbtn{display:inline-flex;align-items:center;margin:4px;padding:8px 24px;font-size:11pt;background:#5b6cf5;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;}
.pbtn-close{background:#ef4444;}
.pbtn-row{display:flex;justify-content:center;gap:8px;margin:10px auto 0;}
@media print{.pbtn{display:none;}.pbtn-close{display:none;}}
</style></head><body>
<div class="card">
  <div class="hd">${title}</div>
  <div class="body">
    <div class="players"><div class="pl">${p1}</div><div class="pl">${p2}</div></div>
    <div class="score-row"><div class="sc"></div><div class="sc"></div></div>
  </div>
  <div class="ft">${today}</div>
</div>
<div class="pbtn-row">
  <button class="pbtn" onclick="window.print()">🖨️ 인쇄</button>
  <button class="pbtn pbtn-close" onclick="window.close()">✕ 닫기</button>
</div>
</body></html>`);
	w.document.close();
};

/* ───────────────────────────── print all players ─────────────────────────────── */
window.printAllPlayers = function () {
	const league = masterData[curId];
	if (!league) return;

	// 조별로 선수 수집 → 등급 오름차순 → 이름 가나다순
	const groupNames = Object.keys(league.groups).sort();
	const groupedPlayers = [];
	groupNames.forEach((gn) => {
		const g = league.groups[gn];
		const names = [...g.names].sort((a, b) => {
			const ga = g.grades && g.grades[a] !== undefined ? g.grades[a] : 9999;
			const gb = g.grades && g.grades[b] !== undefined ? g.grades[b] : 9999;
			return ga !== gb ? ga - gb : a.localeCompare(b, "ko");
		});
		groupedPlayers.push({
			gn,
			players: names.map((name) => {
				const grade = g.grades && g.grades[name] !== undefined && g.grades[name] !== 9999 ? g.grades[name] : null;
				const affil = g.affiliations && g.affiliations[name] ? g.affiliations[name] : "";
				// "소속 이름(등급)" 형식. 소속 없으면 "이름(등급)"
				const namePart = grade !== null ? `${name}(${grade})` : name;
				const display = affil ? `${affil} ${namePart}` : namePart;
				return { name, display };
			}),
		});
	});

	if (!groupedPlayers.some((g) => g.players.length)) {
		alert("선수 명단이 없습니다.");
		return;
	}

	const cols = 4;

	// items: header(조명) + subheader(이름/참가) + players
	const items = [];
	groupedPlayers.forEach(({ gn, players }) => {
		items.push({ type: "header", gn });
		items.push({ type: "subheader", gn });
		players.forEach((p, i) => items.push({ type: "player", gn, display: p.display, num: i + 1 }));
	});

	const totalItems = items.length;
	const rows = Math.ceil(totalItems / cols);

	// 세로우선 grid
	const grid = [];
	for (let c = 0; c < cols; c++) {
		grid[c] = [];
		for (let r = 0; r < rows; r++) {
			const idx = c * rows + r;
			grid[c][r] = idx < totalItems ? items[idx] : null;
		}
	}

	// 열 너비: 이름(6) + 참가(4) = 2열, 열 간 구분선 0.8%
	const gapW = 0.8;
	const colW = (100 - (cols - 1) * gapW) / cols;
	const nameW = +(colW * 0.6).toFixed(2);
	const checkW = +(colW * 0.4).toFixed(2);

	let colgroup = "<colgroup>";
	for (let c = 0; c < cols; c++) {
		colgroup += `<col style="width:${nameW}%"><col style="width:${checkW}%">`;
		if (c < cols - 1) colgroup += `<col style="width:${gapW}%">`;
	}
	colgroup += "</colgroup>";

	// subheader 행 개수 계산
	let subRowCount = 0;
	for (let r = 0; r < rows; r++) {
		if (Array.from({ length: cols }, (_, cc) => grid[cc][r]).some((it) => it && it.type === "subheader")) subRowCount++;
	}
	const nonSubRows = rows - subRowCount;
	const AVAIL_PT = 502;
	const SUB_H = 23;
	const cellFontPt = Math.min(13, Math.max(8, Math.floor(160 / rows)));
	// ③ 0.93 배율 적용
	const tdHPt = Math.round(Math.max(10, Math.floor((AVAIL_PT - subRowCount * SUB_H) / Math.max(nonSubRows, 1))) * 0.93);

	let tableInner = colgroup + "<tbody>";

	for (let r = 0; r < rows; r++) {
		const rowCells = Array.from({ length: cols }, (_, c) => grid[c][r]);
		const isSubRow = rowCells.some((it) => it && it.type === "subheader");
		const subH = `height:${SUB_H}pt;max-height:${SUB_H}pt;overflow:hidden;`;
		tableInner += "<tr>";
		for (let c = 0; c < cols; c++) {
			const item = grid[c][r];
			if (!item) {
				const sty = isSubRow ? subH : "";
				tableInner += `<td class="td-name" style="${sty}"></td><td class="td-check" style="${sty}"></td>`;
			} else if (item.type === "header") {
				tableInner += `<th colspan="2" style="text-align:center;background:none;border:1px solid #000;font-size:16pt;font-weight:900;padding:1pt 0;">${item.gn}</th>`;
			} else if (item.type === "subheader") {
				const sf = Math.max(7, cellFontPt - 2);
				tableInner += `<th class="th-name" style="${subH}font-size:${sf}pt;">이름</th><th class="th-check" style="${subH}font-size:${sf}pt;">참가</th>`;
			} else {
				tableInner += `<td class="td-name">${item.display}</td><td class="td-check"></td>`;
			}
			if (c < cols - 1) {
				const gapSty = isSubRow ? `style="${subH}background:transparent;border:none;padding:0;"` : 'class="td-gap"';
				tableInner += `<td ${gapSty}></td>`;
			}
		}
		tableInner += "</tr>";
	}
	tableInner += "</tbody>";

	const w = window.open("", "_blank");
	w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${league.title} 참가자명단</title>
<style>
@page { size: A4 landscape; margin: 10mm 15mm 10mm 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: 'Malgun Gothic', sans-serif; background: #fff; }
h1 { text-align: center; font-size: 24pt; font-weight: 900; margin-bottom: 10pt; letter-spacing: -0.3px; line-height: 1.1; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { background: #e8eaf0; border: 1px solid #000; font-size: 12pt; font-weight: 800; text-align: center; vertical-align: middle; padding: 0 2pt; }
td { border: 1px solid #000; font-size: ${cellFontPt}pt; vertical-align: middle; padding: 0 3pt; height: ${tdHPt}pt; }
.th-name, .td-name { text-align: center; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-check, .td-check { text-align: center; }
.td-gap { background: transparent !important; border: none !important; padding: 0 !important; }
.pbtn { display: inline-flex; align-items: center; margin: 4px; padding: 8px 28px; font-size: 11pt; background: #5b6cf5; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
.pbtn-close { background: #ef4444; }
.pbtn-row { display: flex; justify-content: center; gap: 8px; margin: 10px auto; }
@media print {
  .pbtn, .pbtn-close, .nohint { display: none !important; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { height: ${tdHPt}pt; max-height: ${tdHPt}pt; overflow: hidden; }
}
</style></head><body>
<h1>${league.title} 참가자명단</h1>
<table>${tableInner}</table>
<p class="nohint" style="text-align:center;font-size:9pt;color:#c00;margin-bottom:6px;font-weight:700;">머리글과 바닥글 체크해제 / 배경그래픽 체크 꼭 해주세요!</p>
<div class="pbtn-row">
  <button class="pbtn" onclick="window.print()">🖨️ 인쇄</button>
  <button class="pbtn pbtn-close" onclick="window.close()">✕ 닫기</button>
</div>
</body></html>`);
	w.document.close();
};

/* ───────────────────────────── band public list ─────────────────────────────── */
/* ───────────────────────────── bulk name edit modal ─────────────────────────────── */
window.openBulkEdit = function () {
	document.getElementById("bulkEditModal").classList.add("active");
	document.getElementById("bulkEditCancel").value = "";
	document.getElementById("bulkEditNew").value = "";
};

window.closeBulkEdit = function () {
	document.getElementById("bulkEditModal").classList.remove("active");
};

/* ── 취소 명단 전용 파서 (processBulk와 동일 로직) ── */
function parseCancelEntry(line) {
	function cleanName(raw) {
		return raw
			.replace(/^[\d\s]+/, "")
			.replace(/[0-9]/g, "")
			.replace(/[^\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF\uF900-\uFAFFa-zA-Z\s]/g, "")
			.trim();
	}
	function cleanGrade(raw) {
		const digits = raw.replace(/[^\d]/g, "");
		return digits ? parseInt(digits) : 9999;
	}
	const tokens = line.trim().split(/\s+/);
	let rawName = "",
		rawGrade = "";

	if (tokens.length >= 3) {
		const last = tokens[tokens.length - 1];
		if (/\d/.test(last)) {
			rawGrade = last;
			rawName = tokens.slice(0, tokens.length - 2).join(" "); // 소속 제외
		} else {
			rawName = tokens.slice(0, tokens.length - 1).join(" ");
		}
	} else if (tokens.length === 2) {
		const last = tokens[1];
		if (/\d/.test(last)) {
			rawGrade = last;
			rawName = tokens[0];
		} else {
			rawName = tokens[0];
		}
	} else {
		rawName = tokens[0] || "";
	}

	const name = cleanName(rawName);
	const grade = rawGrade ? cleanGrade(rawGrade) : cleanGrade(rawName) !== 9999 ? cleanGrade(rawName) : 9999;
	return { name, grade };
}

window.applyBulkEdit = function () {
	const cancelRaw = document.getElementById("bulkEditCancel").value.trim();
	const newRaw = document.getElementById("bulkEditNew").value.trim();

	// 빈 줄 제거 후 파싱
	const cancelLines = cancelRaw
		? cancelRaw
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
		: [];
	const newLines = newRaw
		? newRaw
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
		: [];

	if (!cancelLines.length) {
		alert("취소 명단을 입력해 주세요.");
		return;
	}
	if (newLines.length > cancelLines.length) {
		alert("취소자보다 입력명단의 수가 더 많습니다! 다시 입력해 주세요!");
		return;
	}

	// 취소 명단: parseCancelEntry로 변환 → 이름+등급으로 조 내 선수 검색
	const cancelPlayers = cancelLines.map((l) => parseCancelEntry(l));
	// 새 명단 파싱
	const newPlayers = newLines.map((l) => parseCancelEntry(l));
	// 새 명단이 취소 명단보다 적으면 빈 슬롯으로 채움
	while (newPlayers.length < cancelLines.length) newPlayers.push({ name: "", grade: 9999 });

	const d = masterData[curId];
	let matchedCount = 0;
	const notFound = [];

	cancelPlayers.forEach(({ name: oldName, grade: oldGrade }, i) => {
		const { name: newName, grade: newGrade } = newPlayers[i];
		let found = false;

		for (const gn in d.groups) {
			const g = d.groups[gn];
			// 이름 일치 + 등급도 일치 (등급 미입력 시 이름만으로 검색)
			const idx = g.names.findIndex((n) => {
				if (n !== oldName) return false;
				if (oldGrade === 9999) return true; // 등급 미입력이면 이름만 비교
				const storedGrade = g.grades && g.grades[n] !== undefined ? g.grades[n] : 9999;
				return storedGrade === oldGrade;
			});
			if (idx === -1) continue;
			found = true;
			matchedCount++;

			if (!g.modifiedNames) g.modifiedNames = {};

			if (!newName) {
				// 빈 슬롯: '(공석N)'으로 표시 + 최하위 처리
				const placeholder = "(공석" + (i + 1) + ")";
				g.names[idx] = placeholder;
				if (g.grades) {
					delete g.grades[oldName];
					g.grades[placeholder] = 9999;
				}
				const nr = {};
				for (const k1 in g.results) {
					const nk1 = k1 === oldName ? placeholder : k1;
					nr[nk1] = {};
					for (const k2 in g.results[k1]) {
						nr[nk1][k2 === oldName ? placeholder : k2] = g.results[k1][k2];
					}
				}
				g.results = nr;
				if (g.playerIds) {
					g.playerIds[placeholder] = g.playerIds[oldName];
					delete g.playerIds[oldName];
				}
				if (g.manualRanks) {
					delete g.manualRanks[oldName];
				}
				g.modifiedNames[placeholder] = true;
				const lastRank = g.names.length;
				if (!g.manualRanks) g.manualRanks = {};
				g.manualRanks[placeholder] = lastRank;
			} else {
				// 일반 교체
				g.names[idx] = newName;
				if (g.grades) {
					delete g.grades[oldName];
					g.grades[newName] = newGrade !== 9999 ? newGrade : 9999;
				}
				const nr = {};
				for (const k1 in g.results) {
					const nk1 = k1 === oldName ? newName : k1;
					nr[nk1] = {};
					for (const k2 in g.results[k1]) {
						nr[nk1][k2 === oldName ? newName : k2] = g.results[k1][k2];
					}
				}
				g.results = nr;
				if (g.playerIds) {
					g.playerIds[newName] = g.playerIds[oldName];
					delete g.playerIds[oldName];
				}
				if (g.manualRanks) {
					if (g.manualRanks[oldName] !== undefined) {
						g.manualRanks[newName] = g.manualRanks[oldName];
						delete g.manualRanks[oldName];
					}
				}
				if (d.tournament) {
					(d.tournament.seeds || []).forEach((s) => {
						if (s.name === oldName) s.name = newName;
					});
					(d.tournament.rounds || []).forEach((round) =>
						round.forEach((m) => {
							if (m.player1 === oldName) m.player1 = newName;
							if (m.player2 === oldName) m.player2 = newName;
							if (m.winner === oldName) m.winner = newName;
						}),
					);
					if (d.tournament.champion === oldName) d.tournament.champion = newName;
				}
				g.modifiedNames[newName] = true;
			}
			break;
		}

		if (!found) notFound.push(oldGrade !== 9999 ? `${oldName}(${oldGrade})` : oldName);
	});

	if (matchedCount === 0) {
		alert("일치하는 명단을 찾을 수 없습니다.\n이름과 등급을 다시 확인해 주세요.");
		return;
	}

	// 전체 조 재렌더링
	Object.keys(d.groups).forEach((gn) => {
		renderMatrix(gn);
		updateStandings(gn);
	});

	closeBulkEdit();
	let msg = `✅ ${matchedCount}명의 명단이 수정되었습니다.\n💾 저장 버튼을 눌러 저장해 주세요.`;
	if (notFound.length) msg += `\n\n⚠️ 아래 명단은 찾지 못했습니다:\n${notFound.join(", ")}`;
	alert(msg);
};

window.openBandList = function () {
	const league = masterData[curId];
	if (!league) return;

	// ── 인쇄 화면과 동일한 그리드/items 로직 ──
	const groupNames = Object.keys(league.groups).sort();
	const groupedPlayers = [];
	groupNames.forEach((gn) => {
		const names = [...league.groups[gn].names].sort((a, b) => {
			const ga = league.groups[gn].grades && league.groups[gn].grades[a] !== undefined ? league.groups[gn].grades[a] : 9999;
			const gb = league.groups[gn].grades && league.groups[gn].grades[b] !== undefined ? league.groups[gn].grades[b] : 9999;
			return ga !== gb ? ga - gb : a.localeCompare(b, "ko");
		});
		groupedPlayers.push({ gn, players: names.map((name) => ({ name, display: displayName(league, name) })) });
	});

	const total = groupedPlayers.reduce((s, g) => s + g.players.length, 0);
	const _bNow = new Date();
	const _bYm = _bNow.getFullYear() + "." + String(_bNow.getMonth() + 1).padStart(2, "0");
	const _bFname = (league.title || "용문리그").replace(/\s/g, "_") + "_최종명단_(" + _bYm + ").png";
	if (!total) {
		alert("선수 명단이 없습니다.");
		return;
	}

	const cols = 4;

	// items: header(조명) + players — subheader(번호/이름/참가) 없음
	const items = [];
	groupedPlayers.forEach(({ gn, players }) => {
		items.push({ type: "header", gn });
		players.forEach((p, i) => items.push({ type: "player", gn, display: p.display, num: i + 1 }));
	});

	const totalItems = items.length;
	const rows = Math.ceil(totalItems / cols);

	// 세로우선 grid
	const grid = [];
	for (let ci = 0; ci < cols; ci++) {
		grid[ci] = [];
		for (let ri = 0; ri < rows; ri++) {
			const idx = ci * rows + ri;
			grid[ci][ri] = idx < totalItems ? items[idx] : null;
		}
	}

	// 열 너비: 이름 열만 (번호·참가 열 없음), 간격 열 포함
	const gapW = 0.8;
	const nameW = (100 - (cols - 1) * gapW) / cols;

	let colgroup = "<colgroup>";
	for (let ci = 0; ci < cols; ci++) {
		colgroup += '<col style="width:' + nameW.toFixed(2) + '%">';
		if (ci < cols - 1) colgroup += '<col style="width:' + gapW + '%">';
	}
	colgroup += "</colgroup>";

	// td 높이: hdrRowCount만 미리 계산 (tdHPx는 런타임에 window.innerHeight 기반)
	let hdrRowCount = 0;
	for (let ri = 0; ri < rows; ri++) {
		if (Array.from({ length: cols }, (_, ci) => grid[ci][ri]).some((it) => it && it.type === "header")) hdrRowCount++;
	}
	const HDR_PX = 52;
	const _bHdrRowCount = hdrRowCount;
	const _bRows = rows;
	const _bNonHdrRows = rows - hdrRowCount;
	// tdHPx는 새 창에서 window.innerHeight 기반으로 재계산 (JS로 삽입)
	const tdHPx = 0; // placeholder — 실제 높이는 새창 JS에서 설정

	// 폰트 크기
	const cellFontPx = Math.min(14, Math.max(9, Math.floor(120 / rows)));

	let tableInner = colgroup + "<tbody>";
	for (let ri = 0; ri < rows; ri++) {
		const rowCells = Array.from({ length: cols }, (_, ci) => grid[ci][ri]);
		const isHdrRow = rowCells.some((it) => it && it.type === "header");
		const trCls = isHdrRow ? "tr-hdr" : "tr-player";
		tableInner += '<tr class="' + trCls + '">';
		for (let ci = 0; ci < cols; ci++) {
			const item = grid[ci][ri];
			if (!item) {
				tableInner += '<td class="td-name"></td>';
			} else if (item.type === "header") {
				tableInner += '<th class="th-hdr">' + item.gn + "</th>";
			} else {
				tableInner += '<td class="td-name">' + item.display + "</td>";
			}
			if (ci < cols - 1) tableInner += '<td class="td-gap"></td>';
		}
		tableInner += "</tr>";
	}
	tableInner += "</tbody>";

	const html = [
		'<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">',
		'<meta name="viewport" content="width=device-width,initial-scale=1.0">',
		"<title>" + (league.title || "용문리그") + " 최종명단</title>",
		'<script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"><\/script>',
		"<style>",
		"* { box-sizing: border-box; margin: 0; padding: 0; }",
		'html, body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; background: #fff; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }',
		"h1 { text-align: center; font-size: clamp(17px, 4.5vw, 20pt); font-weight: 900; padding: 10px 0 16px; letter-spacing: -0.3px; line-height: 1.1; color: #1a1f36; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
		"#capture { flex: 1; padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }",
		"table { width: 100%; border-collapse: collapse; table-layout: fixed; flex: 1; }",
		"th.th-hdr { background: #1a1f36; color: #fff; border: 1px solid #1a1f36; font-size: clamp(15px, 4vw, 18pt); font-weight: 900; text-align: center; vertical-align: middle; letter-spacing: -0.3px; height: 52px; white-space: nowrap; }",
		"td.td-name { border: 1px solid #c8cdd8; font-size: clamp(13px, 3.8vw, 16pt); font-weight: 700; text-align: center; vertical-align: middle; color: #1a1f36; padding: 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
		"td.td-gap { border: none; background: transparent; padding: 0; }",
		"tr:nth-child(even) td.td-name { background: #f5f7fb; }",
		".cap-bar { flex-shrink: 0; padding: 8px 14px 10px; display: flex; justify-content: center; align-items: center; gap: 10px; }",
		".close-btn { display: inline-flex; align-items: center; gap: 5px; background: #ef4444; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.15s; }",
		".close-btn:hover { background: #dc2626; }",
		".cap-btn { display: inline-flex; align-items: center; gap: 6px; background: #1a1f36; color: #fff; border: none; border-radius: 8px; padding: 9px 24px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.15s; }",
		".cap-btn:hover { background: #2d3561; }",
		"</style>",
		"</head><body>",
		'<div id="capture"><h1>' +
			(function () {
				var d = new Date();
				return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0");
			})() +
			" " +
			(league.title || "용문리그") +
			" 최종명단</h1><table>" +
			tableInner +
			"</table></div>",
		'<div class="cap-bar">',
		'  <button class="cap-btn" onclick="doCapture()">',
		'    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M3 9h18"/></svg>',
		"    캡쳐하기",
		"  </button>",
		'  <button class="close-btn" onclick="window.close()">✕ 닫기</button>',
		"</div>",
		"<script>",
		"function setTdHeight() {",
		'  var h1El = document.querySelector("h1");',
		'  var capBar = document.querySelector(".cap-bar");',
		'  var hdrRows = document.querySelectorAll(".tr-hdr");',
		'  var playerRows = document.querySelectorAll(".tr-player");',
		"  var h1H = h1El ? h1El.getBoundingClientRect().height : 60;",
		"  var barH = capBar ? capBar.getBoundingClientRect().height : 50;",
		"  var hdrH = " + HDR_PX + ";",
		"  var avail = window.innerHeight - h1H - barH - 4;",
		"  var nHdr = hdrRows.length;",
		"  var nPl = playerRows.length;",
		"  var nTotal = nHdr + nPl;",
		"  var tdH = nTotal > 0 ? Math.max(14, Math.floor((avail - nHdr * hdrH) / nPl)) : 22;",
		'  playerRows.forEach(function(tr){ tr.style.height = tdH + "px"; });',
		"}",
		'window.addEventListener("load", setTdHeight);',
		'window.addEventListener("resize", setTdHeight);',
		"function doCapture() {",
		'  var btn = document.querySelector(".cap-btn");',
		'  btn.textContent = "캡쳐 중..."; btn.disabled = true;',
		'  var target = document.getElementById("capture");',
		'  html2canvas(target, { backgroundColor: "#ffffff", scale: window.devicePixelRatio || 2, useCORS: true, logging: false })',
		"    .then(function(canvas) {",
		'      var a = document.createElement("a");',
		'      a.download = "' + _bFname + '";',
		'      a.href = canvas.toDataURL("image/png");',
		"      a.click();",
		'      btn.textContent = "✓ 캡쳐 완료!";',
		'      setTimeout(function(){ btn.innerHTML = \'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M3 9h18"/></svg> 캡쳐하기\'; btn.disabled = false; }, 2000);',
		'    }).catch(function(){ btn.textContent = "캡쳐 실패"; btn.disabled = false; });',
		"}",
		"<\/script>",
		"</body></html>",
	].join("\n");

	const w = window.open("", "_blank", "width=680,height=800");
	w.document.write(html);
	w.document.close();
};

/* ───────────────────────────── print group matrix ─────────────────────────────── */
window.printGroupMatrix = function (gn) {
	const league = masterData[curId];
	const g = league.groups[gn];
	const nMap = {};
	g.names.forEach((n) => {
		nMap[n] = displayName(league, n);
	});

	// 경기순서 표기용: 이름+등급 괄호 없이, 예) 홍길동2
	const schedMap = {};
	g.names.forEach((nm) => {
		const g2 = getGrade(league, nm);
		schedMap[nm] = g2 !== null ? `${nm}${g2}` : nm;
	});

	// 경기 순서 생성 (리그 방식) — 공석 포함 경기 제외
	const schedule = [];
	let list = [...g.names];
	if (list.length % 2 === 1) list.push("BYE");
	for (let round = 0; round < list.length - 1; round++) {
		for (let i = 0; i < list.length / 2; i++) {
			const a = list[i],
				b = list[list.length - 1 - i];
			// BYE 및 공석 포함 경기 제외
			if (a !== "BYE" && b !== "BYE" && !a.startsWith("(공석") && !b.startsWith("(공석")) {
				schedule.push([schedMap[a], schedMap[b]]);
			}
		}
		list.splice(1, 0, list.pop());
	}

	const w = window.open("", "_blank");
	const n = g.names.length;
	// 셀 폰트: 인원수에 따라 자동 조절
	const cellFontPt = Math.min(15, Math.max(7, Math.floor(120 / (n + 2))));
	// A4 landscape: margin 좌우/상단 6mm, 하단 5mm → 가용: 285mm × 199mm
	// h2 18pt(line-height 1.1≈20pt) + mb 5pt, sched ≈18pt, mt 6pt → 여백 합계 ≈ 49pt
	// 테이블 가용 ≈ 199mm×(72/25.4) - 49 ≈ 564 - 49 = 515pt
	const tableAvailPt = 515;
	const rowHPt = Math.floor((tableAvailPt / (n + 1)) * 0.9);

	w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${league.title} - ${gn}</title>
<style>
@page{size:A4 landscape;margin:6mm 12mm 5mm 12mm;}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{font-family:'Malgun Gothic',sans-serif;background:#fff;}
h2{text-align:center;font-size:18pt;font-weight:900;margin-bottom:8pt;display:flex;align-items:baseline;justify-content:center;gap:8pt;line-height:1.1;}
.print-hint{font-size:7pt;font-weight:700;color:#dc2626;white-space:nowrap;}
table{width:100%;border-collapse:collapse;table-layout:fixed;}
th,td{border:1px solid #000;padding:0 2pt;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle;}th{height:${Math.floor(rowHPt * 0.85)}pt;}td{height:${rowHPt}pt;}
th{background:#f0f0f0;}
.pn{text-align:center;padding-left:0;word-break:keep-all;}
.sched{margin-top:6pt;}
.sched-matches{text-align:left;line-height:2;font-size:9pt;font-weight:600;}
.sched-item{display:inline-block;white-space:nowrap;border:1px solid #000;padding:2.5px;margin:0 5px 5px 0;line-height:1.4;}
.sched-item:last-child{margin-right:0;}
.pbtn{display:inline-flex;align-items:center;margin:4px;padding:8px 28px;font-size:11pt;background:#5b6cf5;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;}.pbtn-close{background:#ef4444;}.pbtn-row{display:flex;justify-content:center;gap:8px;margin:10px auto;}
@media print{
  .pbtn{display:none;}
  .print-hint{display:none;}
  .nohint{display:none;}
  .xclosebtn{display:none;}
  .pbtn-close{display:none;}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  th{height:${Math.floor(rowHPt * 0.85)}pt;max-height:${Math.floor(rowHPt * 0.85)}pt;overflow:hidden;}td{height:${rowHPt}pt;max-height:${rowHPt}pt;overflow:hidden;}
}
</style></head><body>
<h2>${league.title} — ${gn} 대진표</h2>
  <table>
    <thead><tr><th style="width:9%;">선수</th>${g.names.map((n) => `<th style="width:${72 / g.names.length}%;">${nMap[n]}</th>`).join("")}<th style="width:7%;">승/패</th><th style="width:5%;">순위</th></tr></thead>
    <tbody>${g.names.map((n1) => `<tr><td class="pn">${nMap[n1]}</td>${g.names.map((n2) => (n1 === n2 ? '<td style="background:#e5e7eb;">-</td>' : "<td>&nbsp;</td>")).join("")}<td>/</td><td>&nbsp;</td></tr>`).join("")}</tbody>
  </table>
  <div class="sched">
    <div class="sched-matches">${schedule.map(([p1, p2]) => `<span class="sched-item">${p1}<br>${p2}</span>`).join("")}</div>
  </div>
<p class="nohint" style="text-align:center;font-size:9pt;color:#c00;margin:6px 0 4px;font-weight:700;">인쇄 시 머리글/바닥글 체크해제, 배경그래픽 체크 필수!</p>
<div class="pbtn-row">
  <button class="pbtn" onclick="window.print()">🖨️ 인쇄</button>
  <button class="pbtn pbtn-close" onclick="window.close()">✕ 닫기</button>
</div>
</body></html>`);
	w.document.close();
};

/* ───────────────────────────── storage ─────────────────────────────── */
async function save(silent = false) {
	if (!curId) return;
	// 항상 저장 모달 표시 (자동저장 완전 제거)
	showSaveModal();
}

/* ── 저장 모달: 저장명 입력 + 신규/덮어쓰기 선택 ─────────────────── */
function showSaveModal() {
	const existing = document.getElementById("saveModalOverlay");
	if (existing) existing.remove();

	const league = curId ? masterData[curId] : null;
	const currentTitle = league?.title || "";

	// 저장된 목록 (최신순)
	const savedIds = Object.keys(masterData).sort((a, b) => (b > a ? 1 : -1));

	let selectedSaveId = null; // null = 새로 저장

	const overlay = document.createElement("div");
	overlay.id = "saveModalOverlay";
	overlay.style.cssText = [
		"position:fixed",
		"inset:0",
		"z-index:9999",
		"background:rgba(15,20,40,0.65)",
		"backdrop-filter:blur(5px)",
		"display:flex",
		"align-items:center",
		"justify-content:center",
	].join(";");

	const listHtml = savedIds.length
		? savedIds
				.map((id) => {
					const d = masterData[id];
					const isCurrentSession = id === curId;
					return `<div class="save-list-item" data-sid="${id}" style="
      display:flex;align-items:center;gap:10px;padding:9px 12px;
      border-radius:8px;cursor:pointer;border:1.5px solid transparent;
      background:var(--surface2);margin-bottom:6px;transition:all 0.15s;
      ${isCurrentSession ? "border-color:var(--primary);" : ""}
    "
    onmouseover="if(!this.classList.contains('sel')){this.style.background='var(--primary-light)';}"
    onmouseout="if(!this.classList.contains('sel')){this.style.background='var(--surface2)';}">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${d.title || "(제목없음)"}${isCurrentSession ? ' <span style="color:var(--primary);font-size:0.72rem;">(현재)</span>' : ""}
        </div>
        <div style="font-size:0.72rem;color:var(--text3);">${d.savedAt || d.date || ""}</div>
      </div>
      <div class="save-sel-badge" style="display:none;background:var(--primary);color:white;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;white-space:nowrap;">덮어쓰기 선택</div>
    </div>`;
				})
				.join("")
		: '<div style="padding:12px;text-align:center;color:var(--text3);font-size:0.85rem;">저장된 대회가 없습니다.</div>';

	overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow-lg);padding:24px 24px 20px;max-width:420px;width:94%;box-sizing:border-box;max-height:90vh;display:flex;flex-direction:column;">
      <div style="font-size:1.2rem;margin-bottom:6px;text-align:center;">💾</div>
      <div style="font-weight:900;font-size:1.05rem;color:var(--text);margin-bottom:4px;text-align:center;">저장</div>
      <div style="font-size:0.8rem;color:var(--text3);margin-bottom:14px;text-align:center;line-height:1.6;">
        리스트 선택 후 저장 → <strong>덮어쓰기</strong> &nbsp;|&nbsp; 선택 없이 저장 → <strong>새로 저장</strong>
      </div>

      <label style="display:block;font-size:0.8rem;font-weight:700;color:var(--text2);margin-bottom:5px;">저장명</label>
      <input id="saveModalTitle" type="text" value="${currentTitle.replace(/"/g, "&quot;")}"
        placeholder="예) 은행나무부"
        style="width:100%;box-sizing:border-box;border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:9px 11px;font-size:0.92rem;font-family:inherit;outline:none;color:var(--text);background:var(--surface2);margin-bottom:14px;"
        onfocus="this.style.borderColor='var(--primary)'"
        onblur="this.style.borderColor='var(--border)'"
      >

      <div style="font-size:0.8rem;font-weight:700;color:var(--text2);margin-bottom:6px;">저장된 목록 <span style="font-weight:400;color:var(--text3);">(덮어쓸 항목 클릭 선택)</span></div>
      <div id="saveListContainer" style="flex:1;overflow-y:auto;max-height:240px;margin-bottom:14px;">
        ${listHtml}
      </div>

      <div id="saveSelInfo" style="display:none;font-size:0.78rem;color:var(--primary);font-weight:700;margin-bottom:10px;padding:7px 10px;background:var(--primary-light);border-radius:6px;">
        ✅ 선택된 항목에 덮어쓰기 합니다.
      </div>

      <div style="display:flex;gap:8px;">
        <button id="saveModalConfirm" class="btn btn-primary" style="flex:1;font-size:0.92rem;font-weight:800;">💾 저장</button>
        <button id="saveModalCancel" class="btn" style="flex-shrink:0;font-size:0.88rem;background:var(--surface2);color:var(--text);border:1.5px solid var(--border);">취소</button>
      </div>
    </div>`;

	document.body.appendChild(overlay);

	// 저장 리스트 항목 클릭 → 선택/해제 + 저장명 자동입력
	overlay.querySelectorAll(".save-list-item").forEach((item) => {
		item.addEventListener("click", () => {
			const sid = item.dataset.sid;
			const titleInp = document.getElementById("saveModalTitle");
			if (selectedSaveId === sid) {
				// 해제 — 저장명을 현재 대회명으로 복원
				selectedSaveId = null;
				item.classList.remove("sel");
				item.style.background = "var(--surface2)";
				item.style.borderColor = sid === curId ? "var(--primary)" : "transparent";
				item.querySelector(".save-sel-badge").style.display = "none";
				document.getElementById("saveSelInfo").style.display = "none";
				document.getElementById("saveModalConfirm").textContent = "💾 저장";
				if (titleInp) titleInp.value = currentTitle;
			} else {
				// 이전 선택 해제
				overlay.querySelectorAll(".save-list-item.sel").forEach((el) => {
					el.classList.remove("sel");
					el.style.background = "var(--surface2)";
					el.style.borderColor = el.dataset.sid === curId ? "var(--primary)" : "transparent";
					el.querySelector(".save-sel-badge").style.display = "none";
				});
				selectedSaveId = sid;
				item.classList.add("sel");
				item.style.background = "#dbeafe";
				item.style.borderColor = "#3b82f6";
				item.querySelector(".save-sel-badge").style.display = "block";
				document.getElementById("saveSelInfo").style.display = "block";
				document.getElementById("saveModalConfirm").textContent = "✅ 덮어쓰기";
				// ② 선택한 항목의 대회명을 저장명 입력창에 자동 입력
				if (titleInp && masterData[sid]) {
					titleInp.value = masterData[sid].title || "";
				}
			}
		});
	});

	// ② 저장명 직접 수정 시 리스트 선택 해제
	const titleInput = document.getElementById("saveModalTitle");
	if (titleInput) {
		titleInput.addEventListener("input", () => {
			if (!selectedSaveId) return;
			// 선택 해제
			overlay.querySelectorAll(".save-list-item.sel").forEach((el) => {
				el.classList.remove("sel");
				el.style.background = "var(--surface2)";
				el.style.borderColor = el.dataset.sid === curId ? "var(--primary)" : "transparent";
				el.querySelector(".save-sel-badge").style.display = "none";
			});
			selectedSaveId = null;
			document.getElementById("saveSelInfo").style.display = "none";
			document.getElementById("saveModalConfirm").textContent = "💾 저장";
		});
	}

	// 저장 버튼
	document.getElementById("saveModalConfirm").addEventListener("click", async () => {
		const newTitle = document.getElementById("saveModalTitle").value.trim() || currentTitle;
		hideSaveModal();

		if (selectedSaveId) {
			// ① 선택된 항목 덮어쓰기 — 원본 masterData[curId]의 title은 수정하지 않음
			await doSaveOverwriteTarget(selectedSaveId, newTitle);
		} else {
			// 새로 저장 — 마찬가지로 원본 title 보호
			await doSaveNewWithTitle(newTitle);
		}
		document.title = newTitle || document.title;
	});

	// 포커스
	setTimeout(() => {
		const inp = document.getElementById("saveModalTitle");
		if (inp) {
			inp.focus();
			inp.select();
		}
	}, 80);

	document.getElementById("saveModalCancel").addEventListener("click", hideSaveModal);
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) hideSaveModal();
	});
	const escHandler = (e) => {
		if (e.key === "Escape") {
			hideSaveModal();
			document.removeEventListener("keydown", escHandler);
		}
	};
	document.addEventListener("keydown", escHandler);
}

function hideSaveModal() {
	const overlay = document.getElementById("saveModalOverlay");
	if (overlay) overlay.remove();
}

// 구 호환성 유지
function showSaveConfirm() {
	showSaveModal();
}
function hideSaveConfirm() {
	hideSaveModal();
}

/* ─── 저장 실행 함수들 ────────────────────────────────────────────────
 *  ① 기존 masterData[curId].title을 직접 변경하지 않고
 *     스냅샷에만 새 title을 적용하여 "기존 저장명 같이 수정" 오류 방지
 * ──────────────────────────────────────────────────────────────── */

// 지정된 targetId 에 현재 데이터를 덮어쓰기 (title은 newTitle로)
async function doSaveOverwriteTarget(targetId, newTitle) {
	const now = new Date();
	const snapshot = JSON.parse(JSON.stringify(masterData[curId]));
	snapshot.id = targetId;
	snapshot.title = newTitle || snapshot.title;
	snapshot.savedAt = now.toLocaleString("ko-KR");
	masterData[targetId] = snapshot;
	curId = targetId;
	isLoadedFromHistory = false;
	await serverSave(masterData);
	updateSelector();
	renderHistory();
	alert("✅ 덮어쓰기 저장되었습니다. (" + now.toLocaleString("ko-KR") + ")");
}

// 새 ID로 저장 (title은 newTitle로, 원본 curId 데이터 title 불변)
async function doSaveNewWithTitle(newTitle) {
	const now = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	const stamp =
		now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
	const newId = stamp;
	const snapshot = JSON.parse(JSON.stringify(masterData[curId]));
	snapshot.id = newId;
	snapshot.title = newTitle || snapshot.title;
	snapshot.savedAt = now.toLocaleString("ko-KR");
	masterData[newId] = snapshot;
	curId = newId;
	isLoadedFromHistory = false;
	await serverSave(masterData);
	updateSelector();
	renderHistory();
	alert("✅ 새로 저장되었습니다. (" + now.toLocaleString("ko-KR") + ")");
}

// 하위 호환 — silent 자동저장(내부 호출)에서 사용
async function doSaveOverwrite() {
	const league = masterData[curId];
	if (!league) return;
	await doSaveOverwriteTarget(curId, league.title);
}
async function doSaveNew() {
	const league = masterData[curId];
	if (!league) return;
	await doSaveNewWithTitle(league.title);
}

function exportJson() {
	if (!Object.keys(masterData).length) {
		alert("저장된 데이터가 없습니다.");
		return;
	}
	const blob = new Blob([JSON.stringify(masterData, null, 2)], { type: "application/json" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	const _now = new Date();
	const _p = (n) => String(n).padStart(2, "0");
	const _stamp =
		_now.getFullYear() + _p(_now.getMonth() + 1) + _p(_now.getDate()) + "_" + _p(_now.getHours()) + _p(_now.getMinutes()) + _p(_now.getSeconds());
	a.download = `용문리그_${_stamp}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

async function importJson(event, isInitial = false) {
	const file = event.target.files[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = async (e) => {
		try {
			const data = JSON.parse(e.target.result);
			masterData = { ...masterData, ...data };
			await serverSave(masterData);
			updateSelector();
			alert(`✅ ${Object.keys(data).length}개 대회 데이터를 불러왔습니다.`);
			// ⑦ isInitial이어도 hero-card를 숨기지 않음 (첫 화면 유지)
		} catch {
			alert("❌ 올바른 JSON 파일이 아닙니다.");
		}
		event.target.value = "";
	};
	reader.readAsText(file);
}

function updateSelector() {
	const sel = document.getElementById("leagueHistorySelector");
	const ids = Object.keys(masterData).sort((a, b) => (b > a ? 1 : -1));
	sel.innerHTML =
		'<option value="">-- 과거 대회 선택 --</option>' +
		ids
			.map((id) => {
				const d = masterData[id];
				const label = d.savedAt ? `[${d.savedAt}] ${d.title}` : `${d.date || ""} | ${d.title}`;
				return `<option value="${id}">${label}</option>`;
			})
			.join("");
}

function renderHistory() {
	const tbody = document.getElementById("histTableBody");
	if (!tbody) return;
	const ids = Object.keys(masterData).sort((a, b) => (b > a ? 1 : -1));
	if (!ids.length) {
		tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text3);">저장된 대회가 없습니다.</td></tr>';
		// 전체선택 체크박스 초기화
		const ca = document.getElementById("histCheckAll");
		if (ca) ca.checked = false;
		return;
	}
	tbody.innerHTML = ids
		.map((id) => {
			const d = masterData[id];
			const safeId = id.replace(/'/g, "\\'");
			return `<tr data-hist-id="${id}">
      <td style="text-align:center;width:32px;">
        <input type="checkbox" class="hist-chk" data-id="${id}" style="cursor:pointer;width:16px;height:16px;" onchange="onHistChkChange()">
      </td>
      <td style="font-weight:700;text-align:left;word-break:break-all;word-wrap:break-word;">
        ${d.title || "(제목없음)"}
        <br><span style="font-size:0.75rem;color:var(--text3);font-weight:400;">${d.savedAt || d.date || ""}</span>
      </td>
      <td style="white-space:nowrap;vertical-align:middle;">
        <button class="btn btn-success-s btn-xs" onclick="handleEdit('${safeId}')">불러오기</button>
        <button class="btn btn-danger btn-xs" onclick="handleDelete('${safeId}')" style="margin-left:4px;">삭제</button>
      </td>
    </tr>`;
		})
		.join("");

	// 전체선택 체크박스 연동
	const checkAll = document.getElementById("histCheckAll");
	if (checkAll) {
		checkAll.checked = false;
		checkAll.indeterminate = false;
	}
}

/* 체크박스 상태 → 전체선택 indeterminate 갱신 */
window.onHistChkChange = function () {
	const all = document.querySelectorAll(".hist-chk");
	const chkd = document.querySelectorAll(".hist-chk:checked");
	const ca = document.getElementById("histCheckAll");
	if (!ca) return;
	if (chkd.length === 0) {
		ca.checked = false;
		ca.indeterminate = false;
	} else if (chkd.length === all.length) {
		ca.checked = true;
		ca.indeterminate = false;
	} else {
		ca.checked = false;
		ca.indeterminate = true;
	}
};

/* ───────────────────────────── tiebreaker ─────────────────────────────── */
let tbData = { players: [], results: {}, targetWins: 2 };

/* ── 경품추첨: 현재 리그전 명단을 sessionStorage + postMessage로 전달 ── */
function openPrizeWithLeague() {
	let players = [];
	let leagueTitle = "";

	if (curId && masterData[curId] && masterData[curId].groups) {
		const league = masterData[curId];
		leagueTitle = league.title || "";
		Object.values(league.groups).forEach((g) => {
			g.names.forEach((name) => {
				if (name.startsWith("(공석")) return;
				const rawGrade = g.grades && g.grades[name] !== undefined ? g.grades[name] : 9999;
				const grade = rawGrade !== 9999 ? rawGrade : null;
				// display 검증: 등급이 있으면 반드시 "(등급)" 포함
				const display = grade !== null ? `${name}(${grade})` : name;
				players.push({ name, grade, affiliation: "", display });
			});
		});
		// 가나다 순 정렬
		players.sort((a, b) => a.name.localeCompare(b.name, "ko"));
	}

	// ④ 데이터 무결성 검증: 등급이 있는 선수의 display에 반드시 등급 포함 여부 재확인
	players = players.map((p) => {
		const expectedDisplay = p.grade !== null ? `${p.name}(${p.grade})` : p.name;
		if (p.display !== expectedDisplay) {
			return { ...p, display: expectedDisplay };
		}
		return p;
	});

	// sessionStorage에 저장
	try {
		sessionStorage.setItem("prizeLeaguePlayers", JSON.stringify(players));
		sessionStorage.setItem("prizeLeagueTitle", leagueTitle);
	} catch (e) {}

	const prizeWin = window.open("./prize.html", "_blank");

	// postMessage 전달 — 수신 확인 후 중단 (최대 6회)
	if (prizeWin && players.length) {
		let attempts = 0;
		let confirmed = false;

		// prize.html에서 'LEAGUE_PLAYERS_OK' 응답을 받으면 중단
		const onConfirm = (e) => {
			if (e.data && e.data.type === "LEAGUE_PLAYERS_OK") {
				confirmed = true;
				clearInterval(tryMsg);
				window.removeEventListener("message", onConfirm);
			}
		};
		window.addEventListener("message", onConfirm);

		const tryMsg = setInterval(() => {
			attempts++;
			if (confirmed || attempts >= 6) {
				clearInterval(tryMsg);
				window.removeEventListener("message", onConfirm);
				return;
			}
			try {
				prizeWin.postMessage({ type: "LEAGUE_PLAYERS", players, title: leagueTitle }, "*");
			} catch (e) {}
		}, 500);
	}
}

function openTiebreaker() {
	resetTiebreaker();
	document.getElementById("tiebreakerModal").classList.add("active");
	// 모바일: 버튼 위치로 스크롤
	if (window.innerWidth <= 600) {
		const btn = document.querySelector('button[onclick="openTiebreaker()"]');
		if (btn) setTimeout(() => btn.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
	}
}
function closeTiebreaker() {
	document.getElementById("tiebreakerModal").classList.remove("active");
}
function resetTiebreaker() {
	tbData = { players: [], results: {}, targetWins: 2 };
	document.getElementById("tbPlayerCount").value = 3;
	document.querySelector('input[name="tbRule"][value="2"]').checked = true;
	document.getElementById("tbStep1").classList.remove("hidden");
	document.getElementById("tbStep2").classList.add("hidden");
}

function initTiebreaker() {
	const n = parseInt(document.getElementById("tbPlayerCount").value) || 3;
	if (n < 2 || n > 10) {
		alert("2~10명 사이로 입력해주세요.");
		return;
	}
	tbData.targetWins = parseInt(document.querySelector('input[name="tbRule"]:checked').value);
	tbData.players = Array.from({ length: n }, (_, i) => ({ name: "", grade: 9999, id: i }));
	tbData.results = {};

	document.getElementById("tbStep1").classList.add("hidden");
	document.getElementById("tbStep2").classList.remove("hidden");
	renderTbMatrix();
	renderTbStandings();
}

function parseTbName(raw) {
	const nm = raw.match(/^[^\d]+/);
	const gm = raw.match(/\d+/);
	const name = nm ? nm[0].trim() : raw.trim();
	const grade = gm ? parseInt(gm[0]) : 9999;
	return { name, grade };
}

function renderTbMatrix() {
	const players = tbData.players;
	const n = players.length;
	const tw = tbData.targetWins;
	const scoreOpts = [["선택", ""]];
	for (let w = tw; w >= 0; w--) {
		for (let l = tw; l >= 0; l--) {
			if (w === tw && l < tw) scoreOpts.push([`${w}:${l}`, `${w}:${l}`]);
			else if (l === tw && w < tw) scoreOpts.push([`${w}:${l}`, `${w}:${l}`]);
		}
	}

	// 헤더: 이름(부수)로 수정
	document.getElementById("tbHead").innerHTML =
		`<tr><th>이름(부수)</th>${players.map((p, i) => `<th>${p.name || "P" + (i + 1)}</th>`).join("")}</tr>`;

	// 바디 (승일 경우 셀 배경 연두색)
	document.getElementById("tbBody").innerHTML = players
		.map((p, r) => {
			const nameCell = `<td><input type="text" value="${p.name ? (p.grade !== 9999 ? p.name + p.grade : p.name) : ""}"
      placeholder="홍길동2" style="width:90px;border:1.5px solid var(--border);border-radius:5px;padding:4px 6px;font-size:0.82rem;font-family:inherit;outline:none;"
      oninput="tbUpdateName(${r},this.value)"></td>`;
			const cells = players
				.map((_, c) => {
					if (r === c) return `<td style="background:var(--surface2);">-</td>`;
					const key = `${r}_${c}`;
					const val = tbData.results[key] || "";
					const isWin = val
						? (() => {
								const [s1, s2] = val.split(":").map(Number);
								return s1 > s2;
							})()
						: false;
					const winBg = isWin ? "background:var(--success-light);" : "";
					const opts = scoreOpts.map(([label, v]) => `<option value="${v}" ${val === v ? "selected" : ""}>${label}</option>`).join("");
					return `<td style="${winBg}"><select class="matrix-select" style="min-width:58px;"
        onchange="tbUpdateScore(${r},${c},this.value)">${opts}</select></td>`;
				})
				.join("");
			return `<tr>${nameCell}${cells}</tr>`;
		})
		.join("");
}

function tbUpdateName(idx, raw) {
	const { name, grade } = parseTbName(raw);
	tbData.players[idx].name = name;
	tbData.players[idx].grade = grade;
	// 헤더 컬럼명 업데이트
	const ths = document.querySelectorAll("#tbHead th");
	if (ths[idx + 1]) ths[idx + 1].textContent = name || `P${idx + 1}`;
	renderTbStandings();
}

function tbUpdateScore(r, c, val) {
	if (!val) {
		delete tbData.results[`${r}_${c}`];
		delete tbData.results[`${c}_${r}`];
	} else {
		const [s1, s2] = val.split(":").map(Number);
		tbData.results[`${r}_${c}`] = val;
		tbData.results[`${c}_${r}`] = `${s2}:${s1}`;
		// 상대 select 자동 반영 + 배경색 업데이트
		const oppSelect = document.querySelector(`#tbBody tr:nth-child(${c + 1}) td:nth-child(${r + 2}) select`);
		if (oppSelect) {
			oppSelect.value = `${s2}:${s1}`;
			const oppTd = oppSelect.closest("td");
			if (oppTd) oppTd.style.background = s2 > s1 ? "var(--success-light)" : "";
		}
		// 내 셀 배경색
		const myTd = document.querySelector(`#tbBody tr:nth-child(${r + 1}) td:nth-child(${c + 2})`);
		if (myTd) myTd.style.background = s1 > s2 ? "var(--success-light)" : "";
	}
	renderTbStandings();
}

function renderTbStandings() {
	const players = tbData.players;
	const n = players.length;

	// 기본 스탯 계산
	let stats = players.map((p, i) => {
		let w = 0,
			l = 0,
			sW = 0,
			sL = 0,
			pts = 0;
		players.forEach((_, j) => {
			if (i === j) return;
			const val = tbData.results[`${i}_${j}`];
			if (!val) return;
			const [s1, s2] = val.split(":").map(Number);
			sW += s1;
			sL += s2;
			if (s1 > s2) {
				w++;
				pts += 2;
			} else {
				l++;
				pts += 1;
			}
		});
		return { idx: i, name: p.name || `P${i + 1}`, grade: p.grade, w, l, sW, sL, diff: sW - sL, pts };
	});

	// 1차 정렬: 승점
	stats.sort((a, b) => b.pts - a.pts);

	// 동률 처리: h2hW → h2hDiff → diff → grade
	function resolveTb(group) {
		if (group.length <= 1) return group;
		const enriched = group.map((p) => {
			let h2hW = 0,
				h2hSW = 0,
				h2hSL = 0;
			group.forEach((o) => {
				if (p.idx === o.idx) return;
				const val = tbData.results[`${p.idx}_${o.idx}`];
				if (!val) return;
				const [s1, s2] = val.split(":").map(Number);
				h2hSW += s1;
				h2hSL += s2;
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
	let ranked = [...stats],
		gi = 0;
	while (gi < ranked.length) {
		let j = gi + 1;
		while (j < ranked.length && ranked[j].pts === ranked[gi].pts) j++;
		if (j - gi > 1) {
			const resolved = resolveTb(ranked.slice(gi, j));
			resolved.forEach((p, k) => {
				ranked[gi + k] = p;
			});
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
		if (idx === 0) {
			p.rank = cr;
		} else {
			const prev = ranked[idx - 1];
			const samePts = p.pts === prev.pts;
			const h2hSame =
				p.h2hW !== undefined && prev.h2hW !== undefined
					? p.h2hW === prev.h2hW && p.h2hDiff === prev.h2hDiff && p.diff === prev.diff && p.grade === prev.grade
					: false;
			if (samePts && h2hSame) {
				p.rank = prev.rank;
				if (allFilled) p.needsAge = prev.needsAge = true;
			} else {
				cr = idx + 1;
				p.rank = cr;
			}
		}
	});

	// 어떤 기준으로 구분됐는지 파악 (rule highlight)
	// 같은 pts 그룹 내 어느 기준이 실제로 순위를 가름했는지 판단
	let activeRule = null; // 'h2h' | 'diff' | 'grade' | null
	// 모든 선수가 같은 pts 그룹인지
	const allSamePts = ranked.every((p) => p.pts === ranked[0].pts);
	if (allSamePts && ranked.length > 1) {
		// h2hW로 구분됐는지
		const h2hWVals = ranked.map((p) => p.h2hW ?? 0);
		if (h2hWVals.some((v, i) => i > 0 && v !== h2hWVals[0])) {
			activeRule = "h2h";
		} else {
			const diffVals = ranked.map((p) => p.h2hDiff ?? 0);
			if (diffVals.some((v, i) => i > 0 && v !== diffVals[0])) {
				activeRule = "diff";
			} else {
				const gradeVals = ranked.map((p) => p.grade);
				if (gradeVals.some((v, i) => i > 0 && v !== gradeVals[0])) {
					activeRule = "grade";
				} else {
					activeRule = "age";
				}
			}
		}
	} else if (ranked.length > 1) {
		// 서로 다른 pts지만 일부 동률 그룹 내 구분 기준 파악 — 가장 처음 동률 그룹 기준
		for (let i = 0; i < ranked.length - 1; i++) {
			if (ranked[i].pts === ranked[i + 1].pts) {
				const a = ranked[i],
					b = ranked[i + 1];
				if ((a.h2hW ?? 0) !== (b.h2hW ?? 0)) {
					activeRule = "h2h";
					break;
				}
				if ((a.h2hDiff ?? 0) !== (b.h2hDiff ?? 0)) {
					activeRule = "diff";
					break;
				}
				if (a.diff !== b.diff) {
					activeRule = "diff";
					break;
				}
				if (a.grade !== b.grade) {
					activeRule = "grade";
					break;
				}
				activeRule = "age";
				break;
			}
		}
	}

	// 룰 텍스트 강조 업데이트
	const ruleIds = { h2h: "tb-rule-h2h", diff: "tb-rule-diff", grade: "tb-rule-grade", age: "tb-rule-age" };
	Object.entries(ruleIds).forEach(([key, elId]) => {
		const el = document.getElementById(elId);
		if (!el) return;
		if (key === activeRule) {
			el.style.cssText = "color:#ea580c;font-weight:900;font-size:1.05em;";
		} else {
			el.style.cssText = "";
		}
	});

	const tbody = document.querySelector("#tbStandings tbody");
	const needsAgeSet = new Set(ranked.filter((p) => p.needsAge).map((p) => p.idx));
	const ageBg = "#fff7ed";

	tbody.innerHTML = ranked
		.map((s) => {
			const diffColor = s.diff > 0 ? "var(--success)" : s.diff < 0 ? "var(--danger)" : "var(--text3)";
			const rowBg = s.needsAge ? `background:${ageBg};` : "";
			return `<tr style="${rowBg}">
      <td style="font-weight:700;">${s.name}${s.grade !== 9999 ? `(${s.grade})` : ""}</td>
      <td>${s.w} / ${s.l}</td>
      <td style="font-weight:700;color:${diffColor};">${s.diff > 0 ? "+" : ""}${s.diff}</td>
      <td style="font-weight:800;color:var(--primary);">${s.rank}위</td>
    </tr>`;
		})
		.join("");

	// 연장자 필요 메시지
	const existingMsg = document.getElementById("tbAgeMsg");
	if (existingMsg) existingMsg.remove();
	if (ranked.some((p) => p.needsAge)) {
		const msg = document.createElement("div");
		msg.id = "tbAgeMsg";
		msg.style.cssText =
			"margin-top:8px;padding:8px 12px;background:#fff7ed;border:1.5px solid #f59e0b;border-radius:8px;font-size:0.8rem;font-weight:700;color:#92400e;text-align:center;";
		msg.textContent = "⚠️ 연장자 순으로 나이 확인이 필요합니다";
		document.querySelector("#tbStandings").closest(".table-wrap").after(msg);
	}
}
