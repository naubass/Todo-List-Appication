<script setup>
import { ref, onMounted, computed, watch } from 'vue';

// === State Utama Todos & Kategori ===
const todos = ref([]);
const categories = ref([]);
const loading = ref(true);

// State Form Tambah Todo Baru
const inputTitle = ref('');
const inputDescription = ref('');
const inputDueDate = ref('');
const inputPriority = ref('medium');
const inputCategoryId = ref('');

// State Filter, Search, Sort & Tab
const currentTab = ref('active'); // 'active' | 'archived'
const searchQuery = ref('');
const filterCategoryId = ref('');
const filterPriority = ref('');
const filterStatus = ref(''); // '' (semua) | 'completed' | 'pending'
const sortBy = ref('created_at');
const sortOrder = ref('desc');

// State Statistik Ringkasan
const stats = ref({
  total_active: 0,
  total_completed: 0,
  total_archived: 0,
  overdue_count: 0,
  due_today_count: 0,
  priority_breakdown: { high: 0, medium: 0, low: 0 },
});

// State Subtask Baru & Input Edit Todo
const newSubtaskTitles = ref({}); // { [todoId]: 'judul subtask' }
const editingId = ref(null);
const editingTitle = ref('');
const editingDescription = ref('');

// === State Autentikasi ===
const user = ref(null);
const authView = ref('login'); // 'login' | 'register'
const authEmail = ref('');
const authPassword = ref('');
const authError = ref('');
const authLoading = ref(false);

const API_URL = '/api/todos';
const AUTH_URL = '/api';

// === State Profil User ===
const displayName = ref('');
const avatarBase64 = ref('');
const avatarUrl = ref('');

const setProfileData = (userData) => {
  displayName.value = userData.user_metadata?.display_name || '';
  avatarUrl.value = userData.user_metadata?.avatar_url || '';
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    avatarBase64.value = e.target.result;
    avatarUrl.value = e.target.result;
  };
  reader.readAsDataURL(file);
};

