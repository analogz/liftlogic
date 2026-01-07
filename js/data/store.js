/**
 * LiftLogic Data Store
 * Centralized state management for workout data
 */

const LiftLogicStore = (function() {
    // Private state
    let _currentUser = 'default';
    let _userProfiles = {};
    let _workouts = [];
    let _listeners = [];

    // Storage keys
    const KEYS = {
        USER_PROFILES: 'userProfiles',
        CURRENT_USER: 'currentUser',
        WORKOUTS: (userId) => userId === 'default' ? 'workouts' : `${userId}_workouts`
    };

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        loadUserProfiles();
        loadWorkouts();
        console.log('[Store] Initialized with', _workouts.length, 'workouts for user:', _currentUser);
    }

    // ========================================
    // USER MANAGEMENT
    // ========================================

    function loadUserProfiles() {
        try {
            const saved = localStorage.getItem(KEYS.USER_PROFILES);
            if (saved) {
                _userProfiles = JSON.parse(saved);
            }
            
            // Ensure default user exists
            if (!_userProfiles['default']) {
                _userProfiles['default'] = {
                    id: 'default',
                    name: 'Default User',
                    email: '',
                    createdAt: new Date().toISOString()
                };
                saveUserProfiles();
            }

            // Get current user
            _currentUser = localStorage.getItem(KEYS.CURRENT_USER) || 'default';
        } catch (e) {
            console.error('[Store] Error loading user profiles:', e);
            _userProfiles = { default: { id: 'default', name: 'Default User' } };
            _currentUser = 'default';
        }
    }

    function saveUserProfiles() {
        try {
            localStorage.setItem(KEYS.USER_PROFILES, JSON.stringify(_userProfiles));
            localStorage.setItem(KEYS.CURRENT_USER, _currentUser);
        } catch (e) {
            console.error('[Store] Error saving user profiles:', e);
        }
    }

    function getCurrentUser() {
        return _userProfiles[_currentUser] || _userProfiles['default'];
    }

    function setCurrentUser(userId) {
        if (_userProfiles[userId]) {
            _currentUser = userId;
            saveUserProfiles();
            loadWorkouts();
            notifyListeners('userChanged', { userId });
        }
    }

    function getAllUsers() {
        return Object.values(_userProfiles);
    }

    // ========================================
    // WORKOUT DATA
    // ========================================

    function loadWorkouts() {
        try {
            const key = KEYS.WORKOUTS(_currentUser);
            const saved = localStorage.getItem(key);
            _workouts = saved ? JSON.parse(saved) : [];
            
            // Normalize data structure
            _workouts = _workouts.map(normalizeWorkout);
            
            // Sort by date
            _workouts.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            notifyListeners('workoutsLoaded', { count: _workouts.length });
        } catch (e) {
            console.error('[Store] Error loading workouts:', e);
            _workouts = [];
        }
    }

    function saveWorkouts() {
        try {
            const key = KEYS.WORKOUTS(_currentUser);
            localStorage.setItem(key, JSON.stringify(_workouts));
            notifyListeners('workoutsSaved', { count: _workouts.length });
        } catch (e) {
            console.error('[Store] Error saving workouts:', e);
        }
    }

    function normalizeWorkout(workout) {
        // Handle legacy format with dailyInfo
        if (workout.dailyInfo && !workout.date) {
            return {
                date: workout.dailyInfo.currentDate || workout.dailyInfo.date,
                time: workout.dailyInfo.currentTime || workout.dailyInfo.time,
                sleepQuality: workout.dailyInfo.sleepQuality,
                stressLevel: workout.dailyInfo.stressLevel,
                bodyWeight: workout.dailyInfo.bodyWeight,
                muscleSoreness: workout.dailyInfo.muscleSoreness,
                sick: workout.dailyInfo.sick,
                injured: workout.dailyInfo.injured,
                exercises: workout.exercises || []
            };
        }
        return workout;
    }

    function getWorkouts(filters = {}) {
        let result = [..._workouts];

        // Date range filter
        if (filters.days) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - filters.days);
            result = result.filter(w => new Date(w.date) >= cutoff);
        }

        if (filters.startDate) {
            result = result.filter(w => new Date(w.date) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            result = result.filter(w => new Date(w.date) <= new Date(filters.endDate));
        }

        // Exercise filter
        if (filters.exercise) {
            result = result.filter(w => 
                w.exercises && w.exercises.some(ex => ex.kind === filters.exercise)
            );
        }

        // Muscle group filter
        if (filters.muscleGroup) {
            result = result.filter(w =>
                w.exercises && w.exercises.some(ex => 
                    getMuscleGroup(ex.kind) === filters.muscleGroup
                )
            );
        }

        return result;
    }

    function getWorkoutByDate(date) {
        return _workouts.find(w => w.date === date);
    }

    function addWorkout(workout) {
        const normalized = normalizeWorkout(workout);
        
        // Check for existing workout on same date
        const existingIndex = _workouts.findIndex(w => w.date === normalized.date);
        if (existingIndex >= 0) {
            // Merge exercises into existing workout
            _workouts[existingIndex].exercises = [
                ..._workouts[existingIndex].exercises,
                ...normalized.exercises
            ];
        } else {
            _workouts.push(normalized);
        }

        // Re-sort
        _workouts.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        saveWorkouts();
        notifyListeners('workoutAdded', { workout: normalized });
        
        return normalized;
    }

    function updateWorkout(date, updates) {
        const index = _workouts.findIndex(w => w.date === date);
        if (index >= 0) {
            _workouts[index] = { ..._workouts[index], ...updates };
            saveWorkouts();
            notifyListeners('workoutUpdated', { workout: _workouts[index] });
            return _workouts[index];
        }
        return null;
    }

    function deleteWorkout(date) {
        const index = _workouts.findIndex(w => w.date === date);
        if (index >= 0) {
            const deleted = _workouts.splice(index, 1)[0];
            saveWorkouts();
            notifyListeners('workoutDeleted', { workout: deleted });
            return deleted;
        }
        return null;
    }

    // ========================================
    // ANALYTICS HELPERS
    // ========================================

    function getThisWeekWorkouts() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        return _workouts.filter(w => new Date(w.date) >= weekStart);
    }

    function getWeeklySets() {
        const thisWeek = getThisWeekWorkouts();
        const sets = {
            Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Legs: 0, Abs: 0
        };

        thisWeek.forEach(w => {
            if (w.exercises) {
                w.exercises.forEach(ex => {
                    const muscle = getMuscleGroup(ex.kind);
                    if (sets.hasOwnProperty(muscle)) {
                        sets[muscle] += ex.sets ? ex.sets.length : 1;
                    }
                });
            }
        });

        return sets;
    }

    function getExerciseHistory(exerciseName, limit = 10) {
        const history = [];
        
        for (let i = _workouts.length - 1; i >= 0 && history.length < limit; i--) {
            const workout = _workouts[i];
            if (workout.exercises) {
                const exercise = workout.exercises.find(ex => ex.kind === exerciseName);
                if (exercise) {
                    history.push({
                        date: workout.date,
                        exercise: exercise
                    });
                }
            }
        }

        return history.reverse();
    }

    function getPersonalBest(exerciseName) {
        let best = { weight: 0, reps: 0, date: null };

        _workouts.forEach(workout => {
            if (workout.exercises) {
                const exercise = workout.exercises.find(ex => ex.kind === exerciseName);
                if (exercise && exercise.sets) {
                    exercise.sets.forEach(set => {
                        if (set.weight > best.weight) {
                            best = { weight: set.weight, reps: set.reps, date: workout.date };
                        }
                    });
                }
            }
        });

        return best.date ? best : null;
    }

    // ========================================
    // MUSCLE GROUP MAPPING - uses centralized ExerciseDB
    // ========================================

    function getMuscleGroup(exerciseName) {
        if (typeof ExerciseDB !== 'undefined') {
            return ExerciseDB.getMuscleGroup(exerciseName);
        }
        // Fallback if ExerciseDB not loaded
        return 'Other';
    }

    // ========================================
    // EXPORT / IMPORT
    // ========================================

    function exportData() {
        return {
            version: 2,
            exportedAt: new Date().toISOString(),
            currentUser: _currentUser,
            userProfiles: _userProfiles,
            workouts: _workouts
        };
    }

    function importData(data) {
        try {
            if (data.userProfiles) {
                _userProfiles = { ..._userProfiles, ...data.userProfiles };
                saveUserProfiles();
            }

            if (data.workouts) {
                _workouts = data.workouts.map(normalizeWorkout);
                saveWorkouts();
            }

            notifyListeners('dataImported', { count: _workouts.length });
            return { success: true, count: _workouts.length };
        } catch (e) {
            console.error('[Store] Import failed:', e);
            return { success: false, error: e.message };
        }
    }

    // ========================================
    // EVENT SYSTEM
    // ========================================

    function subscribe(callback) {
        _listeners.push(callback);
        return () => {
            _listeners = _listeners.filter(cb => cb !== callback);
        };
    }

    function notifyListeners(event, data) {
        _listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (e) {
                console.error('[Store] Listener error:', e);
            }
        });
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        init,
        // User
        getCurrentUser,
        setCurrentUser,
        getAllUsers,
        // Workouts
        getWorkouts,
        getWorkoutByDate,
        addWorkout,
        updateWorkout,
        deleteWorkout,
        // Analytics
        getThisWeekWorkouts,
        getWeeklySets,
        getExerciseHistory,
        getPersonalBest,
        getMuscleGroup,
        // Export/Import
        exportData,
        importData,
        // Events
        subscribe
    };
})();

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.LiftLogicStore = LiftLogicStore;
    // Initialize on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => LiftLogicStore.init());
    } else {
        LiftLogicStore.init();
    }
}

