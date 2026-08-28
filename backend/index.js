import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// ==========================================
// 1. ENDPOINT KATEGORI (CATEGORIES)
// ==========================================

// GET: Ambil kategori user
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

// POST: Tambah kategori baru
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

// GET: Ambil Todos dengan Relasi Lengkap, Filter, Search, dan Sorting
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

    // Filter Kategori
    if (category_id) query = query.eq('category_id', category_id);

    // Filter Prioritas (low, medium, high)
    if (priority) query = query.eq('priority', priority);

    // Filter Status Selesai
    if (is_completed !== undefined) {
      query = query.eq('is_completed', is_completed === 'true');
    }

    // Pencarian Realtime (title atau description)
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Sorting (due_date / created_at / priority)
    const isAscending = order === 'asc';
    query = query.order(sort_by, { ascending: isAscending, nullsFirst: false });

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Buat Todo baru
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

// PUT: Update Todo (Status, Info, atau Toggle Arsip)
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

// DELETE: Hapus Todo
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

// POST: Tambah Subtask
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

// PUT: Toggle Status Selesai Subtask
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

// DELETE: Hapus Subtask
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

// POST: Upload file dokumen/gambar pendukung Todo
app.post('/api/todos/:todo_id/attachments', async (req, res) => {
  const { todo_id } = req.params;
  const { user_id, file_base64, file_name, mime_type, file_size } = req.body;

  try {
    const buffer = Buffer.from(file_base64.split(',')[1], 'base64');
    const storagePath = `${user_id}/${todo_id}_${Date.now()}_${file_name}`;

    // 1. Upload ke Bucket Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('todo-attachments')
      .upload(storagePath, buffer, {
        contentType: mime_type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 2. Ambil Public URL
    const { data: publicUrlData } = supabase.storage
      .from('todo-attachments')
      .getPublicUrl(storagePath);

    // 3. Simpan Metadata ke DB
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

// GET: Rekap Ringkasan Analitik Dashboard
app.get('/api/analytics/summary', async (req, res) => {
  const { user_id } = req.query;

  try {
    const now = new Date().toISOString();

    // 1. Ambil seluruh todo aktif user
    const { data: allTodos, error } = await supabase
      .from('todos')
      .select('id, is_completed, due_date, priority, is_archived, created_at')
      .eq('user_id', user_id);

    if (error) throw error;

    const totalActive = allTodos.filter(t => !t.is_completed && !t.is_archived).length;
    const totalCompleted = allTodos.filter(t => t.is_completed).length;
    const totalArchived = allTodos.filter(t => t.is_archived).length;

    // Overdue: Belum selesai dan batas waktu sudah lewat dari waktu saat ini
    const overdue = allTodos.filter(
      t => !t.is_completed && !t.is_archived && t.due_date && t.due_date < now
    ).length;

    // Due Today: Deadline hari ini
    const todayStr = new Date().toISOString().slice(0, 10);
    const dueToday = allTodos.filter(
      t => !t.is_completed && !t.is_archived && t.due_date && t.due_date.startsWith(todayStr)
    ).length;

    // Breakdown prioritas untuk todo aktif
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;