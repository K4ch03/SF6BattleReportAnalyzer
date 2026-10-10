let database;
function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('battle-notes-video', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('videos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('動画の保存領域を開けませんでした。ブラウザの保存設定を確認してください。'));
  });
  return database;
}
export async function videoStore(action, key, value) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('videos', action === 'get' || action === 'getAllKeys' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('videos');
    const request = action === 'put' ? store.put(value, key) : action === 'getAllKeys' ? store.getAllKeys() : store[action](key);
    let result; request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(tx.error || request.error || new Error('動画を保存できませんでした。'));
  });
}
