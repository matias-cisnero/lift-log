// LiftLog App Logic - Dexie.js + Chart.js + Vanilla JS

// 1. DATABASE INITIALIZATION
const db = new Dexie('LiftLogDB');
db.version(1).stores({
  exercises: '++id, &name',
  workouts: '++id, date, status', // status: 'active' or 'completed'
  sets: '++id, workoutId, exerciseId',
  bodyweight: '++id, date'
});

// Muscle Groups Translation/Label mapping
const MUSCLE_LABELS = {
  cuadriceps: 'Cuádriceps',
  isquiosurales: 'Isquiosurales',
  pantorrilla: 'Pantorrilla',
  gluteos: 'Glúteos',
  abdomen: 'Abdomen',
  espalda: 'Espalda',
  pecho: 'Pecho',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  'deltoides posterior': 'Deltoides Posterior',
  'deltoides lateral': 'Deltoides Lateral',
  'deltoides anterior': 'Deltoides Anterior',
  antebrazo: 'Antebrazo',
  'espalda baja': 'Espalda Baja'
};

// Default exercise presets with muscle group mappings (as requested by user)
const DEFAULT_EXERCISES = [
  // Empujes / Pecho
  { name: 'Press Banca', primaryMuscle: 'pecho', secondaryMuscles: ['triceps', 'deltoides anterior'] },
  { name: 'Press Banca Inclinado', primaryMuscle: 'pecho', secondaryMuscles: ['triceps', 'deltoides anterior'] },
  { name: 'Press Inclinado con Mancuernas', primaryMuscle: 'pecho', secondaryMuscles: ['triceps', 'deltoides anterior'] },
  { name: 'Press con Mancuernas', primaryMuscle: 'pecho', secondaryMuscles: ['triceps', 'deltoides anterior'] },
  { name: 'Fondos', primaryMuscle: 'pecho', secondaryMuscles: ['triceps', 'deltoides posterior'] },
  
  // Tracciones / Espalda
  { name: 'Dominadas', primaryMuscle: 'espalda', secondaryMuscles: ['biceps', 'deltoides posterior', 'antebrazo'] },
  { name: 'Jalón al Pecho', primaryMuscle: 'espalda', secondaryMuscles: ['biceps', 'deltoides posterior', 'antebrazo'] },
  { name: 'Remo con Barra', primaryMuscle: 'espalda', secondaryMuscles: ['biceps', 'deltoides posterior', 'antebrazo'] },
  
  // Hombros / Deltoides
  { name: 'Elevaciones Laterales', primaryMuscle: 'deltoides lateral', secondaryMuscles: ['deltoides anterior'] },
  { name: 'Press Militar', primaryMuscle: 'deltoides anterior', secondaryMuscles: ['deltoides lateral', 'pecho'] },
  
  // Brazos
  { name: 'Curl de Biceps con Barra', primaryMuscle: 'biceps', secondaryMuscles: [] },
  { name: 'Curl Martillo', primaryMuscle: 'biceps', secondaryMuscles: ['antebrazo'] },
  { name: 'Extensión de Triceps', primaryMuscle: 'triceps', secondaryMuscles: [] },
  { name: 'Press Frances con Barra', primaryMuscle: 'triceps', secondaryMuscles: [] },
  { name: 'Press Frances con Mancuerna', primaryMuscle: 'triceps', secondaryMuscles: [] },
  
  // Piernas
  { name: 'Sentadilla con Barra', primaryMuscle: 'cuadriceps', secondaryMuscles: ['gluteos', 'espalda baja'] },
  { name: 'Peso Muerto Rumano', primaryMuscle: 'isquiosurales', secondaryMuscles: ['gluteos', 'espalda baja', 'antebrazo'] },
  { name: 'Prensa 45', primaryMuscle: 'cuadriceps', secondaryMuscles: ['gluteos'] },
  { name: 'Extension de Cuadriceps', primaryMuscle: 'cuadriceps', secondaryMuscles: [] },
  { name: 'Curl Femoral', primaryMuscle: 'isquiosurales', secondaryMuscles: [] },
  { name: 'Elevaciones de Talones', primaryMuscle: 'pantorrilla', secondaryMuscles: [] },
  
  // Abdomen
  { name: 'Elevaciones de Piernas', primaryMuscle: 'abdomen', secondaryMuscles: [] },
  { name: 'Rueda Abdominal', primaryMuscle: 'abdomen', secondaryMuscles: [] },
  { name: 'Crunch en Polea', primaryMuscle: 'abdomen', secondaryMuscles: [] }
];

