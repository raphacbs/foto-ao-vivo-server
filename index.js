const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const logger = require('./logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = uuidv4();
  req.requestId = requestId;

  logger.info('http', 'Request started', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.on('finish', () => {
    logger.info('http', 'Request finished', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

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
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

app.use('/uploads', express.static(UPLOADS_DIR));

// POST /api/upload
app.post('/api/upload', upload.single('photo'), (req, res) => {
  logger.info('upload', 'Upload request received', {
    requestId: req.requestId,
    hasFile: Boolean(req.file),
  });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const id = path.parse(req.file.filename).name;
  const photo = { id, filename: req.file.filename, originalname: req.file.originalname, created_at: Date.now() };
  db.addPhoto(photo);
  io.emit('new-photo', photo);
  logger.info('upload', 'Upload completed', {
    requestId: req.requestId,
    photoId: id,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
  res.json(photo);
});

// GET /api/photos
app.get('/api/photos', (req, res) => {
  const rows = db.getPhotos();
  logger.info('photos', 'Photo list requested', {
    requestId: req.requestId,
    count: rows.length,
  });
  res.json(rows);
});

// DELETE /api/photos/:id
app.delete('/api/photos/:id', (req, res) => {
  const id = req.params.id;
  logger.info('photos', 'Delete photo requested', { requestId: req.requestId, id });
  const row = db.getPhotoById(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(UPLOADS_DIR, row.filename);
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  db.deletePhoto(id);
  io.emit('delete-photo', { id });
  logger.info('photos', 'Photo deleted', {
    requestId: req.requestId,
    id,
    filename: row.filename,
  });
  res.json({ ok: true });
});

// PUT /api/photos/:id  (update metadata, e.g., display_time)
app.put('/api/photos/:id', (req, res) => {
  const id = req.params.id;
  logger.info('photos', 'Update photo requested', {
    requestId: req.requestId,
    id,
    body: req.body,
  });
  const row = db.getPhotoById(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { display_time } = req.body;
  const changes = {};
  if (display_time !== undefined) changes.display_time = Number(display_time);
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'No changes provided' });
  db.updatePhoto(id, changes);
  const updated = db.getPhotoById(id);
  io.emit('update-photo', updated);
  logger.info('photos', 'Photo updated', {
    requestId: req.requestId,
    id,
    changes,
  });
  res.json({ ok: true, photo: updated });
});

// PUT /api/config
app.put('/api/config', (req, res) => {
  const { key, value } = req.body;
  logger.info('config', 'Config update requested', {
    requestId: req.requestId,
    key,
    value,
  });
  if (!key) return res.status(400).json({ error: 'key required' });
  db.setConfig(key, String(value));
  // broadcast config change so clients can update in real-time
  try { io.emit('config-updated', { key, value: String(value) }); } catch (e) { /* ignore */ }
  logger.info('config', 'Config updated', { requestId: req.requestId, key });
  res.json({ ok: true });
});

// GET /api/config/:key
app.get('/api/config/:key', (req, res) => {
  const key = req.params.key;
  const value = db.getConfig(key);
  logger.info('config', 'Config requested', {
    requestId: req.requestId,
    key,
    hasValue: value !== null,
  });
  res.json({ value });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('upload', 'Multer error', {
      requestId: req.requestId,
      code: err.code,
      message: err.message,
    });
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image too large. Max size is 20MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err) {
    logger.error('server', 'Unhandled request error', {
      requestId: req.requestId,
      message: err.message,
      stack: err.stack,
    });
    return res.status(400).json({ error: err.message || 'Upload error' });
  }

  return next();
});

io.on('connection', (socket) => {
  logger.info('socket', 'Socket connected', { id: socket.id });
  socket.on('disconnect', (reason) => {
    logger.info('socket', 'Socket disconnected', { id: socket.id, reason });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => logger.info('server', `Server listening on ${PORT}`));