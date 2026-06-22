const Storage = {
  KEY:     "coursemap.v2",
  CAL_KEY: "coursemap.calibration.v1",

  emptyState() {
    return { version: 2, terms: [] };
  },

  // Migrate v1 (flat subjects array) → v2 (terms wrapper)
  migrate(data) {
    if (!data) return this.emptyState();
    if (data.version === 1 && Array.isArray(data.subjects)) {
      return {
        version: 2,
        terms: data.subjects.length
          ? [{ id: "term_migrated", name: "My First Term", subjects: data.subjects }]
          : [],
      };
    }
    return data;
  },

  load() {
    try {
      // Try v2 key first, fall back to old v1 key for migration
      let raw = localStorage.getItem(this.KEY);
      if (!raw) raw = localStorage.getItem("academicTracker.v1");
      if (!raw) return this.emptyState();
      const data = JSON.parse(raw);
      const migrated = this.migrate(data);
      if (migrated !== data) this.save(migrated); // write migrated data to new key
      return migrated;
    } catch {
      return this.emptyState();
    }
  },

  save(state) {
    try { localStorage.setItem(this.KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
  },

  reset() {
    localStorage.removeItem(this.KEY);
    localStorage.removeItem(this.CAL_KEY);
  },

  loadCalibration() {
    try {
      const raw = localStorage.getItem(this.CAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  saveCalibration(log) {
    try { localStorage.setItem(this.CAL_KEY, JSON.stringify(log)); } catch (e) { console.error(e); }
  },

  appendCalibration(entry) {
    const log = this.loadCalibration();
    log.push({ ...entry, date: new Date().toISOString().slice(0, 10) });
    this.saveCalibration(log);
  },
};
