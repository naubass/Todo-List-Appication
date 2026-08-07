<script setup>
import { ref, onMounted, computed } from 'vue';

const todos = ref([]);
const inputTitle = ref('');
const loading = ref(true);

// State untuk mode edit
const editingId = ref(null);
const editingTitle = ref('');

// === State Autentikasi ===
const user = ref(null); // { id, email }
const authView = ref('login'); // 'login' | 'register'
const authEmail = ref('');
const authPassword = ref('');
const authError = ref('');
const authLoading = ref(false);

const API_URL = 'http://localhost:5000/api/todos';
const AUTH_URL = 'http://localhost:5000/api';

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

// === Pagination ===
const currentPage = ref(1);
const itemsPerPage = 10;

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
    fetchTodos();
  } else {
    loading.value = false;
  }
});
</script>

<template>
  <main>
    <div class="pixel-scene">
      <div class="cat-sprite"></div>
    </div>

    <h1>List Tugas Harian {{ displayName || user?.email }}</h1>

    <!-- === Belum Login: Form Auth === -->
    <div v-if="!user" class="auth-wrapper">
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
        <button type="submit" :disabled="authLoading">
          {{ authLoading ? 'Memproses...' : (authView === 'login' ? 'Masuk' : 'Daftar') }}
        </button>
      </form>

      <p v-if="authError" class="auth-error">{{ authError }}</p>
    </div>

    <!-- === Sudah Login: Todo Dashboard === -->
    <template v-else>
      <div class="user-bar">
        <span>👤 {{ displayName || user.email }}</span>
        <button @click="handleLogout" class="btn-logout">Logout</button>
      </div>

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

      <form @submit.prevent="handleSubmit">
        <input
          v-model="inputTitle"
          type="text"
          placeholder="Tambah tugas baru..."
        />
        <button type="submit">Tambah</button>
      </form>

      <p v-if="loading" class="loading-text">Memuat data...</p>

      <ul v-else>
        <li v-for="todo in paginatedTodos" :key="todo.id" :class="{ completed: todo.is_completed }">
          <div v-if="editingId === todo.id" class="edit-wrapper">
            <input
              v-model="editingTitle"
              type="text"
              class="edit-input"
              @keyup.enter="handleUpdateTitle(todo.id)"
              @keyup.esc="cancelEdit"
            />
            <button @click="handleUpdateTitle(todo.id)" class="btn-save">Simpan</button>
            <button @click="cancelEdit" class="btn-cancel">Batal</button>
          </div>

          <template v-else>
            <span @click="toggleComplete(todo)" class="todo-title">
              {{ todo.is_completed ? '✅' : '⏳' }} {{ todo.title }}
            </span>

            <div class="action-buttons">
              <button @click="startEdit(todo)" class="btn-edit">Edit</button>
              <button @click="handleDelete(todo.id)" class="btn-delete">Hapus</button>
            </div>
          </template>
        </li>
      </ul>

      <!-- Tambahkan blok pagination ini setelah </ul> -->
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