const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let store = { photos: [], config: {} };
try {
  if (fs.existsSync(dbFile)) store = JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}');
} catch (e) {
  console.error('Failed to read db file, starting fresh', e.message);
  store = { photos: [], config: {} };
}

function save() {
  fs.writeFileSync(dbFile, JSON.stringify(store, null, 2));
}

module.exports = {
  addPhoto(photo) {
    store.photos.push(photo);
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
    save();
    return true;
  },
  deletePhoto(id) {
    store.photos = store.photos.filter((p) => p.id !== id);
    save();
  },
  setConfig(key, value) {
    store.config[key] = value;
    save();
  },
  getConfig(key) {
    return key in store.config ? store.config[key] : null;
  }
};