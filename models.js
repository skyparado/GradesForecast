const Models = {
  uid(prefix = "id") {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  createTerm(name) {
    return { id: this.uid("term"), name: name.trim(), subjects: [] };
  },

  createSubject(name, target = 90) {
    return {
      id:         this.uid("subj"),
      name:       name.trim(),
      target:     Number(target),
      finalWeight: 0,       // % of grade the final exam is worth
      finalConfidence: 50,  // how confident you feel about the final specifically
      categories: [],
    };
  },

  createCategory(name, weight = 0, confidence = 50) {
    return {
      id:                  this.uid("cat"),
      name:                name.trim(),
      weight:              Number(weight),
      confidence:          Number(confidence),
      deadline:            null,
      perceivedDifficulty: 50,
      scores:              [],
    };
  },

  createScore(label, score, max, date, confidenceAtEntry = null) {
    return {
      id:                this.uid("score"),
      label:             label.trim() || "Score",
      score:             Number(score),
      max:               Number(max),
      date:              date || this.today(),
      confidenceAtEntry: confidenceAtEntry !== null ? Number(confidenceAtEntry) : null,
    };
  },
};
