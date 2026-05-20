function levelHandler() {
    return {
        roundScore: 0,
        timer: 0,
        isStartScreen: true,
        gameOver: false,
        isPaused: false,
        victory: false,
        monkeys: [],
        monkeyId: 0,
        loopId: null,
        timerIntervalId: null,

        init() {
            this.timer = levelTime;
            this.roundScore = 0;
        },

        startRound() {
            this.isStartScreen = false;
            this.gameOver = false;
            this.isPaused = false;
            this.victory = false;
            this.timer = levelTime;
            this.roundScore = 0;
            this.startLoop();
        },

        startLoop() {
            this.monkeys = [];
            this.runGameIntervals();
        },

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

        togglePause() {
            if (!this.isStartScreen && !this.gameOver && !this.victory) {
                this.isPaused = !this.isPaused;
            }
        },

        stopTraining() {
            clearInterval(this.loopId);
            clearInterval(this.timerIntervalId);
            window.location.href = "/levels";
        },

        update() {
            const field = document.getElementById('game-field');
            if (!field) return;
            const fw = field.clientWidth;
            const fh = field.clientHeight;

            const spawnRate = 0.015 * levelSpeed;

            if (Math.random() < spawnRate) {
                this.spawnMonkey(fw, fh);
            }

            this.monkeys.forEach(m => {
                if (!m.isCaught) {
                    m.x += m.vx;
                    m.y += m.vy;
                    if (m.x < -150 || m.x > fw + 150 || m.y < -150 || m.y > fh + 150) {
                        m.outOfBounds = true;
                    }
                }
            });

            this.monkeys = this.monkeys.filter(m => !m.outOfBounds && !m.removed);
        },

        spawnMonkey(fw, fh) {
            const side = Math.floor(Math.random() * 4);
            let x, y, vx, vy;

            const baseSpeed = 0.5 + Math.random() * 0.7;
            const finalSpeed = baseSpeed * levelSpeed;

            const angle = Math.random() * Math.PI * 2;
            const vxRandom = Math.cos(angle) * finalSpeed;
            const vyRandom = Math.sin(angle) * finalSpeed;

            if (side === 0) { x = Math.random() * fw; y = -100; vx = vxRandom; vy = vyRandom; }
            else if (side === 1) { x = fw + 100; y = Math.random() * fh; vx = vxRandom; vy = vyRandom; }
            else if (side === 2) { x = Math.random() * fw; y = fh + 100; vx = vxRandom; vy = vyRandom; }
            else { x = -100; y = Math.random() * fh; vx = vxRandom; vy = vyRandom; }

            const chars = levelKeys;
            if (!chars || chars.length === 0) return;

            this.monkeys.push({
                id: this.monkeyId++,
                x, y, vx, vy,
                letter: chars[Math.floor(Math.random() * chars.length)],
                isCaught: false, removed: false, outOfBounds: false
            });
        },

        pulseClass: '',

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
                if (this.roundScore >= levelTargetScore) {
                    this.triggerVictory();
                }
            } else if (index === -1 && /^[А-ЯЁ]$/.test(char)) {
                // Penalize for wrong letters (only in full alphabet range)
                this.roundScore = Math.max(0, this.roundScore - 5);
                this.pulseClass = 'bg-red-600/30 transition-colors duration-100';
                setTimeout(() => { this.pulseClass = ''; }, 300);
            }
        },

        triggerVictory() {
            this.victory = true;
            clearInterval(this.loopId);
            clearInterval(this.timerIntervalId);

            // Send completed level to backend
            fetch('/update_level', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ level: levelId })
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

        endRound() {
            clearInterval(this.loopId);
            clearInterval(this.timerIntervalId);
            this.gameOver = true;
        },

        restartGame() {
            this.startRound();
        }
    };
}
