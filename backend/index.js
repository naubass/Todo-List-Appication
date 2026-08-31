// backend/index.js
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import { supabase } from './supabaseClient.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// DEBUG SEMENTARA - HAPUS SETELAH SELESAI
// app.get('/api/debug', (req, res) => {
//   const url = process.env.SUPABASE_URL || '';
//   const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
//   res.status(200).json({
//     url_length: url.length,
//     url_preview: url.slice(0, 40),
//     key_length: key.length,
//     key_starts_with: key.slice(0, 20),
//     key_ends_with: key.slice(-20),
//     key_has_newline: key.includes('\n'),
//     key_has_space: key.includes(' '),
//   });
// });

// PENTING: cegah browser/proxy menyimpan cache dari response API
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// ==========================================
// HEALTH CHECK (untuk keep-alive / uptime ping)
// ==========================================
// app.get('/api/health', (req, res) => {
//   res.status(200).json({ status: 'ok', time: new Date().toISOString() });
// });

// ==========================================
// 0. ENDPOINT AUTENTIKASI (AUTH)
// ==========================================

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    res.status(201).json({ user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.status(200).json({ user: data.user, session: data.session });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    res.status(200).json({ message: 'Logout berhasil' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', async (req, res) => {
  const { user_id, display_name, avatar_base64 } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id wajib diisi' });
  }

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: {
        display_name,
        avatar_url: avatar_base64 || undefined,
      },
    });

    if (error) throw error;
    res.status(200).json({ user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 1. ENDPOINT KATEGORI (CATEGORIES)
// ==========================================

app.get('/api/categories', async (req, res) => {
  const { user_id } = req.query;
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user_id)
      .order('id', { ascending: true });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  const { user_id, name, color_hex } = req.body;
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ user_id, name, color_hex }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. ENDPOINT TODOS (FILTER, SEARCH & SORT)
// ==========================================

app.get('/api/todos', async (req, res) => {
  const {
    user_id,
    category_id,
    priority,
    is_completed,
    is_archived = 'false',
    search,
    sort_by = 'created_at',
    order = 'desc',
  } = req.query;

  try {
    let query = supabase
      .from('todos')
      .select(`
        *,
        categories(id, name, color_hex),
        subtasks(*),
        todo_attachments(*)
      `)
      .eq('user_id', user_id)
      .eq('is_archived', is_archived === 'true');

    if (category_id) query = query.eq('category_id', category_id);
    if (priority) query = query.eq('priority', priority);

    if (is_completed !== undefined) {
      query = query.eq('is_completed', is_completed === 'true');
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const isAscending = order === 'asc';
    query = query.order(sort_by, { ascending: isAscending, nullsFirst: false });

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  const { user_id, title, description, due_date, priority, category_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('todos')
      .insert([{
        user_id,
        title,
        description,
        due_date: due_date || null,
        priority: priority || 'medium',
        category_id: category_id || null,
        is_completed: false,
        is_archived: false,
      }])
      .select(`*, categories(id, name, color_hex)`);

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, ...updatePayload } = req.body;

  try {
    updatePayload.updated_at = new Date().toISOString();

    let query = supabase
      .from('todos')
      .update(updatePayload)
      .eq('id', id);

    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query.select(`
      *,
      categories(id, name, color_hex),
      subtasks(*),
      todo_attachments(*)
    `);

    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;

  try {
    let query = supabase.from('todos').delete().eq('id', id);
    if (user_id) query = query.eq('user_id', user_id);

    const { error } = await query;
    if (error) throw error;

    res.status(200).json({ message: 'Todo berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. ENDPOINT SUBTASKS / CHECKLIST
// ==========================================

app.post('/api/todos/:todo_id/subtasks', async (req, res) => {
  const { todo_id } = req.params;
  const { title } = req.body;

  try {
    const { data, error } = await supabase
      .from('subtasks')
      .insert([{ todo_id, title, is_completed: false }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/subtasks/:id', async (req, res) => {
  const { id } = req.params;
  const { is_completed, title } = req.body;

  try {
    const payload = {};
    if (is_completed !== undefined) payload.is_completed = is_completed;
    if (title) payload.title = title;

    const { data, error } = await supabase
      .from('subtasks')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subtasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('subtasks').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ message: 'Subtask berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ENDPOINT UPLOAD LAMPIRAN (STORAGE)
// ==========================================

app.post('/api/todos/:todo_id/attachments', async (req, res) => {
  const { todo_id } = req.params;
  const { user_id, file_base64, file_name, mime_type, file_size } = req.body;

  try {
    const buffer = Buffer.from(file_base64.split(',')[1], 'base64');
    const storagePath = `${user_id}/${todo_id}_${Date.now()}_${file_name}`;

    const { error: uploadError } = await supabase.storage
      .from('todo-attachments')
      .upload(storagePath, buffer, {
        contentType: mime_type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('todo-attachments')
      .getPublicUrl(storagePath);

    const { data, error: dbError } = await supabase
      .from('todo_attachments')
      .insert([{
        todo_id,
        file_name,
        file_url: publicUrlData.publicUrl,
        file_size,
      }])
      .select();

    if (dbError) throw dbError;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. ENDPOINT STATISTIK & PRODUKTIVITAS
// ==========================================

app.get('/api/analytics/summary', async (req, res) => {
  const { user_id } = req.query;

  try {
    const now = new Date().toISOString();

    const { data: allTodos, error } = await supabase
      .from('todos')
      .select('id, is_completed, due_date, priority, is_archived, created_at')
      .eq('user_id', user_id);

    if (error) throw error;

    const totalActive = allTodos.filter(t => !t.is_completed && !t.is_archived).length;
    const totalCompleted = allTodos.filter(t => t.is_completed).length;
    const totalArchived = allTodos.filter(t => t.is_archived).length;

    const overdue = allTodos.filter(
      t => !t.is_completed && !t.is_archived && t.due_date && t.due_date < now
    ).length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const dueToday = allTodos.filter(
      t => !t.is_completed && !t.is_archived && t.due_date && t.due_date.startsWith(todayStr)
    ).length;

    const priorityBreakdown = {
      high: allTodos.filter(t => !t.is_completed && !t.is_archived && t.priority === 'high').length,
      medium: allTodos.filter(t => !t.is_completed && !t.is_archived && t.priority === 'medium').length,
      low: allTodos.filter(t => !t.is_completed && !t.is_archived && t.priority === 'low').length,
    };

    res.status(200).json({
      total_active: totalActive,
      total_completed: totalCompleted,
      total_archived: totalArchived,
      overdue_count: overdue,
      due_today_count: dueToday,
      priority_breakdown: priorityBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 404 HANDLER (agar selalu return JSON, bukan HTML)
// ==========================================
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;