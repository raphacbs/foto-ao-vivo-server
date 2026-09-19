const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${id}${ext}`);
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(UPLOADS_DIR));

// POST /api/upload
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const id = path.parse(req.file.filename).name;
  const photo = { id, filename: req.file.filename, originalname: req.file.originalname, created_at: Date.now() };
  db.addPhoto(photo);
  io.emit('new-photo', photo);
  res.json(photo);
});

// GET /api/photos
app.get('/api/photos', (req, res) => {
  const rows = db.getPhotos();
  res.json(rows);
});

// DELETE /api/photos/:id
app.delete('/api/photos/:id', (req, res) => {
  const id = req.params.id;
  const row = db.getPhotoById(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(UPLOADS_DIR, row.filename);
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  db.deletePhoto(id);
  io.emit('delete-photo', { id });
  res.json({ ok: true });
});

// PUT /api/photos/:id  (update metadata, e.g., display_time)
app.put('/api/photos/:id', (req, res) => {
  const id = req.params.id;
  const row = db.getPhotoById(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { display_time } = req.body;
  const changes = {};
  if (display_time !== undefined) changes.display_time = Number(display_time);
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'No changes provided' });
  db.updatePhoto(id, changes);
  const updated = db.getPhotoById(id);
  io.emit('update-photo', updated);
  res.json({ ok: true, photo: updated });
});

// PUT /api/config
app.put('/api/config', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  db.setConfig(key, String(value));
  // broadcast config change so clients can update in real-time
  try { io.emit('config-updated', { key, value: String(value) }); } catch (e) { /* ignore */ }
  res.json({ ok: true });
});

// GET /api/config/:key
app.get('/api/config/:key', (req, res) => {
  const key = req.params.key;
  const value = db.getConfig(key);
  res.json({ value });
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));