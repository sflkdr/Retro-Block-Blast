document.addEventListener('DOMContentLoaded', () => {
    // --- Game constants and setup ---
    const canvas = document.getElementById('gameCanvas');
    const nextPieceCanvas = document.getElementById('nextPieceCanvas');
    const ctx = canvas.getContext('2d');
    const nextCtx = nextPieceCanvas.getContext('2d');
    const scoreSpan = document.getElementById('score');
    const highScoreSpan = document.getElementById('highScore');
    const levelSpan = document.getElementById('level');
    const startButton = document.getElementById('startButton');
    const pauseButton = document.getElementById('pauseButton');
    const newGameButton = document.getElementById('newGameButton');
    const gameOverModal = document.getElementById('gameOverModal');
    const finalScoreSpan = document.getElementById('finalScore');
    const modalHighScoreSpan = document.getElementById('modalHighScore');
    const restartButton = document.getElementById('restartButton');
    const touchControls = document.querySelector('.controls-touch');
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const downBtn = document.getElementById('downBtn');
    const rotateBtn = document.getElementById('rotateBtn');
    const hardDropBtn = document.getElementById('hardDropBtn');

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;

    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    nextPieceCanvas.width = 4 * BLOCK_SIZE;
    nextPieceCanvas.height = 4 * BLOCK_SIZE;

    // New retro color palette
    const COLORS = [
        '#000',          // Empty
        '#00ffff',       // I - Cyan
        '#ffff00',       // O - Yellow
        '#ff00ff',       // T - Magenta
        '#00ff00',       // S - Green
        '#ff0000',       // Z - Red
        '#0000ff',       // J - Blue
        '#ff8800'        // L - Orange
    ];

    const SHAPES = [
        // I shape
        [[1, 1, 1, 1]],
        // O shape
        [[1, 1], [1, 1]],
        // T shape
        [[0, 1, 0], [1, 1, 1]],
        // S shape
        [[0, 1, 1], [1, 1, 0]],
        // Z shape
        [[1, 1, 0], [0, 1, 1]],
        // J shape
        [[1, 0, 0], [1, 1, 1]],
        // L shape
        [[0, 0, 1], [1, 1, 1]]
    ];

    // --- Game state variables ---
    let board;
    let currentPiece;
    let nextPiece;
    let currentPieceX, currentPieceY;
    let score;
    let highScore = 0;
    let level;
    let dropCounter;
    let dropInterval;
    let lastTime;
    let isPlaying = false;
    let isPaused = false;
    let suggestion = null;

    // --- Sound effects using Web Audio API ---
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(frequency, duration, type = 'sine') {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    }

    function playClearSound() {
        playSound(440, 0.1, 'triangle');
        setTimeout(() => playSound(523, 0.1, 'triangle'), 50);
    }

    function playDropSound() {
        playSound(120, 0.05, 'sawtooth');
    }

    function playGameOverSound() {
        playSound(80, 0.5, 'square');
    }


    // --- Core game functions ---

    // Create an empty board filled with 0s
    function createBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    // Draw a single block
    function drawBlock(context, x, y, colorId, alpha = 1) {
        if (colorId === 0) {
            // Clear the block if it's empty
            context.clearRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            return;
        }

        const color = COLORS[colorId];

        // Draw the inner part of the block
        context.fillStyle = color;
        context.globalAlpha = 0.8 * alpha;
        context.fillRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);

        // Draw a slight pixel effect border
        context.globalAlpha = 0.4 * alpha;
        context.fillStyle = '#fff';
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, 2);
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, 2, BLOCK_SIZE);
        context.globalAlpha = 1;

        // Draw the glowing border
        context.shadowColor = color;
        context.shadowBlur = 10;
        context.globalAlpha = 1;
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

        context.shadowBlur = 0;
        context.shadowColor = 'transparent';
    }

    // Draw the entire board
    function drawBoard() {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                drawBlock(ctx, x, y, board[y][x]);
            }
        }
    }

    // Draw a piece
    function drawPiece(piece, offsetX, offsetY, context, alpha = 1) {
        if (!piece) return;
        const blockScale = (context === ctx) ? 1 : 0.5;
        const blockSize = BLOCK_SIZE * blockScale;

        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const color = COLORS[piece.colorId];

                    // Draw the inner part of the block
                    context.fillStyle = color;
                    context.globalAlpha = 0.8 * alpha;
                    context.fillRect(
                        (offsetX + x) * blockSize + 2 * blockScale,
                        (offsetY + y) * blockSize + 2 * blockScale,
                        blockSize - 4 * blockScale,
                        blockSize - 4 * blockScale
                    );

                    // Draw a slight pixel effect border
                    context.globalAlpha = 0.4 * alpha;
                    context.fillStyle = '#fff';
                    context.fillRect(
                        (offsetX + x) * blockSize,
                        (offsetY + y) * blockSize,
                        blockSize,
                        2 * blockScale
                    );
                    context.fillRect(
                        (offsetX + x) * blockSize,
                        (offsetY + y) * blockSize,
                        2 * blockScale,
                        blockSize
                    );
                    context.globalAlpha = 1;

                    // Draw the glowing border
                    context.shadowColor = color;
                    context.shadowBlur = 10 * blockScale;
                    context.globalAlpha = 1;
                    context.strokeStyle = color;
                    context.lineWidth = 1 * blockScale;
                    context.strokeRect(
                        (offsetX + x) * blockSize,
                        (offsetY + y) * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            }
        }
        context.shadowBlur = 0;
        context.shadowColor = 'transparent';
    }


    // Check for collision
    function checkCollision() {
        if (!currentPiece) return false;
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x]) {
                    const boardX = currentPieceX + x;
                    const boardY = currentPieceY + y;
                    if (
                        boardX < 0 || boardX >= COLS ||
                        boardY >= ROWS ||
                        (boardY >= 0 && board[boardY][boardX] !== 0)
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Hard drop the piece
    function hardDrop() {
        if (!isPlaying || isPaused) return;
        while (!checkCollision()) {
            currentPieceY++;
        }
        currentPieceY--;
        mergePiece();
        clearLines();
        spawnNewPiece();
        playDropSound();
    }

    // Merge piece into the board
    function mergePiece() {
        if (!currentPiece) return;
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x]) {
                    board[currentPieceY + y][currentPieceX + x] = currentPiece.colorId;
                }
            }
        }
        playDropSound();
    }

    // Rotate a piece
    function rotatePiece() {
        if (!isPlaying || isPaused) return;
        const oldShape = currentPiece.shape;

        // Transpose the matrix
        let newShape = oldShape[0].map((_, colIndex) =>
            oldShape.map(row => row[colIndex])
        );
        // Reverse the rows to get a clockwise rotation
        newShape = newShape.map(row => row.reverse());

        currentPiece.shape = newShape;
        if (checkCollision()) {
            currentPiece.shape = oldShape; // Revert if collision occurs
        }
    }

    // Clear full lines
    function clearLines() {
        let linesCleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(cell => cell !== 0)) {
                // Remove the full line
                board.splice(y, 1);
                // Add a new empty line at the top
                board.unshift(Array(COLS).fill(0));
                linesCleared++;
                y++; // Re-check the same row index
            }
        }
        if (linesCleared > 0) {
            playClearSound();
            // Scoring
            score += linesCleared * 100 * level;
            scoreSpan.textContent = score;

            // Leveling up
            if (score > level * 500) {
                level++;
                levelSpan.textContent = level;
                dropInterval = 1000 - (level - 1) * 50;
                if (dropInterval < 100) dropInterval = 100;
            }
        }
    }

    // Get a new random piece
    function getNewPiece() {
        const randomId = Math.floor(Math.random() * SHAPES.length) + 1;
        const shape = SHAPES[randomId - 1];
        return { shape: shape, colorId: randomId };
    }

    // Spawn a new piece
    function spawnNewPiece() {
        if (!nextPiece) {
            nextPiece = getNewPiece();
        }
        currentPiece = nextPiece;
        nextPiece = getNewPiece();
        currentPieceX = Math.floor(COLS / 2) - Math.floor(currentPiece.shape[0].length / 2);
        currentPieceY = -1; // Start above the board

        // Check for game over
        if (checkCollision()) {
            gameOver();
        }
    }

    // Update function for the game loop
    function update(time = 0) {
        if (!isPlaying || isPaused) {
             requestAnimationFrame(update);
            return;
        }

        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;

        if (dropCounter > dropInterval) {
            dropPiece();
            dropCounter = 0;
        }

        // Clear the canvases
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        nextCtx.clearRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);

        // Draw the board and current piece
        drawBoard();
        if (currentPiece) {
            drawPiece(currentPiece, currentPieceX, currentPieceY, ctx);
        }

        // Draw the next piece preview
        if (nextPiece) {
            const offsetX = (4 - nextPiece.shape[0].length) / 2;
            const offsetY = (4 - nextPiece.shape.length) / 2;
            drawPiece(nextPiece, offsetX, offsetY, nextCtx);
        }

        requestAnimationFrame(update);
    }

    // Handle piece dropping
    function dropPiece() {
        currentPieceY++;
        if (checkCollision()) {
            currentPieceY--;
            mergePiece();
            clearLines();
            spawnNewPiece();
        }
    }

    // Game over logic
    function gameOver() {
        isPlaying = false;
        playGameOverSound();
        finalScoreSpan.textContent = score;

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('highScore', highScore);
            highScoreSpan.textContent = highScore;
        }
        modalHighScoreSpan.textContent = highScore;
        gameOverModal.style.display = 'flex';
        pauseButton.style.display = 'none';
    }

    // --- Event listeners and game controls ---
    document.addEventListener('keydown', (e) => {
        if (!isPlaying || isPaused) return;

        switch (e.key) {
            case 'ArrowLeft':
                currentPieceX--;
                if (checkCollision()) {
                    currentPieceX++;
                }
                break;
            case 'ArrowRight':
                currentPieceX++;
                if (checkCollision()) {
                    currentPieceX--;
                }
                break;
            case 'ArrowDown':
                dropPiece();
                dropCounter = 0;
                break;
            case 'ArrowUp':
                rotatePiece();
                break;
            case ' ': // Hard Drop
                hardDrop();
                break;
            case 'p': // Pause
            case 'P':
                togglePause();
                break;
        }
    });

    startButton.addEventListener('click', () => {
        startGame();
        startButton.style.display = 'none';
        pauseButton.style.display = 'block';
        newGameButton.style.display = 'block';
    });

    restartButton.addEventListener('click', () => {
        gameOverModal.style.display = 'none';
        startGame();
    });

    pauseButton.addEventListener('click', togglePause);
    newGameButton.addEventListener('click', () => {
        startGame();
        pauseButton.textContent = 'PAUSE';
        isPaused = false;
    });

    function togglePause() {
        isPaused = !isPaused;
        if (isPaused) {
            pauseButton.textContent = 'RESUME';
        } else {
            pauseButton.textContent = 'PAUSE';
            lastTime = performance.now(); // Reset lastTime to avoid a large jump in dropCounter
            requestAnimationFrame(update);
        }
    }

    // Touch control event listeners
    leftBtn.addEventListener('click', () => { if (isPlaying && !isPaused) { currentPieceX--; if (checkCollision()) currentPieceX++; } });
    rightBtn.addEventListener('click', () => { if (isPlaying && !isPaused) { currentPieceX++; if (checkCollision()) currentPieceX--; } });
    downBtn.addEventListener('click', () => { if (isPlaying && !isPaused) { dropPiece(); dropCounter = 0; } });
    rotateBtn.addEventListener('click', () => { if (isPlaying && !isPaused) rotatePiece(); });
    hardDropBtn.addEventListener('click', () => { if (isPlaying && !isPaused) hardDrop(); });

    // Show touch controls if the device is likely mobile
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        touchControls.style.display = 'flex';
    }

    // --- Initialization ---
    function startGame() {
        board = createBoard();
        score = 0;
        level = 1;
        dropCounter = 0;
        dropInterval = 1000;
        lastTime = 0;
        isPlaying = true;
        isPaused = false;
        scoreSpan.textContent = score;
        levelSpan.textContent = level;

        // Load and display high score
        const storedHighScore = localStorage.getItem('highScore');
        if (storedHighScore) {
            highScore = parseInt(storedHighScore, 10);
            highScoreSpan.textContent = highScore;
        }

        // Start the game loop
        spawnNewPiece();
        update();
    }
});