// 2. STATE VARIABLES
let activeWorkout = null;
let activeWorkoutExercises = []; // array of exercise objects in current workout
let chartVolumeInstance = null;
let chartExerciseInstance = null;
let chartMusclesInstance = null;
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
  workoutDateInput: document.getElementById('workout-date'),
  activeWorkoutTitleDate: document.getElementById('active-workout-title-date'),
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
  for (const preset of DEFAULT_EXERCISES) {
    const existing = await db.exercises.where('name').equals(preset.name).first();
    if (existing) {
      await db.exercises.update(existing.id, {
        primaryMuscle: preset.primaryMuscle,
        secondaryMuscles: preset.secondaryMuscles
      });
    } else {
      await db.exercises.add(preset);
    }
  }
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
    
    // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
    const localDate = new Date(activeWorkout.date);
    els.workoutDateInput.value = formatDateForInput(localDate);

    // Update dynamic timezone subtitle
    els.activeWorkoutTitleDate.textContent = formatWorkoutDate(activeWorkout.date);

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
  
  const id = await db.workouts.add({
    date: now.toISOString(),
    status: 'active'
  });

  activeWorkout = { id, date: now.toISOString(), status: 'active' };
  
  els.workoutDateInput.value = formatDateForInput(now);
  els.activeWorkoutTitleDate.textContent = formatWorkoutDate(now.toISOString());

  els.workoutsHomeContainer.classList.add('hidden');
  els.activeWorkoutContainer.classList.remove('hidden');
  
  els.activeWorkoutExercisesList.innerHTML = '';
  activeWorkoutExercises = [];

  showToast('Entrenamiento iniciado. ¡A darlo todo!');
}

async function saveActiveWorkoutMeta() {
  if (!activeWorkout) return;
  
  const dateVal = els.workoutDateInput.value;
  const isoDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

  await db.workouts.update(activeWorkout.id, {
    date: isoDate
  });

  activeWorkout.date = isoDate;
  els.activeWorkoutTitleDate.textContent = formatWorkoutDate(isoDate);
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
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span class="exercise-log-title">${exercise.name}</span>
        <span class="prev-session-info text-muted" id="prev-session-${exercise.id}"></span>
      </div>
      <div class="exercise-log-actions">
        <button class="btn-add-set-row" data-exercise-id="${exercise.id}" title="Agregar Serie">
          <i data-lucide="plus"></i>
        </button>
        <button class="btn-remove-exercise-log" data-exercise-id="${exercise.id}" title="Eliminar Ejercicio">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
    <table class="sets-table">
      <thead>
        <tr>
          <th style="width: 15%;">Set</th>
          <th style="width: 42%;">Peso (kg)</th>
          <th style="width: 33%;">Reps</th>
          <th style="width: 10%;"></th>
        </tr>
      </thead>
      <tbody id="sets-list-${exercise.id}">
        <!-- Dynamically filled with tr rows -->
      </tbody>
    </table>
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

  // Load previous session info asynchronously
  updatePreviousSessionInfo(exercise.id);
}