const handleSaveProfile = async () => {
  if (!user.value) return;
  try {
    const res = await fetch(`${AUTH_URL}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.value.id,
        display_name: displayName.value,
        avatar_base64: avatarBase64.value || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil');

    alert('Profil berhasil diperbarui!');
    if (data.user) {
      user.value = data.user;
      localStorage.setItem('todo_user', JSON.stringify(data.user));
      setProfileData(data.user);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// === API Fetch Data Todos, Kategori & Statistik ===
const fetchCategories = async () => {
  if (!user.value) return;
  try {
    const res = await fetch(`/api/categories?user_id=${user.value.id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Gagal ambil kategori (status ${res.status})`);
    categories.value = await res.json();
  } catch (err) {
    console.error('Gagal mengambil kategori', err);
  }
};

const fetchAnalytics = async () => {
  if (!user.value) return;
  try {
    const res = await fetch(`/api/analytics/summary?user_id=${user.value.id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Gagal ambil statistik (status ${res.status})`);
    stats.value = await res.json();
  } catch (err) {
    console.error('Gagal mengambil ringkasan statistik', err);
  }
};

let todosRequestId = 0;

const fetchTodos = async () => {
  if (!user.value) return;
  loading.value = true;
  currentPage.value = 1;

  const thisRequestId = ++todosRequestId;

  try {
    const params = new URLSearchParams({
      user_id: user.value.id,
      is_archived: currentTab.value === 'archived' ? 'true' : 'false',
      sort_by: sortBy.value,
      order: sortOrder.value,
    });

    if (filterCategoryId.value) params.append('category_id', filterCategoryId.value);
    if (filterPriority.value) params.append('priority', filterPriority.value);
    if (filterStatus.value === 'completed') params.append('is_completed', 'true');
    if (filterStatus.value === 'pending') params.append('is_completed', 'false');
    if (searchQuery.value.trim()) params.append('search', searchQuery.value.trim());

    const res = await fetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' });
    if (thisRequestId !== todosRequestId) return; // ada request lain yang lebih baru

    if (!res.ok) throw new Error(`Gagal ambil todos (status ${res.status})`);
    todos.value = await res.json();
  } catch (err) {
    console.error('Gagal mengambil data todos', err);
  } finally {
    if (thisRequestId === todosRequestId) loading.value = false;
  }
};

// Watcher untuk re-fetch otomatis saat filter/tab berubah
watch([currentTab, filterCategoryId, filterPriority, filterStatus, sortBy, sortOrder], () => {
  fetchTodos();
});

// === Auth Functions ===
const handleRegister = async () => {
  authError.value = '';
  authLoading.value = true;
  try {
    const res = await fetch(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail.value, password: authPassword.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registrasi gagal');

    authError.value = 'Berhasil daftar! Silakan login.';
    authView.value = 'login';
    authPassword.value = '';
  } catch (err) {
    authError.value = err.message;
  } finally {
    authLoading.value = false;
  }
};

const handleLogin = async () => {
  authError.value = '';
  authLoading.value = true;
  try {
    const res = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail.value, password: authPassword.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');

    user.value = data.user;
    localStorage.setItem('todo_user', JSON.stringify(user.value));
    setProfileData(data.user);

    authEmail.value = '';
    authPassword.value = '';
    
    await Promise.all([fetchCategories(), fetchTodos(), fetchAnalytics()]);
  } catch (err) {
    authError.value = err.message;
  } finally {
    authLoading.value = false;
  }
};

const handleLogout = async () => {
  try {
    await fetch(`${AUTH_URL}/logout`, { method: 'POST' });
  } catch (err) {
    console.error('Gagal logout di server', err);
  } finally {
    user.value = null;
    todos.value = [];
    categories.value = [];
    displayName.value = '';
    avatarUrl.value = '';
    avatarBase64.value = '';
    localStorage.removeItem('todo_user');
  }
};

// === CRUD Todos ===
const handleSubmit = async () => {
  if (!inputTitle.value.trim()) return;

  try {
    const payload = {
      user_id: user.value.id,
      title: inputTitle.value.trim(),
      description: inputDescription.value.trim() || null,
      due_date: inputDueDate.value || null,
      priority: inputPriority.value,
      category_id: inputCategoryId.value || null,
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      inputTitle.value = '';
      inputDescription.value = '';
      inputDueDate.value = '';
      inputPriority.value = 'medium';
      inputCategoryId.value = '';
      fetchTodos();
      fetchAnalytics();
    }
  } catch (err) {
    console.error('Gagal menambahkan todo', err);
  }
};

const toggleComplete = async (todo) => {
  try {
    const res = await fetch(`${API_URL}/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !todo.is_completed, user_id: user.value.id }),
    });

    if (res.ok) {
      fetchTodos();
      fetchAnalytics();
    }
  } catch (err) {
    console.error('Gagal mengubah status', err);
  }
};

