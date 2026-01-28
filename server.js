const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'league_data.json');

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 데이터 파일 초기화
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify({}));
        console.log('✅ league_data.json 파일 생성됨');
    }
}

// 에러 핸들러
function handleError(res, error, message = '서버 오류가 발생했습니다') {
    console.error('Error:', error);
    res.status(500).json({ 
        success: false, 
        message,
        error: error.message 
    });
}

// ============================================
// API 엔드포인트
// ============================================

/**
 * GET /api/leagues
 * 모든 대회 데이터 조회
 */
app.get('/api/leagues', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const leagues = JSON.parse(data);
        res.json({ 
            success: true, 
            data: leagues,
            count: Object.keys(leagues).length
        });
    } catch (error) {
        handleError(res, error, '대회 데이터를 불러오는데 실패했습니다');
    }
});

/**
 * GET /api/leagues/:id
 * 특정 대회 데이터 조회
 */
app.get('/api/leagues/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const leagues = JSON.parse(data);
        const league = leagues[req.params.id];
        
        if (!league) {
            return res.status(404).json({ 
                success: false, 
                message: '해당 대회를 찾을 수 없습니다' 
            });
        }
        
        res.json({ 
            success: true, 
            data: league 
        });
    } catch (error) {
        handleError(res, error, '대회 데이터를 불러오는데 실패했습니다');
    }
});

/**
 * POST /api/leagues
 * 새 대회 생성
 */
app.post('/api/leagues', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const leagues = JSON.parse(data);
        
        const newLeague = req.body;
        if (!newLeague.id) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID가 필요합니다' 
            });
        }
        
        leagues[newLeague.id] = newLeague;
        await fs.writeFile(DATA_FILE, JSON.stringify(leagues, null, 2));
        
        res.json({ 
            success: true, 
            message: '대회가 생성되었습니다',
            data: newLeague 
        });
    } catch (error) {
        handleError(res, error, '대회 생성에 실패했습니다');
    }
});

/**
 * PUT /api/leagues/:id
 * 대회 데이터 수정
 */
app.put('/api/leagues/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const leagues = JSON.parse(data);
        
        if (!leagues[req.params.id]) {
            return res.status(404).json({ 
                success: false, 
                message: '해당 대회를 찾을 수 없습니다' 
            });
        }
        
        leagues[req.params.id] = req.body;
        await fs.writeFile(DATA_FILE, JSON.stringify(leagues, null, 2));
        
        res.json({ 
            success: true, 
            message: '대회가 수정되었습니다',
            data: req.body 
        });
    } catch (error) {
        handleError(res, error, '대회 수정에 실패했습니다');
    }
});

/**
 * DELETE /api/leagues/:id
 * 대회 삭제
 */
app.delete('/api/leagues/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const leagues = JSON.parse(data);
        
        if (!leagues[req.params.id]) {
            return res.status(404).json({ 
                success: false, 
                message: '해당 대회를 찾을 수 없습니다' 
            });
        }
        
        delete leagues[req.params.id];
        await fs.writeFile(DATA_FILE, JSON.stringify(leagues, null, 2));
        
        res.json({ 
            success: true, 
            message: '대회가 삭제되었습니다' 
        });
    } catch (error) {
        handleError(res, error, '대회 삭제에 실패했습니다');
    }
});

/**
 * POST /api/backup
 * 데이터 백업
 */
app.post('/api/backup', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const backupFile = path.join(__dirname, `league_backup_${timestamp}.json`);
        
        await fs.writeFile(backupFile, data);
        
        res.json({ 
            success: true, 
            message: '백업이 완료되었습니다',
            filename: `league_backup_${timestamp}.json`
        });
    } catch (error) {
        handleError(res, error, '백업에 실패했습니다');
    }
});

/**
 * GET /api/export
 * JSON 파일 다운로드
 */
app.get('/api/export', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=league_data.json');
        res.send(data);
    } catch (error) {
        handleError(res, error, '내보내기에 실패했습니다');
    }
});

/**
 * POST /api/import
 * JSON 파일 가져오기
 */
app.post('/api/import', async (req, res) => {
    try {
        const importedData = req.body;
        
        if (typeof importedData !== 'object') {
            return res.status(400).json({ 
                success: false, 
                message: '올바른 JSON 형식이 아닙니다' 
            });
        }
        
        await fs.writeFile(DATA_FILE, JSON.stringify(importedData, null, 2));
        
        res.json({ 
            success: true, 
            message: '데이터를 성공적으로 가져왔습니다',
            count: Object.keys(importedData).length
        });
    } catch (error) {
        handleError(res, error, '가져오기에 실패했습니다');
    }
});

// 서버 시작
initializeDataFile().then(() => {
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════╗
║   🏓 탁구 리그 관리 시스템 서버 구동중    ║
╠════════════════════════════════════════════╣
║   포트: ${PORT}                              ║
║   URL: http://localhost:${PORT}             ║
║   데이터 파일: league_data.json            ║
╚════════════════════════════════════════════╝
        `);
    });
});

// 우아한 종료
process.on('SIGTERM', () => {
    console.log('서버를 종료합니다...');
    process.exit(0);
});
