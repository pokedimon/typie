function leaderboardSorting() {
    return {
        leaders: [],
        searchName: '',
        filterGrade: '',
        sortKey: 'score',
        sortAsc: false,
        gradeOrder: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
        init() {
            fetch('/api/leaderboard')
                .then(r => r.json())
                .then(data => {
                    data.forEach((item, idx) => {
                        item.rank = idx + 1;
                    });
                    this.leaders = data;
                })
                .catch(err => console.error('Failed to load leaderboard:', err));
        },
        sortBy(key) {
            if (this.sortKey === key) {
                this.sortAsc = !this.sortAsc;
            } else {
                this.sortKey = key;
                this.sortAsc = key === 'name' || key === 'grade';
            }
            const dir = this.sortAsc ? 1 : -1;
            this.leaders.sort((a, b) => {
                let valA = a[key], valB = b[key];
                if (key === 'grade') {
                    valA = this.gradeOrder.indexOf(valA);
                    valB = this.gradeOrder.indexOf(valB);
                    return (valA - valB) * dir;
                }
                if (typeof valA === 'string') {
                    return valA.localeCompare(valB, 'ru') * dir;
                }
                return (valA - valB) * dir;
            });
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
        }
    };
}