const toggleArchive = async (todo) => {
  try {
    const res = await fetch(`${API_URL}/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: !todo.is_archived, user_id: user.value.id }),
    });

    if (res.ok) {
      fetchTodos();
      fetchAnalytics();
    }
  } catch (err) {
    console.error('Gagal mengubah arsip todo', err);
  }
};

const startEdit = (todo) => {
  editingId.value = todo.id;
  editingTitle.value = todo.title;
  editingDescription.value = todo.description || '';
};

const cancelEdit = () => {
  editingId.value = null;
  editingTitle.value = '';
  editingDescription.value = '';
};

const handleUpdateTodo = async (id) => {
  if (!editingTitle.value.trim()) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editingTitle.value.trim(),
        description: editingDescription.value.trim() || null,
        user_id: user.value.id,
      }),
    });

    if (res.ok) {
      editingId.value = null;
      fetchTodos();
    }
  } catch (err) {
    console.error('Gagal memperbarui todo', err);
  }
};

const handleDelete = async (id) => {
  if (!confirm('Yakin ingin menghapus tugas ini secara permanen?')) return;
  try {
    const res = await fetch(`${API_URL}/${id}?user_id=${user.value.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchTodos();
      fetchAnalytics();
    }
  } catch (err) {
    console.error('Gagal menghapus data', err);
  }
};

// === CRUD Subtasks / Checklist ===
const handleAddSubtask = async (todoId) => {
  const title = newSubtaskTitles.value[todoId]?.trim();
  if (!title) return;

  try {
    const res = await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    if (res.ok) {
      newSubtaskTitles.value[todoId] = '';
      fetchTodos();
    }
  } catch (err) {
    console.error('Gagal menambah subtask', err);
  }
};

const toggleSubtask = async (subtask) => {
  try {
    const res = await fetch(`/api/subtasks/${subtask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !subtask.is_completed }),
    });

    if (res.ok) fetchTodos();
  } catch (err) {
    console.error('Gagal update status subtask', err);
  }
};

const deleteSubtask = async (subtaskId) => {
  try {
    const res = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });

    if (res.ok) fetchTodos();
  } catch (err) {
    console.error('Gagal menghapus subtask', err);
  }
};

// === Upload Lampiran Berkas Todo ===
const handleAttachmentUpload = async (event, todoId) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const res = await fetch(`/api/todos/${todoId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.value.id,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          file_base64: e.target.result,
        }),
      });

      if (res.ok) {
        alert('Lampiran berhasil diunggah!');
        fetchTodos();
      }
    } catch (err) {
      alert('Gagal mengunggah lampiran: ' + err.message);
    }
  };
  reader.readAsDataURL(file);
};

// === Helper Functions (Due Date Alert & Progress) ===
const getDueDateStatus = (dueDateStr, isCompleted) => {
  if (!dueDateStr || isCompleted) return 'normal';
  const dueDate = new Date(dueDateStr);
  const now = new Date();
  const diffHours = (dueDate - now) / (1000 * 60 * 60);

  if (diffHours < 0) return 'overdue'; // Warna Merah
  if (diffHours <= 24) return 'due-soon'; // Warna Kuning/Oranye
  return 'normal';
};

const calculateProgress = (subtasks) => {
  if (!subtasks || subtasks.length === 0) return 0;
  const completed = subtasks.filter((s) => s.is_completed).length;
  return Math.round((completed / subtasks.length) * 100);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// === Pagination ===
const currentPage = ref(1);
const itemsPerPage = 8;

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(todos.value.length / itemsPerPage));
});

const paginatedTodos = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return todos.value.slice(start, start + itemsPerPage);
});

const goToFirstPage = () => { currentPage.value = 1; };
const goToLastPage = () => { currentPage.value = totalPages.value; };
const goToPrevPage = () => { if (currentPage.value > 1) currentPage.value--; };
const goToNextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };
const goToPage = (page) => { currentPage.value = page; };

const visiblePageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const range = 2;
  let start = Math.max(1, current - range);
  let end = Math.min(total, current + range);

  if (current - range < 1) end = Math.min(total, end + (range - (current - 1)));
  if (current + range > total) start = Math.max(1, start - ((current + range) - total));

  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

onMounted(() => {
  const saved = localStorage.getItem('todo_user');
  if (saved) {
    user.value = JSON.parse(saved);
    setProfileData(user.value);
    fetchCategories();
    fetchTodos();
    fetchAnalytics();
  } else {
    loading.value = false;
  }
});
</script>

