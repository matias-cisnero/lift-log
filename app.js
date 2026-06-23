// LiftLog App Logic - Dexie.js + Chart.js + Vanilla JS

// 1. DATABASE INITIALIZATION
const db = new Dexie('LiftLogDB');
db.version(1).stores({
  exercises: '++id, &name',
  workouts: '++id, date, status', // status: 'active' or 'completed'
  sets: '++id, workoutId, exerciseId',
  bodyweight: '++id, date'
});

// Default exercise presets
const DEFAULT_EXERCISES = [
  'Sentadilla con Barra (Squat)',
  'Press de Banca (Bench Press)',
  'Peso Muerto (Deadlift)',
  'Press Militar (Overhead Press)',
  'Dominadas (Pull-ups)',
  'Remo con Barra',
  'Curl de Bíceps con Barra',
  'Fondos en Paralelas (Dips)',
  'Prensa de Piernas',
  'Elevaciones Laterales'
];

// 2. STATE VARIABLES
let activeWorkout = null;
let activeWorkoutExercises = []; // array of exercise objects in current workout
let chartVolumeInstance = null;
let chartExerciseInstance = null;
let chartBodyweightInstance = null;
let activeExerciseMetric = '1rm'; // default metric for exercise progress chart

// 3. DOM ELEMENTS
const els = {
  // Views
  navItems: document.querySelectorAll('.nav-item'),
  views: document.querySelectorAll('.view-section'),
  
  // Workouts View
  workoutsHomeContainer: document.getElementById('workouts-home-container'),
  activeWorkoutContainer: document.getElementById('active-workout-container'),
  btnStartWorkout: document.getElementById('btn-start-workout'),
  btnCancelWorkout: document.getElementById('btn-cancel-workout'),
  btnFinishWorkout: document.getElementById('btn-finish-workout'),
  workoutNameInput: document.getElementById('workout-name'),
  workoutDateInput: document.getElementById('workout-date'),
  activeWorkoutExercisesList: document.getElementById('active-workout-exercises'),
  btnAddExerciseToWorkout: document.getElementById('btn-add-exercise-to-workout'),
  workoutsHistoryList: document.getElementById('workouts-history-list'),

  // Exercises View
  btnShowAddExercise: document.getElementById('btn-show-add-exercise'),
  addExerciseFormCard: document.getElementById('add-exercise-form-card'),
  newExerciseName: document.getElementById('new-exercise-name'),
  btnCancelAddExercise: document.getElementById('btn-cancel-add-exercise'),
  btnSaveExercise: document.getElementById('btn-save-exercise'),
  exerciseSearch: document.getElementById('exercise-search'),
  exercisesList: document.getElementById('exercises-list'),

  // Progress View
  statTotalWorkouts: document.getElementById('stat-total-workouts'),
  statWeeklyVolume: document.getElementById('stat-weekly-volume'),
  progressExerciseSelect: document.getElementById('progress-exercise-select'),
  chartTabBtns: document.querySelectorAll('.chart-tab-btn'),

  // Weight View
  btnShowAddWeight: document.getElementById('btn-show-add-weight'),
  addWeightFormCard: document.getElementById('add-weight-form-card'),
  weightValue: document.getElementById('weight-value'),
  weightDate: document.getElementById('weight-date'),
  btnCancelAddWeight: document.getElementById('btn-cancel-add-weight'),
  btnSaveWeight: document.getElementById('btn-save-weight'),
  weightHistoryTbody: document.getElementById('weight-history-tbody'),

  // Settings View
  btnExportJson: document.getElementById('btn-export-json'),
  btnTriggerImport: document.getElementById('btn-trigger-import'),
  importJsonFile: document.getElementById('import-json-file'),
  btnLoadPresets: document.getElementById('btn-load-presets'),
  btnClearDb: document.getElementById('btn-clear-db'),

  // Modals
  modalSelectExercise: document.getElementById('modal-select-exercise'),
  modalExerciseSearch: document.getElementById('modal-exercise-search'),
  modalExercisesList: document.getElementById('modal-exercises-list'),
  btnModalCreateExercise: document.getElementById('btn-modal-create-exercise'),
  
  modalWorkoutDetails: document.getElementById('modal-workout-details'),
  detailsWorkoutName: document.getElementById('details-workout-name'),
  detailsWorkoutBody: document.getElementById('details-workout-body'),
  btnDetailsDeleteWorkout: document.getElementById('btn-details-delete-workout'),
  
  modalCloses: document.querySelectorAll('.modal-close, .modal-close-btn')
};

// 4. APP INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Setup Event Listeners
  setupNavigation();
  setupWorkoutListeners();
  setupExerciseListeners();
  setupWeightListeners();
  setupSettingsListeners();
  setupModalListeners();

  // Verify and seed default exercises if DB is empty
  await checkAndSeedPresets();

  // Check if there is an active workout in progress
  await checkActiveWorkout();

  // Load initial view data
  await loadWorkoutsHistory();
});

// Seed default exercises if table is empty
async function checkAndSeedPresets() {
  const count = await db.exercises.count();
  if (count === 0) {
    await seedDefaultExercises();
  }
}

async function seedDefaultExercises() {
  const exercises = DEFAULT_EXERCISES.map(name => ({ name }));
  await db.exercises.bulkAdd(exercises);
  showToast('Ejercicios predeterminados cargados correctamente.');
}

