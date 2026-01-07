/**
 * LiftLogic Leaderboard System
 * Syncs workout data and manages competitive rankings
 */

const LiftLogicLeaderboard = (function() {
    let _leaderboardData = [];
    let _unsubscribe = null;
    let _listeners = [];

    // ========================================
    // WEEK UTILITIES
    // ========================================

    /**
     * Get current week ID (e.g., "2026-W01")
     */
    function getCurrentWeekId() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    }

    /**
     * Get week start date
     */
    function getWeekStart() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
    }

    // ========================================
    // SCORE CALCULATION
    // ========================================

    /**
     * Calculate weekly stats from local workouts
     */
    function calculateWeeklyStats() {
        const workouts = JSON.parse(localStorage.getItem('workouts') || '[]');
        const weekStart = getWeekStart();
        
        const thisWeekWorkouts = workouts.filter(w => {
            const date = w.date || w.dailyInfo?.currentDate;
            return date && new Date(date) >= weekStart;
        });

        let totalVolume = 0;
        let totalSets = 0;
        let totalReps = 0;
        const muscleGroups = {
            Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Legs: 0, Abs: 0
        };
        const exercisesPerformed = new Set();
        const daysTraining = new Set();

        thisWeekWorkouts.forEach(workout => {
            const date = workout.date || workout.dailyInfo?.currentDate;
            if (date) daysTraining.add(date);

            if (workout.exercises) {
                workout.exercises.forEach(exercise => {
                    exercisesPerformed.add(exercise.kind);
                    const muscle = getMuscleGroup(exercise.kind);
                    
                    if (exercise.sets) {
                        exercise.sets.forEach(set => {
                            const weight = parseFloat(set.weight) || 0;
                            const reps = parseInt(set.reps) || 0;
                            totalVolume += weight * reps;
                            totalReps += reps;
                            totalSets++;
                        });
                        
                        if (muscleGroups.hasOwnProperty(muscle)) {
                            muscleGroups[muscle] += exercise.sets.length;
                        }
                    }
                });
            }
        });

        // Calculate composite score
        // Score = Sets × 10 + Volume/1000 + Days × 50
        const score = Math.round(
            (totalSets * 10) + 
            (totalVolume / 1000) + 
            (daysTraining.size * 50)
        );

        return {
            weekId: getCurrentWeekId(),
            totalVolume: Math.round(totalVolume),
            totalSets,
            totalReps,
            daysTraining: daysTraining.size,
            exerciseCount: exercisesPerformed.size,
            muscleGroups,
            score,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Get muscle group from exercise name
     */
    function getMuscleGroup(exerciseName) {
        const muscleMap = {
            'Chest': ['bench', 'chest', 'fly', 'dip', 'pec', 'incline', 'decline'],
            'Back': ['row', 'pull', 'lat', 'deadlift', 'back', 'chin'],
            'Shoulders': ['shoulder', 'press', 'lateral', 'delt', 'raise', 'ohp'],
            'Legs': ['squat', 'leg', 'lunge', 'calf', 'ham', 'quad', 'glute'],
            'Arms': ['curl', 'tricep', 'bicep', 'arm', 'extension'],
            'Abs': ['ab', 'crunch', 'plank', 'core', 'leg raise']
        };

        const lower = exerciseName.toLowerCase();
        for (const [group, keywords] of Object.entries(muscleMap)) {
            if (keywords.some(k => lower.includes(k))) return group;
        }
        return 'Other';
    }

    // ========================================
    // SYNC TO FIREBASE
    // ========================================

    /**
     * Sync current week stats to Firebase
     */
    async function syncToFirebase() {
        const user = LiftLogicAuth.getCurrentUser();
        if (!user) {
            console.warn('[Leaderboard] Not signed in, cannot sync');
            return { success: false, error: 'Not signed in' };
        }

        const db = FirebaseConfig.getDb();
        if (!db) {
            return { success: false, error: 'Firebase not initialized' };
        }

        try {
            const stats = calculateWeeklyStats();
            const weekId = getCurrentWeekId();

            // Update user's weekly stats
            await db.collection('weeklyStats')
                .doc(`${user.uid}_${weekId}`)
                .set({
                    odId: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    ...stats,
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log('[Leaderboard] Synced stats:', stats);
            return { success: true, stats };
        } catch (error) {
            console.error('[Leaderboard] Sync failed:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // LEADERBOARD QUERIES
    // ========================================

    /**
     * Subscribe to real-time leaderboard updates
     */
    function subscribeToLeaderboard(weekId = null) {
        const db = FirebaseConfig.getDb();
        if (!db) {
            console.warn('[Leaderboard] Firebase not initialized');
            return;
        }

        const targetWeek = weekId || getCurrentWeekId();

        // Unsubscribe from previous listener
        if (_unsubscribe) {
            _unsubscribe();
        }

        // Listen to leaderboard updates
        _unsubscribe = db.collection('weeklyStats')
            .where('weekId', '==', targetWeek)
            .orderBy('score', 'desc')
            .limit(50)
            .onSnapshot((snapshot) => {
                _leaderboardData = snapshot.docs.map((doc, index) => ({
                    rank: index + 1,
                    odId: doc.data().odId,
                    ...doc.data()
                }));

                notifyListeners('updated', _leaderboardData);
                console.log('[Leaderboard] Updated:', _leaderboardData.length, 'entries');
            }, (error) => {
                console.error('[Leaderboard] Subscription error:', error);
            });
    }

    /**
     * Get current leaderboard data
     */
    function getLeaderboard() {
        return _leaderboardData;
    }

    /**
     * Get current user's rank
     */
    function getMyRank() {
        const user = LiftLogicAuth.getCurrentUser();
        if (!user) return null;

        const entry = _leaderboardData.find(e => e.odId === user.uid);
        return entry ? entry.rank : null;
    }

    /**
     * Get historical leaderboard (past weeks)
     */
    async function getHistoricalLeaderboard(weekId) {
        const db = FirebaseConfig.getDb();
        if (!db) return [];

        try {
            const snapshot = await db.collection('weeklyStats')
                .where('weekId', '==', weekId)
                .orderBy('score', 'desc')
                .limit(50)
                .get();

            return snapshot.docs.map((doc, index) => ({
                rank: index + 1,
                ...doc.data()
            }));
        } catch (error) {
            console.error('[Leaderboard] Historical query failed:', error);
            return [];
        }
    }

    // ========================================
    // EVENT SYSTEM
    // ========================================

    function subscribe(callback) {
        _listeners.push(callback);
        // Immediately send current data
        if (_leaderboardData.length > 0) {
            callback('updated', _leaderboardData);
        }
        return () => {
            _listeners = _listeners.filter(cb => cb !== callback);
        };
    }

    function notifyListeners(event, data) {
        _listeners.forEach(cb => {
            try {
                cb(event, data);
            } catch (e) {
                console.error('[Leaderboard] Listener error:', e);
            }
        });
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        if (!FirebaseConfig.isConfigured()) {
            console.warn('[Leaderboard] Firebase not configured');
            return false;
        }

        // Subscribe to auth changes
        LiftLogicAuth.subscribe((event, user) => {
            if (event === 'signedIn') {
                // Start listening to leaderboard
                subscribeToLeaderboard();
                // Sync local data
                syncToFirebase();
            } else if (event === 'signedOut') {
                // Stop listening
                if (_unsubscribe) {
                    _unsubscribe();
                    _unsubscribe = null;
                }
                _leaderboardData = [];
            }
        });

        console.log('[Leaderboard] Initialized');
        return true;
    }

    /**
     * Cleanup
     */
    function destroy() {
        if (_unsubscribe) {
            _unsubscribe();
            _unsubscribe = null;
        }
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        init,
        destroy,
        calculateWeeklyStats,
        syncToFirebase,
        subscribeToLeaderboard,
        getLeaderboard,
        getMyRank,
        getHistoricalLeaderboard,
        getCurrentWeekId,
        subscribe
    };
})();

// Make globally available
window.LiftLogicLeaderboard = LiftLogicLeaderboard;