<template>
  <main class="todo-app-container">
    <div class="pixel-scene">
      <div class="cat-sprite"></div>
    </div>

    <h1>List Tugas Harian {{ displayName || user?.email }}</h1>

    <!-- === Form Autentikasi (Jika Belum Login) === -->
    <div v-if="!user" class="auth-wrapper">
      <div class="auth-tabs">
        <button :class="{ active: authView === 'login' }" @click="authView = 'login'; authError = ''">Login</button>
        <button :class="{ active: authView === 'register' }" @click="authView = 'register'; authError = ''">Daftar</button>
      </div>

      <form @submit.prevent="authView === 'login' ? handleLogin() : handleRegister()">
        <input v-model="authEmail" type="email" placeholder="Email" required />
        <input v-model="authPassword" type="password" placeholder="Password" required />
        <button type="submit" :disabled="authLoading">
          {{ authLoading ? 'Memproses...' : (authView === 'login' ? 'Masuk' : 'Daftar') }}
        </button>
      </form>

      <p v-if="authError" class="auth-error">{{ authError }}</p>
    </div>

    <!-- === Dashboard Tugas (Jika Sudah Login) === -->
    <template v-else>
      <!-- User Bar -->
      <div class="user-bar">
        <span>👤 {{ displayName || user.email }}</span>
        <button @click="handleLogout" class="btn-logout">Logout</button>
      </div>

      <!-- Profil & Avatar -->
      <div class="profile-section">
        <div class="avatar-box">
          <img 
            :src="avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`" 
            class="pixel-avatar" 
          />
          <label class="custom-file-upload">
            <input type="file" @change="handleFileUpload" accept="image/*" />
            <span>Pilih Foto</span>
          </label>
        </div>
        <input v-model="displayName" type="text" placeholder="Masukkan nama kamu..." class="profile-input" />
        <button @click="handleSaveProfile" class="btn-save">Simpan Profil</button>
      </div>

      <!-- Widget Ringkasan Statistik & Produktivitas -->
      <div class="analytics-grid">
        <div class="stat-card">
          <span class="stat-num">{{ stats.total_active }}</span>
          <span class="stat-label">Tugas Aktif</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ stats.total_completed }}</span>
          <span class="stat-label">Selesai</span>
        </div>
        <div class="stat-card danger" :class="{ alert: stats.overdue_count > 0 }">
          <span class="stat-num">{{ stats.overdue_count }}</span>
          <span class="stat-label">⚠️ Overdue</span>
        </div>
        <div class="stat-card warning">
          <span class="stat-num">{{ stats.due_today_count }}</span>
          <span class="stat-label">⏰ Hari Ini</span>
        </div>
      </div>

      <!-- Form Pembuatan Todo Baru -->
      <form @submit.prevent="handleSubmit" class="todo-form">
        <div class="form-row">
          <input
            v-model="inputTitle"
            type="text"
            placeholder="Judul tugas baru..."
            required
            class="input-title"
          />
          <select v-model="inputPriority" class="select-priority">
            <option value="low">🟢 Prioritas Rendah</option>
            <option value="medium">🟡 Prioritas Sedang</option>
            <option value="high">🔴 Prioritas Tinggi</option>
          </select>
        </div>

        <textarea
          v-model="inputDescription"
          placeholder="Catatan / deskripsi tambahan (opsional)..."
          rows="2"
          class="input-desc"
        ></textarea>

        <div class="form-row">
          <select v-model="inputCategoryId" class="select-category">
            <option value="">📁 Tanpa Kategori</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>

          <input
            v-model="inputDueDate"
            type="datetime-local"
            class="input-date"
            title="Tenggat Waktu"
          />

          <button type="submit" class="btn-add">Tambah Tugas</button>
        </div>
      </form>

      <!-- Tab Navigasi & Filter Toolbar -->
      <div class="filter-toolbar">
        <div class="tab-switch">
          <button 
            :class="{ active: currentTab === 'active' }" 
            @click="currentTab = 'active'"
          >
            📋 Tugas Aktif
          </button>
          <button 
            :class="{ active: currentTab === 'archived' }" 
            @click="currentTab = 'archived'"
          >
            📦 Arsip ({{ stats.total_archived }})
          </button>
        </div>

        <!-- Pencarian & Filter Cerdas -->
        <div class="filter-controls">
          <input
            v-model="searchQuery"
            @input="debouncedFetchTodos"
            type="text"
            placeholder="🔍 Cari tugas..."
            class="search-input"
          />

          <select v-model="filterCategoryId">
            <option value="">Semua Kategori</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>

          <select v-model="filterPriority">
            <option value="">Semua Prioritas</option>
            <option value="high">🔴 Tinggi</option>
            <option value="medium">🟡 Sedang</option>
            <option value="low">🟢 Rendah</option>
          </select>

          <select v-model="filterStatus" v-if="currentTab === 'active'">
            <option value="">Semua Status</option>
            <option value="pending">⏳ Belum Selesai</option>
            <option value="completed">✅ Selesai</option>
          </select>

          <select v-model="sortBy">
            <option value="created_at">Urutkan: Tanggal Dibuat</option>
            <option value="due_date">Urutkan: Tenggat Waktu</option>
          </select>
        </div>
      </div>

      <p v-if="loading" class="loading-text">Memuat data tugas...</p>
      <p v-else-if="todos.length === 0" class="empty-text">Tidak ada tugas yang cocok.</p>

      <!-- Daftar Card Todos -->
      <ul v-else class="todo-list">
        <li 
          v-for="todo in paginatedTodos" 
          :key="todo.id" 
          class="todo-card"
          :class="[
            { completed: todo.is_completed },
            `status-${getDueDateStatus(todo.due_date, todo.is_completed)}`
          ]"
        >
          <!-- Header Todo: Status, Judul & Badges -->
          <div class="todo-main">
            <!-- Mode Edit Judul & Deskripsi -->
            <div v-if="editingId === todo.id" class="edit-wrapper">
              <input v-model="editingTitle" type="text" class="edit-input" />
              <textarea v-model="editingDescription" rows="2" class="edit-textarea"></textarea>
              <div class="edit-actions">
                <button @click="handleUpdateTodo(todo.id)" class="btn-save">Simpan</button>
                <button @click="cancelEdit" class="btn-cancel">Batal</button>
              </div>
            </div>

            <!-- Mode Tampilan Normal -->
            <div v-else class="todo-content">
              <div class="todo-header-row">
                <span @click="toggleComplete(todo)" class="todo-check-icon">
                  {{ todo.is_completed ? '✅' : '⏳' }}
                </span>
                <span class="todo-title-text" :class="{ strikethrough: todo.is_completed }">
                  {{ todo.title }}
                </span>

                <!-- Priority Badge -->
                <span :class="`badge-priority priority-${todo.priority}`">
                  {{ todo.priority.toUpperCase() }}
                </span>

                <!-- Category Tag -->
                <span 
                  v-if="todo.categories" 
                  class="badge-category" 
                  :style="{ backgroundColor: todo.categories.color_hex || '#3B82F6' }"
                >
                  {{ todo.categories.name }}
                </span>
              </div>

              <p v-if="todo.description" class="todo-desc-text">{{ todo.description }}</p>

              <!-- Due Date Alert Badge -->
              <div v-if="todo.due_date" class="due-date-row">
                <span 
                  class="badge-due" 
                  :class="getDueDateStatus(todo.due_date, todo.is_completed)"
                >
                  🗓 Tenggat: {{ formatDate(todo.due_date) }}
                  <template v-if="getDueDateStatus(todo.due_date, todo.is_completed) === 'overdue'">
                    (Terlewat)
                  </template>
                  <template v-else-if="getDueDateStatus(todo.due_date, todo.is_completed) === 'due-soon'">
                    (Mendekati Batas)
                  </template>
                </span>
              </div>
            </div>

            <!-- Tombol Aksi Todo -->
            <div class="todo-actions">
              <button @click="startEdit(todo)" class="btn-edit">✏️</button>
              <button @click="toggleArchive(todo)" class="btn-archive" :title="todo.is_archived ? 'Buka dari Arsip' : 'Arsipkan'">
                {{ todo.is_archived ? '📤 Unarchive' : '📦 Arsip' }}
              </button>
              <button @click="handleDelete(todo.id)" class="btn-delete">🗑️</button>
            </div>
          </div>

          <!-- Section Subtasks / Checklist -->
          <div class="subtasks-section">
            <div v-if="todo.subtasks && todo.subtasks.length > 0" class="progress-bar-container">
              <div class="progress-bar-track">
                <div 
                  class="progress-bar-fill" 
                  :style="{ width: `${calculateProgress(todo.subtasks)}%` }"
                ></div>
              </div>
              <span class="progress-text">{{ calculateProgress(todo.subtasks) }}% Selesai</span>
            </div>

            <!-- Daftar Subtasks -->
            <div class="subtask-list">
              <div v-for="sub in todo.subtasks" :key="sub.id" class="subtask-item">
                <input 
                  type="checkbox" 
                  :checked="sub.is_completed" 
                  @change="toggleSubtask(sub)" 
                />
                <span :class="{ completed: sub.is_completed }">{{ sub.title }}</span>
                <button @click="deleteSubtask(sub.id)" class="btn-sub-del">×</button>
              </div>
            </div>

            <!-- Tambah Subtask Cepat -->
            <div class="add-subtask-box">
              <input
                v-model="newSubtaskTitles[todo.id]"
                type="text"
                placeholder="+ Tambah checklist..."
                @keyup.enter="handleAddSubtask(todo.id)"
              />
              <button @click="handleAddSubtask(todo.id)" class="btn-add-sub">OK</button>
            </div>
          </div>

          <!-- Section Lampiran Berkas (Attachments) -->
          <div class="attachments-section">
            <div class="attachments-list" v-if="todo.todo_attachments && todo.todo_attachments.length > 0">
              <a 
                v-for="att in todo.todo_attachments" 
                :key="att.id" 
                :href="att.file_url" 
                target="_blank" 
                class="attachment-chip"
              >
                📎 {{ att.file_name }}
              </a>
            </div>
            
            <label class="btn-upload-file">
              <input type="file" @change="handleAttachmentUpload($event, todo.id)" />
              <span>+ Unggah Lampiran Dokumen/Foto</span>
            </label>
          </div>
        </li>
      </ul>

      <!-- Pagination -->
      <div v-if="!loading && todos.length > 0" class="pagination">
        <button @click="goToFirstPage" :disabled="currentPage === 1" class="btn-page btn-page-edge">⏮</button>
        <button @click="goToPrevPage" :disabled="currentPage === 1" class="btn-page btn-page-edge">◀</button>

        <button
          v-for="page in visiblePageNumbers"
          :key="page"
          @click="goToPage(page)"
          :class="{ active: page === currentPage }"
          class="btn-page"
        >{{ page }}</button>

        <button @click="goToNextPage" :disabled="currentPage === totalPages" class="btn-page btn-page-edge">▶</button>
        <button @click="goToLastPage" :disabled="currentPage === totalPages" class="btn-page btn-page-edge">⏭</button>
      </div>
    </template>
  </main>