// 5. NAVIGATION / VIEW SWITCHING
function setupNavigation() {
  els.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      switchView(viewId);
      
      // Update active nav class
      els.navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function switchView(viewId) {
  els.views.forEach(view => {
    if (view.id === `view-${viewId}`) {
      view.classList.add('active');
      initViewData(viewId);
    } else {
      view.classList.remove('active');
    }
  });
}

async function initViewData(viewId) {
  if (viewId === 'workouts') {
    await checkActiveWorkout();
    await loadWorkoutsHistory();
  } else if (viewId === 'exercises') {
    await loadExercisesList();
  } else if (viewId === 'progress') {
    await initProgressView();
  } else if (viewId === 'weight') {
    await initWeightView();
  }
}

// 6. WORKOUTS LOGIC
function setupWorkoutListeners() {
  // Start new workout
  els.btnStartWorkout.addEventListener('click', startNewWorkout);

  // Auto-save metadata on change
  els.workoutNameInput.addEventListener('input', debounce(saveActiveWorkoutMeta, 1000));
  els.workoutDateInput.addEventListener('change', saveActiveWorkoutMeta);

  // Add exercise to active workout
  els.btnAddExerciseToWorkout.addEventListener('click', openSelectExerciseModal);

  // Cancel workout
  els.btnCancelWorkout.addEventListener('click', cancelWorkout);

  // Finish workout
  els.btnFinishWorkout.addEventListener('click', finishWorkout);
}

// Check for workout in progress on load/refresh
async function checkActiveWorkout() {
  const inProgress = await db.workouts.where('status').equals('active').first();
  if (inProgress) {
    activeWorkout = inProgress;
    els.workoutNameInput.value = activeWorkout.name || '';
    
    // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
    const localDate = new Date(activeWorkout.date);
    els.workoutDateInput.value = formatDateForInput(localDate);

    els.workoutsHomeContainer.classList.add('hidden');
    els.activeWorkoutContainer.classList.remove('hidden');
    
    await loadActiveWorkoutExercises();
  } else {
    activeWorkout = null;
    els.workoutsHomeContainer.classList.remove('hidden');
    els.activeWorkoutContainer.classList.add('hidden');
  }
}

async function startNewWorkout() {
  const now = new Date();
  const defaultName = `Entrenamiento del ${getDayName(now)}`;
  
  const id = await db.workouts.add({
    name: defaultName,
    date: now.toISOString(),
    status: 'active'
  });

  activeWorkout = { id, name: defaultName, date: now.toISOString(), status: 'active' };
  
  els.workoutNameInput.value = defaultName;
  els.workoutDateInput.value = formatDateForInput(now);

  els.workoutsHomeContainer.classList.add('hidden');
  els.activeWorkoutContainer.classList.remove('hidden');
  
  els.activeWorkoutExercisesList.innerHTML = '';
  activeWorkoutExercises = [];

  showToast('Entrenamiento iniciado. ¡A darlo todo!');
}

async function saveActiveWorkoutMeta() {
  if (!activeWorkout) return;
  
  const name = els.workoutNameInput.value.trim() || `Entrenamiento`;
  const dateVal = els.workoutDateInput.value;
  const isoDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

  await db.workouts.update(activeWorkout.id, {
    name: name,
    date: isoDate
  });

  activeWorkout.name = name;
  activeWorkout.date = isoDate;
}

// Load active exercises and their sets
async function loadActiveWorkoutExercises() {
  els.activeWorkoutExercisesList.innerHTML = '';
  
  // Find all sets for this workout
  const sets = await db.sets.where('workoutId').equals(activeWorkout.id).toArray();
  
  // Group sets by exerciseId
  const exerciseGroups = {};
  sets.forEach(set => {
    if (!exerciseGroups[set.exerciseId]) {
      exerciseGroups[set.exerciseId] = [];
    }
    exerciseGroups[set.exerciseId].push(set);
  });

  // Fetch exercise metadata and populate list
  activeWorkoutExercises = [];
  for (const exerciseIdStr in exerciseGroups) {
    const exerciseId = parseInt(exerciseIdStr);
    const exercise = await db.exercises.get(exerciseId);
    if (exercise) {
      activeWorkoutExercises.push(exercise);
      renderExerciseLogCard(exercise, exerciseGroups[exerciseId]);
    }
  }
  lucide.createIcons();
}

function renderExerciseLogCard(exercise, sets = []) {
  const card = document.createElement('div');
  card.className = 'exercise-log-card mb-3';
  card.id = `exercise-card-${exercise.id}`;
  
  card.innerHTML = `
    <div class="exercise-log-header">
      <span class="exercise-log-title">${exercise.name}</span>
      <button class="btn-remove-exercise-log" data-exercise-id="${exercise.id}">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
    <div class="sets-table-header">
      <span>Set</span>
      <span>Peso (kg)</span>
      <span>Reps</span>
      <span></span>
    </div>
    <div class="sets-list" id="sets-list-${exercise.id}">
      <!-- Dynamically filled with set rows -->
    </div>
    <button class="btn btn-secondary btn-block btn-sm btn-add-set-row" data-exercise-id="${exercise.id}">
      <i data-lucide="plus"></i> Agregar Serie
    </button>
  `;

  els.activeWorkoutExercisesList.appendChild(card);
  
  const setsListContainer = card.querySelector(`#sets-list-${exercise.id}`);
  
  // If sets array is provided, render each set
  if (sets.length > 0) {
    // Sort sets by ID to preserve order
    sets.sort((a, b) => a.id - b.id).forEach((set, index) => {
      renderSetRow(setsListContainer, exercise.id, set, index + 1);
    });
  } else {
    // Add a default set if none exist
    addSetToExercise(exercise.id);
  }

  // Set card specific event listeners
  card.querySelector('.btn-remove-exercise-log').addEventListener('click', () => {
    deleteExerciseFromWorkout(exercise.id);
  });

  card.querySelector('.btn-add-set-row').addEventListener('click', () => {
    addSetToExercise(exercise.id);
  });
}

function renderSetRow(container, exerciseId, set, setNumber) {
  const row = document.createElement('div');
  row.className = 'set-row';
  row.id = `set-row-${set.id}`;
  row.innerHTML = `
    <div class="set-number-badge">${setNumber}</div>
    <input type="number" step="0.5" class="set-weight" placeholder="0" value="${set.weight !== undefined ? set.weight : ''}" data-set-id="${set.id}">
    <input type="number" class="set-reps" placeholder="0" value="${set.reps !== undefined ? set.reps : ''}" data-set-id="${set.id}">
    <button class="btn-delete-set" data-set-id="${set.id}" data-exercise-id="${exerciseId}">
      <i data-lucide="x"></i>
    </button>
  `;

  container.appendChild(row);

  // Auto-save set inputs on input change
  const weightInput = row.querySelector('.set-weight');
  const repsInput = row.querySelector('.set-reps');

  const saveSetData = async () => {
    const w = parseFloat(weightInput.value);
    const r = parseInt(repsInput.value);
    await db.sets.update(set.id, {
      weight: isNaN(w) ? undefined : w,
      reps: isNaN(r) ? undefined : r
    });
  };

  weightInput.addEventListener('input', debounce(saveSetData, 800));
  repsInput.addEventListener('input', debounce(saveSetData, 800));

  // Delete set handler
  row.querySelector('.btn-delete-set').addEventListener('click', async (e) => {
    await deleteSet(set.id, exerciseId);
  });
}

async function addSetToExercise(exerciseId) {
  // Query previous sets for this exercise to auto-fill weight and reps from last session (progressive overload!)
  let defaultWeight = '';
  let defaultReps = '';

  // Get last set logged for this exercise in any workout
  const lastSet = await db.sets
    .where('exerciseId').equals(exerciseId)
    .and(s => s.workoutId !== activeWorkout.id)
    .reverse()
    .first();

  if (lastSet) {
    defaultWeight = lastSet.weight || '';
    defaultReps = lastSet.reps || '';
  }

  const setId = await db.sets.add({
    workoutId: activeWorkout.id,
    exerciseId: exerciseId,
    weight: defaultWeight !== '' ? parseFloat(defaultWeight) : undefined,
    reps: defaultReps !== '' ? parseInt(defaultReps) : undefined
  });

  const container = document.getElementById(`sets-list-${exerciseId}`);
  const setNumber = container.children.length + 1;
  
  const newSet = { id: setId, weight: defaultWeight, reps: defaultReps };
  renderSetRow(container, exerciseId, newSet, setNumber);
  
  lucide.createIcons();
}

async function deleteSet(setId, exerciseId) {
  await db.sets.delete(setId);
  
  // Re-render sets list for this exercise to update numbers badge correctly
  const container = document.getElementById(`sets-list-${exerciseId}`);
  container.innerHTML = '';
  
  const sets = await db.sets.where('workoutId').equals(activeWorkout.id).and(s => s.exerciseId === exerciseId).toArray();
  
  if (sets.length === 0) {
    // If no sets are left, remove the exercise card completely
    document.getElementById(`exercise-card-${exerciseId}`).remove();
    // remove from state array
    activeWorkoutExercises = activeWorkoutExercises.filter(e => e.id !== exerciseId);
  } else {
    // Sort and re-render remaining sets
    sets.sort((a, b) => a.id - b.id).forEach((set, index) => {
      renderSetRow(container, exerciseId, set, index + 1);
    });
    lucide.createIcons();
  }
}

async function deleteExerciseFromWorkout(exerciseId) {
  if (confirm('¿Eliminar este ejercicio y todas sus series de la sesión actual?')) {
    // Delete sets
    const sets = await db.sets.where('workoutId').equals(activeWorkout.id).and(s => s.exerciseId === exerciseId).toArray();
    const deletePromises = sets.map(set => db.sets.delete(set.id));
    await Promise.all(deletePromises);

    // Remove UI card
    document.getElementById(`exercise-card-${exerciseId}`).remove();
    activeWorkoutExercises = activeWorkoutExercises.filter(e => e.id !== exerciseId);
    showToast('Ejercicio removido de la sesión.');
  }
}

async function finishWorkout() {
  // Check if we have any valid exercises/sets with inputs
  const sets = await db.sets.where('workoutId').equals(activeWorkout.id).toArray();
  
  if (sets.length === 0) {
    showToast('Agrega al menos una serie antes de terminar.', 'error');
    return;
  }

  // Validate that there is at least one set with weight and reps filled
  const validSets = sets.filter(s => s.weight !== undefined && s.reps !== undefined);
  if (validSets.length === 0) {
    if (!confirm('No has ingresado peso o reps en ninguna serie. ¿Terminar de todos modos?')) {
      return;
    }
  }

  // Clean empty sets (unfilled weight/reps) to keep DB clean
  const emptySets = sets.filter(s => s.weight === undefined || s.reps === undefined);
  const deletePromises = emptySets.map(s => db.sets.delete(s.id));
  await Promise.all(deletePromises);

  // Set workout status to completed
  await db.workouts.update(activeWorkout.id, {
    status: 'completed'
  });

  showToast('¡Entrenamiento guardado con éxito!');
  activeWorkout = null;
  
  // Show history view
  await checkActiveWorkout();
  await loadWorkoutsHistory();
}

async function cancelWorkout() {
  if (confirm('¿Seguro que deseas cancelar y borrar la sesión actual? Todos los sets ingresados se perderán.')) {
    // Delete sets
    const sets = await db.sets.where('workoutId').equals(activeWorkout.id).toArray();
    const deletePromises = sets.map(s => db.sets.delete(s.id));
    await Promise.all(deletePromises);

    // Delete workout
    await db.workouts.delete(activeWorkout.id);

    activeWorkout = null;
    showToast('Entrenamiento cancelado y eliminado.');
    await checkActiveWorkout();
    await loadWorkoutsHistory();
  }
}

// History List Loading
async function loadWorkoutsHistory() {
  els.workoutsHistoryList.innerHTML = '';
  
  // Query all completed workouts sorted by date descending
  const workouts = await db.workouts.where('status').equals('completed').reverse().sortBy('date');
  
  if (workouts.length === 0) {
    els.workoutsHistoryList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar"></i>
        <p>Aún no has completado ningún entrenamiento.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  for (const workout of workouts) {
    // Fetch sets for this workout
    const sets = await db.sets.where('workoutId').equals(workout.id).toArray();
    
    // Group by exercise and calculate stats
    const exerciseCount = new Set(sets.map(s => s.exerciseId)).size;
    let totalVolume = 0;
    sets.forEach(s => {
      if (s.weight && s.reps) {
        totalVolume += s.weight * s.reps;
      }
    });

    // Create readable exercise list preview
    const exerciseIds = [...new Set(sets.map(s => s.exerciseId))];
    const exerciseNames = [];
    for (let i = 0; i < Math.min(3, exerciseIds.length); i++) {
      const exercise = await db.exercises.get(exerciseIds[i]);
      if (exercise) exerciseNames.push(exercise.name);
    }
    let exercisePreview = exerciseNames.join(', ');
    if (exerciseIds.length > 3) {
      exercisePreview += ` y ${exerciseIds.length - 3} más`;
    }

    const card = document.createElement('div');
    card.className = 'card workout-history-card';
    card.innerHTML = `
      <div class="workout-header">
        <div>
          <h4 class="workout-title">${workout.name}</h4>
          <span class="workout-date">${formatFullDate(new Date(workout.date))}</span>
        </div>
        <span class="workout-volume-tag">${totalVolume.toLocaleString()} kg</span>
      </div>
      <div class="workout-summary-exercises">
        ${exercisePreview || 'Sin ejercicios'}
      </div>
    `;

    card.addEventListener('click', () => {
      openWorkoutDetailsModal(workout.id);
    });

    els.workoutsHistoryList.appendChild(card);
  }

  lucide.createIcons();
}

// 7. EXERCISES VIEW LOGIC
function setupExerciseListeners() {
  els.btnShowAddExercise.addEventListener('click', () => {
    els.addExerciseFormCard.classList.remove('hidden');
    els.newExerciseName.focus();
  });

  els.btnCancelAddExercise.addEventListener('click', () => {
    els.addExerciseFormCard.classList.add('hidden');
    els.newExerciseName.value = '';
  });

  els.btnSaveExercise.addEventListener('click', saveNewExercise);
  els.exerciseSearch.addEventListener('input', loadExercisesList);
}

async function loadExercisesList() {
  els.exercisesList.innerHTML = '';
  const searchVal = els.exerciseSearch.value.toLowerCase().trim();

  // Fetch all exercises sorted by name
  let exercises = await db.exercises.orderBy('name').toArray();

  if (searchVal) {
    exercises = exercises.filter(e => e.name.toLowerCase().includes(searchVal));
  }

  if (exercises.length === 0) {
    els.exercisesList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="info"></i>
        <p>No se encontraron ejercicios.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  exercises.forEach(exercise => {
    const item = document.createElement('div');
    item.className = 'exercise-item';
    item.innerHTML = `
      <span class="exercise-item-name">${exercise.name}</span>
      <button class="btn-delete-exercise" data-id="${exercise.id}">
        <i data-lucide="trash-2"></i>
      </button>
    `;

    item.querySelector('.btn-delete-exercise').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteExercise(exercise.id, exercise.name);
    });

    els.exercisesList.appendChild(item);
  });

  lucide.createIcons();
}

async function saveNewExercise() {
  const name = els.newExerciseName.value.trim();
  if (!name) {
    showToast('Ingresa un nombre para el ejercicio.', 'error');
    return;
  }

  try {
    await db.exercises.add({ name });
    els.newExerciseName.value = '';
    els.addExerciseFormCard.classList.add('hidden');
    showToast('Ejercicio creado correctamente.');
    await loadExercisesList();
  } catch (error) {
    showToast('Ya existe un ejercicio con ese nombre.', 'error');
  }
}

async function deleteExercise(id, name) {
  // Check if exercise has logged sets
  const countSets = await db.sets.where('exerciseId').equals(id).count();
  
  if (countSets > 0) {
    if (!confirm(`Este ejercicio tiene ${countSets} series registradas en el historial. ¿Seguro que deseas eliminarlo? Esto borrará también sus series del historial.`)) {
      return;
    }
    // Delete cascading sets
    const sets = await db.sets.where('exerciseId').equals(id).toArray();
    await Promise.all(sets.map(s => db.sets.delete(s.id)));
  } else {
    if (!confirm(`¿Eliminar el ejercicio "${name}"?`)) {
      return;
    }
  }

  await db.exercises.delete(id);
  showToast('Ejercicio eliminado.');
  await loadExercisesList();
}

// 8. PROGRESS (CHARTS) LOGIC
async function initProgressView() {
  await loadStatsOverview();
  await loadExerciseSelectDropdown();
  await renderVolumeChart();
  await renderExerciseProgressChart();
}

async function loadStatsOverview() {
  // Total Workouts Completed
  const total = await db.workouts.where('status').equals('completed').count();
  els.statTotalWorkouts.textContent = total;

  // Weekly Volume (last 7 days)
  const workouts = await db.workouts.where('status').equals('completed').toArray();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  let weeklyVolume = 0;
  const recentWorkouts = workouts.filter(w => new Date(w.date) >= sevenDaysAgo);
  
  for (const w of recentWorkouts) {
    const sets = await db.sets.where('workoutId').equals(w.id).toArray();
    sets.forEach(s => {
      if (s.weight && s.reps) {
        weeklyVolume += s.weight * s.reps;
      }
    });
  }

  els.statWeeklyVolume.textContent = weeklyVolume.toLocaleString();
}

async function loadExerciseSelectDropdown() {
  const currentSelect = els.progressExerciseSelect.value;
  els.progressExerciseSelect.innerHTML = '<option value="">-- Elige un ejercicio --</option>';

  const exercises = await db.exercises.orderBy('name').toArray();
  
  // Find which exercises actually have sets logged (so we don't display empty ones in progress by default)
  const loggedExerciseIds = new Set();
  const allSets = await db.sets.toArray();
  allSets.forEach(s => loggedExerciseIds.add(s.exerciseId));

  exercises.forEach(e => {
    const option = document.createElement('option');
    option.value = e.id;
    option.textContent = e.name + (loggedExerciseIds.has(e.id) ? ' (Con registros)' : '');
    els.progressExerciseSelect.appendChild(option);
  });

  // Re-select previous value if still valid
  if (currentSelect) {
    els.progressExerciseSelect.value = currentSelect;
  } else if (exercises.length > 0) {
    // Select first exercise by default if it has records
    const loggedIdsArray = Array.from(loggedExerciseIds);
    if (loggedIdsArray.length > 0) {
      els.progressExerciseSelect.value = loggedIdsArray[0];
    }
  }

  // Add listener for dropdown change
  els.progressExerciseSelect.onchange = renderExerciseProgressChart;

  // Chart Metric Tabs Listener
  els.chartTabBtns.forEach(btn => {
    btn.onclick = () => {
      els.chartTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeExerciseMetric = btn.getAttribute('data-metric');
      renderExerciseProgressChart();
    };
  });
}

// Chart 1: Total volume per workout session
async function renderVolumeChart() {
  if (chartVolumeInstance) {
    chartVolumeInstance.destroy();
  }

  const workouts = await db.workouts.where('status').equals('completed').sortBy('date');
  
  if (workouts.length === 0) {
    return;
  }

  // Take last 12 sessions for chart clarity
  const recentSessions = workouts.slice(-12);
  const labels = [];
  const data = [];

  for (const w of recentSessions) {
    const sets = await db.sets.where('workoutId').equals(w.id).toArray();
    let volume = 0;
    sets.forEach(s => {
      if (s.weight && s.reps) {
        volume += s.weight * s.reps;
      }
    });

    const dateObj = new Date(w.date);
    labels.push(formatShortDate(dateObj));
    data.push(volume);
  }

  const ctx = document.getElementById('chart-volume').getContext('2d');
  chartVolumeInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Volumen (kg)',
        data: data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#6366f1',
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
}

// Chart 2: Progress by exercise (1RM, Max Weight, Volume)
async function renderExerciseProgressChart() {
  if (chartExerciseInstance) {
    chartExerciseInstance.destroy();
  }

  const exerciseId = parseInt(els.progressExerciseSelect.value);
  if (!exerciseId) {
    return;
  }

  // Get all completed workouts sorted by date
  const workouts = await db.workouts.where('status').equals('completed').sortBy('date');
  
  const labels = [];
  const datasetData = [];

  for (const workout of workouts) {
    // Get sets for this exercise in this specific workout
    const sets = await db.sets.where('workoutId').equals(workout.id)
      .and(s => s.exerciseId === exerciseId && s.weight !== undefined && s.reps !== undefined)
      .toArray();

    if (sets.length === 0) continue;

    // Calculate value based on selected metric
    let val = 0;
    if (activeExerciseMetric === '1rm') {
      // Epley Formula: 1RM = Weight * (1 + Reps/30)
      // Pick max 1RM of the session
      let max1RM = 0;
      sets.forEach(s => {
        const est1RM = s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30);
        if (est1RM > max1RM) max1RM = est1RM;
      });
      val = Math.round(max1RM * 10) / 10;
    } else if (activeExerciseMetric === 'max-weight') {
      // Max weight lifted in the session
      let maxW = 0;
      sets.forEach(s => {
        if (s.weight > maxW) maxW = s.weight;
      });
      val = maxW;
    } else if (activeExerciseMetric === 'volume') {
      // Exercise specific volume
      let vol = 0;
      sets.forEach(s => {
        vol += s.weight * s.reps;
      });
      val = vol;
    }

    labels.push(formatShortDate(new Date(workout.date)));
    datasetData.push(val);
  }

  let labelText = '';
  let color = '#3b82f6';
  let bgColor = 'rgba(59, 130, 246, 0.1)';

  if (activeExerciseMetric === '1rm') {
    labelText = '1RM Estimado (kg)';
    color = '#10b981';
    bgColor = 'rgba(16, 185, 129, 0.1)';
  } else if (activeExerciseMetric === 'max-weight') {
    labelText = 'Peso Máximo (kg)';
    color = '#ec4899';
    bgColor = 'rgba(236, 72, 153, 0.1)';
  } else {
    labelText = 'Volumen Ejercicio (kg)';
  }

  const ctx = document.getElementById('chart-exercise-progress').getContext('2d');
  chartExerciseInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: labelText,
        data: datasetData,
        borderColor: color,
        backgroundColor: bgColor,
        borderWidth: 3,
        tension: 0.25,
        fill: true,
        pointBackgroundColor: color,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
}

