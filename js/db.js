// Persistencia local con IndexedDB. Los gastos nunca salen del navegador.

const DB_NAME = 'billetera-lite';
const DB_VERSION = 1;
const STORE = 'gastos';

let dbPromise = null;

function abrirDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Este navegador no soporta IndexedDB.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('fecha', 'fecha');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Si falla, permite reintentar en la siguiente llamada.
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

// Ejecuta una operación y resuelve cuando la transacción se confirma en disco.
async function transaccion(modo, operacion) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo);
    const request = operacion(tx.objectStore(STORE));
    let resultado;
    request.onsuccess = () => { resultado = request.result; };
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Guarda un gasto y devuelve su id. */
export function agregarGasto(gasto) {
  return transaccion('readwrite', (store) => store.add(gasto));
}

/** Devuelve todos los gastos, del más reciente al más antiguo. */
export async function obtenerGastos() {
  const gastos = await transaccion('readonly', (store) => store.getAll());
  return gastos.sort((a, b) => b.fecha - a.fecha || b.id - a.id);
}

/** Elimina un gasto por id. */
export function eliminarGasto(id) {
  return transaccion('readwrite', (store) => store.delete(id));
}
