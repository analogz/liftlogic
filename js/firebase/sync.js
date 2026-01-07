/**
 * LiftLogic Cloud Sync
 * Syncs all workout data to Firebase Firestore
 */

const LiftLogicSync = (function() {
    let _isSyncing = false;
    let _lastSyncTime = null;
    let _listeners = [];

    const STORAGE_KEY = 'workouts';
    const LAST_SYNC_KEY = 'lastCloudSync';

    // ========================================
    // UPLOAD TO CLOUD
    // ========================================

    /**
     * Upload all local workouts to Firebase
     */
    async function uploadWorkouts() {
        const user = LiftLogicAuth.getCurrentUser();
        if (!user) {
            console.warn('[Sync] Not signed in, cannot upload');
            return { success: false, error: 'Not signed in' };
        }

        const db = FirebaseConfig.getDb();
        if (!db) {
            return { success: false, error: 'Firebase not initialized' };
        }

        _isSyncing = true;
        notifyListeners('syncing', { direction: 'upload' });

        try {
            const workouts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            
            // Store workouts in user's subcollection
            const userWorkoutsRef = db.collection('users').doc(user.uid).collection('workouts');
            
            // Use batch writes for efficiency
            const batch = db.batch();
            
            workouts.forEach(workout => {
                // Create a unique ID based on date and timestamp
                const workoutId = workout.id || `${workout.date || workout.dailyInfo?.currentDate}_${Date.now()}`;
                workout.id = workoutId;
                
                const docRef = userWorkoutsRef.doc(workoutId);
                batch.set(docRef, {
                    ...workout,
                    odId: user.uid,
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            
            // Update last sync time
            _lastSyncTime = new Date().toISOString();
            localStorage.setItem(LAST_SYNC_KEY, _lastSyncTime);

            console.log('[Sync] Uploaded', workouts.length, 'workouts');
            _isSyncing = false;
            notifyListeners('complete', { direction: 'upload', count: workouts.length });
            
            return { success: true, count: workouts.length };
        } catch (error) {
            console.error('[Sync] Upload failed:', error);
            _isSyncing = false;
            notifyListeners('error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload a single workout (for real-time sync)
     */
    async function uploadSingleWorkout(workout) {
        const user = LiftLogicAuth.getCurrentUser();
        if (!user) return { success: false, error: 'Not signed in' };

        const db = FirebaseConfig.getDb();
        if (!db) return { success: false, error: 'Firebase not initialized' };

        try {
            const workoutId = workout.id || `${workout.date || workout.dailyInfo?.currentDate}_${Date.now()}`;
            workout.id = workoutId;

            await db.collection('users').doc(user.uid).collection('workouts').doc(workoutId).set({
                ...workout,
                odId: user.uid,
                syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('[Sync] Uploaded workout:', workoutId);
            notifyListeners('workoutSynced', { workoutId });
            return { success: true, workoutId };
        } catch (error) {
            console.error('[Sync] Single upload failed:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // DOWNLOAD FROM CLOUD
    // ========================================

    /**
     * Download all workouts from Firebase
     */
    async function downloadWorkouts() {
        const user = LiftLogicAuth.getCurrentUser();
        if (!user) {
            console.warn('[Sync] Not signed in, cannot download');
            return { success: false, error: 'Not signed in' };
        }

        const db = FirebaseConfig.getDb();
        if (!db) {
            return { success: false, error: 'Firebase not initialized' };
        }

        _isSyncing = true;
        notifyListeners('syncing', { direction: 'download' });

        try {
            const snapshot = await db.collection('users').doc(user.uid)
                .collection('workouts')
                .orderBy('syncedAt', 'desc')
                .get();

            const cloudWorkouts = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            }));

            console.log('[Sync] Downloaded', cloudWorkouts.length, 'workouts from cloud');
            
            _isSyncing = false;
            notifyListeners('complete', { direction: 'download', count: cloudWorkouts.length });
            
            return { success: true, workouts: cloudWorkouts };
        } catch (error) {
            console.error('[Sync] Download failed:', error);
            _isSyncing = false;
            notifyListeners('error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // MERGE & SYNC
    // ========================================

    /**
     * Full sync: merge local and cloud data
     */
    async function fullSync() {
        const user = LiftLogicAuth.getCurrentUser();
        if (!user) {
            return { success: false, error: 'Not signed in' };
        }

        notifyListeners('syncing', { direction: 'both' });

        try {
            // 1. Download cloud workouts
            const downloadResult = await downloadWorkouts();
            if (!downloadResult.success) {
                return downloadResult;
            }
            const cloudWorkouts = downloadResult.workouts;

            // 2. Get local workouts
            const localWorkouts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

            // 3. Merge (cloud wins for conflicts, but keep unique local entries)
            const merged = mergeWorkouts(localWorkouts, cloudWorkouts);

            // 4. Save merged data locally
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

            // 5. Upload any new local workouts to cloud
            const localOnly = localWorkouts.filter(lw => 
                !cloudWorkouts.some(cw => cw.id === lw.id)
            );
            
            if (localOnly.length > 0) {
                console.log('[Sync] Uploading', localOnly.length, 'local-only workouts');
                await uploadWorkouts();
            }

            // Update last sync time
            _lastSyncTime = new Date().toISOString();
            localStorage.setItem(LAST_SYNC_KEY, _lastSyncTime);

            console.log('[Sync] Full sync complete. Total workouts:', merged.length);
            notifyListeners('complete', { direction: 'both', count: merged.length });

            return { success: true, count: merged.length };
        } catch (error) {
            console.error('[Sync] Full sync failed:', error);
            notifyListeners('error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Merge local and cloud workouts
     * Strategy: Use ID to match, prefer newer syncedAt timestamp
     */
    function mergeWorkouts(local, cloud) {
        const merged = new Map();

        // Add all cloud workouts (they're the source of truth if synced)
        cloud.forEach(w => {
            merged.set(w.id, w);
        });

        // Add local workouts that aren't in cloud
        local.forEach(w => {
            if (w.id && !merged.has(w.id)) {
                merged.set(w.id, w);
            } else if (!w.id) {
                // Local workout without ID - generate one and add
                const newId = `${w.date || w.dailyInfo?.currentDate}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                w.id = newId;
                merged.set(newId, w);
            }
        });

        return Array.from(merged.values()).sort((a, b) => {
            const dateA = a.date || a.dailyInfo?.currentDate || '';
            const dateB = b.date || b.dailyInfo?.currentDate || '';
            return dateB.localeCompare(dateA);
        });
    }

    // ========================================
    // AUTO-SYNC
    // ========================================

    /**
     * Initialize auto-sync on auth state changes
     */
    function initAutoSync() {
        if (!FirebaseConfig.isConfigured()) {
            console.warn('[Sync] Firebase not configured, auto-sync disabled');
            return;
        }

        // Sync when user signs in
        LiftLogicAuth.subscribe(async (event, user) => {
            if (event === 'signedIn' && user) {
                console.log('[Sync] User signed in, starting full sync...');
                await fullSync();
            }
        });

        console.log('[Sync] Auto-sync initialized');
    }

    // ========================================
    // STATUS
    // ========================================

    function isSyncing() {
        return _isSyncing;
    }

    function getLastSyncTime() {
        return _lastSyncTime || localStorage.getItem(LAST_SYNC_KEY);
    }

    function getStatus() {
        return {
            isSyncing: _isSyncing,
            lastSync: getLastSyncTime(),
            isSignedIn: LiftLogicAuth.isSignedIn()
        };
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
        _listeners.forEach(cb => {
            try {
                cb(event, data);
            } catch (e) {
                console.error('[Sync] Listener error:', e);
            }
        });
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        uploadWorkouts,
        uploadSingleWorkout,
        downloadWorkouts,
        fullSync,
        initAutoSync,
        isSyncing,
        getLastSyncTime,
        getStatus,
        subscribe
    };
})();

// Make globally available
window.LiftLogicSync = LiftLogicSync;

