# 🏓 탁구 리그 관리 시스템

JSON 파일 기반 데이터 저장 및 AJAX 통신을 활용한 리그 관리 시스템입니다.

## 📋 주요 기능

- ✅ **JSON 파일 기반 데이터 저장** - 서버의 `league_data.json` 파일에 모든 데이터 저장
- ✅ **AJAX 통신** - 비동기 방식으로 서버와 통신하여 부드러운 사용자 경험
- ✅ **RESTful API** - GET, POST, PUT, DELETE 방식의 표준 API
- ✅ **반응형 디자인** - 모바일, 태블릿, 데스크톱 모든 환경 지원
- ✅ **데이터 백업/복원** - JSON 파일 내보내기/가져오기 기능
- ✅ **실시간 서버 상태 표시** - 서버 연결 상태를 시각적으로 표시
- ✅ **토스트 알림** - 사용자 친화적인 알림 메시지

## 🚀 설치 방법

### 1. 필수 요구사항
- Node.js (v14 이상)
- npm 또는 yarn

### 2. 의존성 설치

```bash
npm install
```

또는

```bash
yarn install
```

## 💻 실행 방법

### 1. 서버 시작

```bash
npm start
```

또는 개발 모드 (자동 재시작):

```bash
npm run dev
```

### 2. 브라우저에서 접속

```
http://localhost:3000
```

## 📁 프로젝트 구조

```
league-management-system/
├── server.js              # Express 백엔드 서버
├── package.json           # 프로젝트 의존성 및 스크립트
├── league_data.json       # 데이터 저장 파일 (자동 생성)
├── public/
│   └── index.html         # 프론트엔드 HTML/CSS/JS
└── README.md             # 프로젝트 설명서
```

## 🔌 API 엔드포인트

### 대회 관리

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/leagues` | 모든 대회 조회 |
| GET | `/api/leagues/:id` | 특정 대회 조회 |
| POST | `/api/leagues` | 새 대회 생성 |
| PUT | `/api/leagues/:id` | 대회 정보 수정 |
| DELETE | `/api/leagues/:id` | 대회 삭제 |

### 백업 및 내보내기

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/backup` | 데이터 백업 파일 생성 |
| GET | `/api/export` | JSON 파일 다운로드 |
| POST | `/api/import` | JSON 파일 가져오기 |

## 📱 사용 방법

### 1. 새 대회 생성
1. 날짜, 대회명, 조 개수, 조별 인원, 방식 설정
2. "1단계: 이름 입력창 생성" 클릭
3. 각 조의 선수 이름 입력
4. "2단계: 전체 조 매트릭스 생성" 클릭

### 2. 경기 결과 입력
- 매트릭스 테이블에서 각 경기의 결과 선택
- 자동으로 순위표가 업데이트됨

### 3. 데이터 저장
- "💾 서버에 저장" 버튼 클릭
- 데이터가 `league_data.json` 파일에 저장됨

### 4. 과거 대회 불러오기
- "지난 대회 리스트 보기" 클릭
- 원하는 대회의 "불러오기" 버튼 클릭

### 5. 데이터 백업
- "📥 내보내기" 버튼으로 JSON 파일 다운로드
- "📤 가져오기" 버튼으로 백업 파일 복원

## 🛠️ 기술 스택

### 백엔드
- **Node.js** - JavaScript 런타임
- **Express** - 웹 프레임워크
- **CORS** - 교차 출처 리소스 공유
- **File System (fs)** - JSON 파일 읽기/쓰기

### 프론트엔드
- **Vanilla JavaScript** - 순수 자바스크립트
- **AJAX (Fetch API)** - 비동기 HTTP 통신
- **HTML5 & CSS3** - 반응형 UI
- **Flexbox & Grid** - 레이아웃

## ⚙️ 환경 설정

### 포트 변경
`server.js` 파일에서 포트 번호 수정:

```javascript
const PORT = 3000; // 원하는 포트 번호로 변경
```

### CORS 설정
필요시 `server.js`에서 CORS 옵션 설정:

```javascript
app.use(cors({
    origin: 'https://yourdomain.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
```

## 🐛 문제 해결

### 서버가 시작되지 않을 때
```bash
# 포트가 이미 사용 중인 경우
lsof -ti:3000 | xargs kill -9

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### 데이터가 저장되지 않을 때
- `league_data.json` 파일에 쓰기 권한이 있는지 확인
- 서버 콘솔에서 에러 메시지 확인
- 브라우저 개발자 도구(F12)에서 네트워크 탭 확인

### 서버 연결 실패 시
- 서버가 실행 중인지 확인
- 방화벽 설정 확인
- `http://localhost:3000/api/leagues`에 직접 접속하여 API 응답 확인

## 📈 향후 개선 사항

- [ ] 사용자 인증 시스템
- [ ] 데이터베이스 연동 (MongoDB, PostgreSQL)
- [ ] 실시간 업데이트 (WebSocket)
- [ ] 통계 및 차트 기능
- [ ] PDF 리포트 생성
- [ ] 이메일 알림 기능
- [ ] 모바일 앱 (React Native)

## 📄 라이선스

MIT License

## 👥 기여

이슈 및 Pull Request는 언제나 환영합니다!

## 📞 문의

문제가 있거나 제안사항이 있으시면 이슈를 등록해주세요.
