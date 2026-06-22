/* ============================================================================
 * models.js
 * ----------------------------------------------------------------------------
 * "Factory" functions that build new objects in a consistent shape. Instead of
 * scattering { id: ..., name: ..., ... } all over the app, every new subject /
 * category / score is created here. If you ever add a field, you add it once.
 *
 * THE DATA MODEL (what gets stored):
 *
 *   subject = {
 *     id, name,
 *     target,        // the final grade you're aiming for (e.g. 95)
 *     categories: [ category, ... ]
 *   }
 *   (The grade-trend chart is replayed from the dated scores, so we don't need
 *    to store snapshots — one less thing to keep in sync.)
 *
 *   category = {
 *     id, name,
 *     weight,        // percent of the final grade (e.g. 30 means 30%)
 *     confidence,    // 0–100, how confident YOU feel about it
 *     scores: [ score, ... ]
 *   }
 *
 *   score = {
 *     id, label,     // e.g. "Midterm", "Quiz 3"
 *     score,         // points you got
 *     max,           // points possible
 *     date           // "YYYY-MM-DD"
 *   }
 * ========================================================================== */

const Models = {
  // Tiny unique-id generator. Good enough for a local single-user app.
  uid(prefix = "id") {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  today() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  },

  createSubject(name, target = 90) {
    return {
      id: this.uid("subj"),
      name: name.trim(),
      target: Number(target),
      categories: [],
    };
  },

  createCategory(name, weight = 0, confidence = 50) {
    return {
      id: this.uid("cat"),
      name: name.trim(),
      weight: Number(weight),
      confidence: Number(confidence),
      scores: [],
    };
  },

  createScore(label, score, max, date) {
    return {
      id: this.uid("score"),
      label: label.trim() || "Score",
      score: Number(score),
      max: Number(max),
      date: date || this.today(),
    };
  },
};
