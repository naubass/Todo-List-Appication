<script setup>
import { ref, onMounted, computed, watch } from 'vue';

const todos = ref([]);
const inputTitle = ref('');
const loading = ref(true);

// State untuk mode edit
const editingId = ref(null);
const editingTitle = ref('');

// === State Search & Filter ===
const searchQuery = ref('');
const statusFilter = ref('all'); // 'all' | 'completed' | 'pending'

// === State Autentikasi ===
const user = ref(null); // { id, email }
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

// Ambil data profil dari user metadata
const setProfileData = (userData) => {
  displayName.value = userData.user_metadata?.display_name || '';
  avatarUrl.value = userData.user_metadata?.avatar_url || '';
};

// Saat user memilih file gambar (Konversi ke Base64)
const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    avatarBase64.value = e.target.result; // Ubah ke Base64
    avatarUrl.value = e.target.result;    // Preview gambar lokal
  };
  reader.readAsDataURL(file);
};

// Simpan Profil ke Express Backend
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

    // Update data local user
    if (data.user) {
      user.value = data.user;
      localStorage.setItem('todo_user', JSON.stringify(data.user));
      setProfileData(data.user);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// === Fetch Todos ===
const fetchTodos = async () => {
  if (!user.value) return;
  loading.value = true;
  currentPage.value = 1;
  try {
    const res = await fetch(`${API_URL}?user_id=${user.value.id}`);
    const data = await res.json();
    todos.value = data;
  } catch (err) {
    console.log('Gagal mengambil data', err);
  } finally {
    loading.value = false;
  }
};

// === Register ===
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

// === Login ===
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
    fetchTodos();
  } catch (err) {
    authError.value = err.message;
  } finally {
    authLoading.value = false;
  }
};

// === Logout ===
const handleLogout = async () => {
  try {
    await fetch(`${AUTH_URL}/logout`, { method: 'POST' });
  } catch (err) {
    console.log('Gagal logout di server', err);
  } finally {
    user.value = null;
    todos.value = [];
    displayName.value = '';
    avatarUrl.value = '';
    avatarBase64.value = '';
    searchQuery.value = '';
    statusFilter.value = 'all';
    localStorage.removeItem('todo_user');
  }
};

// === CRUD Todos ===
const handleSubmit = async () => {
  if (!inputTitle.value.trim()) return;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: inputTitle.value, user_id: user.value.id }),
    });

    if (res.ok) {
      inputTitle.value = '';
      fetchTodos();
    }
  } catch (err) {
    console.log('Gagal menambahkan todo', err);
  }
};

