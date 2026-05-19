/**
 * ZENITH TASK MANAGER — script.js
 * Vanilla JS | localStorage persistence | Full CRUD
 */

/* =====================================================
   STATE
   ===================================================== */
let state = {
  profile: {
    name: 'Username',
    role: 'Your Role',
    avatar: ''
  },
  categories: [
    { id: 'personal', name: 'Personal',  icon: 'fa-user',      color: '#7c5cfc' },
    { id: 'work',     name: 'Work',      icon: 'fa-briefcase', color: '#f97316' },
    { id: 'study',    name: 'Study',     icon: 'fa-book',      color: '#22c55e' },
    { id: 'video',    name: 'Video',     icon: 'fa-film',      color: '#ef4444' }
  ],
  tasks: [],
  activeCategory: 'all',  // 'all' or a category id
  filter: 'all',
  searchQuery: ''
};

// Pending confirmation callback
let pendingConfirm = null;
// Category being edited (null = new)
let editingCategoryId = null;

/* =====================================================
   LOCALSTORAGE
   ===================================================== */
function saveState() {
  localStorage.setItem('zenithState', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('zenithState');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge carefully to avoid missing new keys
      state.profile     = parsed.profile     || state.profile;
      state.categories  = parsed.categories  || state.categories;
      state.tasks       = parsed.tasks       || state.tasks;
      state.activeCategory = parsed.activeCategory || 'all';
      state.filter      = parsed.filter      || 'all';
    } catch(e) { /* use defaults */ }
  }
}

/* =====================================================
   HELPERS
   ===================================================== */
function generateId() {
  return '_' + Math.random().toString(36).slice(2, 11);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  return d < today;
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2) || 'U';
}

function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/* =====================================================
   MODAL HELPERS
   ===================================================== */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Close buttons
document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.modal;
    if (id) closeModal(id);
  });
});

/* =====================================================
   PROFILE
   ===================================================== */
function renderProfile() {
  const { name, role, avatar } = state.profile;
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = role;
  document.getElementById('avatarInitials').textContent = getInitials(name);

  const img = document.getElementById('avatarImg');
  const ini = document.getElementById('avatarInitials');
  if (avatar) {
    img.src = avatar;
    img.style.display = 'flex';
    ini.style.display = 'none';
  } else {
    img.style.display = 'none';
    ini.style.display = 'flex';
  }
}

document.getElementById('btnEditProfile').addEventListener('click', () => {
  document.getElementById('editName').value = state.profile.name;
  document.getElementById('editRole').value = state.profile.role;
  openModal('profileModal');
});

document.getElementById('btnSaveProfile').addEventListener('click', () => {
  const name = document.getElementById('editName').value.trim();
  const role = document.getElementById('editRole').value.trim();
  if (!name) { showToast('⚠️ Name cannot be empty'); return; }
  state.profile.name = name;
  state.profile.role = role || 'No status set';
  saveState();
  renderProfile();
  closeModal('profileModal');
  showToast('✅ Profile updated!');
});

// Avatar upload
document.getElementById('avatarUpload').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.profile.avatar = e.target.result;
    saveState();
    renderProfile();
    showToast('🖼️ Avatar updated!');
  };
  reader.readAsDataURL(file);
});

/* =====================================================
   CATEGORIES
   ===================================================== */
function getTaskCountForCategory(catId) {
  return state.tasks.filter(t => t.categoryId === catId).length;
}

function renderCategories() {
  const ul = document.getElementById('categoryList');
  ul.innerHTML = '';

  // "All Tasks" built-in entry
  const allLi = document.createElement('li');
  allLi.className = 'category-item' + (state.activeCategory === 'all' ? ' active' : '');
  allLi.dataset.id = 'all';
  allLi.innerHTML = `
    <div class="cat-icon"><i class="fa fa-layer-group"></i></div>
    <div class="cat-info">
      <div class="cat-name">All Tasks</div>
      <div class="cat-count">${state.tasks.length} task${state.tasks.length !== 1 ? 's' : ''}</div>
    </div>
  `;
  allLi.addEventListener('click', () => selectCategory('all'));
  ul.appendChild(allLi);

  // User categories
  state.categories.forEach(cat => {
    const count = getTaskCountForCategory(cat.id);
    const li = document.createElement('li');
    li.className = 'category-item' + (state.activeCategory === cat.id ? ' active' : '');
    li.dataset.id = cat.id;
    li.innerHTML = `
      <div class="cat-icon"><i class="fa ${cat.icon}"></i></div>
      <div class="cat-info">
        <div class="cat-name">${escapeHtml(cat.name)}</div>
        <div class="cat-count">${count} task${count !== 1 ? 's' : ''}</div>
      </div>
      <div class="cat-actions">
        <button class="cat-btn edit" title="Edit category"><i class="fa fa-pen"></i></button>
        <button class="cat-btn del" title="Delete category"><i class="fa fa-trash"></i></button>
      </div>
    `;
    li.addEventListener('click', e => {
      if (!e.target.closest('.cat-actions')) selectCategory(cat.id);
    });
    li.querySelector('.edit').addEventListener('click', e => { e.stopPropagation(); openEditCategory(cat.id); });
    li.querySelector('.del').addEventListener('click',  e => { e.stopPropagation(); confirmDeleteCategory(cat.id); });
    ul.appendChild(li);
  });
}

