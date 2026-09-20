const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let store = { photos: [], config: {} };
try {
  if (fs.existsSync(dbFile)) store = JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}');
  logger.info('db', 'Database loaded', {
    photos: Array.isArray(store.photos) ? store.photos.length : 0,
    configKeys: store.config ? Object.keys(store.config).length : 0,
    dbFile,
  });
} catch (e) {
  logger.error('db', 'Failed to read db file, starting fresh', { message: e.message, dbFile });
  store = { photos: [], config: {} };
}

function save() {
  fs.writeFileSync(dbFile, JSON.stringify(store, null, 2));
  logger.info('db', 'Database saved', {
    photos: store.photos.length,
    configKeys: Object.keys(store.config).length,
  });
}

module.exports = {
  addPhoto(photo) {
    store.photos.push(photo);
    logger.info('db', 'Photo added', { id: photo.id, filename: photo.filename });
    save();
  },
  getPhotos() {
    return store.photos.slice().sort((a, b) => a.created_at - b.created_at);
  },
  getPhotoById(id) {
    return store.photos.find((p) => p.id === id) || null;
  },
  updatePhoto(id, changes) {
    const p = store.photos.find((x) => x.id === id);
    if (!p) return false;
    Object.assign(p, changes);
    logger.info('db', 'Photo updated', { id, changes });
    save();
    return true;
  },
  deletePhoto(id) {
    store.photos = store.photos.filter((p) => p.id !== id);
    logger.info('db', 'Photo deleted', { id });
    save();
  },
  setConfig(key, value) {
    store.config[key] = value;
    logger.info('db', 'Config saved', { key, value });
    save();
  },
  getConfig(key) {
    return key in store.config ? store.config[key] : null;
  }
};