</template>

<style scoped>
/* ==========================================
   LAYOUT DASAR — dibuat lebih lebar & lega
   ========================================== */
.todo-app-container {
  max-width: 1100px;
  width: 92%;
  margin: 40px auto;
  padding: 32px 40px 48px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(30, 41, 59, 0.12);
  box-sizing: border-box;
}

.todo-app-container h1 {
  text-align: center;
  font-size: 1.6rem;
  margin: 8px 0 28px;
  color: #1e293b;
}

/* ==========================================
   AUTH WRAPPER
   ========================================== */
.auth-wrapper {
  max-width: 420px;
  margin: 20px auto;
  padding: 28px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}
.auth-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}
.auth-tabs button {
  flex: 1;
  padding: 10px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.15s;
}
.auth-tabs button.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.auth-wrapper form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.auth-wrapper input {
  padding: 11px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
}
.auth-wrapper input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.auth-wrapper button[type="submit"] {
  padding: 12px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.auth-wrapper button[type="submit"]:hover {
  background: #1d4ed8;
}
.auth-wrapper button[type="submit"]:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}
.auth-error {
  margin-top: 12px;
  text-align: center;
  font-size: 0.9rem;
  color: #dc2626;
}

/* ==========================================
   USER BAR
   ========================================== */
.user-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: #f1f5f9;
  border-radius: 10px;
  margin-bottom: 20px;
  font-weight: 600;
  color: #334155;
}
.btn-logout {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #475569;
  transition: all 0.15s;
}
.btn-logout:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #dc2626;
}

