import type { ProjectBundle } from "./types";
import { normalizeBundle } from "./utils";

const DB_NAME = "trime-authoring";
const DB_VERSION = 3;
const STORE = "projects";
const SNAPSHOTS = "snapshots";
const MAX_SNAPSHOTS = 20;

export type Snapshot = {
  key: string;
  projectId: string;
  label: string;
  createdAt: number;
  project: ProjectBundle;
};

export type SnapshotBundle = {
  format: "trime-theme-snapshots";
  version: 2;
  projectId: string;
  projectName: string;
  exportedAt: string;
  snapshots: Snapshot[];
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    // v2 has no production data to preserve. Recreate the stores instead of
    // carrying a migration path for the old document shape.
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [STORE, SNAPSHOTS]) {
        if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
      }
      db.createObjectStore(STORE, { keyPath: "id" });
      const store = db.createObjectStore(SNAPSHOTS, { keyPath: "key" });
      store.createIndex("projectId", "projectId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listProjects(): Promise<ProjectBundle[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as ProjectBundle[])
      .map(normalizeBundle)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function loadProject(id: string): Promise<ProjectBundle | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => {
      const result = request.result as ProjectBundle | undefined;
      resolve(result ? normalizeBundle(result) : undefined);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveProject(project: ProjectBundle): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...normalizeBundle(project), updatedAt: Date.now() });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
  await deleteSnapshotsForProject(id);
}

export async function listSnapshots(projectId: string): Promise<Snapshot[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, "readonly");
    const request = tx.objectStore(SNAPSHOTS).index("projectId").getAll(projectId);
    request.onsuccess = () => resolve((request.result as Snapshot[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveSnapshot(project: ProjectBundle, label: string): Promise<Snapshot> {
  const createdAt = Date.now();
  const snapshot: Snapshot = {
    key: `${project.id}@${createdAt}`,
    projectId: project.id,
    label: label || "Manual snapshot",
    createdAt,
    project: normalizeBundle(project),
  };
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, "readwrite");
    tx.objectStore(SNAPSHOTS).put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  await pruneSnapshots(project.id);
  return snapshot;
}

export async function pruneSnapshots(projectId: string): Promise<void> {
  const snapshots = await listSnapshots(projectId);
  const extra = snapshots.slice(MAX_SNAPSHOTS);
  if (extra.length === 0) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, "readwrite");
    for (const snapshot of extra) tx.objectStore(SNAPSHOTS).delete(snapshot.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteSnapshot(key: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, "readwrite");
    tx.objectStore(SNAPSHOTS).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSnapshotsForProject(projectId: string): Promise<void> {
  const snapshots = await listSnapshots(projectId);
  if (snapshots.length === 0) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, "readwrite");
    for (const snapshot of snapshots) tx.objectStore(SNAPSHOTS).delete(snapshot.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function importSnapshots(projectId: string, snapshots: Snapshot[]): Promise<number> {
  if (snapshots.length === 0) return 0;
  const db = await open();
  const base = Date.now();
  let imported = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, "readwrite");
    snapshots.forEach((snapshot, index) => {
      if (!snapshot || !snapshot.project) return;
      const createdAt = Number(snapshot.createdAt) || base - index;
      const key = `${projectId}@${createdAt}-${index}-${Math.random().toString(36).slice(2, 7)}`;
      try {
        tx.objectStore(SNAPSHOTS).put({
          key,
          projectId,
          label: snapshot.label || `Imported snapshot ${index + 1}`,
          createdAt,
          project: normalizeBundle(snapshot.project),
        });
        imported += 1;
      } catch {
        // Skip malformed snapshot in the bundle.
      }
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  await pruneSnapshots(projectId);
  return imported;
}
