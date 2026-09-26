/**
 * Borrador del flujo de creación (`/create`) en IndexedDB.
 *
 * En modo lanzamiento el usuario sube la foto **antes** de tener cuenta, así que
 * esa foto solo vive en memoria hasta que se autentica. Si recarga o cierra la
 * pestaña por accidente, la perdería: aquí se guarda una copia local.
 *
 * Por qué IndexedDB y no `sessionStorage`: se guardan los `File`/`Blob` tal cual.
 * Una foto de móvil pasa de los 5 MB que suele permitir `sessionStorage` en
 * cuanto se convierte a base64 (que además la infla ~33%).
 *
 * Nada de esto es crítico: en modo privado, con el almacenamiento bloqueado o en
 * un navegador sin IndexedDB, todas las funciones fallan en silencio y el paso de
 * foto sigue funcionando — solo sin red de seguridad.
 */

const DB_NAME = "clawpuzzle_create";
const DB_VERSION = 1;
const STORE = "draft";
// Un único borrador a la vez: empezar otro estilo reemplaza el anterior.
const KEY = "current";

export interface CreateDraft {
  /** Estilo para el que se subió la foto. Un borrador de otro estilo se descarta. */
  styleId: string;
  petName: string;
  files: File[];
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("open failed"));
    // Otra pestaña con una versión distinta abierta: no bloquear al usuario.
    request.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("tx failed"));
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("tx aborted"));
        };
      }),
  );
}

export async function saveDraft(
  draft: Omit<CreateDraft, "savedAt">,
): Promise<void> {
  try {
    await run("readwrite", (store) =>
      store.put({ ...draft, savedAt: Date.now() }, KEY),
    );
  } catch {
    // Sin almacenamiento disponible: el flujo sigue, solo sin borrador.
  }
}

export async function loadDraft(): Promise<CreateDraft | null> {
  try {
    const raw = await run<CreateDraft | undefined>("readonly", (store) =>
      store.get(KEY),
    );
    if (!raw || typeof raw.styleId !== "string") return null;
    // Firefox en modo privado puede devolver los blobs vacíos o inválidos.
    const files = Array.isArray(raw.files)
      ? raw.files.filter((f): f is File => f instanceof File && f.size > 0)
      : [];
    if (files.length === 0) return null;
    return {
      ...raw,
      files,
      petName: raw.petName ?? "",
    };
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(KEY));
  } catch {
    // Idem: un borrador huérfano no rompe nada, se sobrescribe al siguiente.
  }
}