// 9. WEIGHT VIEW LOGIC
function setupWeightListeners() {
  els.btnShowAddWeight.addEventListener('click', () => {
    els.addWeightFormCard.classList.remove('hidden');
    els.weightValue.focus();
    els.weightDate.value = new Date().toISOString().split('T')[0];
  });

  els.btnCancelAddWeight.addEventListener('click', () => {
    els.addWeightFormCard.classList.add('hidden');
    els.weightValue.value = '';
  });

  els.btnSaveWeight.addEventListener('click', saveBodyweight);
}

async function initWeightView() {
  await loadWeightHistoryTable();
  await renderBodyweightChart();
}

async function loadWeightHistoryTable() {
  els.weightHistoryTbody.innerHTML = '';
  
  // Sort weight entries by date descending
  const weights = await db.bodyweight.reverse().sortBy('date');

  if (weights.length === 0) {
    els.weightHistoryTbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-muted" style="text-align: center; padding: 30px;">
          No hay registros de peso corporal.
        </td>
      </tr>
    `;
    return;
  }

  weights.forEach(w => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatFullDate(new Date(w.date + 'T12:00:00'))}</td>
      <td style="font-weight: 600;">${w.weight} kg</td>
      <td>
        <button class="btn-delete-exercise btn-delete-weight" data-id="${w.id}">
          <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
        </button>
      </td>
    `;

    row.querySelector('.btn-delete-weight').addEventListener('click', async () => {
      if (confirm('¿Eliminar este registro de peso?')) {
        await db.bodyweight.delete(w.id);
        showToast('Peso corporal eliminado.');
        await initWeightView();
      }
    });

    els.weightHistoryTbody.appendChild(row);
  });

  lucide.createIcons();
}

