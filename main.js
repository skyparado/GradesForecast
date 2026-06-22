/* ============================================================================
 * main.js
 * ----------------------------------------------------------------------------
 * The controller. It owns the app state, decides when to re-render, and listens
 * for user actions. It leans on the other modules:
 *   Storage  – load / save           Models – build new objects
 *   Calc     – all the math           UI     – build HTML        Charts – draw
 *
 * Loaded LAST in index.html so every helper above already exists.
 * ========================================================================== */

const App = {
  state: null,
  selectedId: null,

  init() {
    this.state = Storage.load();
    // Select the first subject by default so the screen isn't empty.
    if (this.state.subjects.length) this.selectedId = this.state.subjects[0].id;
    this.bindEvents();
    this.render();
  },

  // Save then redraw — call this after any change to the data.
  commit() {
    Storage.save(this.state);
    this.render();
  },

  selectedSubject() {
    return this.state.subjects.find((s) => s.id === this.selectedId) || null;
  },

  // ----- Rendering -----------------------------------------------------------
  render() {
    document.getElementById("priority-board").innerHTML = UI.priorityBoard(this.state);
    document.getElementById("subject-list").innerHTML = UI.subjectList(this.state, this.selectedId);
    document.getElementById("subject-detail").innerHTML = UI.subjectDetail(this.selectedSubject());
    this.drawCharts();
  },

  drawCharts() {
    const subject = this.selectedSubject();
    if (!subject) return;
    const gradeCanvas = document.getElementById("chart-grade");
    const confCanvas = document.getElementById("chart-confidence");
    if (gradeCanvas) Charts.line(gradeCanvas, Calc.gradeTrend(subject));
    if (confCanvas)
      Charts.bars(
        confCanvas,
        subject.categories.map((c) => ({ label: c.name, value: c.confidence }))
      );
  },

  // ----- Reading values from the little inline forms -------------------------
  // Given a button, find its surrounding form container and read a [data-field].
  fieldVal(container, field) {
    const el = container.querySelector(`[data-field="${field}"]`);
    return el ? el.value : "";
  },

  // ----- Event wiring (delegation) -------------------------------------------
  // One click listener for the whole app. We read data-action off whatever was
  // clicked and route to the right handler. New buttons added by re-rendering
  // work automatically — no need to re-attach listeners.
  bindEvents() {
    const root = document.getElementById("app");

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const handler = this.actions[action];
      if (handler) handler.call(this, btn, id, e);
    });

    // Inputs that should save on change (number fields, range release).
    root.addEventListener("change", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.dataset.action;
      if (["set-target", "set-weight", "set-confidence"].includes(action)) {
        this.actions[action].call(this, el, el.dataset.id, e);
      }
    });

    // Live update of the confidence % label as the slider moves (no save yet).
    root.addEventListener("input", (e) => {
      if (e.target.dataset.action === "set-confidence") {
        const label = e.target.parentElement.querySelector(".conf__val");
        if (label) label.textContent = e.target.value + "%";
      }
    });

    // Top-level "Add subject" form.
    document.getElementById("add-subject-btn").addEventListener("click", () => {
      const name = document.getElementById("new-subject-name");
      const target = document.getElementById("new-subject-target");
      if (!name.value.trim()) return;
      const subject = Models.createSubject(name.value, target.value || 90);
      this.state.subjects.push(subject);
      this.selectedId = subject.id;
      name.value = "";
      target.value = "";
      this.commit();
    });

    // Reset everything.
    document.getElementById("reset-btn").addEventListener("click", () => {
      if (!confirm("Delete all subjects and data? This can't be undone.")) return;
      Storage.reset();
      this.state = Storage.load();
      this.selectedId = null;
      this.render();
    });
  },

  // Each handler is small and named after the data-action it serves.
  actions: {
    "select-subject"(btn, id) {
      this.selectedId = id;
      this.render(); // no data changed, so no need to save
    },

    "set-target"(el, id) {
      const subj = this.state.subjects.find((s) => s.id === id);
      if (subj) subj.target = Number(el.value);
      this.commit();
    },

    "add-category"(btn, subjectId) {
      const form = btn.closest("[data-subject]");
      const name = this.fieldVal(form, "name");
      const weight = this.fieldVal(form, "weight");
      if (!name.trim()) return;
      const subj = this.state.subjects.find((s) => s.id === subjectId);
      subj.categories.push(Models.createCategory(name, weight || 0, 50));
      this.commit();
    },

    "delete-category"(btn, catId) {
      const subj = this.selectedSubject();
      subj.categories = subj.categories.filter((c) => c.id !== catId);
      this.commit();
    },

    "set-weight"(el, catId) {
      const cat = this.findCategory(catId);
      if (cat) cat.weight = Number(el.value);
      this.commit();
    },

    "set-confidence"(el, catId) {
      const cat = this.findCategory(catId);
      if (cat) cat.confidence = Number(el.value);
      this.commit();
    },

    "add-score"(btn, catId) {
      const form = btn.closest(".mini-form");
      const label = this.fieldVal(form, "label");
      const score = this.fieldVal(form, "score");
      const max = this.fieldVal(form, "max");
      if (score === "" || max === "" || Number(max) <= 0) return;
      const cat = this.findCategory(catId);
      cat.scores.push(Models.createScore(label, score, max));
      this.commit();
    },

    "delete-score"(btn, catId) {
      const scoreId = btn.dataset.score;
      const cat = this.findCategory(catId);
      cat.scores = cat.scores.filter((s) => s.id !== scoreId);
      this.commit();
    },

    // What-if updates ONLY its result line, so the inputs you typed stay put.
    "what-if"(btn, subjectId) {
      const card = btn.closest("[data-subject]");
      const catId = this.fieldVal(card, "wi-cat");
      const score = this.fieldVal(card, "wi-score");
      const max = this.fieldVal(card, "wi-max");
      const out = card.querySelector("#what-if-result");
      if (score === "" || max === "" || Number(max) <= 0) {
        out.textContent = "Enter a score and a max above.";
        return;
      }
      const subj = this.state.subjects.find((s) => s.id === subjectId);
      const { before, after } = Calc.whatIf(subj, catId, score, max);
      const arrow = after >= before ? "↑" : "↓";
      out.innerHTML = `Current grade would go from
        <strong>${UI.fmt(before)}</strong> to
        <strong>${UI.fmt(after)}</strong> ${arrow}`;
    },
  },

  // Helper: find a category by id within the currently selected subject.
  findCategory(catId) {
    const subj = this.selectedSubject();
    return subj ? subj.categories.find((c) => c.id === catId) : null;
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());

// Redraw charts on resize so the canvas stays crisp.
window.addEventListener("resize", () => App.drawCharts());
