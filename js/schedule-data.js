/**
 * Single source of truth for the default workout schedule.
 * All pages render from this object. It is not stored per profile.
 *
 * The heavy presses, bent-over row, and curl are dumbbell movements so the
 * default week can be done without a barbell. Set and rep schemes are unchanged.
 * Barbell names stay in the exercise catalog, and saved workouts are not rewritten.
 */

const SCHEDULE_DATA = {
    title: "5-Day Upper Body Split",
    guidelines: "40-min sessions. 90s rest between sets. Cycling handles lower body. Priorities: shoulders, chest, abs. ~16 working sets/session — chest, shoulders, and back each hit 2×/week with 48-72hr recovery.",
    footer: "5-Day Upper Body Split — 2026",
    days: [
        {
            name: "Monday",
            number: 1,
            focus: "Chest & Triceps",
            isRest: false,
            exercises: [
                { name: "Dumbbell Bench Press", sets: "4 × 6-8" },
                { name: "Incline Dumbbell Press", sets: "3 × 8-10" },
                { name: "Cable Chest Fly", sets: "3 × 12-15" },
                { name: "Cable Tricep Pushdown", sets: "3 × 10-12" },
                { name: "Hanging Leg Raises", sets: "3 × 10-15" }
            ]
        },
        {
            name: "Tuesday",
            number: 2,
            focus: "Pull A — Back & Biceps",
            isRest: false,
            exercises: [
                { name: "Weighted Pull-Ups", sets: "4 × 6-8" },
                { name: "Dumbbell Row", sets: "3 × 8-10" },
                { name: "Cable Face Pulls", sets: "3 × 15-20" },
                { name: "Dumbbell Curl", sets: "3 × 8-10" },
                { name: "Cable Crunch", sets: "3 × 15-20" }
            ]
        },
        {
            name: "Wednesday",
            number: 3,
            focus: "Shoulders & Abs",
            isRest: false,
            exercises: [
                { name: "Dumbbell Shoulder Press", sets: "4 × 6-8" },
                { name: "Cable Lateral Raise", sets: "4 × 12-15" },
                { name: "Dumbbell Rear Delt Fly", sets: "3 × 12-15" },
                { name: "Overhead Tricep Extension", sets: "3 × 10-12" },
                { name: "Ab Wheel Rollout", sets: "3 × 8-12" }
            ]
        },
        {
            name: "Thursday",
            number: 4,
            focus: "Pull B — Back & Biceps",
            isRest: false,
            exercises: [
                { name: "Lat Pulldown", sets: "4 × 8-10" },
                { name: "Seated Cable Row", sets: "3 × 10-12" },
                { name: "Cable Face Pulls", sets: "3 × 15-20" },
                { name: "Incline Dumbbell Curl", sets: "3 × 10-12" },
                { name: "Pallof Press", sets: "3 × 12-15 / side" }
            ]
        },
        {
            name: "Friday",
            number: 5,
            focus: "Chest, Shoulders & Abs",
            isRest: false,
            exercises: [
                { name: "Incline Dumbbell Press", sets: "4 × 6-8" },
                { name: "Dumbbell Lateral Raises", sets: "4 × 12-15" },
                { name: "Cable Chest Fly - Low to High", sets: "3 × 12-15" },
                { name: "Overhead Tricep Extension", sets: "3 × 10-12" },
                { name: "Hanging Leg Raises", sets: "3 × 10-15" }
            ]
        },
        {
            name: "Saturday",
            number: 6,
            focus: "Cycling / Active Recovery",
            isRest: true,
            restNote: "Bike training. Light mobility, stretching. Cycling covers lower-body work for the week."
        },
        {
            name: "Sunday",
            number: 7,
            focus: "Rest / Recovery",
            isRest: true,
            restNote: "Full recovery. Focus on sleep, nutrition, mobility. Optional easy cycling."
        }
    ]
};

/**
 * Renders a single day card HTML
 */
function renderDayCard(day, useH2 = false) {
    const headingTag = useH2 ? 'h2' : 'h3';
    const restClass = day.isRest ? ' rest' : '';
    
    let exercisesHTML = '';
    if (day.isRest) {
        exercisesHTML = `<p class="rest-note">${day.restNote}</p>`;
        if (/cycling/i.test(day.focus || '')) {
            exercisesHTML += `<a class="log-ride-link" href="./tracker.html?mode=ride" style="display:inline-block;margin-top:10px;font-weight:700;color:inherit;text-decoration:underline;"><span class="icon icon--sm" data-icon="ride" aria-hidden="true"></span> Log a ride <span class="icon icon--sm" data-icon="arrow" aria-hidden="true"></span></a>`;
        }
    } else {
        const exerciseItems = day.exercises.map(ex => 
            `<li class="exercise-item"><span class="exercise-name">${ex.name}</span><span class="exercise-sets">${ex.sets}</span></li>`
        ).join('\n                        ');
        exercisesHTML = `<ul class="exercise-list">
                        ${exerciseItems}
                    </ul>`;
    }

    return `
                <div class="day-card${restClass}">
                    <div class="day-header">
                        <${headingTag} class="day-title"><span class="day-number">${day.number}</span>${day.name}</${headingTag}>
                        <span class="day-focus">${day.focus}</span>
                    </div>
                    ${exercisesHTML}
                </div>`;
}

/**
 * Renders all day cards HTML
 */
function renderAllDayCards(useH2 = false) {
    return SCHEDULE_DATA.days.map(day => renderDayCard(day, useH2)).join('\n');
}

/**
 * Renders the complete schedule modal HTML
 */
function renderScheduleModalHTML() {
    const daysHTML = renderAllDayCards(false);
    
    return `
        <div id="scheduleModal" class="schedule-modal">
            <div class="schedule-modal-content">
                <div class="schedule-modal-header">
                    <h2 style="margin: 0;">${SCHEDULE_DATA.title}</h2>
                    <button class="schedule-close-btn" onclick="closeScheduleModal()" aria-label="Close">&times;</button>
                </div>
                <div class="schedule-modal-body">
                    <p style="margin-bottom: 24px; color: #E4E4E4;">${SCHEDULE_DATA.guidelines}</p>
                    ${daysHTML}
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the schedule for the main schedule page (with h2 headings)
 */
function renderSchedulePage() {
    return renderAllDayCards(true);
}

/**
 * Injects the schedule modal into the page
 */
function injectScheduleModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('scheduleModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', renderScheduleModalHTML());
}

/**
 * Renders schedule into a container element (for schedule page)
 */
function renderScheduleIntoContainer(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = renderAllDayCards(true);
    }
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCHEDULE_DATA, renderScheduleModalHTML, renderSchedulePage, injectScheduleModal, renderScheduleIntoContainer };
}

