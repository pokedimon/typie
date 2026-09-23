/**
 * =============================================================================
 * Alpine.js Component: gameHandler (Sandbox / Free Play Mode)
 * =============================================================================
 * Manages the interactive typing sandbox where monkeys carrying Cyrillic letters
 * spawn from the edges of the screen and float across the game field.
 *
 * Handles:
 * - 50 FPS game animation and collision/movement loop.
 * - 1-second countdown timer.
 * - Keyboard input matching against active on-screen targets.
 * - Dynamic scoring with speed, time, and alphabet variety multipliers.
 * - LocalStorage persistence for user sandbox preferences.
 * - Backend API synchronization for cumulative score and game telemetry.
 */
function gameHandler() {
    return {
        // --- State Management ---
        score: 0,              // Total cumulative score fetched from the database
        roundScore: 0,         // Points accumulated during the active session
        timer: 0,              // Remaining countdown in seconds
        isStartScreen: true,   // Controls visibility of the start/welcome overlay
        showSettings: false,   // Controls visibility of the sandbox customizer panel
        gameOver: false,       // Becomes true when the round timer expires
        isPaused: false,       // Toggled by the Spacebar key
        monkeys: [],           // Array of active floating targets currently on screen
        monkeyId: 0,           // Monotonically increasing ID counter for list keys
        loopId: null,          // setInterval reference for the 20ms physics loop
        timerIntervalId: null, // setInterval reference for the 1-second timer

        // Default sandbox configuration (customizable via UI and persisted to localStorage)
        sandbox: {
            letters: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ", // Allowed Cyrillic alphabet set
            speed: 1.0,                                   // Speed multiplier (e.g. 1.0 = normal)
            time: 60,                                     // Round duration in seconds
            skin: "🐒"                                    // Character avatar / emoji
        },

        /**
         * Component Initialization:
         * 1. Loads saved sandbox preferences from browser localStorage if available.
         * 2. Asynchronously requests the current user's cumulative score from /get_score.
         */
        init() {
            const savedSettings = localStorage.getItem('typie_sandbox_settings');
            if (savedSettings) this.sandbox = JSON.parse(savedSettings);

            fetch('/get_score', { credentials: 'same-origin' })
                .then(r => {
                    if (!r.ok) throw new Error('Not logged in');
                    return r.json();
                })
                .then(data => {
                    this.score = data.total_score || 0;
                })
                .catch(() => {
                    this.score = 0;
                });
        },

        /**
         * Persists current sandbox settings to localStorage.
         */
        saveProgress() {
            localStorage.setItem('typie_sandbox_settings', JSON.stringify(this.sandbox));
        },

        /**
         * Reloads sandbox settings from localStorage.
         */
        loadSandboxSettings() {
            const saved = localStorage.getItem('typie_sandbox_settings');
            if (saved) {
                this.sandbox = JSON.parse(saved);
            }
        },

        /**
         * Begins a new game session:
         * Hides start screen, unpauses, resets round score and timer, and starts the loops.
         */
        startRound() {
            this.isStartScreen = false;
            this.gameOver = false;
            this.isPaused = false;
            this.showSettings = false;
            this.timer = this.sandbox.time;
            this.roundScore = 0;
            this.startLoop();
        },

        /**
         * Clears all active on-screen targets and initializes the game intervals.
         */
        startLoop() {
            this.monkeys = [];
            this.runGameIntervals();
        },

        /**
         * Sets up the two core recurring intervals:
         * 1. Physics & Animation loop: runs every 20ms (~50 FPS) to update positions and spawn targets.
         * 2. Game clock: runs every 1000ms to decrement the round timer and trigger game over when 0.
         */
        runGameIntervals() {
            if (this.loopId) clearInterval(this.loopId);
            if (this.timerIntervalId) clearInterval(this.timerIntervalId);

            // 50 FPS physics update
            this.loopId = setInterval(() => {
                if (!this.isPaused) this.update();
            }, 20);

            // 1-second countdown clock
            this.timerIntervalId = setInterval(() => {
                if (!this.isPaused && this.timer > 0) {
                    this.timer--;
                } else if (this.timer === 0 && !this.isPaused) {
                    this.endRound();
                }
            }, 1000);
        },

        /**
         * Toggles game pause state if game is actively running (triggered by spacebar).
         */
        togglePause() {
            if (!this.isStartScreen && !this.gameOver && !this.showSettings) {
                this.isPaused = !this.isPaused;
            }
        },

        /**
         * Main Game Loop Step (called every 20ms):
         * 1. Calculates spawn probability based on sandbox speed setting.
         * 2. Rolls a random number to spawn a new monkey if conditions are met.
         * 3. Moves each uncaught monkey by its velocity vectors (vx, vy).
         * 4. Flags monkeys that float past field boundaries (with 150px padding).
         * 5. Filters out all out-of-bounds or caught/removed monkeys.
         */
        update() {
            const field = document.getElementById('game-field');
            const fw = field.clientWidth;
            const fh = field.clientHeight;

            // Spawn chance scales proportionally with chosen game speed
            const spawnRate = 0.02 * this.sandbox.speed;

            if (Math.random() < spawnRate) {
                this.spawnMonkey(fw, fh);
            }

            // Update spatial positions
            this.monkeys.forEach(m => {
                if (!m.isCaught) {
                    m.x += m.vx;
                    m.y += m.vy;
                    // Detect when target leaves the screen viewport with buffer
                    if (m.x < -150 || m.x > fw + 150 || m.y < -150 || m.y > fh + 150) {
                        m.outOfBounds = true;
                    }
                }
            });

            // Cull inactive entities
            this.monkeys = this.monkeys.filter(m => !m.outOfBounds && !m.removed);
        },

        /**
         * Spawns a single target entity:
         * - Randomly selects an entry side (0: top, 1: right, 2: bottom, 3: left).
         * - Calculates a randomized speed and directional angle.
         * - Picks a random character from the active sandbox alphabet.
         * - Pushes the new entity into the `monkeys` array.
         */
        spawnMonkey(fw, fh) {
            const side = Math.floor(Math.random() * 4);
            let x, y, vx, vy;

            // Randomized baseline speed scaled by user configuration
            const baseSpeed = 0.6 + Math.random() * 0.8;
            const finalSpeed = baseSpeed * this.sandbox.speed;

            // Random flight angle (0 to 2*PI radians)
            const angle = Math.random() * Math.PI * 2;
            const vxRandom = Math.cos(angle) * finalSpeed;
            const vyRandom = Math.sin(angle) * finalSpeed;

            // Determine spawn coordinate just outside the visible boundary
            if (side === 0) { x = Math.random() * fw; y = -100; vx = vxRandom; vy = vyRandom; }
            else if (side === 1) { x = fw + 100; y = Math.random() * fh; vx = vxRandom; vy = vyRandom; }
            else if (side === 2) { x = Math.random() * fw; y = fh + 100; vx = vxRandom; vy = vyRandom; }
            else { x = -100; y = Math.random() * fh; vx = vxRandom; vy = vyRandom; }

            const chars = this.sandbox.letters;
            if (!chars) return;

            this.monkeys.push({
                id: this.monkeyId++,
                x, y, vx, vy,
                letter: chars[Math.floor(Math.random() * chars.length)],
                isCaught: false,
                removed: false,
                outOfBounds: false
            });
        },

        // CSS class for visual feedback pulses (green flash on hit, red flash on miss)
        pulseClass: '',

        /**
         * Keyboard Input Handler:
         * - Spacebar toggles pause.
         * - Ignores input during start screen, settings modal, pause, or game over.
         * - Checks if the typed character matches an uncaught monkey on screen:
         *   * MATCH: Calculates score using speed/time/letters multipliers, applies
         *     green screen flash, marks monkey caught, and schedules removal.
         *   * MISS (valid Cyrillic letter): Penalizes score and flashes screen red.
         */
        handleInput(e) {
            if (e.key === ' ') {
                this.togglePause();
                return;
            }

            if (this.isStartScreen || this.showSettings || this.gameOver || this.isPaused) return;

            const char = e.key.toUpperCase();
            const index = this.monkeys.findIndex(m => m.letter === char && !m.isCaught);

            // Difficulty multiplier based on round length and alphabet complexity
            const multiplier = 1 + this.sandbox.time / 360 + this.sandbox.letters.length / 66;

            if (index !== -1) {
                // Correct key hit
                this.roundScore += Math.round((5 * this.sandbox.speed + 5) * multiplier);
                this.pulseClass = 'bg-green-600/30 transition-colors duration-100';
                setTimeout(() => { this.pulseClass = ''; }, 300);

                const m = this.monkeys[index];
                m.isCaught = true;
                setTimeout(() => m.removed = true, 500);
            } else if (index === -1 && /^[А-Я]$/.test(char)) {
                // Wrong key typed within Russian alphabet range
                this.roundScore = Math.max(0, this.roundScore - Math.round(5 * this.sandbox.speed * multiplier));
                this.pulseClass = 'bg-red-600/30 transition-colors duration-100';
                setTimeout(() => { this.pulseClass = ''; }, 300);
            }
        },

        /**
         * Concludes the Round:
         * 1. Stops loop and timer intervals.
         * 2. Accumulates round score into total cumulative score.
         * 3. Sends POST request to /update_score to update user's score in the database.
         * 4. Sends POST request to /creategame with round statistics (letters, speed, duration, score).
         * 5. Displays the game-over screen.
         */
        endRound() {
            clearInterval(this.loopId);
            clearInterval(this.timerIntervalId);
            this.score += this.roundScore;

            // Synchronize updated total score with database
            fetch('/update_score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ score: this.score })
            })
            .catch(err => console.error('Failed to update score:', err));

            // Log individual game session record
            fetch('/creategame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    chars: this.sandbox.letters,
                    velocity: this.sandbox.speed,
                    time: this.sandbox.time,
                    score: this.roundScore
                })
            })
            .catch(err => console.error('Failed to create game record:', err));

            this.gameOver = true;
        },

        /**
         * Restarts the sandbox session from the game over screen.
         */
        restartGame() {
            this.startRound();
        }
    };
}