function renderSetRow(container, exerciseId, set, setNumber) {
  const row = document.createElement('tr');
  row.id = `set-row-${set.id}`;
  row.innerHTML = `
    <td class="set-num-cell">${setNumber}</td>
    <td class="input-cell">
      <input type="number" step="0.5" class="set-weight" placeholder="0" value="${set.weight !== undefined ? set.weight : ''}" data-set-id="${set.id}">
    </td>
    <td class="input-cell">
      <input type="number" class="set-reps" placeholder="0" value="${set.reps !== undefined ? set.reps : ''}" data-set-id="${set.id}">
    </td>
    <td class="action-cell">
      <button class="btn-delete-set" data-set-id="${set.id}" data-exercise-id="${exerciseId}">
        <i data-lucide="x"></i>
      </button>
    </td>
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

  // Immediate save on blur
  weightInput.addEventListener('blur', saveSetData);
  repsInput.addEventListener('blur', saveSetData);

  // Keyboard navigation: Enter in weight focuses reps
  weightInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      repsInput.focus();
      try {
        repsInput.select();
      } catch (err) {}
    }
  });

  // Keyboard navigation & auto-row creation: Enter in reps adds a new set row
  repsInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      
      // Save current input data immediately
      await saveSetData();
      
      // Add new set and get its ID
      const newSetId = await addSetToExercise(exerciseId);
      
      // Focus and select the new weight input
      setTimeout(() => {
        const newRow = document.getElementById(`set-row-${newSetId}`);
        if (newRow) {
          const newWeightInput = newRow.querySelector('.set-weight');
          if (newWeightInput) {
            newWeightInput.focus();
            try {
              newWeightInput.select();
            } catch (err) {}
          }
        }
      }, 50);
    }
  });

  // Delete set handler
  row.querySelector('.btn-delete-set').addEventListener('click', async (e) => {
    await deleteSet(set.id, exerciseId);
  });
}

async function addSetToExercise(exerciseId) {
  let defaultWeight = undefined;
  let defaultReps = undefined;

  // 1. Query the last set logged for this exercise in the current workout
  const lastSetInCurrentWorkout = await db.sets
    .where('workoutId').equals(activeWorkout.id)
    .and(s => s.exerciseId === exerciseId)
    .reverse()
    .first();

  if (lastSetInCurrentWorkout) {
    defaultWeight = lastSetInCurrentWorkout.weight;
    defaultReps = lastSetInCurrentWorkout.reps;
  } else {
    // 2. Query previous sets for this exercise to auto-fill weight and reps from last session
    const lastSetInPreviousWorkout = await db.sets
      .where('exerciseId').equals(exerciseId)
      .and(s => s.workoutId !== activeWorkout.id)
      .reverse()
      .first();

    if (lastSetInPreviousWorkout) {
      defaultWeight = lastSetInPreviousWorkout.weight;
      defaultReps = lastSetInPreviousWorkout.reps;
    }
  }

  const setId = await db.sets.add({
    workoutId: activeWorkout.id,
    exerciseId: exerciseId,
    weight: defaultWeight,
    reps: defaultReps
  });

  const container = document.getElementById(`sets-list-${exerciseId}`);
  const setNumber = container.children.length + 1;
  
  const newSet = { id: setId, weight: defaultWeight, reps: defaultReps };
  renderSetRow(container, exerciseId, newSet, setNumber);
  
  lucide.createIcons();

  return setId;
}

// Helpers for Previous Session Display
async function getPreviousSessionDetails(exerciseId) {
  const allSetsForExercise = await db.sets
    .where('exerciseId').equals(exerciseId)
    .toArray();
  
  const pastSets = allSetsForExercise.filter(s => !activeWorkout || s.workoutId !== activeWorkout.id);
  if (pastSets.length === 0) return null;

  const workoutIds = [...new Set(pastSets.map(s => s.workoutId))];
  const workouts = await db.workouts.bulkGet(workoutIds);
  const completedWorkouts = workouts
    .filter(w => w && w.status === 'completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (completedWorkouts.length === 0) return null;

  const lastWorkout = completedWorkouts[0];
  const lastWorkoutSets = pastSets.filter(s => s.workoutId === lastWorkout.id);
  lastWorkoutSets.sort((a, b) => a.id - b.id);

  return { workout: lastWorkout, sets: lastWorkoutSets };
}

function formatPreviousSets(sets) {
  if (!sets || sets.length === 0) return '';

  const groups = [];
  let currentGroup = null;

  sets.forEach(set => {
    const weight = set.weight;
    const reps = set.reps;
    if (weight === undefined || reps === undefined) return;

    if (currentGroup && currentGroup.weight === weight) {
      currentGroup.reps.push(reps);
    } else {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        weight: weight,
        reps: [reps]
      };
    }
  });

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups.map(g => `${g.weight}kg x ${g.reps.join(',')}`).join(' | ');
}

async function updatePreviousSessionInfo(exerciseId) {
  const infoEl = document.getElementById(`prev-session-${exerciseId}`);
  if (!infoEl) return;

  try {
    const prevDetails = await getPreviousSessionDetails(exerciseId);
    if (prevDetails && prevDetails.sets.length > 0) {
      const dateLabel = formatPrevSessionDate(prevDetails.workout.date);
      const formattedSets = formatPreviousSets(prevDetails.sets);
      if (formattedSets) {
        infoEl.textContent = `Ant. (${dateLabel}): ${formattedSets}`;
        return;
      }
    }
    infoEl.textContent = '';
  } catch (err) {
    console.error('Error fetching previous session details:', err);
    infoEl.textContent = '';
  }
}

function formatPrevSessionDate(dateString) {
  const date = new Date(dateString);
  const weekday = date.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long'
  });
  const day = date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit' });
  const month = date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', month: '2-digit' });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalizedWeekday} ${day}/${month}`;
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
          <h4 class="workout-title">${formatWorkoutDate(workout.date)}</h4>
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
    const primarySelect = document.getElementById('new-exercise-primary');
    if (primarySelect) primarySelect.value = '';
    const secondariesDiv = document.getElementById('new-exercise-secondaries');
    if (secondariesDiv) {
      secondariesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
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
    
    // Format muscles tags display
    let musclesText = '';
    if (exercise.primaryMuscle) {
      musclesText = MUSCLE_LABELS[exercise.primaryMuscle] || exercise.primaryMuscle;
      if (Array.isArray(exercise.secondaryMuscles) && exercise.secondaryMuscles.length > 0) {
        const secText = exercise.secondaryMuscles.map(sm => MUSCLE_LABELS[sm] || sm).join(', ');
        musclesText += ` • Secundarios: ${secText}`;
      }
    } else {
      musclesText = 'Sin grupo muscular asignado';
    }

    item.innerHTML = `
      <div>
        <span class="exercise-item-name">${exercise.name}</span>
        <span class="exercise-item-muscles" style="display:block; font-size:11px; color:var(--text-muted); margin-top:2px;">${musclesText}</span>
      </div>
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

  const primarySelect = document.getElementById('new-exercise-primary');
  const primaryMuscle = primarySelect ? primarySelect.value : '';
  
  // Secondary muscles
  const secondariesDiv = document.getElementById('new-exercise-secondaries');
  const secondaryMuscles = [];
  if (secondariesDiv) {
    const checkedCheckboxes = secondariesDiv.querySelectorAll('input[type="checkbox"]:checked');
    checkedCheckboxes.forEach(cb => {
      secondaryMuscles.push(cb.value);
    });
  }

  try {
    await db.exercises.add({
      name,
      primaryMuscle: primaryMuscle || undefined,
      secondaryMuscles: secondaryMuscles.length > 0 ? secondaryMuscles : undefined
    });
    
    els.newExerciseName.value = '';
    if (primarySelect) primarySelect.value = '';
    if (secondariesDiv) {
      secondariesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
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
  await renderMusclesWeeklyChart();
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
  
  // Find which exercises actually have sets logged
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

    labels.push(formatShortDate(new Date(w.date)));
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
        borderColor: '#f97316', // Orange theme
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#f97316',
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
      let max1RM = 0;
      sets.forEach(s => {
        const est1RM = s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30);
        if (est1RM > max1RM) max1RM = est1RM;
      });
      val = Math.round(max1RM * 10) / 10;
    } else if (activeExerciseMetric === 'max-weight') {
      let maxW = 0;
      sets.forEach(s => {
        if (s.weight > maxW) maxW = s.weight;
      });
      val = maxW;
    } else if (activeExerciseMetric === 'volume') {
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
  let color = '#f97316'; // Orange
  let bgColor = 'rgba(249, 115, 22, 0.1)';

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

// Chart 3: Weekly Series Count by Muscle Group (Primary = 1.0, Secondary = 0.5)
async function renderMusclesWeeklyChart() {
  if (chartMusclesInstance) {
    chartMusclesInstance.destroy();
  }

  // Get date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch completed workouts in the last 7 days
  const workouts = await db.workouts.where('status').equals('completed').toArray();
  const recentWorkouts = workouts.filter(w => new Date(w.date) >= sevenDaysAgo);

  // Cache exercises map for fast lookup
  const exercises = await db.exercises.toArray();
  const exercisesMap = new Map(exercises.map(e => [e.id, e]));

  // Initialize count map for all 14 muscle groups
  const musclesMap = {};
  Object.keys(MUSCLE_LABELS).forEach(muscle => {
    musclesMap[muscle] = 0;
  });

  // Count sets
  for (const w of recentWorkouts) {
    const sets = await db.sets.where('workoutId').equals(w.id).toArray();
    sets.forEach(s => {
      // Only count sets with inputs filled
      if (s.weight !== undefined && s.reps !== undefined) {
        const exercise = exercisesMap.get(s.exerciseId);
        if (exercise) {
          if (exercise.primaryMuscle && musclesMap[exercise.primaryMuscle] !== undefined) {
            musclesMap[exercise.primaryMuscle] += 1;
          }
          if (Array.isArray(exercise.secondaryMuscles)) {
            exercise.secondaryMuscles.forEach(sm => {
              if (musclesMap[sm] !== undefined) {
                musclesMap[sm] += 0.5; // Secondary muscles count 50%
              }
            });
          }
        }
      }
    });
  }

  // Convert map to sorted array
  const sortedMuscles = Object.keys(musclesMap)
    .map(key => ({ key, value: musclesMap[key] }))
    .sort((a, b) => b.value - a.value);

  // Filter out muscles with zero series to keep chart compact
  const activeMuscles = sortedMuscles.filter(m => m.value > 0);
  
  // If nothing is logged, show all muscles at 0
  const chartData = activeMuscles.length > 0 ? activeMuscles : sortedMuscles;
  const labels = chartData.map(m => MUSCLE_LABELS[m.key]);
  const data = chartData.map(m => m.value);

  const ctx = document.getElementById('chart-muscles-weekly').getContext('2d');
  chartMusclesInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Series Semanales',
        data: data,
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        borderColor: '#f97316',
        borderWidth: 1.5,
        borderRadius: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', stepSize: 1 },
          beginAtZero: true
        },
        y: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 10 } }
        }
      }
    }
  });
}

// 9. WEIGHT VIEW LOGIC (RESTORED!)
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
  const weights = await db.bodyweight.reverse().sortBy('date');

  if (weights.length === 0) {
    els.weightHistoryTbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-muted" style="text-align: center; padding: 20px;">
          No hay registros de peso corporal.
        </td>
      </tr>
    `;
    return;
  }

  weights.forEach(w => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding: 8px 12px; font-size:13px;">${w.date.split('-').reverse().join('/')}</td>
      <td style="padding: 8px 12px; font-size:13px; font-weight: 600;">${w.weight} kg</td>
      <td style="padding: 8px 12px;">
        <button class="btn-delete-exercise btn-delete-weight" data-id="${w.id}">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
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

  const weights = await db.bodyweight.orderBy('date').toArray();

  if (weights.length === 0) {
    return;
  }

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
        borderColor: '#10b981', // Green theme for weight
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
      
      if (!data.exercises || !data.workouts || !data.sets) {
        showToast('Formato de copia de seguridad inválido.', 'error');
        return;
      }

      const confirmRestore = confirm(
        `Se importarán:\n- ${data.exercises.length} ejercicios\n- ${data.workouts.length} entrenamientos\n- ${data.sets.length} series\n- ${data.bodyweight ? data.bodyweight.length : 0} pesos.\n\nLos datos duplicados se sobrescribirán. ¿Deseas proceder?`
      );

      if (!confirmRestore) return;

      await db.transaction('rw', [db.exercises, db.workouts, db.sets, db.bodyweight], async () => {
        if (data.exercises.length > 0) await db.exercises.bulkPut(data.exercises);
        if (data.workouts.length > 0) await db.workouts.bulkPut(data.workouts);
        if (data.sets.length > 0) await db.sets.bulkPut(data.sets);
        if (data.bodyweight && data.bodyweight.length > 0) await db.bodyweight.bulkPut(data.bodyweight);
      });

      showToast('¡Copia de seguridad restaurada con éxito!');
      
      els.importJsonFile.value = '';
      
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
    
    // Format muscles line preview
    let musclesPreview = '';
    if (e.primaryMuscle) {
      musclesPreview = ` (${MUSCLE_LABELS[e.primaryMuscle] || e.primaryMuscle})`;
    }

    div.textContent = e.name + musclesPreview;
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

  els.detailsWorkoutName.textContent = formatWorkoutDate(workout.date);
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
    
    let setsRowsHTML = '';
    // Sort sets
    exerciseSets.sort((a, b) => a.id - b.id).forEach((s, idx) => {
      setsRowsHTML += `
        <tr>
          <td class="set-num-cell">${idx + 1}</td>
          <td style="text-align:center; padding: 6px;">${s.weight !== undefined ? s.weight + ' kg' : '-'}</td>
          <td style="text-align:center; padding: 6px;">${s.reps !== undefined ? s.reps + ' reps' : '-'}</td>
        </tr>
      `;
    });

    card.innerHTML = `
      <div class="details-exercise-title" style="margin-bottom: 6px; font-weight:600; font-size:13px; color:var(--accent-primary-light);">${exercise ? exercise.name : 'Ejercicio Eliminado'}</div>
      <table class="sets-table" style="margin-bottom: 0;">
        <thead>
          <tr>
            <th style="width: 20%; padding: 4px;">Set</th>
            <th style="width: 40%; padding: 4px;">Peso</th>
            <th style="width: 40%; padding: 4px;">Reps</th>
          </tr>
        </thead>
        <tbody>
          ${setsRowsHTML}
        </tbody>
      </table>
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

// Format date to local TZ Argentina displaying day of week + date + time
function formatWorkoutDate(dateString) {
  const date = new Date(dateString);
  const formatted = date.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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

// Inject CSS rules for toast notifications directly in JavaScript for ease of integration
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
