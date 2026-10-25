"use client";

import type { Creation } from "./pixel-data";
import type { BrandbookDraft } from "./brandbook-data";

const DATABASE_NAME = "pixel-workspace";
const STORE_NAME = "creations";
const BRANDBOOK_STORE_NAME = "brandbooks";
const DATABASE_VERSION = 2;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento local."));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(BRANDBOOK_STORE_NAME)) request.result.createObjectStore(BRANDBOOK_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function loadCreations(): Promise<Creation[]> {
  const database = await openDatabase();
  try {
    return await new Promise<Creation[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onerror = () => reject(request.error ?? new Error("Não foi possível ler as criações."));
      request.onsuccess = () => resolve(request.result as Creation[]);
    });
  } finally {
    database.close();
  }
}

export async function saveCreations(creations: Creation[]) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      creations.forEach((creation) => store.put(creation));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível salvar as criações."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Não foi possível salvar as criações."));
    });
  } finally {
    database.close();
  }
}

export async function loadBrandbooks(): Promise<BrandbookDraft[]> {
  const database = await openDatabase();
  try {
    return await new Promise<BrandbookDraft[]>((resolve, reject) => {
      const request = database.transaction(BRANDBOOK_STORE_NAME, "readonly").objectStore(BRANDBOOK_STORE_NAME).getAll();
      request.onerror = () => reject(request.error ?? new Error("Não foi possível ler os rascunhos de brandbook."));
      request.onsuccess = () => resolve(request.result as BrandbookDraft[]);
    });
  } finally {
    database.close();
  }
}

export async function saveBrandbooks(brandbooks: BrandbookDraft[]) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(BRANDBOOK_STORE_NAME, "readwrite");
      const store = transaction.objectStore(BRANDBOOK_STORE_NAME);
      store.clear();
      brandbooks.forEach((brandbook) => store.put(brandbook));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível salvar os rascunhos de brandbook."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Não foi possível salvar os rascunhos de brandbook."));
    });
  } finally {
    database.close();
  }
}