/* ==========================================
   PROFILE SECTION
   ========================================== */
.profile-section {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.avatar-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.pixel-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  background: #fff;
  object-fit: cover;
}
.custom-file-upload {
  font-size: 0.75rem;
  color: #2563eb;
  cursor: pointer;
}
.custom-file-upload input {
  display: none;
}
.profile-input {
  flex: 1;
  min-width: 220px;
  padding: 11px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
}
.btn-save {
  padding: 11px 22px;
  background: #10b981;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.btn-save:hover {
  background: #059669;
}

/* ==========================================
   ANALYTICS GRID
   ========================================== */
.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  margin: 20px 0 28px;
}
.stat-card {
  background: #f8fafc;
  padding: 18px 12px;
  border-radius: 10px;
  text-align: center;
  border: 1px solid #e5e7eb;
  transition: transform 0.15s, box-shadow 0.15s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30, 41, 59, 0.08);
}
.stat-num {
  display: block;
  font-size: 1.8rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 4px;
}
.stat-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}
.stat-card.danger.alert {
  background: #fee2e2;
  border-color: #ef4444;
}
.stat-card.danger.alert .stat-num {
  color: #991b1b;
}
.stat-card.warning {
  background: #fef3c7;
  border-color: #f59e0b;
}
.stat-card.warning .stat-num {
  color: #92400e;
}

