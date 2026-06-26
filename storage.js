const Storage = {
  KEY: "dlplanner.v1",

  emptyState() {
    return { version: 1, terms: [] };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.emptyState();
      return JSON.parse(raw);
    } catch {
      return this.emptyState();
    }
  },

  save(state) {
    try { localStorage.setItem(this.KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
  },

  reset() {
    localStorage.removeItem(this.KEY);
  },
};
