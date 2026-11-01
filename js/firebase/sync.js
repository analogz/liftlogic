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

    const MAX_BATCH_WRITES = 450; // Firestore allows 500 writes per batch
    const DEDUPE_FLAG = 'liftlogicDedupeV1';
    const DEDUPE_LOG_KEY = 'liftlogicDedupeLog';
    const R = () => window.LiftLogicRecords;

    function docFor(record, uid) {
        return {
            ...record,
            odId: uid,
            syncedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    /** Write records in chunks of <= MAX_BATCH_WRITES. Returns number of batches. */
    async function writeBatched(db, uid, records) {
        const ref = db.collection('users').doc(uid).collection('workouts');
        let batches = 0;
        for (let i = 0; i < records.length; i += MAX_BATCH_WRITES) {
            const batch = db.batch();
            records.slice(i, i + MAX_BATCH_WRITES).forEach(r => batch.set(ref.doc(r.id), docFor(r, uid)));
            await batch.commit();
            batches++;
        }
        return batches;
    }

    // ========================================
    // UPLOAD TO CLOUD
    // ========================================

    /**
     * Upload all local workouts (and deletion tombstones) to Firebase
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
            const all = R().loadAll(STORAGE_KEY);
            all.forEach(w => { if (!w.id) w.id = R().newId(w); });
            R().saveAll(STORAGE_KEY, all); // persist generated ids so re-uploads don't duplicate

            const batches = await writeBatched(db, user.uid, all);

            _lastSyncTime = new Date().toISOString();
            localStorage.setItem(LAST_SYNC_KEY, _lastSyncTime);

            console.log('[Sync] Uploaded', all.length, 'records in', batches, 'batch(es)');
            _isSyncing = false;
            notifyListeners('complete', { direction: 'upload', count: all.length });

            return { success: true, count: all.length, batches };
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
            if (!workout.id) workout.id = R().newId(workout);
            if (!workout.updatedAt) workout.updatedAt = Date.now();
            const workoutId = workout.id;

            await db.collection('users').doc(user.uid).collection('workouts').doc(workoutId).set(docFor(workout, user.uid));

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
     * Download all workouts (including tombstones) from Firebase
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

            const cloudWorkouts = snapshot.docs.map(doc => {
                const data = { ...doc.data(), id: doc.id };
                delete data.syncedAt; // server timestamp object; not stored locally
                delete data.odId;
                return data;
            });

            console.log('[Sync] Downloaded', cloudWorkouts.length, 'records from cloud');

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

    let _fullSyncPromise = null;

    /**
     * Full sync: merge local and cloud data by id (newest updatedAt wins,
     * deletes are tombstones) and upload whatever the cloud is missing.
     */
    function fullSync() {
        if (_fullSyncPromise) return _fullSyncPromise;
        _fullSyncPromise = _fullSync().finally(() => { _fullSyncPromise = null; });
        return _fullSyncPromise;
    }

    async function _fullSync() {
        const user = LiftLogicAuth.getCurrentUser();
        if (!user) {
            return { success: false, error: 'Not signed in' };
        }

        notifyListeners('syncing', { direction: 'both' });

        try {
            // 1. Download cloud records (live + tombstones)
            const downloadResult = await downloadWorkouts();
            if (!downloadResult.success) {
                return downloadResult;
            }
            const cloudWorkouts = downloadResult.workouts;

            // 2. Local records (live + tombstones)
            const localWorkouts = R().loadAll(STORAGE_KEY);

            // 3. Merge by id, newest updatedAt wins
            let { merged, toUpload } = R().mergeById(localWorkouts, cloudWorkouts);

            // 4. One-time cleanup of duplicates created by the old sync/Data Explorer bug
            const flagKey = `${DEDUPE_FLAG}:${user.uid}`;
            let deduped = 0;
            if (!localStorage.getItem(flagKey)) {
                const result = dedupeIdentical(merged, cloudWorkouts);
                merged = result.records;
                deduped = result.removed;
                const up = new Map(toUpload.map(w => [w.id, w]));
                result.changed.forEach(w => up.set(w.id, w));
                toUpload = Array.from(up.values());
                localStorage.setItem(flagKey, new Date().toISOString());
            }

            // 5. Save merged data locally (live array + tombstones kept separately)
            R().saveAll(STORAGE_KEY, merged);

            // 6. Upload what the cloud is missing or has an older copy of
            let batches = 0;
            if (toUpload.length > 0) {
                const db = FirebaseConfig.getDb();
                console.log('[Sync] Uploading', toUpload.length, 'new/changed/deleted records');
                batches = await writeBatched(db, user.uid, toUpload);
            }
            R().clearDirty();

            _lastSyncTime = new Date().toISOString();
            localStorage.setItem(LAST_SYNC_KEY, _lastSyncTime);

            const live = merged.filter(w => !R().isTombstone(w)).length;
            console.log('[Sync] Full sync complete. Workouts:', live, 'uploaded:', toUpload.length, 'deduped:', deduped);
            notifyListeners('complete', { direction: 'both', count: live, uploaded: toUpload.length, batches, deduped });

            return { success: true, count: live, uploaded: toUpload.length, batches, deduped };
        } catch (error) {
            console.error('[Sync] Full sync failed:', error);
            notifyListeners('error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Collapse content-identical copies (same date + identical exercises/sets).
     * Keeps the copy whose id exists in the cloud; the others become tombstones.
     * Workouts that differ in any set are never touched.
     */
    function dedupeIdentical(records, cloudWorkouts) {
        const cloudIds = new Set(cloudWorkouts.filter(w => !R().isTombstone(w)).map(w => w.id));
        const live = records.filter(w => !R().isTombstone(w));
        const groups = R().findDuplicates(live, cloudIds);
        if (!groups.length) return { records, removed: 0, changed: [] };

        const dropIds = new Map();
        const changed = [];
        const log = [];
        const at = Date.now();
        groups.forEach(({ keep, drop }) => {
            const absorbed = R().absorb(keep, drop);
            if (absorbed.length) { keep.updatedAt = at; changed.push(keep); }
            drop.forEach(d => {
                const stone = R().makeTombstone(d, at);
                dropIds.set(d.id, stone);
                changed.push(stone);
            });
            log.push({ date: keep.date || keep.dailyInfo?.currentDate, kept: keep.id, removed: drop.map(d => d.id), absorbedFields: absorbed });
        });

        const out = records.map(w => dropIds.get(w.id) || w);
        try {
            const prev = JSON.parse(localStorage.getItem(DEDUPE_LOG_KEY) || '[]');
            localStorage.setItem(DEDUPE_LOG_KEY, JSON.stringify(prev.concat([{ at: new Date(at).toISOString(), merged: log }])));
        } catch (e) { /* ignore */ }
        console.log('[Sync] Merged', dropIds.size, 'duplicate workout copies:', log);
        return { records: out, removed: dropIds.size, changed };
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

        // Changes made on pages without sync (Data Explorer) set a dirty flag;
        // pick them up now if a session is already active.
        if (R().isDirty() && LiftLogicAuth.isSignedIn()) {
            fullSync();
        }

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
        _dedupeIdentical: dedupeIdentical,
        isSyncing,
        getLastSyncTime,
        getStatus,
        subscribe
    };
})();

// Make globally available
window.LiftLogicSync = LiftLogicSync;

