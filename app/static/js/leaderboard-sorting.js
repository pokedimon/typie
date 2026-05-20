function leaderboardSorting() {
    return {
        mode: 'allTime',
        leaders: [],
        games: [],
        searchName: '',
        filterGrade: '',
        
        filterMinChars: '',
        filterVelocity: '0',
        filterTime: 'Любое',
        
        sortKey: 'score',
        sortAsc: false,
        gradeOrder: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
        
        init() {
            fetch('/api/leaderboard')
                .then(r => r.json())
                .then(data => {
                    this.leaders = data;
                })
                .catch(err => console.error('Failed to load leaderboard:', err));
                
            fetch('/api/games')
                .then(r => r.json())
                .then(data => {
                    this.games = data;
                })
                .catch(err => console.error('Failed to load games:', err));
        },
        
        setMode(newMode) {
            this.mode = newMode;
            this.sortKey = 'score';
            this.sortAsc = false;
        },
        
        sortBy(key) {
            if (this.sortKey === key) {
                this.sortAsc = !this.sortAsc;
            } else {
                this.sortKey = key;
                this.sortAsc = key === 'name' || key === 'grade';
            }
        },
        
        getArrow(key) {
            if (this.sortKey !== key) return 'mobiledata_arrows';
            return this.sortAsc ? 'arrow_downward' : 'arrow_upward';
        },
        
        getRankBadge(rank) {
            if (rank === 1) return '🥇';
            if (rank === 2) return '🥈';
            if (rank === 3) return '🥉';
            return rank;
        },
        
        getRowClass(rank) {
            if (rank === 1) return 'bg-yellow-500/10';
            if (rank === 2) return 'bg-gray-400/10';
            if (rank === 3) return 'bg-amber-700/10';
            return '';
        },
        
        getRankColorClass(rank) {
            if (rank === 1) return 'text-yellow-400';
            if (rank === 2) return 'text-gray-400';
            if (rank === 3) return 'text-amber-600';
            return 'text-gray-300';
        },
        
        get filteredAndSortedLeaders() {
            let filtered = this.leaders.filter(player => {
                const matchName = player.name.toLowerCase().includes(this.searchName.toLowerCase());
                const matchGrade = this.filterGrade === '' || this.filterGrade === 'Все' || player.grade === this.filterGrade;
                return matchName && matchGrade;
            });
            const sorted = filtered.sort((a, b) => {
                let valA = a[this.sortKey], valB = b[this.sortKey];
                const dir = this.sortAsc ? 1 : -1;
                if (this.sortKey === 'grade') {
                    valA = this.gradeOrder.indexOf(valA);
                    valB = this.gradeOrder.indexOf(valB);
                    return (valA - valB) * dir;
                }
                if (typeof valA === 'string') {
                    return valA.localeCompare(valB, 'ru') * dir;
                }
                return (valA - valB) * dir;
            });
            
            return sorted;
        },
        
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
                if (this.sortKey === 'grade') {
                    valA = this.gradeOrder.indexOf(valA);
                    valB = this.gradeOrder.indexOf(valB);
                    return (valA - valB) * dir;
                }
                if (this.sortKey === 'velocity' || this.sortKey === 'time') {
                    valA = parseInt(valA, 10) || 0;
                    valB = parseInt(valB, 10) || 0;
                }
                if (typeof valA === 'string') {
                    return valA.localeCompare(valB, 'ru') * dir;
                }
                return (valA - valB) * dir;
            });
            
            return sorted;
        }
    };
}