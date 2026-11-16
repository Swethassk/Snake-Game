// GAME ENGINE LOGIC - CYBER-SNAKE
document.addEventListener('DOMContentLoaded', () => {
    // Canvas & Context Setup
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.querySelector('.canvas-container');

    // UI Overlays
    const startMenu = document.getElementById('start-menu');
    const gameOverScreen = document.getElementById('game-over-screen');
    const pauseScreen = document.getElementById('pause-screen');

    // UI Buttons
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const exitBtn = document.getElementById('exit-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const quitBtn = document.getElementById('quit-btn');
    const soundToggle = document.getElementById('sound-toggle');
    const soundOnIcon = document.getElementById('sound-on-icon');
    const soundOffIcon = document.getElementById('sound-off-icon');

    // UI Stats
    const currentScoreEl = document.getElementById('current-score');
    const highScoreEl = document.getElementById('high-score');
    const finalScoreEl = document.getElementById('final-score');
    const finalFoodEl = document.getElementById('final-food');
    const finalTimeEl = document.getElementById('final-time');

    // Selectors
    const speedSelector = document.getElementById('speed-selector');
    const modeSelector = document.getElementById('mode-selector');
    const skinSelector = document.getElementById('skin-selector');

    // Game Config & Constants
    const GRID_SIZE = 20; // 20x20 grid cells
    let CELL_SIZE = canvas.width / GRID_SIZE;

    // Game State variables
    let snake = [];
    let direction = 'RIGHT';
    let nextDirection = 'RIGHT';
    let inputQueue = []; // To prevent rapid-input self-collision

    let food = null;
    let foodSpawnTimer = 0;
    let particles = [];
    
    let score = 0;
    let highScore = parseInt(localStorage.getItem('cyber_snake_high') || '0');
    let foodEatenCount = 0;
    let gameStartTime = 0;
    let gameDuration = 0;

    let gameInterval = null;
    let isPlaying = false;
    let isPaused = false;
    let soundEnabled = localStorage.getItem('cyber_snake_sound') !== 'false';

    // Game Customization Settings (Defaults)
    let speedTicks = 1000 / 12; // Time in ms per grid step (lower is faster)
    let borderMode = 'wrap'; // 'wrap' or 'solid'
    let selectedSkin = 'cyan'; // 'cyan', 'green', 'magenta', 'gold'

    // Power-ups state
    let activePowerups = {
        shield: { active: false, timer: 0, maxDuration: 10000 }, // 10s
        speed: { active: false, timer: 0, maxDuration: 8000, speedMultiplier: 0.65 } // 8s
    };

    // Color Theme Mappings
    const SKIN_COLORS = {
        cyan: { primary: '#00f0ff', secondary: '#0078a0', glow: 'rgba(0, 240, 255, 0.4)' },
        green: { primary: '#39ff14', secondary: '#1db000', glow: 'rgba(57, 255, 20, 0.4)' },
        magenta: { primary: '#ff007f', secondary: '#aa0055', glow: 'rgba(255, 0, 127, 0.4)' },
        gold: { primary: '#ffd700', secondary: '#c59b00', glow: 'rgba(255, 215, 0, 0.4)' }
    };

    const FOOD_TYPES = {
        normal: { color: '#ff3131', glow: 'rgba(255, 49, 49, 0.6)', score: 10 },
        gold: { color: '#ffd700', glow: 'rgba(255, 215, 0, 0.7)', score: 30, duration: 6000 },
        shield: { color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.6)', score: 15, duration: 10000 },
        speed: { color: '#b026ff', glow: 'rgba(176, 38, 255, 0.6)', score: 20, duration: 8000 }
    };

    // Web Audio Synthesizer setup
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playSound(type) {
        if (!soundEnabled) return;
        initAudio();
        if (!audioCtx) return;

        // Resume AudioContext if suspended (browser security)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        const masterVolume = audioCtx.createGain();
        masterVolume.gain.setValueAtTime(0.12, now); // Prevent overly loud beeps
        masterVolume.connect(audioCtx.destination);

        switch (type) {
            case 'move': {
                const osc = audioCtx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
                osc.connect(masterVolume);
                osc.start(now);
                osc.stop(now + 0.08);
                break;
            }
            case 'eat': {
                // Cyber double beep
                const osc1 = audioCtx.createOscillator();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(440, now);
                osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
                osc1.connect(masterVolume);
                osc1.start(now);
                osc1.stop(now + 0.12);

                const osc2 = audioCtx.createOscillator();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(587.33, now + 0.06);
                osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18);
                osc2.connect(masterVolume);
                osc2.start(now + 0.06);
                osc2.stop(now + 0.18);
                break;
            }
            case 'powerup': {
                // Rising laser effect
                const osc = audioCtx.createOscillator();
                const filter = audioCtx.createBiquadFilter();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.45);
                filter.type = 'lowpass';
                filter.Q.setValueAtTime(5, now);
                filter.frequency.setValueAtTime(400, now);
                filter.frequency.exponentialRampToValueAtTime(2000, now + 0.45);

                osc.connect(filter);
                filter.connect(masterVolume);
                osc.start(now);
                osc.stop(now + 0.45);
                break;
            }
            case 'shield-pop': {
                // Glass shatter / metal click
                const osc = audioCtx.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(1500, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                
                const gainNode = audioCtx.createGain();
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

                osc.connect(gainNode);
                gainNode.connect(masterVolume);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }
            case 'gameover': {
                // Descending retro explosion sound
                const osc = audioCtx.createOscillator();
                const noise = audioCtx.createOscillator(); // we'll simulate noise with square & detune
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.85);

                const gainNode = audioCtx.createGain();
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

                osc.connect(gainNode);
                gainNode.connect(masterVolume);
                osc.start(now);
                osc.stop(now + 0.9);
                break;
            }
        }
    }

    // Set Sound Toggle UI State
    function updateSoundUI() {
        if (soundEnabled) {
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
            localStorage.setItem('cyber_snake_sound', 'true');
        } else {
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
            localStorage.setItem('cyber_snake_sound', 'false');
        }
    }
    updateSoundUI();

    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        updateSoundUI();
        initAudio();
        playSound('move');
    });

    // Resize Canvas dynamically if window sizes change
    function handleResize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // Base size 600
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        CELL_SIZE = rect.width / GRID_SIZE;
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    // Menu Controls - Setting Selections
    speedSelector.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            speedSelector.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // speed settings: 8 ticks/sec (easy), 12 ticks/sec (med), 16 ticks/sec (hard)
            const tickRate = parseInt(btn.getAttribute('data-speed'));
            speedTicks = 1000 / tickRate;
            playSound('move');
        });
    });

    modeSelector.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            modeSelector.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            borderMode = btn.getAttribute('data-mode');
            
            // Adjust canvas border color visual representation
            if (borderMode === 'solid') {
                container.style.borderColor = 'rgba(255, 49, 49, 0.4)';
                container.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(255, 49, 49, 0.08)';
            } else {
                container.style.borderColor = 'rgba(0, 240, 255, 0.2)';
                container.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 240, 255, 0.05)';
            }
            playSound('move');
        });
    });

    skinSelector.querySelectorAll('.skin-option').forEach(option => {
        option.addEventListener('click', (e) => {
            skinSelector.querySelectorAll('.skin-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            selectedSkin = option.getAttribute('data-skin');
            playSound('move');
        });
    });

    // Game Initiation
    function startSimulation() {
        initAudio();
        isPlaying = true;
        isPaused = false;
        score = 0;
        foodEatenCount = 0;
        gameStartTime = Date.now();
        gameDuration = 0;
        
        currentScoreEl.textContent = '0000';
        highScoreEl.textContent = String(highScore).padStart(4, '0');

        // Reset power-ups
        activePowerups.shield.active = false;
        activePowerups.shield.timer = 0;
        activePowerups.speed.active = false;
        activePowerups.speed.timer = 0;

        // Spawn Snake at center
        snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        direction = 'RIGHT';
        nextDirection = 'RIGHT';
        inputQueue = [];

        // Spawn first food
        spawnFood();

        // Clear existing interval
        if (gameInterval) clearInterval(gameInterval);

        // Hide menus
        startMenu.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        pauseScreen.classList.add('hidden');

        // Play synth start
        playSound('powerup');

        // Start game loop ticks
        runGameLoop();
    }

    function runGameLoop() {
        if (gameInterval) clearInterval(gameInterval);
        
        // Calculate speed based on setting and active power-ups
        let currentInterval = speedTicks;
        if (activePowerups.speed.active) {
            currentInterval = speedTicks * activePowerups.speed.speedMultiplier;
        }

        gameInterval = setInterval(() => {
            if (isPlaying && !isPaused) {
                update();
                render();
            }
        }, currentInterval);
    }

    // Spawn Food logic (different probability weightings)
    function spawnFood() {
        let attempts = 0;
        let newX, newY;
        let onSnake = true;

        while (onSnake && attempts < 100) {
            newX = Math.floor(Math.random() * GRID_SIZE);
            newY = Math.floor(Math.random() * GRID_SIZE);
            
            // Verify new position is not on snake body
            onSnake = snake.some(segment => segment.x === newX && segment.y === newY);
            attempts++;
        }

        // Determine food type based on percentage chances
        const rand = Math.random() * 100;
        let type = 'normal';

        if (rand < 10) {
            type = 'shield';
        } else if (rand < 20) {
            type = 'speed';
        } else if (rand < 32) {
            type = 'gold';
        }

        food = {
            x: newX,
            y: newY,
            type: type,
            spawnTime: Date.now(),
            expiresAt: FOOD_TYPES[type].duration ? (Date.now() + FOOD_TYPES[type].duration) : null
        };
    }

    // Particle Explosion System
    function spawnExplosion(x, y, color) {
        const count = 16;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 4;
            particles.push({
                x: (x + 0.5) * CELL_SIZE,
                y: (y + 0.5) * CELL_SIZE,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                alpha: 1,
                size: 2 + Math.random() * 3,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    // Main Update Frame Logic
    function update() {
        // Handle input queue
        if (inputQueue.length > 0) {
            const nextDir = inputQueue.shift();
            
            // Prevent 180 degree turns instantly
            if (nextDir === 'LEFT' && direction !== 'RIGHT') direction = 'LEFT';
            else if (nextDir === 'UP' && direction !== 'DOWN') direction = 'UP';
            else if (nextDir === 'RIGHT' && direction !== 'LEFT') direction = 'RIGHT';
            else if (nextDir === 'DOWN' && direction !== 'UP') direction = 'DOWN';
        }

        // Check if food has expired (golden, shield, speed food)
        if (food && food.expiresAt && Date.now() > food.expiresAt) {
            // Spawn normal food in its place, clean expire
            spawnFood();
        }

        // Manage active powerups duration
        const now = Date.now();
        if (activePowerups.shield.active && now > activePowerups.shield.timer) {
            activePowerups.shield.active = false;
            playSound('shield-pop');
            spawnExplosion(snake[0].x, snake[0].y, FOOD_TYPES.shield.color);
        }
        if (activePowerups.speed.active && now > activePowerups.speed.timer) {
            activePowerups.speed.active = false;
            // Reset game tick interval
            runGameLoop();
            spawnExplosion(snake[0].x, snake[0].y, FOOD_TYPES.speed.color);
        }

        // Move the snake head
        let headX = snake[0].x;
        let headY = snake[0].y;

        switch (direction) {
            case 'LEFT': headX--; break;
            case 'UP': headY--; break;
            case 'RIGHT': headX++; break;
            case 'DOWN': headY++; break;
        }

        // Border behavior logic
        if (borderMode === 'wrap') {
            if (headX < 0) headX = GRID_SIZE - 1;
            else if (headX >= GRID_SIZE) headX = 0;

            if (headY < 0) headY = GRID_SIZE - 1;
            else if (headY >= GRID_SIZE) headY = 0;
        } else {
            // Solid Border Integrity collision check
            if (headX < 0 || headX >= GRID_SIZE || headY < 0 || headY >= GRID_SIZE) {
                if (activePowerups.shield.active) {
                    // Shield saves user
                    activePowerups.shield.active = false;
                    playSound('shield-pop');
                    spawnExplosion(snake[0].x, snake[0].y, FOOD_TYPES.shield.color);
                    // Wrap user to save them or bounce back
                    if (headX < 0) headX = 0;
                    if (headX >= GRID_SIZE) headX = GRID_SIZE - 1;
                    if (headY < 0) headY = 0;
                    if (headY >= GRID_SIZE) headY = GRID_SIZE - 1;
                } else {
                    triggerGameOver();
                    return;
                }
            }
        }

        // Move head to front of array
        const newHead = { x: headX, y: headY };
        snake.unshift(newHead);

        // Check if food eaten
        if (headX === food.x && headY === food.y) {
            foodEatenCount++;
            
            // Award score based on food type
            let scoreGain = FOOD_TYPES[food.type].score;
            if (activePowerups.speed.active) {
                scoreGain *= 2; // Score double during speed boost
            }
            score += scoreGain;
            currentScoreEl.textContent = String(score).padStart(4, '0');

            // Handle Power-up activations
            if (food.type === 'shield') {
                activePowerups.shield.active = true;
                activePowerups.shield.timer = Date.now() + activePowerups.shield.maxDuration;
                playSound('powerup');
            } else if (food.type === 'speed') {
                activePowerups.speed.active = true;
                activePowerups.speed.timer = Date.now() + activePowerups.speed.maxDuration;
                playSound('powerup');
                runGameLoop(); // Re-trigger timer rates
            } else {
                playSound('eat');
            }

            // High score update
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('cyber_snake_high', highScore);
                highScoreEl.textContent = String(highScore).padStart(4, '0');
            }

            // Explosion effect
            spawnExplosion(food.x, food.y, FOOD_TYPES[food.type].color);

            // Spawn next food
            spawnFood();
        } else {
            // Remove tail segment if food not eaten
            snake.pop();
        }

        // Self-collision check (now after the movement is complete)
        const selfCollide = snake.slice(1).some(segment => segment.x === snake[0].x && segment.y === snake[0].y);
        if (selfCollide) {
            if (activePowerups.shield.active) {
                // Shield saves user
                activePowerups.shield.active = false;
                playSound('shield-pop');
                spawnExplosion(snake[0].x, snake[0].y, FOOD_TYPES.shield.color);
            } else {
                triggerGameOver();
                return;
            }
        }

        // Update trail particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98; // Friction
            p.vy *= 0.98;
            p.alpha -= p.decay;
            if (p.alpha <= 0) {
                particles.splice(i, 1);
            }
        }

        // Passive particles from tail (cyber-trail)
        if (snake.length > 0 && Math.random() < 0.3) {
            const tail = snake[snake.length - 1];
            const skinColors = SKIN_COLORS[selectedSkin];
            particles.push({
                x: (tail.x + 0.5) * CELL_SIZE + (Math.random() - 0.5) * 8,
                y: (tail.y + 0.5) * CELL_SIZE + (Math.random() - 0.5) * 8,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                color: skinColors.primary,
                alpha: 0.6,
                size: 1 + Math.random() * 2,
                decay: 0.03
            });
        }
    }

    // Rendering Frame Logic
    function render() {
        const theme = SKIN_COLORS[selectedSkin];

        // Clear canvas
        ctx.fillStyle = '#080a10';
        ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);

        // Draw sub-grid lines
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.025)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= GRID_SIZE; i++) {
            // Verticals
            ctx.beginPath();
            ctx.moveTo(i * CELL_SIZE, 0);
            ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
            ctx.stroke();
            
            // Horizontals
            ctx.beginPath();
            ctx.moveTo(0, i * CELL_SIZE);
            ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
            ctx.stroke();
        }

        // Draw Food
        if (food) {
            const foodConfig = FOOD_TYPES[food.type];
            const centerX = (food.x + 0.5) * CELL_SIZE;
            const centerY = (food.y + 0.5) * CELL_SIZE;
            const radius = CELL_SIZE * 0.42;

            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = foodConfig.color;

            // Pulsing sizing for special items
            let scalePulse = 1;
            if (food.type !== 'normal') {
                scalePulse = 1 + Math.sin(Date.now() / 150) * 0.08;
            }

            // Radial gradient food sphere
            const grad = ctx.createRadialGradient(
                centerX - radius * 0.2, 
                centerY - radius * 0.2, 
                radius * 0.1, 
                centerX, 
                centerY, 
                radius * scalePulse
            );
            
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, foodConfig.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * scalePulse, 0, Math.PI * 2);
            ctx.fill();

            // Expire rings for timed foods
            if (food.expiresAt) {
                const timeLeft = food.expiresAt - Date.now();
                const pct = timeLeft / FOOD_TYPES[food.type].duration;
                ctx.strokeStyle = foodConfig.color;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = pct * 0.5;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * (1.2 + (1 - pct) * 0.8), 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Draw Particles
        particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Draw Snake
        if (snake.length > 0) {
            ctx.save();
            
            // Add global glowing shadow for active shields
            if (activePowerups.shield.active) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = FOOD_TYPES.shield.color;
            } else if (activePowerups.speed.active) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = FOOD_TYPES.speed.color;
            } else {
                ctx.shadowBlur = 12;
                ctx.shadowColor = theme.primary;
            }

            // Draw Body Segment Loops (drawing back to front)
            for (let i = snake.length - 1; i >= 0; i--) {
                const segment = snake[i];
                const segmentX = (segment.x + 0.5) * CELL_SIZE;
                const segmentY = (segment.y + 0.5) * CELL_SIZE;
                
                // Scale segments to taper slightly down towards tail
                const pct = 1 - (i / snake.length); // 1.0 (head) to 0.2 (tail)
                const baseRadius = CELL_SIZE * 0.45;
                const radius = baseRadius * (0.55 + pct * 0.45);

                ctx.beginPath();
                
                if (i === 0) {
                    // Draw Head - slightly larger glowing bubble or distinct color
                    ctx.fillStyle = theme.primary;
                    ctx.arc(segmentX, segmentY, baseRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Eyes pointing in moving direction
                    ctx.fillStyle = '#050609';
                    const eyeSize = CELL_SIZE * 0.12;
                    const offset = CELL_SIZE * 0.2;
                    let eyeX1, eyeY1, eyeX2, eyeY2;

                    switch (direction) {
                        case 'RIGHT':
                            eyeX1 = segmentX + offset; eyeY1 = segmentY - offset;
                            eyeX2 = segmentX + offset; eyeY2 = segmentY + offset;
                            break;
                        case 'LEFT':
                            eyeX1 = segmentX - offset; eyeY1 = segmentY - offset;
                            eyeX2 = segmentX - offset; eyeY2 = segmentY + offset;
                            break;
                        case 'UP':
                            eyeX1 = segmentX - offset; eyeY1 = segmentY - offset;
                            eyeX2 = segmentX + offset; eyeY2 = segmentY - offset;
                            break;
                        case 'DOWN':
                            eyeX1 = segmentX - offset; eyeY1 = segmentY + offset;
                            eyeX2 = segmentX + offset; eyeY2 = segmentY + offset;
                            break;
                    }

                    ctx.beginPath();
                    ctx.arc(eyeX1, eyeY1, eyeSize, 0, Math.PI * 2);
                    ctx.arc(eyeX2, eyeY2, eyeSize, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw eye highlights
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(eyeX1 + (direction === 'RIGHT' ? 1 : direction === 'LEFT' ? -1 : 0), eyeY1 + (direction === 'DOWN' ? 1 : direction === 'UP' ? -1 : 0), eyeSize * 0.4, 0, Math.PI * 2);
                    ctx.arc(eyeX2 + (direction === 'RIGHT' ? 1 : direction === 'LEFT' ? -1 : 0), eyeY2 + (direction === 'DOWN' ? 1 : direction === 'UP' ? -1 : 0), eyeSize * 0.4, 0, Math.PI * 2);
                    ctx.fill();

                } else {
                    // Draw Body Beads
                    // Pulse or alter styling slightly based on active status effects
                    if (activePowerups.shield.active) {
                        ctx.fillStyle = FOOD_TYPES.shield.color;
                    } else if (activePowerups.speed.active) {
                        ctx.fillStyle = i % 2 === 0 ? FOOD_TYPES.speed.color : theme.primary;
                    } else {
                        // Alternate gradients / body colors
                        ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                    }
                    
                    ctx.arc(segmentX, segmentY, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
        }

        // Draw Screen HUD Alerts inside Canvas (Timers for Power-ups)
        let alertOffset = 25;
        ctx.save();
        ctx.font = '10px "Share Tech Mono"';
        ctx.textAlign = 'left';
        
        if (activePowerups.shield.active) {
            const timeLeft = Math.max(0, activePowerups.shield.timer - Date.now());
            ctx.fillStyle = FOOD_TYPES.shield.color;
            ctx.fillText(`SHIELD STABILITY: ${(timeLeft/1000).toFixed(1)}s`, 15, alertOffset);
            alertOffset += 18;
        }

        if (activePowerups.speed.active) {
            const timeLeft = Math.max(0, activePowerups.speed.timer - Date.now());
            ctx.fillStyle = FOOD_TYPES.speed.color;
            ctx.fillText(`HYPERDRIVE ENGAGED: ${(timeLeft/1000).toFixed(1)}s (2x PTS)`, 15, alertOffset);
        }
        ctx.restore();
    }

    // Trigger game over sequence
    function triggerGameOver() {
        isPlaying = false;
        clearInterval(gameInterval);
        playSound('gameover');

        // Play container shake animation
        container.classList.add('screen-shake');
        setTimeout(() => {
            container.classList.remove('screen-shake');
        }, 400);

        // Calculate statistics
        const durationSec = Math.floor((Date.now() - gameStartTime) / 1000);

        finalScoreEl.textContent = score;
        finalFoodEl.textContent = foodEatenCount;
        finalTimeEl.textContent = `${durationSec}s`;

        // Render Game Over Overlay
        gameOverScreen.classList.remove('hidden');
    }

    // Pause/Resume Actions
    function togglePause() {
        if (!isPlaying) return;
        
        isPaused = !isPaused;
        if (isPaused) {
            pauseScreen.classList.remove('hidden');
            playSound('move');
        } else {
            pauseScreen.classList.add('hidden');
            playSound('move');
        }
    }

    // Direction input handlers
    function handleDirectionInput(newDir) {
        if (!isPlaying || isPaused) return;

        // Obtain last added direction in inputQueue to evaluate logical movement check
        const lastQueuedDir = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : direction;

        // Guard: Prevent user from turning directly back onto itself (which causes death)
        if (newDir === 'LEFT' && lastQueuedDir !== 'RIGHT' && lastQueuedDir !== 'LEFT') {
            inputQueue.push(newDir);
            playSound('move');
        } else if (newDir === 'UP' && lastQueuedDir !== 'DOWN' && lastQueuedDir !== 'UP') {
            inputQueue.push(newDir);
            playSound('move');
        } else if (newDir === 'RIGHT' && lastQueuedDir !== 'LEFT' && lastQueuedDir !== 'RIGHT') {
            inputQueue.push(newDir);
            playSound('move');
        } else if (newDir === 'DOWN' && lastQueuedDir !== 'UP' && lastQueuedDir !== 'DOWN') {
            inputQueue.push(newDir);
            playSound('move');
        }
    }

    // Keyboard Event Listener
    window.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                handleDirectionInput('LEFT');
                e.preventDefault();
                break;
            case 'ArrowUp':
            case 'KeyW':
                handleDirectionInput('UP');
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'KeyD':
                handleDirectionInput('RIGHT');
                e.preventDefault();
                break;
            case 'ArrowDown':
            case 'KeyS':
                handleDirectionInput('DOWN');
                e.preventDefault();
                break;
            case 'Escape':
            case 'Space':
                togglePause();
                e.preventDefault();
                break;
        }
    });

    // Touch D-Pad Event listeners
    document.getElementById('btn-up').addEventListener('touchstart', (e) => {
        handleDirectionInput('UP');
        e.preventDefault();
    });
    document.getElementById('btn-down').addEventListener('touchstart', (e) => {
        handleDirectionInput('DOWN');
        e.preventDefault();
    });
    document.getElementById('btn-left').addEventListener('touchstart', (e) => {
        handleDirectionInput('LEFT');
        e.preventDefault();
    });
    document.getElementById('btn-right').addEventListener('touchstart', (e) => {
        handleDirectionInput('RIGHT');
        e.preventDefault();
    });

    // Support click controls on mobile simulation via desktop mouse
    document.getElementById('btn-up').addEventListener('mousedown', () => handleDirectionInput('UP'));
    document.getElementById('btn-down').addEventListener('mousedown', () => handleDirectionInput('DOWN'));
    document.getElementById('btn-left').addEventListener('mousedown', () => handleDirectionInput('LEFT'));
    document.getElementById('btn-right').addEventListener('mousedown', () => handleDirectionInput('RIGHT'));

    // Menu Interactions
    startBtn.addEventListener('click', startSimulation);
    restartBtn.addEventListener('click', startSimulation);
    resumeBtn.addEventListener('click', togglePause);
    quitBtn.addEventListener('click', () => {
        isPlaying = false;
        isPaused = false;
        clearInterval(gameInterval);
        pauseScreen.classList.add('hidden');
        startMenu.classList.remove('hidden');
        render();
    });

    exitBtn.addEventListener('click', () => {
        isPlaying = false;
        isPaused = false;
        clearInterval(gameInterval);
        gameOverScreen.classList.add('hidden');
        startMenu.classList.remove('hidden');
        render();
    });

    // Render static grid initially on page load
    render();
});
