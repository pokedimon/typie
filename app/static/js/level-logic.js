/**
 * =============================================================================
 * Alpine.js Component: levelHandler (Campaign / Level Mode)
 * =============================================================================
 * Manages structured campaign levels where users practice specific subsets of
 * keyboard keys with target scores and time constraints.
 *
 * Accepts level configuration either via constructor arguments (e.g. `x-data="levelHandler({...})"`)
 * or through legacy global variables (`levelId`, `levelTime`, `levelSpeed`, etc.).
 *
 * Config Parameters:
 * - id: Unique integer identifier of the current level.
 * - time: Time limit in seconds to complete the level.
 * - speed: Movement speed multiplier for this level's targets.
 * - keys: String of allowed keys / characters for this specific level.
 * - targetScore: Points required to successfully clear the level.
 */
function levelHandler(config = {}) {
    // Resolve configuration values from arguments or fall back to global scope
    const id = (typeof config === 'object' && config !== null && config.id !== undefined)
        ? config.id
        : (typeof levelId !== 'undefined' ? levelId : 0);

    const keys = (typeof config === 'object' && config !== null && config.keys !== undefined)
        ? config.keys
        : (typeof levelKeys !== 'undefined' ? levelKeys : '');

    const speed = (typeof config === 'object' && config !== null && config.speed !== undefined)
        ? config.speed
        : (typeof levelSpeed !== 'undefined' ? levelSpeed : 1.0);

    const time = (typeof config === 'object' && config !== null && config.time !== undefined)
        ? config.time
        : (typeof levelTime !== 'undefined' ? levelTime : 60);

    const targetScore = (typeof config === 'object' && config !== null && config.targetScore !== undefined)
        ? config.targetScore
        : (typeof levelTargetScore !== 'undefined' ? levelTargetScore : 100);

    return {
        // --- Level Configuration Attributes ---
        levelId: id,
        levelKeys: keys,
        levelSpeed: speed,
        levelTime: time,
        levelTargetScore: targetScore,
        level: {
            id: id,
            keys: keys,
            speed: speed,
            time: time,
            target_score: targetScore
        },

        // --- State Management ---
        roundScore: 0,         // Points accumulated in the current level attempt
        timer: 0,              // Countdown clock in seconds
        isStartScreen: true,   // Controls visibility of the pre-game countdown/start overlay
        gameOver: false,       // Set to true if time expires before reaching target score
        isPaused: false,       // Paused status toggled by Spacebar
        victory: false,        // Set to true when roundScore >= targetScore
        monkeys: [],           // Active floating letter targets on screen
        monkeyId: 0,           // Auto-incrementing identifier for item keys
        loopId: null,          // setInterval reference for the 20ms physics update
        timerIntervalId: null, // setInterval reference for the 1-second countdown

        /**
         * Component Initialization:
         * Sets initial timer duration from the level configuration and resets score.
         */
        init() {
            this.timer = this.levelTime;
            this.roundScore = 0;
        },

        /**
         * Starts a fresh attempt at the level:
         * Resets state flags (gameOver, victory, isPaused), sets timer,
         * and begins the game loop.
         */
        startRound() {
            this.isStartScreen = false;
            this.gameOver = false;
            this.isPaused = false;
            this.victory = false;
            this.timer = this.levelTime;
            this.roundScore = 0;
            this.startLoop();
        },

        /**
         * Empties active monkey array and starts the animation and timer intervals.
         */
        startLoop() {
            this.monkeys = [];
            this.runGameIntervals();
        },

        /**
         * Sets up recurring timers:
         * - 20ms physics tick (~50 FPS) calling `update()` when not paused.
         * - 1000ms countdown timer calling `endRound()` when time reaches zero.
         */
        runGameIntervals() {
            if (this.loopId) clearInterval(this.loopId);
            if (this.timerIntervalId) clearInterval(this.timerIntervalId);

            this.loopId = setInterval(() => {
                if (!this.isPaused && !this.victory && !this.gameOver) {
                    this.update();
                }
            }, 20);

            this.timerIntervalId = setInterval(() => {
                if (!this.isPaused && !this.victory && !this.gameOver) {
                    if (this.timer > 0) {
                        this.timer--;
                    } else {
                        this.endRound();
                    }
                }
            }, 1000);
        },

        /**
         * Toggles game pause state via Spacebar (only when actively playing).
         */
        togglePause() {
            if (!this.isStartScreen && !this.gameOver && !this.victory) {
                this.isPaused = !this.isPaused;
            }
        },

        /**
         * Aborts the level training session, clears all intervals,
         * and navigates the user back to the levels selection map (/levels).
         */
        stopTraining() {
            clearInterval(this.loopId);
            clearInterval(this.timerIntervalId);
            window.location.href = "/levels";
        },

        /**
         * Frame Update (runs every 20ms):
         * 1. Evaluates spawn probability: 0.015 * levelSpeed.
         * 2. Spawns new targets when random chance meets the threshold.
         * 3. Moves uncaught targets by velocity (vx, vy).
         * 4. Flags and filters targets that fly past field boundaries (+/-150px).
         */
        update() {
            const field = document.getElementById('game-field');
            if (!field) return;
            const fw = field.clientWidth;
            const fh = field.clientHeight;

            // Spawn rate proportional to level difficulty speed
            const spawnRate = 0.015 * this.levelSpeed;

            if (Math.random() < spawnRate) {
                this.spawnMonkey(fw, fh);
            }

            // Move targets
            this.monkeys.forEach(m => {
                if (!m.isCaught) {
                    m.x += m.vx;
                    m.y += m.vy;
                    if (m.x < -150 || m.x > fw + 150 || m.y < -150 || m.y > fh + 150) {
                        m.outOfBounds = true;
                    }
                }
            });

            // Clean up off-screen or collected entities
            this.monkeys = this.monkeys.filter(m => !m.outOfBounds && !m.removed);
        },

        /**
         * Spawns a new target from outside one of the four screen edges:
         * Calculates trajectory angle, applies levelSpeed multiplier,
         * and picks a letter exclusively from the current level's key pool (`levelKeys`).
         */
        spawnMonkey(fw, fh) {
            const side = Math.floor(Math.random() * 4);
            let x, y, vx, vy;

            const baseSpeed = 0.5 + Math.random() * 0.7;
            const finalSpeed = baseSpeed * this.levelSpeed;

            const angle = Math.random() * Math.PI * 2;
            const vxRandom = Math.cos(angle) * finalSpeed;
            const vyRandom = Math.sin(angle) * finalSpeed;

            if (side === 0) { x = Math.random() * fw; y = -100; vx = vxRandom; vy = vyRandom; }
            else if (side === 1) { x = fw + 100; y = Math.random() * fh; vx = vxRandom; vy = vyRandom; }
            else if (side === 2) { x = Math.random() * fw; y = fh + 100; vx = vxRandom; vy = vyRandom; }
            else { x = -100; y = Math.random() * fh; vx = vxRandom; vy = vyRandom; }

            const chars = this.levelKeys;
            if (!chars || chars.length === 0) return;

            this.monkeys.push({
                id: this.monkeyId++,
                x, y, vx, vy,
                letter: chars[Math.floor(Math.random() * chars.length)],
                isCaught: false,
                removed: false,
                outOfBounds: false
            });
        },

        // CSS class for hit/miss background screen flash effects
        pulseClass: '',

        /**
         * Keystroke Input Handler:
         * - Spacebar toggles pause.
         * - Compares key to active uncaught targets:
         *   * MATCH: +10 points, triggers green flash, marks target as caught.
         *     Checks if `roundScore >= levelTargetScore`, and if so triggers victory!
         *   * MISS (valid Cyrillic letter): -5 points penalty, triggers red flash.
         */
        handleInput(e) {
            if (e.key === ' ') {
                this.togglePause();
                return;
            }

            if (this.isStartScreen || this.gameOver || this.isPaused || this.victory) return;

            const char = e.key.toUpperCase();
            
            // Check if user pressed key matches any active falling monkey
            const index = this.monkeys.findIndex(m => m.letter === char && !m.isCaught);
            if (index !== -1) {
                // Award points
                this.roundScore += 10;
                this.pulseClass = 'bg-green-600/30 transition-colors duration-100';
                setTimeout(() => { this.pulseClass = ''; }, 300);

                const m = this.monkeys[index];
                m.isCaught = true;
                setTimeout(() => m.removed = true, 500);

                // Check victory condition
                if (this.roundScore >= this.levelTargetScore) {
                    this.triggerVictory();
                }
            } else if (index === -1 && /^[А-ЯЁ]$/.test(char)) {
                // Penalize for wrong letters (only in full Russian alphabet range)
                this.roundScore = Math.max(0, this.roundScore - 5);
                this.pulseClass = 'bg-red-600/30 transition-colors duration-100';
                setTimeout(() => { this.pulseClass = ''; }, 300);
            }
        },

        /**
         * Level Victory Handler:
         * 1. Sets victory state to true and stops physics/timer intervals.
         * 2. Sends POST request to /update_level with current levelId.
         * 3. Server unlocks the next campaign level in the database (or session).
         */
        triggerVictory() {
            this.victory = true;
            clearInterval(this.loopId);
            clearInterval(this.timerIntervalId);

            // Send completed level to backend
            fetch('/update_level', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ level: this.levelId })
            })
            .then(r => {
                if (!r.ok) throw new Error("Failed to update progress on backend");
                return r.json();
            })
            .then(data => {
                console.log("Progress saved: level =", data.level);
            })
            .catch(err => console.error("Error saving progress:", err));
        },

        /**
         * Concludes Level Attempt (Time Expired without reaching target score):
         * Stops physics and timer intervals, and displays the Game Over modal.
         */
        endRound() {
            clearInterval(this.loopId);
            clearInterval(this.timerIntervalId);
            this.gameOver = true;
        },

        /**
         * Restarts the level attempt from the beginning.
         */
        restartGame() {
            this.startRound();
        }
    };
}

// Register as an Alpine component if Alpine is initialized
document.addEventListener('alpine:init', () => {
    Alpine.data('levelHandler', (config = {}) => levelHandler(config));
});
