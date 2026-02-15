export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // API: Save scores to D1
        if (path === '/api/scores' && request.method === 'POST') {
            try {
                const scores = await request.json();
                
                if (env.DB) {
                    await env.DB.prepare(
                        'INSERT INTO connect4_scores (player1_wins, player2_wins, draws, played_at) VALUES (?, ?, ?, datetime("now"))'
                    ).bind(scores.p1 || 0, scores.p2 || 0, scores.draw || 0).run();
                    
                    return new Response(JSON.stringify({ success: true, saved: true }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    return new Response(JSON.stringify({ success: true, saved: false, note: 'D1 not configured' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500 });
            }
        }
        
        // API: Get leaderboard
        if (path === '/api/leaderboard' && request.method === 'GET') {
            try {
                if (env.DB) {
                    const stats = await env.DB.prepare(
                        'SELECT SUM(player1_wins) as p1_total, SUM(player2_wins) as p2_total, SUM(draws) as draws_total, COUNT(*) as games FROM connect4_scores'
                    ).first();
                    
                    return new Response(JSON.stringify(stats || { p1_total: 0, p2_total: 0, draws_total: 0, games: 0 }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    return new Response(JSON.stringify({ p1_total: 0, p2_total: 0, draws_total: 0, games: 0 }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500 });
            }
        }
        
        // Serve the game HTML
        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Puissance 4 - Clawd Games</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg-primary: #0f0f1a;
            --bg-secondary: #1a1a2e;
            --accent: #00d4ff;
            --danger: #ff6b6b;
            --success: #00ff88;
            --warning: #ffd700;
        }
        body {
            font-family: 'Inter', system-ui, sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #fff;
            padding: 20px;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(90deg, var(--danger), var(--warning));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle { color: #888; margin-bottom: 20px; }
        .game-info {
            display: flex;
            gap: 30px;
            margin-bottom: 20px;
            align-items: center;
        }
        .player {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 20px;
            border-radius: 10px;
            background: rgba(255,255,255,0.05);
            border: 2px solid transparent;
            transition: all 0.3s;
        }
        .player.active {
            border-color: var(--accent);
            box-shadow: 0 0 20px rgba(0,212,255,0.3);
        }
        .player-disc {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            box-shadow: 0 0 10px currentColor;
        }
        .player1 { color: var(--danger); }
        .player2 { color: var(--warning); }
        .player1 .player-disc { background: var(--danger); }
        .player2 .player-disc { background: var(--warning); }
        
        .board-container {
            background: linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%);
            padding: 15px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .board {
            display: grid;
            grid-template-columns: repeat(7, 60px);
            grid-template-rows: repeat(6, 60px);
            gap: 8px;
        }
        .cell {
            background: rgba(0,0,0,0.3);
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
        }
        .cell:hover:not(.taken) {
            background: rgba(255,255,255,0.1);
            transform: scale(1.05);
        }
        .cell.taken { cursor: default; }
        .disc {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            animation: drop 0.5s ease-out;
            box-shadow: inset -5px -5px 10px rgba(0,0,0,0.3), 0 0 20px currentColor;
        }
        .disc.p1 { background: radial-gradient(circle at 30% 30%, #ff8a8a, var(--danger)); color: var(--danger); }
        .disc.p2 { background: radial-gradient(circle at 30% 30%, #ffe066, var(--warning)); color: var(--warning); }
        .disc.winner { animation: pulse-winner 1s infinite; }
        
        @keyframes drop {
            0% { transform: translateY(-300px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse-winner {
            0%, 100% { transform: scale(1); box-shadow: 0 0 20px currentColor; }
            50% { transform: scale(1.1); box-shadow: 0 0 40px currentColor; }
        }
        
        .message {
            font-size: 1.5rem;
            margin: 20px 0;
            min-height: 40px;
            text-align: center;
        }
        .message.win { color: var(--success); }
        .btn {
            padding: 15px 40px;
            background: linear-gradient(135deg, var(--accent) 0%, #7b68ee 100%);
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin: 5px;
        }
        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(0,212,255,0.3);
        }
        .scores {
            display: flex;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
            justify-content: center;
        }
        .score-card {
            background: rgba(255,255,255,0.05);
            padding: 15px 25px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .score-value {
            font-size: 2rem;
            font-weight: 700;
        }
        .score-label {
            font-size: 0.85rem;
            color: #888;
            margin-top: 5px;
        }
        .score-p1 { color: var(--danger); }
        .score-p2 { color: var(--warning); }
        .total-stats {
            margin-top: 20px;
            padding: 15px;
            background: rgba(0,255,136,0.1);
            border: 1px solid rgba(0,255,136,0.3);
            border-radius: 10px;
            text-align: center;
        }
        .total-stats h3 {
            color: var(--success);
            margin-bottom: 10px;
        }
        
        @media (max-width: 500px) {
            .board { grid-template-columns: repeat(7, 40px); grid-template-rows: repeat(6, 40px); gap: 5px; }
            h1 { font-size: 1.8rem; }
            .game-info { flex-direction: column; gap: 10px; }
        }
    </style>
</head>
<body>
    <h1>🔴 Puissance 4 🟡</h1>
    <p class="subtitle">Aligne 4 pions pour gagner !</p>
    
    <div class="game-info">
        <div class="player player1 active" id="player1">
            <div class="player-disc"></div>
            <span>Joueur 1</span>
        </div>
        <div class="player player2" id="player2">
            <div class="player-disc"></div>
            <span>Joueur 2</span>
        </div>
    </div>
    
    <div class="board-container">
        <div class="board" id="board"></div>
    </div>
    
    <div class="message" id="message"></div>
    
    <div>
        <button class="btn" onclick="resetGame()">🔄 Nouvelle Partie</button>
        <button class="btn" onclick="saveScore()">💾 Sauvegarder Score</button>
    </div>
    
    <div class="scores" id="scores">
        <div class="score-card">
            <div class="score-value score-p1" id="scoreP1">0</div>
            <div class="score-label">Victoires J1</div>
        </div>
        <div class="score-card">
            <div class="score-value" id="scoreDraw">0</div>
            <div class="score-label">Matchs Nuls</div>
        </div>
        <div class="score-card">
            <div class="score-value score-p2" id="scoreP2">0</div>
            <div class="score-label">Victoires J2</div>
        </div>
    </div>
    
    <div class="total-stats" id="totalStats" style="display: none;">
        <h3>📊 Stats globales (D1)</h3>
        <p id="globalStats">Chargement...</p>
    </div>

    <script>
        const ROWS = 6;
        const COLS = 7;
        let board = [];
        let currentPlayer = 1;
        let gameActive = true;
        let sessionScores = { p1: 0, p2: 0, draw: 0 };
        
        function initBoard() {
            const boardEl = document.getElementById('board');
            boardEl.innerHTML = '';
            board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
            
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    cell.onclick = () => dropDisc(c);
                    boardEl.appendChild(cell);
                }
            }
        }
        
        function dropDisc(col) {
            if (!gameActive) return;
            
            for (let row = ROWS - 1; row >= 0; row--) {
                if (board[row][col] === 0) {
                    board[row][col] = currentPlayer;
                    renderDisc(row, col);
                    
                    if (checkWin(row, col)) {
                        endGame(currentPlayer);
                    } else if (checkDraw()) {
                        endGame(0);
                    } else {
                        switchPlayer();
                    }
                    return;
                }
            }
        }
        
        function renderDisc(row, col) {
            const cells = document.querySelectorAll('.cell');
            const index = row * COLS + col;
            const cell = cells[index];
            
            const disc = document.createElement('div');
            disc.className = 'disc p' + currentPlayer;
            cell.appendChild(disc);
            cell.classList.add('taken');
        }
        
        function switchPlayer() {
            currentPlayer = currentPlayer === 1 ? 2 : 1;
            document.getElementById('player1').classList.toggle('active');
            document.getElementById('player2').classList.toggle('active');
        }
        
        function checkWin(row, col) {
            const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
            
            for (const [dr, dc] of directions) {
                let count = 1;
                let winningCells = [[row, col]];
                
                for (let i = 1; i < 4; i++) {
                    const r = row + dr * i;
                    const c = col + dc * i;
                    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === currentPlayer) {
                        count++;
                        winningCells.push([r, c]);
                    } else break;
                }
                
                for (let i = 1; i < 4; i++) {
                    const r = row - dr * i;
                    const c = col - dc * i;
                    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === currentPlayer) {
                        count++;
                        winningCells.push([r, c]);
                    } else break;
                }
                
                if (count >= 4) {
                    highlightWinners(winningCells);
                    return true;
                }
            }
            return false;
        }
        
        function highlightWinners(cells) {
            const boardCells = document.querySelectorAll('.cell');
            cells.forEach(([r, c]) => {
                const index = r * COLS + c;
                const disc = boardCells[index].querySelector('.disc');
                if (disc) disc.classList.add('winner');
            });
        }
        
        function checkDraw() {
            return board[0].every(cell => cell !== 0);
        }
        
        function endGame(winner) {
            gameActive = false;
            const message = document.getElementById('message');
            
            if (winner === 1) {
                message.innerHTML = '🎉 Joueur 🔴 a gagné !';
                message.className = 'message win';
                sessionScores.p1++;
                document.getElementById('scoreP1').textContent = sessionScores.p1;
            } else if (winner === 2) {
                message.innerHTML = '🎉 Joueur 🟡 a gagné !';
                message.className = 'message win';
                sessionScores.p2++;
                document.getElementById('scoreP2').textContent = sessionScores.p2;
            } else {
                message.innerHTML = '🤝 Match nul !';
                message.className = 'message';
                sessionScores.draw++;
                document.getElementById('scoreDraw').textContent = sessionScores.draw;
            }
        }
        
        function resetGame() {
            gameActive = true;
            currentPlayer = 1;
            document.getElementById('message').textContent = '';
            document.getElementById('message').className = 'message';
            document.getElementById('player1').classList.add('active');
            document.getElementById('player2').classList.remove('active');
            initBoard();
        }
        
        async function saveScore() {
            try {
                const response = await fetch('/api/scores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionScores)
                });
                if (response.ok) {
                    const data = await response.json();
                    alert(data.saved ? 'Scores sauvegardés en D1 !' : 'Scores sauvegardés (mode session)');
                    loadGlobalStats();
                } else {
                    alert('Erreur sauvegarde');
                }
            } catch (err) {
                alert('Mode hors ligne - scores en session uniquement');
            }
        }
        
        async function loadGlobalStats() {
            try {
                const response = await fetch('/api/leaderboard');
                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('totalStats').style.display = 'block';
                    document.getElementById('globalStats').innerHTML = 
                        '🔴 ' + (data.p1_total || 0) + ' victoires J1 | ' +
                        '🟡 ' + (data.p2_total || 0) + ' victoires J2 | ' +
                        '🤝 ' + (data.draws_total || 0) + ' nuls | ' +
                        '🎮 ' + (data.games || 0) + ' parties';
                }
            } catch (err) {
                console.log('Stats non disponibles');
            }
        }
        
        // Init
        initBoard();
        loadGlobalStats();
    </script>
</body>
</html>`;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
};