async function saveBodyweight() {
  const weight = parseFloat(els.weightValue.value);
  const dateVal = els.weightDate.value;

  if (isNaN(weight) || weight <= 0) {
    showToast('Ingresa un peso corporal válido.', 'error');
    return;
  }
  if (!dateVal) {
    showToast('Selecciona una fecha.', 'error');
    return;
  }

  // Check if weight record for this date already exists to prompt or overwrite
  const existing = await db.bodyweight.where('date').equals(dateVal).first();
  if (existing) {
    if (confirm(`Ya tienes un peso registrado para el ${dateVal}. ¿Deseas actualizarlo?`)) {
      await db.bodyweight.update(existing.id, { weight });
      showToast('Registro de peso actualizado.');
    } else {
      return;
    }
  } else {
    await db.bodyweight.add({
      date: dateVal,
      weight: weight
    });
    showToast('Peso corporal registrado.');
  }

  els.weightValue.value = '';
  els.addWeightFormCard.classList.add('hidden');
  await initWeightView();
}

async function renderBodyweightChart() {
  if (chartBodyweightInstance) {
    chartBodyweightInstance.destroy();
  }

  // Get weights sorted by date ascending
  const weights = await db.bodyweight.orderBy('date').toArray();

  if (weights.length === 0) {
    return;
  }

  // Max recent 20 weight entries
  const recentWeights = weights.slice(-20);
  const labels = recentWeights.map(w => formatShortDate(new Date(w.date + 'T12:00:00')));
  const datasetData = recentWeights.map(w => w.weight);

  const ctx = document.getElementById('chart-bodyweight').getContext('2d');
  chartBodyweightInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Peso Corporal (kg)',
        data: datasetData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: '#10b981',
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
}