/* ==========================================
   FORM TAMBAH TODO
   ========================================== */
.todo-form {
  background: #f8fafc;
  padding: 22px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.form-row > * {
  flex: 1;
  min-width: 160px;
}
.input-title { flex: 2; min-width: 240px; }
.select-priority { flex: 1; }

.todo-form input,
.todo-form select,
.todo-form textarea {
  padding: 11px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  background: #fff;
  box-sizing: border-box;
}
.todo-form input:focus,
.todo-form select:focus,
.todo-form textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.input-desc { width: 100%; resize: vertical; }

.btn-add {
  flex: 1;
  min-width: 160px;
  padding: 12px 20px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-add:hover {
  background: #1d4ed8;
}

/* ==========================================
   FILTER TOOLBAR
   ========================================== */
.filter-toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 22px;
}
.tab-switch {
  display: flex;
  gap: 8px;
}
.tab-switch button {
  padding: 10px 20px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  cursor: pointer;
  border-radius: 8px;
  font-weight: 600;
  color: #475569;
  transition: all 0.15s;
}
.tab-switch button.active {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}
.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.filter-controls input,
.filter-controls select {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  background: #fff;
}
.search-input {
  flex: 2;
  min-width: 220px;
}
.filter-controls select {
  flex: 1;
  min-width: 150px;
}

.loading-text,
.empty-text {
  text-align: center;
  padding: 40px 0;
  color: #94a3b8;
  font-size: 1rem;
}

/* ==========================================
   DAFTAR TODO
   ========================================== */
.todo-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.todo-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px 20px;
  transition: box-shadow 0.15s, transform 0.15s;
}
.todo-card:hover {
  box-shadow: 0 8px 20px rgba(30, 41, 59, 0.08);
}
.todo-card.completed {
  background: #f9fafb;
  opacity: 0.8;
}
.todo-card.status-overdue {
  border-left: 5px solid #ef4444;
}
.todo-card.status-due-soon {
  border-left: 5px solid #f59e0b;
}
.todo-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.todo-content {
  flex: 1;
  min-width: 220px;
}
.todo-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.todo-check-icon {
  cursor: pointer;
  font-size: 1.2rem;
}
.todo-title-text {
  font-size: 1.05rem;
  font-weight: 600;
  color: #1e293b;
}
.strikethrough {
  text-decoration: line-through;
  color: #9ca3af;
}
.badge-priority {
  font-size: 0.75rem;
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.priority-high { background: #fee2e2; color: #dc2626; }
.priority-medium { background: #fef3c7; color: #d97706; }
.priority-low { background: #dcfce7; color: #16a34a; }
.badge-category {
  color: white;
  font-size: 0.75rem;
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 600;
}
.todo-desc-text {
  margin: 8px 0 0;
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.5;
}
.due-date-row {
  margin-top: 8px;
}
.badge-due {
  font-size: 0.82rem;
  color: #64748b;
}
.badge-due.overdue {
  color: #dc2626;
  font-weight: 700;
}
.badge-due.due-soon {
  color: #d97706;
  font-weight: 700;
}

/* Aksi Todo */
.todo-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.todo-actions button {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-edit:hover { background: #dbeafe; border-color: #93c5fd; }
.btn-archive:hover { background: #fef3c7; border-color: #fbbf24; }
.btn-delete:hover { background: #fee2e2; border-color: #fca5a5; }

/* Edit Mode */
.edit-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.edit-input,
.edit-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  width: 100%;
  box-sizing: border-box;
}
.edit-actions {
  display: flex;
  gap: 8px;
}
.edit-actions .btn-save {
  padding: 9px 18px;
}
.btn-cancel {
  padding: 9px 18px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #475569;
}

/* ==========================================
   SUBTASKS
   ========================================== */
.subtasks-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed #e5e7eb;
}
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.progress-bar-track {
  flex: 1;
  background: #e5e7eb;
  height: 7px;
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar-fill {
  background: #10b981;
  height: 100%;
  transition: width 0.3s;
}
.progress-text {
  font-size: 0.78rem;
  color: #6b7280;
  white-space: nowrap;
}
.subtask-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.subtask-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: #334155;
}
.subtask-item span.completed {
  text-decoration: line-through;
  color: #9ca3af;
}
.btn-sub-del {
  border: none;
  background: none;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 1rem;
  margin-left: auto;
  padding: 0 6px;
}
.btn-sub-del:hover { color: #ef4444; }

.add-subtask-box {
  display: flex;
  gap: 8px;
}
.add-subtask-box input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.88rem;
}
.btn-add-sub {
  padding: 8px 16px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  color: #4338ca;
  font-weight: 600;
  cursor: pointer;
}
.btn-add-sub:hover { background: #e0e7ff; }

/* ==========================================
   ATTACHMENTS
   ========================================== */
.attachments-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}
.attachments-list {
  margin-bottom: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.btn-upload-file {
  display: inline-block;
  font-size: 0.82rem;
  color: #2563eb;
  cursor: pointer;
  font-weight: 600;
}
.btn-upload-file input { display: none; }
.attachment-chip {
  display: inline-block;
  background: #e0f2fe;
  color: #0369a1;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  text-decoration: none;
  transition: background 0.15s;
}
.attachment-chip:hover { background: #bae6fd; }

/* ==========================================
   PAGINATION
   ========================================== */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 28px;
  flex-wrap: wrap;
}
.btn-page {
  min-width: 38px;
  height: 38px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #475569;
  transition: all 0.15s;
}
.btn-page:hover:not(:disabled) {
  background: #eef2ff;
  border-color: #93c5fd;
}
.btn-page.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.btn-page:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ==========================================
   RESPONSIVE
   ========================================== */
@media (max-width: 720px) {
  .todo-app-container {
    width: 94%;
    padding: 22px 18px 32px;
    margin: 16px auto;
  }
  .todo-main {
    flex-direction: column;
  }
  .todo-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .form-row > * {
    min-width: 100%;
  }
}
</style>