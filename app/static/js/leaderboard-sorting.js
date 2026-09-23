/**
 * =============================================================================
 * Alpine.js Component: leaderboardSorting
 * =============================================================================
 * Powers the interactive Leaderboard page. Supports two viewing modes:
 * 1. 'allTime': Cumulative rankings by player total score.
 * 2. 'games': Individual typing session attempts and metrics.
 *
 * Provides real-time client-side searching, multi-criteria filtering
 * (school grade, minimum characters, velocity, duration), and custom sorting
 * (numeric, Russian alphabetical collation, and educational grade order).
 */
function leaderboardSorting() {
    return {
        // --- Component State ---
        mode: 'allTime',         // Active tab: 'allTime' (players) or 'games' (runs)
        leaders: [],             // Array of player objects fetched from /api/leaderboard
        games: [],               // Array of game attempt objects fetched from /api/games
        searchName: '',          // Substring search query for filtering player names
        filterGrade: '',         // Grade filter dropdown ('', 'Все', or '0'-'11')
        
        // Filters specific to the 'games' view:
        filterMinChars: '',      // Minimum character count threshold
        filterVelocity: '0',     // Target typing speed filter ('0' = any)
        filterTime: 'Любое',     // Session duration filter in seconds ('Любое' = any)
        
        // Sorting configuration:
        sortKey: 'score',        // Active column key to sort by
        sortAsc: false,          // Sort direction: false = descending, true = ascending
        // Custom sort hierarchy for school grades (kindergarten/none = '0', grades 1 to 11)
        gradeOrder: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
        
        /**
         * Component Initialization:
         * Fetches player leaderboard and game sessions from their respective API endpoints.
         */
        init() {
            // Load user rankings
            fetch('/api/leaderboard')
                .then(r => r.json())
                .then(data => {
                    this.leaders = data;
                })
                .catch(err => console.error('Failed to load leaderboard:', err));
                
            // Load individual game run records
            fetch('/api/games')
                .then(r => r.json())
                .then(data => {
                    this.games = data;
                })
                .catch(err => console.error('Failed to load games:', err));
        },
        
        /**
         * Switches the active leaderboard tab ('allTime' vs 'games')
         * and resets sorting to highest score first.
         */
        setMode(newMode) {
            this.mode = newMode;
            this.sortKey = 'score';
            this.sortAsc = false;
        },
        
        /**
         * Toggles or updates the sort column:
         * - If clicking the active column: inverts sort direction.
         * - If clicking a new column: sets default direction
         *   (ascending for alphabetical/grade fields, descending for scores/numbers).
         */
        sortBy(key) {
            if (this.sortKey === key) {
                this.sortAsc = !this.sortAsc;
            } else {
                this.sortKey = key;
                this.sortAsc = key === 'name' || key === 'grade';
            }
        },
        
        /**
         * Returns the Material Symbols icon name for table header sort indicators:
         * - 'mobiledata_arrows': column is not currently active for sorting
         * - 'arrow_upward' / 'arrow_downward': indicates current sort direction
         */
        getArrow(key) {
            if (this.sortKey !== key) return 'mobiledata_arrows';
            return this.sortAsc ? 'arrow_downward' : 'arrow_upward';
        },
        
        /**
         * Returns medal emojis for podium positions (1st, 2nd, 3rd)
         * or the plain numeric rank for 4th and below.
         */
        getRankBadge(rank) {
            if (rank === 1) return '🥇';
            if (rank === 2) return '🥈';
            if (rank === 3) return '🥉';
            return rank;
        },
        
        /**
         * Returns subtle background highlight classes for the top 3 podium rows.
         */
        getRowClass(rank) {
            if (rank === 1) return 'bg-yellow-500/10';
            if (rank === 2) return 'bg-gray-400/10';
            if (rank === 3) return 'bg-amber-700/10';
            return '';
        },
        
        /**
         * Returns podium text accent colors for ranks 1 to 3.
         */
        getRankColorClass(rank) {
            if (rank === 1) return 'text-yellow-400';
            if (rank === 2) return 'text-gray-400';
            if (rank === 3) return 'text-amber-600';
            return 'text-gray-300';
        },
        
        /**
         * Computed Getter: filteredAndSortedLeaders
         * Filters and sorts the cumulative player list:
         * 1. Filters by case-insensitive name query and school grade selection.
         * 2. Sorts results based on active `sortKey` and `sortAsc` direction:
         *    - Grades are sorted using the custom `gradeOrder` index.
         *    - String names are sorted using Russian locale collation ('ru').
         *    - Numeric values (scores) are sorted by mathematical difference.
         */
        get filteredAndSortedLeaders() {
            let filtered = this.leaders.filter(player => {
                const matchName = player.name.toLowerCase().includes(this.searchName.toLowerCase());
                const matchGrade = this.filterGrade === '' || this.filterGrade === 'Все' || player.grade === this.filterGrade;
                return matchName && matchGrade;
            });
            const sorted = filtered.sort((a, b) => {
                let valA = a[this.sortKey], valB = b[this.sortKey];
                const dir = this.sortAsc ? 1 : -1;

                // Sort by predefined grade hierarchy
                if (this.sortKey === 'grade') {
                    valA = this.gradeOrder.indexOf(valA);
                    valB = this.gradeOrder.indexOf(valB);
                    return (valA - valB) * dir;
                }
                // Sort strings with Russian locale collation
                if (typeof valA === 'string') {
                    return valA.localeCompare(valB, 'ru') * dir;
                }
                // Numeric sort
                return (valA - valB) * dir;
            });
            
            return sorted;
        },
        
        /**
         * Computed Getter: filteredAndSortedGames
         * Filters and sorts individual game attempt records:
         * 1. Filters by player name, school grade, minimum character count,
         *    velocity/speed setting, and round duration.
         * 2. Sorts results according to `sortKey` and `sortAsc`:
         *    - Supports grade indexing, numeric casting for velocity/time/score,
         *      and string comparison for player names.
         */
        get filteredAndSortedGames() {
            let filtered = this.games.filter(game => {
                const matchName = game.name.toLowerCase().includes(this.searchName.toLowerCase());
                const matchGrade = this.filterGrade === '' || this.filterGrade === 'Все' || game.grade === this.filterGrade;
                
                const minChars = parseInt(this.filterMinChars, 10);
                const matchChars = isNaN(minChars) ? true : game.chars_len >= minChars;
                
                const matchVelocity = this.filterVelocity === '0' || game.velocity === this.filterVelocity;
                const matchTime = this.filterTime === 'Любое' || game.time.toString() === this.filterTime;
                
                return matchName && matchGrade && matchChars && matchVelocity && matchTime;
            });
            const sorted = filtered.sort((a, b) => {
                let valA = a[this.sortKey], valB = b[this.sortKey];
                const dir = this.sortAsc ? 1 : -1;

                // Sort by predefined grade hierarchy
                if (this.sortKey === 'grade') {
                    valA = this.gradeOrder.indexOf(valA);
                    valB = this.gradeOrder.indexOf(valB);
                    return (valA - valB) * dir;
                }
                // Parse velocity or duration numbers for accurate numeric comparison
                if (this.sortKey === 'velocity' || this.sortKey === 'time') {
                    valA = parseInt(valA, 10) || 0;
                    valB = parseInt(valB, 10) || 0;
                }
                // String comparison with Russian locale
                if (typeof valA === 'string') {
                    return valA.localeCompare(valB, 'ru') * dir;
                }
                // Numeric comparison
                return (valA - valB) * dir;
            });
            
            return sorted;
        }
    };
}