const toggleComplete = async (todo) => {
  try {
    const res = await fetch(`${API_URL}/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !todo.is_completed, user_id: user.value.id }),
    });

    if (res.ok) fetchTodos();
  } catch (err) {
    console.log('Gagal mengubah status', err);
  }
};

const startEdit = (todo) => {
  editingId.value = todo.id;
  editingTitle.value = todo.title;
};

const cancelEdit = () => {
  editingId.value = null;
  editingTitle.value = '';
};

const handleUpdateTitle = async (id) => {
  if (!editingTitle.value.trim()) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editingTitle.value, user_id: user.value.id }),
    });

    if (res.ok) {
      editingId.value = null;
      editingTitle.value = '';
      fetchTodos();
    }
  } catch (err) {
    console.log('Gagal memperbarui judul todo', err);
  }
};

const handleDelete = async (id) => {
  try {
    const res = await fetch(`${API_URL}/${id}?user_id=${user.value.id}`, {
      method: 'DELETE',
    });

    if (res.ok) fetchTodos();
  } catch (err) {
    console.log('Gagal menghapus data', err);
  }
};

// === Statistik (untuk navbar / hero) ===
const totalTodos = computed(() => todos.value.length);
const doneTodos = computed(() => todos.value.filter(t => t.is_completed).length);

// === Search & Filter ===
const filteredTodos = computed(() => {
  let result = todos.value;

  // Filter berdasarkan status
  if (statusFilter.value === 'completed') {
    result = result.filter(t => t.is_completed);
  } else if (statusFilter.value === 'pending') {
    result = result.filter(t => !t.is_completed);
  }

  // Filter berdasarkan kata kunci pencarian
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(t => t.title.toLowerCase().includes(q));
  }

  return result;
});

const setStatusFilter = (value) => {
  statusFilter.value = value;
};

const clearSearch = () => {
  searchQuery.value = '';
};

// Reset ke halaman pertama setiap kali search/filter berubah
watch([searchQuery, statusFilter], () => {
  currentPage.value = 1;
});

// === Pagination ===
const currentPage = ref(1);
const itemsPerPage = 10;

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredTodos.value.length / itemsPerPage));
});

const paginatedTodos = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredTodos.value.slice(start, start + itemsPerPage);
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

// === Navigasi (scroll ke section) ===
const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

onMounted(() => {
  const saved = localStorage.getItem('todo_user');
  if (saved) {
    user.value = JSON.parse(saved);
    setProfileData(user.value);
    fetchTodos();
  } else {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page">
    <!-- === NAVBAR === -->
    <header class="navbar">
      <div class="navbar-inner">
        <div class="brand" @click="scrollToId('top')">
          <span class="brand-sprite"></span>
          <span class="brand-text">NekoTask<span class="brand-accent">.io</span></span>
        </div>

        <nav class="nav-links">
          <button v-if="user" class="nav-link" @click="scrollToId('board')">Papan Tugas</button>
          <button v-if="user" class="nav-link" @click="scrollToId('profile')">Profil</button>
        </nav> 

        <div class="navbar-cta">
          <span v-if="user" class="navbar-user">🐾 {{ displayName || user.email }}</span>
          <button v-if="user" @click="handleLogout" class="btn-pixel btn-pixel--ghost">Keluar</button>
          <button v-else @click="scrollToId('auth')" class="btn-pixel btn-pixel--primary">Mulai</button>
        </div>
      </div>
    </header>

    <!-- === HERO === -->
    <section id="top" class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="hero-eyebrow">✦ Selamat datang kembali ✦</p>
          <h1 class="hero-title">
            List Tugas Harian<br />
            <span class="hero-name">{{ displayName || user?.email || 'Kamu' }}</span>
          </h1>
          <p class="hero-subtitle">
            Catat, selesaikan, dan rayakan tugasmu satu per satu — ditemani kucing piksel
            kesayanganmu yang selalu siap menyemangati.
          </p>

          <div v-if="user" class="hero-stats">
            <div class="stat-chip">
              <span class="stat-number">{{ totalTodos }}</span>
              <span class="stat-label">Total Tugas</span>
            </div>
            <div class="stat-chip">
              <span class="stat-number">{{ doneTodos }}</span>
              <span class="stat-label">Selesai</span>
            </div>
            <div class="stat-chip">
              <span class="stat-number">{{ totalTodos - doneTodos }}</span>
              <span class="stat-label">Berjalan</span>
            </div>
          </div>

          <button v-if="!user" class="btn-pixel btn-pixel--primary btn-pixel--lg" @click="scrollToId('auth')">
            Masuk / Daftar
          </button>
          <button v-else class="btn-pixel btn-pixel--primary btn-pixel--lg" @click="scrollToId('board')">
            Lihat Papan Tugas ▾
          </button>
        </div>

        <div class="hero-scene">
          <div class="pixel-scene">
            <div class="pixel-cloud pixel-cloud--a"></div>
            <div class="pixel-cloud pixel-cloud--b"></div>
            <div class="pixel-ground"></div>
            <div class="cat-sprite"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- === Belum Login: Form Auth === -->
    <section v-if="!user" id="auth" class="section">
      <div class="auth-wrapper">
        <div class="auth-tabs">
          <button
            :class="{ active: authView === 'login' }"
            @click="authView = 'login'; authError = ''"
          >Login</button>
          <button
            :class="{ active: authView === 'register' }"
            @click="authView = 'register'; authError = ''"
          >Daftar</button>
        </div>

        <form @submit.prevent="authView === 'login' ? handleLogin() : handleRegister()">
          <input v-model="authEmail" type="email" placeholder="Email" required />
          <input v-model="authPassword" type="password" placeholder="Password" required />
          <button type="submit" class="btn-pixel btn-pixel--primary" :disabled="authLoading">
            {{ authLoading ? 'Memproses...' : (authView === 'login' ? 'Masuk' : 'Daftar') }}
          </button>
        </form>

        <p v-if="authError" class="auth-error">{{ authError }}</p>
      </div>
    </section>

    <!-- === Sudah Login: Todo Dashboard === -->
    <template v-else>
      <section id="profile" class="section">
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

          <div class="profile-fields">
            <input v-model="displayName" type="text" placeholder="Masukkan nama kamu..." class="profile-input" />
            <button @click="handleSaveProfile" class="btn-pixel btn-pixel--primary">Simpan Profil</button>
          </div>
        </div>
      </section>

      <section id="board" class="section section--wide">
        <div class="board-card">
          <form @submit.prevent="handleSubmit" class="add-form">
            <input
              v-model="inputTitle"
              type="text"
              placeholder="Tambah tugas baru..."
            />
            <button type="submit" class="btn-pixel btn-pixel--primary">Tambah</button>
          </form>

          <!-- === Search & Filter Bar === -->
          <div class="filter-bar">
            <div class="search-box">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="🔍 Cari tugas..."
                class="search-input"
              />
              <button v-if="searchQuery" @click="clearSearch" class="search-clear" type="button">✕</button>
            </div>

            <div class="status-filters">
              <button
                @click="setStatusFilter('all')"
                :class="{ active: statusFilter === 'all' }"
                class="btn-filter"
                type="button"
              >Semua</button>
              <button
                @click="setStatusFilter('pending')"
                :class="{ active: statusFilter === 'pending' }"
                class="btn-filter"
                type="button"
              >⏳ Belum Selesai</button>
              <button
                @click="setStatusFilter('completed')"
                :class="{ active: statusFilter === 'completed' }"
                class="btn-filter"
                type="button"
              >✅ Selesai</button>
            </div>
          </div>

          <p v-if="loading" class="loading-text">Memuat data...</p>

          <ul v-else class="todo-list">
            <li v-for="todo in paginatedTodos" :key="todo.id" :class="{ completed: todo.is_completed }">
              <div v-if="editingId === todo.id" class="edit-wrapper">
                <input
                  v-model="editingTitle"
                  type="text"
                  class="edit-input"
                  @keyup.enter="handleUpdateTitle(todo.id)"
                  @keyup.esc="cancelEdit"
                />
                <button @click="handleUpdateTitle(todo.id)" class="btn-pixel btn-pixel--primary btn-pixel--sm">Simpan</button>
                <button @click="cancelEdit" class="btn-pixel btn-pixel--ghost btn-pixel--sm">Batal</button>
              </div>

              <template v-else>
                <span @click="toggleComplete(todo)" class="todo-title">
                  {{ todo.is_completed ? '✅' : '⏳' }} {{ todo.title }}
                </span>

                <div class="action-buttons">
                  <button @click="startEdit(todo)" class="btn-pixel btn-pixel--ghost btn-pixel--sm">Edit</button>
                  <button @click="handleDelete(todo.id)" class="btn-pixel btn-pixel--danger btn-pixel--sm">Hapus</button>
                </div>
              </template>
            </li>

            <li v-if="!loading && paginatedTodos.length === 0 && todos.length > 0" class="empty-state">
              Tidak ada tugas yang cocok dengan pencarian/filter kamu. 🔍
            </li>

            <li v-if="!loading && todos.length === 0" class="empty-state">
              Belum ada tugas. Tambahkan satu di atas! 🐱
            </li>
          </ul>

          <div v-if="!loading && filteredTodos.length > 0" class="pagination">
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
        </div>
      </section>
    </template>

    <footer class="footer">
      <p>made with 🧡 &amp; pixels — NekoTask.io {{ new Date().getFullYear() }}</p>
    </footer>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');

:root {
  --sky: #bfe3f0;
  --sky-deep: #8fcfe6;
  --sky-dark: #3f7ea6;
  --ink: #223047;
  --cream: #fff7e8;
  --sun: #ffd166;
  --coral: #ff8fab;
  --coral-dark: #e2607f;
  --leaf: #8fd694;
  --leaf-dark: #4e9b58;
  --pixel-border: 4px solid var(--ink);
  --shadow-pixel: 6px 6px 0 var(--ink);
  --font-display: 'Press Start 2P', 'VT323', monospace;
  --font-body: 'VT323', 'Press Start 2P', monospace;
}

* {
  box-sizing: border-box;
  image-rendering: pixelated;
}

html, body {
  margin: 0;
  padding: 0;
}

body {
  background: var(--sky);
  font-family: var(--font-body);
  color: var(--ink);
  font-size: 20px;
}

.page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(var(--sky) 0%, var(--sky) 60%, var(--sky-deep) 100%);
}

h1, h2, h3, .brand-text, .btn-pixel, .stat-number, .hero-eyebrow {
  font-family: var(--font-display);
}

/* ============ NAVBAR ============ */
.navbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--cream);
  border-bottom: var(--pixel-border);
}

.navbar-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 14px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-sprite {
  width: 28px;
  height: 28px;
  background: var(--coral);
  border: 3px solid var(--ink);
  box-shadow: inset -3px -3px 0 rgba(0,0,0,0.25);
  border-radius: 3px;
}

.brand-text {
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--ink);
}

.brand-accent {
  color: var(--sky-dark);
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  font-family: var(--font-body);
  font-size: 18px;
  background: transparent;
  border: 3px solid transparent;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--ink);
  border-radius: 4px;
  transition: transform 0.05s ease;
}

.nav-link:hover {
  border-color: var(--ink);
  background: var(--sun);
  transform: translate(-1px, -1px);
}

.navbar-cta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.navbar-user {
  font-size: 18px;
  white-space: nowrap;
}

/* ============ BUTTONS (pixel style) ============ */
.btn-pixel {
  font-family: var(--font-display);
  font-size: 11px;
  line-height: 1.4;
  padding: 12px 18px;
  border: 3px solid var(--ink);
  cursor: pointer;
  box-shadow: 4px 4px 0 var(--ink);
  background: var(--cream);
  color: var(--ink);
  border-radius: 2px;
  transition: transform 0.06s ease, box-shadow 0.06s ease;
  white-space: nowrap;
}

.btn-pixel:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 var(--ink);
}

.btn-pixel:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 var(--ink);
}

.btn-pixel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 4px 4px 0 var(--ink);
}

.btn-pixel--primary {
  background: var(--sun);
}

.btn-pixel--ghost {
  background: var(--cream);
}

.btn-pixel--danger {
  background: var(--coral);
}

.btn-pixel--lg {
  font-size: 13px;
  padding: 16px 26px;
  box-shadow: 6px 6px 0 var(--ink);
}

.btn-pixel--sm {
  font-size: 9px;
  padding: 8px 12px;
  box-shadow: 3px 3px 0 var(--ink);
}

/* ============ HERO ============ */
.hero {
  border-bottom: var(--pixel-border);
  background: linear-gradient(180deg, var(--sky) 0%, var(--sky-deep) 100%);
  overflow: hidden;
}

.hero-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 64px 32px;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 48px;
  align-items: center;
}

.hero-eyebrow {
  font-size: 11px;
  color: var(--sky-dark);
  margin: 0 0 18px;
}

.hero-title {
  font-size: 34px;
  line-height: 1.5;
  margin: 0 0 20px;
  color: var(--ink);
  text-shadow: 3px 3px 0 var(--cream);
}

.hero-name {
  color: var(--coral-dark);
}

.hero-subtitle {
  font-size: 22px;
  line-height: 1.5;
  max-width: 52ch;
  color: var(--ink);
  margin: 0 0 28px;
}

.hero-stats {
  display: flex;
  gap: 14px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.stat-chip {
  background: var(--cream);
  border: 3px solid var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
  padding: 10px 16px;
  text-align: center;
  min-width: 96px;
}

.stat-number {
  display: block;
  font-size: 20px;
  color: var(--sky-dark);
}

.stat-label {
  display: block;
  font-size: 15px;
  margin-top: 4px;
}

/* --- hero pixel scene --- */
.hero-scene {
  display: flex;
  justify-content: center;
}

.pixel-scene {
  position: relative;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1 / 1;
  background: var(--cream);
  border: 4px solid var(--ink);
  box-shadow: 8px 8px 0 var(--ink);
  overflow: hidden;
}

.pixel-cloud {
  position: absolute;
  width: 64px;
  height: 24px;
  background: #ffffff;
  border: 3px solid var(--ink);
  border-radius: 2px;
}

.pixel-cloud--a { top: 14%; left: 12%; }
.pixel-cloud--b { top: 26%; right: 14%; width: 48px; }

.pixel-ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30%;
  background: var(--leaf);
  border-top: 4px solid var(--ink);
  box-shadow: inset 0 8px 0 var(--leaf-dark);
}

.cat-sprite {
  position: absolute;
  bottom: 26%;
  left: 50%;
  transform: translateX(-50%);
  width: 96px;
  height: 96px;
  background: #f4a460;
  border: 4px solid var(--ink);
  border-radius: 8px;
  box-shadow: inset -6px -6px 0 rgba(0,0,0,0.15);
}

.cat-sprite::before,
.cat-sprite::after {
  content: '';
  position: absolute;
  top: -18px;
  width: 22px;
  height: 22px;
  background: #f4a460;
  border: 4px solid var(--ink);
}

.cat-sprite::before { left: 6px; clip-path: polygon(0 100%, 50% 0, 100% 100%); }
.cat-sprite::after { right: 6px; clip-path: polygon(0 100%, 50% 0, 100% 100%); }

/* ============ SECTIONS / CONTAINERS ============ */
.section {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 48px 24px;
}

.section--wide {
  padding-top: 0;
}

/* ============ AUTH ============ */
.auth-wrapper {
  width: 100%;
  max-width: 460px;
  background: var(--cream);
  border: var(--pixel-border);
  box-shadow: var(--shadow-pixel);
  padding: 32px;
}

.auth-tabs {
  display: flex;
  margin-bottom: 20px;
  border: 3px solid var(--ink);
}

.auth-tabs button {
  flex: 1;
  font-family: var(--font-display);
  font-size: 11px;
  padding: 12px;
  border: none;
  background: var(--sky);
  cursor: pointer;
  color: var(--ink);
}

.auth-tabs button.active {
  background: var(--sun);
}

.auth-wrapper form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-wrapper input,
.profile-input {
  font-family: var(--font-body);
  font-size: 20px;
  padding: 12px 14px;
  border: 3px solid var(--ink);
  background: #fff;
  color: var(--ink);
}

.auth-wrapper input:focus,
.profile-input:focus,
.add-form input:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--sun);
}

.auth-error {
  margin-top: 14px;
  font-size: 17px;
  color: var(--coral-dark);
}

/* ============ PROFILE ============ */
.profile-section {
  width: 100%;
  max-width: 760px;
  background: var(--cream);
  border: var(--pixel-border);
  box-shadow: var(--shadow-pixel);
  padding: 28px;
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}

.avatar-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.pixel-avatar {
  width: 96px;
  height: 96px;
  border: 4px solid var(--ink);
  background: #fff;
  object-fit: cover;
}

.custom-file-upload {
  font-family: var(--font-body);
  font-size: 16px;
  border: 3px solid var(--ink);
  padding: 6px 10px;
  background: var(--sky);
  cursor: pointer;
}

.custom-file-upload input { display: none; }

.profile-fields {
  flex: 1;
  min-width: 220px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.profile-fields .profile-input { flex: 1; min-width: 200px; }

/* ============ BOARD ============ */
.board-card {
  width: 100%;
  max-width: 900px;
  background: var(--cream);
  border: var(--pixel-border);
  box-shadow: var(--shadow-pixel);
  padding: 28px;
}

.add-form {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.add-form input {
  flex: 1;
  font-family: var(--font-body);
  font-size: 20px;
  padding: 12px 14px;
  border: 3px solid var(--ink);
  background: #fff;
}

/* ============ SEARCH & FILTER BAR ============ */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 3px dashed var(--ink);
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  font-family: var(--font-body);
  font-size: 18px;
  padding: 10px 36px 10px 12px;
  border: 3px solid var(--ink);
  background: #fff;
  color: var(--ink);
}

.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--sun);
}

.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 18px;
  cursor: pointer;
  color: var(--coral-dark);
  padding: 0 4px;
}

.status-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-filter {
  font-family: var(--font-body);
  font-size: 16px;
  padding: 8px 14px;
  border: 3px solid var(--ink);
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  white-space: nowrap;
}

.btn-filter.active {
  background: var(--sun);
}

.loading-text {
  text-align: center;
  font-size: 20px;
  color: var(--sky-dark);
}

.todo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.todo-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fff;
  border: 3px solid var(--ink);
  padding: 12px 16px;
  flex-wrap: wrap;
}

.todo-list li.completed {
  background: #f0fbe9;
}

.todo-list li.completed .todo-title {
  text-decoration: line-through;
  color: #7a8a7c;
}

.todo-title {
  font-size: 20px;
  cursor: pointer;
  flex: 1;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.edit-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
  flex-wrap: wrap;
}

.edit-input {
  flex: 1;
  font-family: var(--font-body);
  font-size: 20px;
  padding: 8px 10px;
  border: 3px solid var(--ink);
}

.empty-state {
  justify-content: center;
  color: var(--sky-dark);
  font-size: 18px;
  border-style: dashed;
}

/* ============ PAGINATION ============ */
.pagination {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.btn-page {
  font-family: var(--font-body);
  font-size: 18px;
  min-width: 36px;
  padding: 6px 10px;
  border: 3px solid var(--ink);
  background: #fff;
  cursor: pointer;
}

.btn-page.active {
  background: var(--sun);
}

.btn-page:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ============ FOOTER ============ */
.footer {
  margin-top: auto;
  text-align: center;
  padding: 24px;
  font-size: 16px;
  color: var(--sky-dark);
  border-top: var(--pixel-border);
  background: var(--cream);
}

/* ============ RESPONSIVE ============ */
@media (max-width: 900px) {
  .hero-inner {
    grid-template-columns: 1fr;
    padding: 40px 20px;
    text-align: center;
  }
  .hero-subtitle { margin-left: auto; margin-right: auto; }
  .hero-stats { justify-content: center; }
  .hero-scene { order: -1; }
  .navbar-inner { flex-wrap: wrap; gap: 12px; }
  .nav-links { order: 3; width: 100%; justify-content: center; }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .status-filters { justify-content: center; }
}

@media (max-width: 520px) {
  .hero-title { font-size: 26px; }
  .navbar-user { display: none; }
}
</style>