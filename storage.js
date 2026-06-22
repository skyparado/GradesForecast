/* ============================================================================
 * storage.js
 * ----------------------------------------------------------------------------
 * The ONLY file that talks to where data lives. Right now that's LocalStorage.
 * Later, when you add a backend (or Canvas sync), you change this file ONLY:
 * make load()/save() call fetch() instead of localStorage. Nothing else in the
 * app needs to know where the data came from.
 * ========================================================================== */

const Storage = {
  KEY: "academicTracker.v1",

  // The shape of an empty app. Keeping a single source of truth for "empty"
  // means a fresh user and a reset user get the exact same starting state.
  emptyState() {
    return { version: 1, subjects: [] };
  },

  // Read everything from LocalStorage. If nothing is saved yet (or the saved
  // data is corrupt), fall back to an empty state instead of crashing.
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.emptyState();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.subjects)) return this.emptyState();
      return data;
    } catch (err) {
      console.warn("Could not read saved data, starting fresh.", err);
      return this.emptyState();
    }
  },

  // Write everything back. We save the whole state object every time — simple
  // and reliable for a personal app where the data is small.
  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Could not save data.", err);
    }
  },

  // Wipe everything (used by the Reset button).
  reset() {
    localStorage.removeItem(this.KEY);
  },
};
