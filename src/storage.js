let database;
function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('battle-notes-video', 2);
    request.onupgradeneeded = () => {
      if(!request.result.objectStoreNames.contains('videos'))request.result.createObjectStore('videos');
      else {
        // v1 stored video copies. Release those copies; never touch source files.
        const cursor=request.transaction.objectStore('videos').openCursor();
        cursor.onsuccess=()=>{const entry=cursor.result;if(entry){if(entry.value?.blob)entry.delete();entry.continue();}};
      }
    };
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
