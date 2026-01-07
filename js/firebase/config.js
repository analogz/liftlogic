/**
 * LiftLogic Firebase Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to console.firebase.google.com
 * 2. Create a new project called "LiftLogic"
 * 3. Enable Authentication > Google Sign-In
 * 4. Create Firestore Database (test mode)
 * 5. Go to Project Settings > Your Apps > Add Web App
 * 6. Copy your config values below
 */

// LiftLogic Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAvf6QoYmKUa751pn0V0jZXph2yYrtGhpI",
    authDomain: "liftlogic-3ea17.firebaseapp.com",
    projectId: "liftlogic-3ea17",
    storageBucket: "liftlogic-3ea17.firebasestorage.app",
    messagingSenderId: "47881747128",
    appId: "1:47881747128:web:efd43ae113bcee7da1524d",
    measurementId: "G-067BV4NHQL"
};

// Check if Firebase is configured
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== "YOUR_API_KEY";
}

// Initialize Firebase (called after SDK loads)
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

function initializeFirebase() {
    if (!isFirebaseConfigured()) {
        console.warn('[Firebase] Not configured. Update js/firebase/config.js with your Firebase credentials.');
        return false;
    }

    try {
        // Initialize Firebase app
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        
        console.log('[Firebase] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[Firebase] Initialization failed:', error);
        return false;
    }
}

// Export for use in other modules
window.FirebaseConfig = {
    config: firebaseConfig,
    isConfigured: isFirebaseConfigured,
    initialize: initializeFirebase,
    getAuth: () => firebaseAuth,
    getDb: () => firebaseDb,
    getApp: () => firebaseApp
};