function selectCategory(id) {
  state.activeCategory = id;
  state.filter = 'all';
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  // Reset filter buttons
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
  saveState();
  renderCategories();
  renderTasksView();
  // Close sidebar on mobile
  if (window.innerWidth <= 720) closeMobileSidebar();
}

// Add category
document.getElementById('btnAddCategory').addEventListener('click', () => {
  editingCategoryId = null;
  document.getElementById('categoryModalTitle').textContent = 'New Category';
  document.getElementById('editCategoryName').value = '';
  document.getElementById('editCategoryIcon').value = '';
  document.getElementById('iconPreview').className = 'fa fa-folder';
  openModal('categoryModal');
});

function openEditCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  editingCategoryId = id;
  document.getElementById('categoryModalTitle').textContent = 'Edit Category';
  document.getElementById('editCategoryName').value = cat.name;
  document.getElementById('editCategoryIcon').value = cat.icon;
  document.getElementById('iconPreview').className = `fa ${cat.icon}`;
  openModal('categoryModal');
}

// Live icon preview
document.getElementById('editCategoryIcon').addEventListener('input', function() {
  const val = this.value.trim() || 'fa-folder';
  document.getElementById('iconPreview').className = `fa ${val}`;
});

// Icon suggestion clicks
document.querySelectorAll('.icon-suggestions span').forEach(span => {
  span.addEventListener('click', () => {
    const icon = span.dataset.icon;
    document.getElementById('editCategoryIcon').value = icon;
    document.getElementById('iconPreview').className = `fa ${icon}`;
  });
});

document.getElementById('btnSaveCategory').addEventListener('click', () => {
  const name = document.getElementById('editCategoryName').value.trim();
  const icon = document.getElementById('editCategoryIcon').value.trim() || 'fa-folder';
  if (!name) { showToast('⚠️ Category name is required'); return; }

  if (editingCategoryId) {
    const cat = state.categories.find(c => c.id === editingCategoryId);
    if (cat) { cat.name = name; cat.icon = icon; }
    showToast('✅ Category updated!');
  } else {
    state.categories.push({ id: generateId(), name, icon });
    showToast('✅ Category added!');
  }
  saveState();
  renderCategories();
  renderTasksView();
  closeModal('categoryModal');
});

function confirmDeleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  const taskCount = getTaskCountForCategory(id);
  document.getElementById('confirmMessage').textContent =
    `Delete "${cat.name}"? ${taskCount > 0 ? `This will also delete ${taskCount} task(s) inside.` : ''}`;
  pendingConfirm = () => deleteCategory(id);
  openModal('confirmModal');
}

function deleteCategory(id) {
  state.categories = state.categories.filter(c => c.id !== id);
  state.tasks = state.tasks.filter(t => t.categoryId !== id);
  if (state.activeCategory === id) state.activeCategory = 'all';
  saveState();
  renderCategories();
  renderTasksView();
  showToast('🗑️ Category deleted');
}

/* =====================================================
   STATS & PROGRESS
   ===================================================== */
function renderStats() {
  const total     = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const pct       = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statDone').textContent    = completed;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('progressPct').textContent = pct + '%';
  document.getElementById('progressFill').style.width = pct + '%';
}

/* =====================================================
   TASKS — FILTER & RENDER
   ===================================================== */
function getFilteredTasks() {
  let tasks = state.tasks;

  // Category filter
  if (state.activeCategory !== 'all') {
    tasks = tasks.filter(t => t.categoryId === state.activeCategory);
  }

  // Status / priority filter
  switch (state.filter) {
    case 'completed': tasks = tasks.filter(t => t.completed);  break;
    case 'pending':   tasks = tasks.filter(t => !t.completed); break;
    case 'high':      tasks = tasks.filter(t => t.priority === 'high'); break;
  }

  // Search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  return tasks;
}

