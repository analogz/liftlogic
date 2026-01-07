/**
 * LiftLogic Backup System
 * Automatic and manual backup functionality
 */

const LiftLogicBackup = (function() {
    const BACKUP_REMINDER_KEY = 'lastBackupReminder';
    const LAST_BACKUP_KEY = 'lastBackupDate';
    const BACKUP_INTERVAL_DAYS = 7; // Remind every 7 days

    // ========================================
    // EXPORT FUNCTIONS
    // ========================================

    /**
     * Export all data as JSON and trigger download
     */
    function downloadBackup() {
        try {
            const data = {
                version: 2,
                exportedAt: new Date().toISOString(),
                source: 'LiftLogic Backup',
                workouts: JSON.parse(localStorage.getItem('workouts') || '[]'),
                userProfiles: JSON.parse(localStorage.getItem('userProfiles') || '{}')
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `liftlogic-backup-${formatDate(new Date())}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Update last backup date
            localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
            
            console.log('[Backup] Downloaded backup file');
            return { success: true };
        } catch (e) {
            console.error('[Backup] Export failed:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Export as CSV for spreadsheet analysis
     */
    function downloadCSV() {
        try {
            const workouts = JSON.parse(localStorage.getItem('workouts') || '[]');
            
            // Flatten workout data for CSV
            const rows = [];
            rows.push(['Date', 'Exercise', 'Set', 'Weight (lbs)', 'Reps', 'RIR', 'RPE'].join(','));

            workouts.forEach(workout => {
                const date = workout.date || workout.dailyInfo?.currentDate || 'Unknown';
                if (workout.exercises) {
                    workout.exercises.forEach(exercise => {
                        if (exercise.sets) {
                            exercise.sets.forEach((set, index) => {
                                rows.push([
                                    date,
                                    `"${exercise.kind}"`,
                                    index + 1,
                                    set.weight || '',
                                    set.reps || '',
                                    set.rir || '',
                                    exercise.rpe || ''
                                ].join(','));
                            });
                        }
                    });
                }
            });

            const csv = rows.join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `liftlogic-export-${formatDate(new Date())}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[Backup] Downloaded CSV file');
            return { success: true };
        } catch (e) {
            console.error('[Backup] CSV export failed:', e);
            return { success: false, error: e.message };
        }
    }

    // ========================================
    // IMPORT FUNCTIONS
    // ========================================

    /**
     * Import data from a backup file
     */
    function importBackup(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Validate structure
                    if (!data.workouts || !Array.isArray(data.workouts)) {
                        throw new Error('Invalid backup file: missing workouts array');
                    }

                    // Merge or replace?
                    const existingWorkouts = JSON.parse(localStorage.getItem('workouts') || '[]');
                    const mergedWorkouts = mergeWorkouts(existingWorkouts, data.workouts);
                    
                    localStorage.setItem('workouts', JSON.stringify(mergedWorkouts));
                    
                    if (data.userProfiles) {
                        const existingProfiles = JSON.parse(localStorage.getItem('userProfiles') || '{}');
                        localStorage.setItem('userProfiles', JSON.stringify({
                            ...existingProfiles,
                            ...data.userProfiles
                        }));
                    }

                    console.log('[Backup] Imported', mergedWorkouts.length, 'workouts');
                    resolve({ 
                        success: true, 
                        imported: data.workouts.length,
                        total: mergedWorkouts.length 
                    });
                } catch (err) {
                    console.error('[Backup] Import failed:', err);
                    reject(err);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Merge workouts, avoiding duplicates by date
     */
    function mergeWorkouts(existing, imported) {
        const dateMap = new Map();
        
        // Add existing workouts
        existing.forEach(w => {
            const date = w.date || w.dailyInfo?.currentDate;
            if (date) dateMap.set(date, w);
        });

        // Add imported workouts (newer data wins)
        imported.forEach(w => {
            const date = w.date || w.dailyInfo?.currentDate;
            if (date) {
                const existing = dateMap.get(date);
                if (existing) {
                    // Merge exercises from both
                    const mergedExercises = [...(existing.exercises || [])];
                    (w.exercises || []).forEach(ex => {
                        if (!mergedExercises.some(e => e.kind === ex.kind)) {
                            mergedExercises.push(ex);
                        }
                    });
                    dateMap.set(date, { ...existing, ...w, exercises: mergedExercises });
                } else {
                    dateMap.set(date, w);
                }
            }
        });

        return Array.from(dateMap.values()).sort((a, b) => 
            new Date(a.date || a.dailyInfo?.currentDate) - new Date(b.date || b.dailyInfo?.currentDate)
        );
    }

    // ========================================
    // BACKUP REMINDERS
    // ========================================

    /**
     * Check if user should be reminded to backup
     */
    function shouldRemindBackup() {
        // Don't nag users who are signed in - their data syncs to cloud
        if (typeof LiftLogicAuth !== 'undefined' && LiftLogicAuth.isSignedIn()) {
            return false;
        }

        const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
        const lastReminder = localStorage.getItem(BACKUP_REMINDER_KEY);
        
        if (!lastBackup) return true; // Never backed up
        
        const daysSinceBackup = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceReminder = lastReminder 
            ? (Date.now() - new Date(lastReminder).getTime()) / (1000 * 60 * 60 * 24)
            : Infinity;

        return daysSinceBackup >= BACKUP_INTERVAL_DAYS && daysSinceReminder >= 1;
    }

    /**
     * Show backup reminder if needed
     */
    function checkAndShowReminder() {
        if (!shouldRemindBackup()) return;

        const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
        const daysSince = lastBackup 
            ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const message = daysSince 
            ? `It's been ${daysSince} days since your last backup.`
            : `You haven't backed up your workout data yet.`;

        // Create reminder banner
        const banner = document.createElement('div');
        banner.id = 'backupReminder';
        banner.innerHTML = `
            <div class="backup-reminder">
                <div class="backup-reminder-content">
                    <span class="backup-reminder-icon">💾</span>
                    <div class="backup-reminder-text">
                        <strong>Backup Your Data</strong>
                        <span>${message}</span>
                    </div>
                </div>
                <div class="backup-reminder-actions">
                    <button class="backup-reminder-btn primary" onclick="LiftLogicBackup.downloadBackup(); LiftLogicBackup.dismissReminder();">
                        Backup Now
                    </button>
                    <button class="backup-reminder-btn secondary" onclick="LiftLogicBackup.dismissReminder();">
                        Later
                    </button>
                </div>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('backupReminderStyles')) {
            const styles = document.createElement('style');
            styles.id = 'backupReminderStyles';
            styles.textContent = `
                .backup-reminder {
                    position: fixed;
                    bottom: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #1A1A1A;
                    border: 2px solid #BFFF00;
                    border-radius: 16px;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-width: 400px;
                    width: calc(100% - 32px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                    z-index: 9999;
                    animation: slideUp 300ms ease-out;
                }
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
                .backup-reminder-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .backup-reminder-icon {
                    font-size: 24px;
                }
                .backup-reminder-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .backup-reminder-text strong {
                    color: #FFFFFF;
                    font-size: 14px;
                }
                .backup-reminder-text span {
                    color: #A3A3A3;
                    font-size: 12px;
                }
                .backup-reminder-actions {
                    display: flex;
                    gap: 8px;
                }
                .backup-reminder-btn {
                    flex: 1;
                    height: 40px;
                    border: none;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    cursor: pointer;
                    transition: all 150ms ease-out;
                }
                .backup-reminder-btn.primary {
                    background: #BFFF00;
                    color: #0D0D0D;
                }
                .backup-reminder-btn.primary:hover {
                    background: #9ACC00;
                }
                .backup-reminder-btn.secondary {
                    background: #3D3D3D;
                    color: #A3A3A3;
                }
                .backup-reminder-btn.secondary:hover {
                    background: #4D4D4D;
                }
                @media (max-width: 768px) {
                    .backup-reminder {
                        bottom: 90px;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(banner);
        localStorage.setItem(BACKUP_REMINDER_KEY, new Date().toISOString());
    }

    /**
     * Dismiss the backup reminder
     */
    function dismissReminder() {
        const banner = document.getElementById('backupReminder');
        if (banner) {
            banner.style.animation = 'slideUp 200ms ease-out reverse';
            setTimeout(() => banner.remove(), 200);
        }
    }

    // ========================================
    // UTILITIES
    // ========================================

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Get backup status info
     */
    function getStatus() {
        const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
        const workouts = JSON.parse(localStorage.getItem('workouts') || '[]');
        
        return {
            lastBackup: lastBackup ? new Date(lastBackup) : null,
            daysSinceBackup: lastBackup 
                ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24))
                : null,
            workoutCount: workouts.length,
            dataSize: Math.round(JSON.stringify(workouts).length / 1024) + ' KB'
        };
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        downloadBackup,
        downloadCSV,
        importBackup,
        checkAndShowReminder,
        dismissReminder,
        getStatus,
        shouldRemindBackup
    };
})();

// Make globally available
if (typeof window !== 'undefined') {
    window.LiftLogicBackup = LiftLogicBackup;
    
    // Check for backup reminder after page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => LiftLogicBackup.checkAndShowReminder(), 2000);
        });
    } else {
        setTimeout(() => LiftLogicBackup.checkAndShowReminder(), 2000);
    }
}

