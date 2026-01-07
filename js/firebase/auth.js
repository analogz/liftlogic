/**
 * LiftLogic Firebase Authentication
 * Handles Google Sign-In and user management
 */

const LiftLogicAuth = (function() {
    let _currentUser = null;
    let _listeners = [];

    // ========================================
    // AUTHENTICATION
    // ========================================

    /**
     * Sign in with Google
     */
    async function signInWithGoogle() {
        const auth = FirebaseConfig.getAuth();
        if (!auth) {
            console.error('[Auth] Firebase not initialized');
            return { success: false, error: 'Firebase not configured' };
        }

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            
            // Create/update user profile in Firestore
            await createOrUpdateUserProfile(result.user);
            
            console.log('[Auth] Signed in as:', result.user.displayName);
            return { success: true, user: result.user };
        } catch (error) {
            console.error('[Auth] Sign in failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sign out
     */
    async function signOut() {
        const auth = FirebaseConfig.getAuth();
        if (!auth) return;

        try {
            await auth.signOut();
            _currentUser = null;
            notifyListeners('signedOut', null);
            console.log('[Auth] Signed out');
            return { success: true };
        } catch (error) {
            console.error('[Auth] Sign out failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current user
     */
    function getCurrentUser() {
        return _currentUser;
    }

    /**
     * Check if user is signed in
     */
    function isSignedIn() {
        return _currentUser !== null;
    }

    // ========================================
    // USER PROFILE
    // ========================================

    /**
     * Create or update user profile in Firestore
     */
    async function createOrUpdateUserProfile(user) {
        const db = FirebaseConfig.getDb();
        if (!db) return;

        const userRef = db.collection('users').doc(user.uid);
        
        await userRef.set({
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    /**
     * Get user profile from Firestore
     */
    async function getUserProfile(uid) {
        const db = FirebaseConfig.getDb();
        if (!db) return null;

        try {
            const doc = await db.collection('users').doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('[Auth] Error fetching user profile:', error);
            return null;
        }
    }

    // ========================================
    // AUTH STATE LISTENER
    // ========================================

    /**
     * Initialize auth state listener
     */
    function initAuthListener() {
        const auth = FirebaseConfig.getAuth();
        if (!auth) return;

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                _currentUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL
                };
                notifyListeners('signedIn', _currentUser);
                console.log('[Auth] User state: signed in as', user.displayName);
            } else {
                _currentUser = null;
                notifyListeners('signedOut', null);
                console.log('[Auth] User state: signed out');
            }
        });
    }

    // ========================================
    // EVENT SYSTEM
    // ========================================

    function subscribe(callback) {
        _listeners.push(callback);
        // Immediately notify of current state
        if (_currentUser) {
            callback('signedIn', _currentUser);
        }
        return () => {
            _listeners = _listeners.filter(cb => cb !== callback);
        };
    }

    function notifyListeners(event, data) {
        _listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (e) {
                console.error('[Auth] Listener error:', e);
            }
        });
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        if (!FirebaseConfig.isConfigured()) {
            console.warn('[Auth] Firebase not configured, auth disabled');
            return false;
        }

        initAuthListener();
        console.log('[Auth] Initialized');
        return true;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        init,
        signInWithGoogle,
        signOut,
        getCurrentUser,
        isSignedIn,
        getUserProfile,
        subscribe
    };
})();

// Make globally available
window.LiftLogicAuth = LiftLogicAuth;

