import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';

dotenv.config()

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// -- API AUTENTIKASI USER --
// POST: Registrasi user
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try{
        const {data, error} = await supabase.auth.signUp({email, password});
        if(error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.log(err);
        res.status(400).json({error: err.message});
    }
});

// POST: Login user
app.post('/api/login', async (req, res) => {
    const {email, password} = req.body;
    try {
        const {data, error} = await supabase.auth.signInWithPassword({email, password});
        if(error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.log(err);
        res.status(400).json({error: err.message});
    }
});

// POST: Logout user
app.post('/api/logout', async (req, res) => {
    try {
        const {data, error} = await supabase.auth.signOut();
        if(error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.log(err);
        res.status(400).json({error: err.message});
    }
})

// -- API CRUD DATA ---
// GET: Ambil semua data
app.get('/api/todos', async (req, res) => {
    const {user_id} = req.query
    try{
        let query = supabase
            .from('todos')
            .select('*')
            .order('id', { ascending: false });

        if (user_id) {
            query = query.eq('user_id', user_id);
        }

        const {data, error} = await query;

        if(error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.log(err);
        res.status(500).json({error: err.message});
    }
});

// POST: Tambah data baru
app.post('/api/todos', async (req, res) => {
    const { title, user_id } = req.body
    try{
        const {data, error} = await supabase
            .from('todos')
            .insert([{title, is_completed: false, user_id}])
            .select();

        if(error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.log(err);
        res.status(500).json({error: err.message});
    }
});

// PUT: Edit data todos
app.put('/api/todos/:id', async (req, res) => {
    const {id} = req.params;
    const {title, is_completed, user_id} = req.body;

    const updateData = {};
    if(title) updateData.title = title;
    if(is_completed !== undefined) updateData.is_completed = is_completed;

    try{
        let query = supabase
            .from('todos')
            .update(updateData)
            .eq('id', id);

        if (user_id) {
            query = query.eq('user_id', user_id);
        }

        const {data, error} = await query.select();
        
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        console.log(err);
        res.status(500).json({error: err.message});
    }
});

// DELETE: Hapus data todos
app.delete('/api/todos/:id', async (req, res) => {
    const {id} = req.params;
    const {user_id} = req.query;
    try{
        let query = supabase
            .from('todos')
            .delete()
            .eq('id', id);

        if (user_id) {
            query = query.eq('user_id', user_id);
        }

        const {error} = await query;
        
        if (error) throw error;
        res.json({message: 'Todo berhasil dihapus'});
    } catch (err) {
        console.log(err);
        res.status(500).json({error: err.message});
    }
});

// PUT: Update Profile (Termasuk Upload Gambar)
app.put('/api/profile', async (req, res) => {
  const { user_id, display_name, avatar_base64 } = req.body;

  try {
    let avatar_url = undefined;

    // Jika ada file gambar base64 dikirim
    if (avatar_base64) {
      const buffer = Buffer.from(avatar_base64.split(',')[1], 'base64');
      const filePath = `${user_id}/profile_${Date.now()}.png`;

      // Upload langsung lewat backend pake Admin SDK
      const { error: uploadError } = await supabase.storage
        .from('Avatars')
        .upload(filePath, buffer, { contentType: 'image/png', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('Avatars').getPublicUrl(filePath);
      avatar_url = urlData.publicUrl;
    }

    // Update metadata user
    const updatePayload = { display_name };
    if (avatar_url) updatePayload.avatar_url = avatar_url;

    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: updatePayload,
    });

    if (error) throw error;

    res.status(200).json({ message: 'Profil berhasil diperbarui', user: data.user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});