// Shared Navigation Functionality
// Requires schedule-data.js to be loaded first

// Schedule Modal Functions
function openScheduleModal() {
    // Check if modal exists, if not create it
    let modal = document.getElementById('scheduleModal');
    if (!modal) {
        createScheduleModal();
        modal = document.getElementById('scheduleModal');
    }
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function createScheduleModal() {
    // Use the shared schedule data from schedule-data.js
    if (typeof injectScheduleModal === 'function') {
        injectScheduleModal();
    } else {
        console.error('schedule-data.js must be loaded before shared-nav.js');
    }
}

// Data Health Check
function checkDataHealth() {
    try {
        // Get current user from global scope or default
        const currentUser = window.currentUser || 'default';
        const workoutsKey = currentUser === 'default' ? 'workouts' : `${currentUser}_workouts`;
        const workouts = JSON.parse(localStorage.getItem(workoutsKey) || '[]');

        let issueCount = 0;

        workouts.forEach(workout => {
            // Check for missing dates
            if (!workout.date && !workout.dailyInfo?.currentDate) {
                issueCount++;
            }

            // Check for missing exercises
            if (!workout.exercises || workout.exercises.length === 0) {
                issueCount++;
            }
        });

        const badge = document.getElementById('dataHealthBadge');
        if (badge) {
            if (issueCount > 0) {
                badge.textContent = issueCount > 9 ? '9+' : issueCount;
                badge.style.display = 'inline-flex';
                badge.title = `${issueCount} data issue${issueCount > 1 ? 's' : ''} found`;
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.error('Error checking data health:', e);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check data health on load
    checkDataHealth();

    // Close modal on outside click
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('scheduleModal');
        if (modal && e.target === modal) {
            closeScheduleModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeScheduleModal();
        }
    });
});