/* =====================================================
   PRIORITY GROUPS — render tasks in High → Medium → Low
   ===================================================== */
const PRIORITY_ORDER = ['high', 'medium', 'low'];
const PRIORITY_LABELS = { high: '🔴 High Priority', medium: '🟡 Medium Priority', low: '🟢 Low Priority' };
const PRIORITY_ICONS  = { high: 'fa-fire', medium: 'fa-circle-half-stroke', low: 'fa-leaf' };

function renderTasksView() {
  // Header title
  const catName = state.activeCategory === 'all'
    ? 'All Tasks'
    : (state.categories.find(c => c.id === state.activeCategory)?.name || 'Tasks');
  document.getElementById('currentCategoryTitle').textContent = catName;

  const filtered = getFilteredTasks();
  document.getElementById('currentCategoryCount').textContent =
    `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`;

  const listEl  = document.getElementById('taskList');
  const emptyEl = document.getElementById('emptyState');
  listEl.innerHTML = '';

  if (filtered.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  // Separate pending vs completed
  const pending   = filtered.filter(t => !t.completed);
  const completed = filtered.filter(t => t.completed);

  // Helper: sort within a group by due date
  function sortByDue(arr) {
    return arr.slice().sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }

  // Render pending tasks grouped by priority
  PRIORITY_ORDER.forEach(p => {
    const group = sortByDue(pending.filter(t => t.priority === p));
    if (group.length === 0) return;

    // Section header
    const header = document.createElement('div');
    header.className = `priority-group-header priority-group-${p}`;
    header.innerHTML = `
      <span class="pg-dot"></span>
      <i class="fa ${PRIORITY_ICONS[p]}"></i>
      <span>${PRIORITY_LABELS[p]}</span>
      <span class="pg-count">${group.length}</span>
    `;
    listEl.appendChild(header);

    group.forEach(task => listEl.appendChild(createTaskElement(task)));
  });

  // Render completed tasks as a separate collapsed-style group
  if (completed.length > 0) {
    const compHeader = document.createElement('div');
    compHeader.className = 'priority-group-header priority-group-done';
    compHeader.innerHTML = `
      <span class="pg-dot"></span>
      <i class="fa fa-check-circle"></i>
      <span>Completed</span>
      <span class="pg-count">${completed.length}</span>
    `;
    listEl.appendChild(compHeader);
    sortByDue(completed).forEach(task => listEl.appendChild(createTaskElement(task)));
  }
}

function createTaskElement(task) {
  const el = document.createElement('div');
  el.className = 'task-item' + (task.completed ? ' completed' : '');
  el.dataset.id = task.id;
  el.dataset.priority = task.priority;

  const overdue = !task.completed && isOverdue(task.dueDate);
  const dueDateStr = task.dueDate
    ? `<span class="due-date ${overdue ? 'overdue' : ''}">
         <i class="fa fa-calendar${overdue ? '-times' : ''}"></i>
         ${formatDate(task.dueDate)}${overdue ? ' · Overdue' : ''}
       </span>`
    : '';

  el.innerHTML = `
    <div class="task-check ${task.completed ? 'checked' : ''}" data-id="${task.id}">
      ${task.completed ? '<i class="fa fa-check"></i>' : ''}
    </div>
    <div class="task-body">
      <div class="task-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
      <div class="task-meta">
        <span class="priority-badge ${task.priority}">${capitalize(task.priority)}</span>
        ${dueDateStr}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-btn edit-task" title="Edit task"><i class="fa fa-pen"></i></button>
      <button class="task-btn del delete-task" title="Delete task"><i class="fa fa-trash"></i></button>
    </div>
  `;

  el.querySelector('.task-check').addEventListener('click', () => toggleTask(task.id));
  el.querySelector('.edit-task').addEventListener('click', e => { e.stopPropagation(); openEditTask(task.id); });
  el.querySelector('.delete-task').addEventListener('click', e => { e.stopPropagation(); confirmDeleteTask(task.id); });

  return el;
}

/* =====================================================
   ADD TASK (inline form)
   ===================================================== */
// Toggle add task panel
const addTaskToggle = document.getElementById('addTaskToggle');
const addTaskBody   = document.getElementById('addTaskBody');
const addTaskChevron = document.getElementById('addTaskChevron');

addTaskToggle.addEventListener('click', () => {
  const open = addTaskBody.classList.toggle('open');
  addTaskChevron.classList.toggle('open', open);
  if (open) document.getElementById('taskTitle').focus();
});

document.getElementById('btnCancelTask').addEventListener('click', () => {
  addTaskBody.classList.remove('open');
  addTaskChevron.classList.remove('open');
  clearAddForm();
});

document.getElementById('taskTitle').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

document.getElementById('btnAddTask').addEventListener('click', addTask);

function addTask() {
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const dueDate  = document.getElementById('taskDue').value;

  if (!title) {
    showToast('⚠️ Task title is required');
    document.getElementById('taskTitle').focus();
    return;
  }

  const task = {
    id:          generateId(),
    title,
    description: desc,
    priority,
    dueDate,
    completed:   false,
    createdAt:   Date.now(),
    categoryId:  state.activeCategory === 'all' ? (state.categories[0]?.id || 'personal') : state.activeCategory
  };

  state.tasks.unshift(task);
  saveState();
  clearAddForm();
  addTaskBody.classList.remove('open');
  addTaskChevron.classList.remove('open');
  renderAll();
  showToast('✅ Task added!');
}

function clearAddForm() {
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value  = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskDue').value   = '';
}

/* =====================================================
   TOGGLE TASK COMPLETE
   ===================================================== */
function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveState();
  renderAll();
  showToast(task.completed ? '🎉 Task completed!' : '↩️ Marked as pending');
}

