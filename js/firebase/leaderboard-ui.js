/**
 * LiftLogic Leaderboard UI Component
 * Renders the auth bar and leaderboard in the DOM
 */

const LeaderboardUI = (function() {
    
    /**
     * Render the complete leaderboard section
     */
    function render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[LeaderboardUI] Container not found:', containerId);
            return;
        }

        // Check if Firebase is configured
        if (!FirebaseConfig.isConfigured()) {
            container.innerHTML = renderNotConfigured();
            return;
        }

        container.innerHTML = `
            <h2 style="color: var(--accent); margin-bottom: var(--space-1);">🏆 Weekly Leaderboard</h2>
            <p class="caption" style="margin-bottom: var(--space-2); color: var(--grey-500);">Compete with friends for weekly volume gains</p>
            <div id="leaderboard-auth-bar"></div>
            <div id="leaderboard-my-stats"></div>
            <div id="leaderboard-rankings"></div>
        `;

        // Subscribe to auth changes
        LiftLogicAuth.subscribe((event, user) => {
            updateAuthBar(user);
            updateMyStats();
            bindAuthButtons();
        });

        // Subscribe to leaderboard updates
        LiftLogicLeaderboard.subscribe((event, data) => {
            updateRankings(data);
            updateMyStats();
        });

        // Initial render
        updateAuthBar(LiftLogicAuth.getCurrentUser());
        updateMyStats();
        updateRankings(LiftLogicLeaderboard.getLeaderboard());
        bindAuthButtons();
    }

    /**
     * Render when Firebase is not configured
     */
    function renderNotConfigured() {
        return `
            <div class="firebase-not-configured">
                <div class="firebase-not-configured-icon">🔥</div>
                <h3>Leaderboard Requires Firebase</h3>
                <p>Set up Firebase to compete with friends.<br>
                See <code>js/firebase/config.js</code> for instructions.</p>
            </div>
        `;
    }

    /**
     * Update the auth bar
     */
    function updateAuthBar(user) {
        const authBar = document.getElementById('leaderboard-auth-bar');
        if (!authBar) return;

        if (user) {
            const rank = LiftLogicLeaderboard.getMyRank();
            authBar.innerHTML = `
                <div class="auth-bar">
                    <div class="auth-user">
                        ${user.photoURL 
                            ? `<img class="auth-avatar" src="${user.photoURL}" alt="${user.displayName}">`
                            : `<div class="auth-avatar-placeholder">${getInitials(user.displayName)}</div>`
                        }
                        <div class="auth-info">
                            <span class="auth-name">${user.displayName}</span>
                            ${rank ? `<span class="auth-rank">Rank #${rank} this week</span>` : ''}
                        </div>
                    </div>
                    <button class="auth-btn secondary" id="signout-btn">
                        Sign Out
                    </button>
                </div>
            `;
        } else {
            authBar.innerHTML = `
                <div class="auth-bar signed-out">
                    <button class="auth-btn" id="google-signin-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Sign in with Google
                    </button>
                </div>
            `;
        }
        bindAuthButtons();
    }

    /**
     * Bind click handlers to auth buttons
     */
    function bindAuthButtons() {
        const signInBtn = document.getElementById('google-signin-btn');
        if (signInBtn) {
            signInBtn.onclick = async () => {
                signInBtn.disabled = true;
                signInBtn.textContent = 'Signing in...';
                const result = await LiftLogicAuth.signInWithGoogle();
                if (!result.success) {
                    signInBtn.disabled = false;
                    signInBtn.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Sign in with Google
                    `;
                    alert('Sign in failed: ' + result.error);
                }
            };
        }

        const signOutBtn = document.getElementById('signout-btn');
        if (signOutBtn) {
            signOutBtn.onclick = () => LiftLogicAuth.signOut();
        }
    }

    /**
     * Update my stats card
     */
    function updateMyStats() {
        const statsContainer = document.getElementById('leaderboard-my-stats');
        if (!statsContainer) return;

        const user = LiftLogicAuth.getCurrentUser();
        if (!user) {
            statsContainer.innerHTML = '';
            return;
        }

        const stats = LiftLogicLeaderboard.calculateWeeklyStats();
        const rank = LiftLogicLeaderboard.getMyRank();

        statsContainer.innerHTML = `
            <div class="my-stats-card">
                <div class="my-stats-header">
                    <h4 class="my-stats-title">Your Week</h4>
                    ${rank ? `<span class="my-stats-rank">#${rank}</span>` : ''}
                </div>
                <div class="my-stats-score">${stats.score.toLocaleString()}</div>
                <div class="my-stats-label">Weekly Score</div>
                <div class="my-stats-grid">
                    <div class="my-stats-item">
                        <div class="my-stats-value">${stats.totalSets}</div>
                        <div class="my-stats-item-label">Sets</div>
                    </div>
                    <div class="my-stats-item">
                        <div class="my-stats-value">${formatVolume(stats.totalVolume)}</div>
                        <div class="my-stats-item-label">Volume</div>
                    </div>
                    <div class="my-stats-item">
                        <div class="my-stats-value">${stats.daysTraining}</div>
                        <div class="my-stats-item-label">Days</div>
                    </div>
                </div>
            </div>
            <div class="leaderboard-sync">
                <button class="sync-btn" onclick="syncAndUpdate()" id="sync-btn">
                    ↑ Sync Stats
                </button>
            </div>
        `;
    }

    /**
     * Update the rankings list
     */
    function updateRankings(data) {
        const rankingsContainer = document.getElementById('leaderboard-rankings');
        if (!rankingsContainer) return;

        const user = LiftLogicAuth.getCurrentUser();
        
        if (!user) {
            rankingsContainer.innerHTML = `
                <div class="leaderboard">
                    <div class="leaderboard-header">
                        <h4 class="leaderboard-title">🏆 Weekly Leaderboard</h4>
                        <span class="leaderboard-week">${LiftLogicLeaderboard.getCurrentWeekId()}</span>
                    </div>
                    <div class="leaderboard-empty">
                        <div class="leaderboard-empty-icon">🔐</div>
                        <div class="leaderboard-empty-text">Sign in to view the leaderboard</div>
                    </div>
                </div>
            `;
            return;
        }

        if (!data || data.length === 0) {
            rankingsContainer.innerHTML = `
                <div class="leaderboard">
                    <div class="leaderboard-header">
                        <h4 class="leaderboard-title">🏆 Weekly Leaderboard</h4>
                        <span class="leaderboard-week">${LiftLogicLeaderboard.getCurrentWeekId()}</span>
                    </div>
                    <div class="leaderboard-empty">
                        <div class="leaderboard-empty-icon">🏋️</div>
                        <div class="leaderboard-empty-text">
                            No entries yet this week<br>
                            <small style="color:var(--grey-500)">Log workouts and sync to join!</small>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const entriesHtml = data.map(entry => {
            const isMe = user && entry.odId === user.uid;
            return `
                <li class="leaderboard-entry${isMe ? ' me' : ''}">
                    <div class="leaderboard-rank">${entry.rank}</div>
                    ${entry.photoURL 
                        ? `<img class="leaderboard-avatar" src="${entry.photoURL}" alt="${entry.displayName}">`
                        : `<div class="leaderboard-avatar-placeholder">${getInitials(entry.displayName)}</div>`
                    }
                    <div class="leaderboard-user">
                        <div class="leaderboard-name">${entry.displayName}${isMe ? ' (You)' : ''}</div>
                        <div class="leaderboard-stats">${entry.totalSets} sets · ${entry.daysTraining} days</div>
                    </div>
                    <div class="leaderboard-score">
                        <div class="leaderboard-score-value">${entry.score.toLocaleString()}</div>
                        <div class="leaderboard-score-label">points</div>
                    </div>
                </li>
            `;
        }).join('');

        rankingsContainer.innerHTML = `
            <div class="leaderboard">
                <div class="leaderboard-header">
                    <h4 class="leaderboard-title">🏆 Weekly Leaderboard</h4>
                    <span class="leaderboard-week">${LiftLogicLeaderboard.getCurrentWeekId()}</span>
                </div>
                <ul class="leaderboard-list">
                    ${entriesHtml}
                </ul>
            </div>
        `;
    }

    // ========================================
    // HELPERS
    // ========================================

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function formatVolume(volume) {
        if (volume >= 1000000) return (volume / 1000000).toFixed(1) + 'M';
        if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K';
        return volume.toString();
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        render
    };
})();

// Global sync function
async function syncAndUpdate() {
    const btn = document.getElementById('sync-btn');
    if (btn) {
        btn.classList.add('syncing');
        btn.textContent = 'Syncing...';
    }

    const result = await LiftLogicLeaderboard.syncToFirebase();
    
    if (btn) {
        btn.classList.remove('syncing');
        btn.textContent = result.success ? '✓ Synced!' : '✗ Failed';
        
        setTimeout(() => {
            btn.textContent = '↑ Sync Stats';
        }, 2000);
    }
}

// Make globally available
window.LeaderboardUI = LeaderboardUI;