// 10. SETTINGS LOGIC
function setupSettingsListeners() {
  els.btnExportJson.addEventListener('click', exportDatabaseToJson);
  els.btnTriggerImport.addEventListener('click', () => els.importJsonFile.click());
  els.importJsonFile.addEventListener('change', importDatabaseFromJson);
  els.btnLoadPresets.addEventListener('click', async () => {
    const count = await db.exercises.count();
    if (count > 0 && !confirm('Ya tienes ejercicios cargados. ¿Cargar los predeterminados de todos modos? Se sumarán a tu lista.')) {
      return;
    }
    await seedDefaultExercises();
    await loadExercisesList();
  });
  els.btnClearDb.addEventListener('click', clearDatabase);
}

async function exportDatabaseToJson() {
  try {
    // Read all tables
    const exercises = await db.exercises.toArray();
    const workouts = await db.workouts.toArray();
    const sets = await db.sets.toArray();
    const bodyweight = await db.bodyweight.toArray();

    const dataBackup = {
      app: 'LiftLog',
      version: 1,
      exportDate: new Date().toISOString(),
      exercises,
      workouts,
      sets,
      bodyweight
    };

    const jsonString = JSON.stringify(dataBackup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    
    const formattedDate = new Date().toISOString().split('T')[0];
    a.download = `liftlog_backup_${formattedDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Copia de seguridad exportada con éxito.');
  } catch (error) {
    showToast('Error al exportar la base de datos.', 'error');
    console.error(error);
  }
}

async function importDatabaseFromJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      
      // Simple format verification
      if (!data.exercises || !data.workouts || !data.sets || !data.bodyweight) {
        showToast('Formato de copia de seguridad inválido.', 'error');
        return;
      }

      const confirmRestore = confirm(
        `Se importarán:\n- ${data.exercises.length} ejercicios\n- ${data.workouts.length} entrenamientos\n- ${data.sets.length} series\n- ${data.bodyweight.length} registros de peso.\n\nLos datos duplicados se sobrescribirán. ¿Deseas proceder?`
      );

      if (!confirmRestore) return;

      // Import database transactions
      await db.transaction('rw', [db.exercises, db.workouts, db.sets, db.bodyweight], async () => {
        // We use bulkPut so entries with existing IDs are replaced/updated instead of throwing error
        if (data.exercises.length > 0) await db.exercises.bulkPut(data.exercises);
        if (data.workouts.length > 0) await db.workouts.bulkPut(data.workouts);
        if (data.sets.length > 0) await db.sets.bulkPut(data.sets);
        if (data.bodyweight.length > 0) await db.bodyweight.bulkPut(data.bodyweight);
      });

      showToast('¡Copia de seguridad restaurada con éxito!');
      
      // Clear file input value
      els.importJsonFile.value = '';
      
      // Reload current views
      const activeNavId = document.querySelector('.nav-item.active').getAttribute('data-view');
      await initViewData(activeNavId);
    } catch (err) {
      showToast('Error al parsear el archivo JSON.', 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

async function clearDatabase() {
  if (confirm('¿ATENCIÓN! Estás a punto de borrar TODOS tus datos definitivamente. No podrás recuperarlos a menos que tengas una copia de seguridad JSON. ¿Deseas continuar?')) {
    if (confirm('Por favor confirma por segunda vez. ¿Borrar absolutamente todo?')) {
      await db.transaction('rw', [db.exercises, db.workouts, db.sets, db.bodyweight], async () => {
        await db.exercises.clear();
        await db.workouts.clear();
        await db.sets.clear();
        await db.bodyweight.clear();
      });
      showToast('Base de datos borrada por completo.');
      // Re-seed defaults so app isn't completely empty next time
      await checkAndSeedPresets();
      window.location.reload();
    }
  }
}

// 11. MODAL WINDOWS DIALOGS LOGIC
function setupModalListeners() {
  // Select Exercise search in modal
  els.modalExerciseSearch.addEventListener('input', fillModalExercisesList);

  // Quick exercise create button inside select modal
  els.btnModalCreateExercise.addEventListener('click', async () => {
    const name = els.modalExerciseSearch.value.trim();
    if (!name) {
      showToast('Escribe el nombre del ejercicio en el buscador primero.', 'error');
      return;
    }
    try {
      const id = await db.exercises.add({ name });
      showToast('Ejercicio creado y agregado.');
      await selectExerciseForActiveWorkout(id);
      closeAllModals();
    } catch (e) {
      showToast('Ya existe un ejercicio con ese nombre.', 'error');
    }
  });

  // Setup generic modal close events
  els.modalCloses.forEach(closeBtn => {
    closeBtn.addEventListener('click', closeAllModals);
  });
}

function openSelectExerciseModal() {
  els.modalSelectExercise.classList.add('active');
  els.modalExerciseSearch.value = '';
  fillModalExercisesList();
  els.modalExerciseSearch.focus();
}

async function fillModalExercisesList() {
  els.modalExercisesList.innerHTML = '';
  const searchVal = els.modalExerciseSearch.value.toLowerCase().trim();

  let exercises = await db.exercises.orderBy('name').toArray();

  if (searchVal) {
    exercises = exercises.filter(e => e.name.toLowerCase().includes(searchVal));
  }

  if (exercises.length === 0) {
    els.modalExercisesList.innerHTML = `
      <div class="text-muted" style="text-align: center; padding: 15px;">
        No se encontraron ejercicios. Escribe un nombre y presiona el botón inferior para crearlo.
      </div>
    `;
    return;
  }

  // Filter out exercises that are already added in the active workout to avoid duplicates in the same session
  const alreadyAddedIds = activeWorkoutExercises.map(e => e.id);
  const availableExercises = exercises.filter(e => !alreadyAddedIds.includes(e.id));

  if (availableExercises.length === 0) {
    els.modalExercisesList.innerHTML = `
      <div class="text-muted" style="text-align: center; padding: 15px;">
        Todos los ejercicios filtrados ya fueron añadidos a esta sesión.
      </div>
    `;
    return;
  }

  availableExercises.forEach(e => {
    const div = document.createElement('div');
    div.className = 'modal-exercise-item';
    div.textContent = e.name;
    div.addEventListener('click', async () => {
      await selectExerciseForActiveWorkout(e.id);
      closeAllModals();
    });
    els.modalExercisesList.appendChild(div);
  });
}

async function selectExerciseForActiveWorkout(exerciseId) {
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) return;

  activeWorkoutExercises.push(exercise);
  
  // Render card UI
  renderExerciseLogCard(exercise);
  
  // Instantly scroll down to the new card
  setTimeout(() => {
    const cardEl = document.getElementById(`exercise-card-${exerciseId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);

  lucide.createIcons();
}

// Workout History Details Dialog Modal
let currentDetailsWorkoutId = null;

async function openWorkoutDetailsModal(workoutId) {
  currentDetailsWorkoutId = workoutId;
  const workout = await db.workouts.get(workoutId);
  if (!workout) return;

  els.detailsWorkoutName.textContent = workout.name;
  els.detailsWorkoutBody.innerHTML = '<div style="text-align:center;padding:20px;">Cargando...</div>';
  
  els.modalWorkoutDetails.classList.add('active');

  // Load exercises & sets
  const sets = await db.sets.where('workoutId').equals(workoutId).toArray();
  
  if (sets.length === 0) {
    els.detailsWorkoutBody.innerHTML = '<div class="text-muted">No se registraron series en este entrenamiento.</div>';
    return;
  }

  // Group by exercise
  const exerciseGroups = {};
  sets.forEach(s => {
    if (!exerciseGroups[s.exerciseId]) exerciseGroups[s.exerciseId] = [];
    exerciseGroups[s.exerciseId].push(s);
  });

  els.detailsWorkoutBody.innerHTML = '';
  
  for (const exerciseIdStr in exerciseGroups) {
    const exerciseId = parseInt(exerciseIdStr);
    const exercise = await db.exercises.get(exerciseId);
    const exerciseSets = exerciseGroups[exerciseId];

    const card = document.createElement('div');
    card.className = 'details-exercise-card';
    
    let setsHTML = '';
    // Sort sets
    exerciseSets.sort((a, b) => a.id - b.id).forEach((s, idx) => {
      setsHTML += `
        <div class="details-set-row">
          <span style="font-weight:600;color:var(--text-muted);">Serie ${idx+1}</span>
          <span style="text-align:center;">${s.weight} kg</span>
          <span style="text-align:right;">${s.reps} reps</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="details-exercise-title">${exercise ? exercise.name : 'Ejercicio Eliminado'}</div>
      <div class="details-sets-container">
        ${setsHTML}
      </div>
    `;

    els.detailsWorkoutBody.appendChild(card);
  }

  // Workout details delete button setup
  els.btnDetailsDeleteWorkout.onclick = async () => {
    if (confirm('¿Seguro que deseas eliminar este entrenamiento del historial? Esta acción no se puede deshacer.')) {
      // Delete sets
      const workoutSets = await db.sets.where('workoutId').equals(workoutId).toArray();
      await Promise.all(workoutSets.map(s => db.sets.delete(s.id)));
      
      // Delete workout
      await db.workouts.delete(workoutId);
      
      showToast('Entrenamiento eliminado del historial.');
      closeAllModals();
      await loadWorkoutsHistory();
    }
  };
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
  });
}

// 12. UTILITY HELPER FUNCTIONS
function formatShortDate(dateObj) {
  // Return format DD/MM
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatFullDate(dateObj) {
  // Return format DD/MM/YYYY
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

function getDayName(dateObj) {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[dateObj.getDay()];
}

function formatDateForInput(date) {
  // Convert date to YYYY-MM-DDTHH:MM local format
  const pad = (num) => String(num).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// Toast Notification
function showToast(message, type = 'success') {
  // If a toast already exists, remove it
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  
  let icon = 'check-circle';
  if (type === 'error') icon = 'alert-circle';
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  lucide.createIcons();

  // Animate slide-in and fade-out
  setTimeout(() => {
    toast.classList.add('show');
  }, 50);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Debounce helper to limit DB writes while user types
function debounce(func, delay) {
  let debounceTimer;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

// Add CSS rules for toast notifications directly in JavaScript for ease of integration
const toastStyle = document.createElement('style');
toastStyle.innerHTML = `
  .toast-notification {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translate(-50%, -100px);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background-color: var(--bg-secondary);
    color: var(--text-main);
    border-radius: var(--border-radius-md);
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    border: 1px solid var(--border-color);
    z-index: 2000;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
    opacity: 0;
    font-size: 14px;
    font-weight: 500;
    pointer-events: none;
    max-width: 90%;
    width: max-content;
  }
  .toast-notification.show {
    transform: translate(-50%, 0);
    opacity: 1;
  }
  .toast-notification.success i {
    color: var(--accent-success);
  }
  .toast-notification.error i {
    color: var(--accent-danger);
  }
  .toast-notification.success {
    border-left: 4px solid var(--accent-success);
  }
  .toast-notification.error {
    border-left: 4px solid var(--accent-danger);
  }
`;
document.head.appendChild(toastStyle);