/* =====================================================
   EDIT TASK
   ===================================================== */
function openEditTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('editTaskId').value          = id;
  document.getElementById('editTaskTitle').value       = task.title;
  document.getElementById('editTaskDesc').value        = task.description || '';
  document.getElementById('editTaskPriority').value    = task.priority;
  document.getElementById('editTaskDue').value         = task.dueDate || '';
  openModal('editTaskModal');
}

document.getElementById('btnSaveTask').addEventListener('click', () => {
  const id    = document.getElementById('editTaskId').value;
  const title = document.getElementById('editTaskTitle').value.trim();
  if (!title) { showToast('⚠️ Title cannot be empty'); return; }

  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  task.title       = title;
  task.description = document.getElementById('editTaskDesc').value.trim();
  task.priority    = document.getElementById('editTaskPriority').value;
  task.dueDate     = document.getElementById('editTaskDue').value;

  saveState();
  renderAll();
  closeModal('editTaskModal');
  showToast('✅ Task updated!');
});

/* =====================================================
   DELETE TASK
   ===================================================== */
function confirmDeleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('confirmMessage').textContent = `Delete "${task.title}"? This cannot be undone.`;
  pendingConfirm = () => deleteTask(id);
  openModal('confirmModal');
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  renderAll();
  showToast('🗑️ Task deleted');
}

// Confirm button
document.getElementById('btnConfirmDelete').addEventListener('click', () => {
  if (pendingConfirm) { pendingConfirm(); pendingConfirm = null; }
  closeModal('confirmModal');
});

/* =====================================================
   SEARCH
   ===================================================== */
document.getElementById('searchInput').addEventListener('input', function() {
  state.searchQuery = this.value.trim();
  renderTasksView();
});

/* =====================================================
   FILTER BUTTONS
   ===================================================== */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    saveState();
    renderTasksView();
  });
});

/* =====================================================
   MOBILE SIDEBAR
   ===================================================== */
// Add backdrop div dynamically
const backdrop = document.createElement('div');
backdrop.className = 'sidebar-backdrop';
document.body.appendChild(backdrop);

document.getElementById('hamburger').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.add('open');
  backdrop.classList.add('open');
  // Reposition close button to be just inside the sidebar edge
  const w = sidebar.offsetWidth;
  document.getElementById('sidebarClose').style.left = (w - 46) + 'px';
});

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  backdrop.classList.remove('open');
}

document.getElementById('sidebarClose').addEventListener('click', closeMobileSidebar);
backdrop.addEventListener('click', closeMobileSidebar);

/* =====================================================
   RENDER ALL
   ===================================================== */
function renderAll() {
  renderProfile();
  renderStats();
  renderCategories();
  renderTasksView();
}

/* =====================================================
   UTILS
   ===================================================== */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* =====================================================
   SEED DATA (first run)
   ===================================================== */
function seedData() {
  if (state.tasks.length > 0) return;
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);

  state.tasks = [];
  saveState();
}

/* =====================================================
   INIT
   ===================================================== */
loadState();
//seedData();
renderAll();

// Set active filter button from state
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.filter === state.filter);
});