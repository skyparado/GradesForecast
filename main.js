/* ============================================================================
 * main.js — controller with three-screen navigation: terms → dashboard → course
 * ========================================================================== */

const App = {
  state:          null,
  calibrationLog: [],

  // Navigation state
  nav: { screen: "terms", termId: null, courseId: null },

  init() {
    this.state          = Storage.load();
    this.calibrationLog = Storage.loadCalibration();
    this.bindGlobalEvents();
    this.render();
  },

  commit() {
    Storage.save(this.state);
    this.render();
  },

  // ---- Navigation -----------------------------------------------------------

  goTo(screen, opts = {}) {
    this.nav = {
      screen,
      termId:   opts.termId   ?? this.nav.termId,
      courseId: opts.courseId ?? null,
    };
    this.render();
  },

  activeTerm() {
    return this.state.terms.find((t) => t.id === this.nav.termId) || null;
  },

  activeCourse() {
    const term = this.activeTerm();
    return term ? term.subjects.find((s) => s.id === this.nav.courseId) || null : null;
  },

  // ---- Render ---------------------------------------------------------------

  render() {
    const app = document.getElementById("app");
    const { screen } = this.nav;
    if (screen === "terms")     app.innerHTML = UI.termsScreen(this.state);
    if (screen === "dashboard") app.innerHTML = UI.dashboardScreen(this.activeTerm(), this.calibrationLog);
    if (screen === "course")    app.innerHTML = UI.courseScreen(this.activeCourse(), this.calibrationLog);
    this.drawCharts();
  },

  drawCharts() {
    const course = this.activeCourse();
    if (!course) return;
    const gc = document.getElementById("chart-grade");
    const cc = document.getElementById("chart-confidence");
    if (gc) Charts.line(gc, Calc.gradeTrend(course));
    if (cc) Charts.bars(cc, course.categories.map((c) => ({ label: c.name, value: c.confidence })));
  },

  // ---- Global event delegation ----------------------------------------------

  bindGlobalEvents() {
    document.getElementById("app").addEventListener("click",  (e) => this.handleClick(e));
    document.getElementById("app").addEventListener("change", (e) => this.handleChange(e));
    document.getElementById("app").addEventListener("input",  (e) => this.handleInput(e));
  },

  handleClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    const handler = this.actions[action];
    if (handler) handler.call(this, btn, id, e);
  },

  handleChange(e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const changeable = ["set-target", "set-weight", "set-confidence", "set-deadline",
                        "set-final-weight", "set-final-confidence"];
    if (changeable.includes(el.dataset.action)) {
      this.actions[el.dataset.action].call(this, el, el.dataset.id, e);
    }
  },

  handleInput(e) {
    const el = e.target;
    if (el.dataset.action === "set-confidence") {
      const label = el.parentElement.querySelector(".conf__val");
      if (label) label.textContent = el.value + "%";
    }
    if (el.dataset.action === "set-final-confidence") {
      const label = document.getElementById("final-conf-val");
      if (label) label.textContent = el.value + "%";
      // Re-render just the final calc result without a full commit
      this.updateFinalCalcDisplay();
    }
    if (el.dataset.action === "set-final-weight") {
      this.updateFinalCalcDisplay();
    }
  },

  updateFinalCalcDisplay() {
    const course = this.activeCourse();
    if (!course) return;
    const weightEl = document.querySelector("[data-action='set-final-weight']");
    const confEl   = document.querySelector("[data-action='set-final-confidence']");
    if (weightEl) course.finalWeight      = Number(weightEl.value);
    if (confEl)   course.finalConfidence  = Number(confEl.value);
    const resultEl = document.getElementById("final-calc-result");
    if (resultEl) resultEl.innerHTML = UI.finalCalcResult(course, this.calibrationLog);
  },

  fieldVal(container, field) {
    const el = container.querySelector(`[data-field="${field}"]`);
    return el ? el.value : "";
  },

  // ---- Actions --------------------------------------------------------------

  actions: {

    // --- Terms screen ---
    "add-term"(btn) {
      const input = document.getElementById("new-term-name");
      if (!input || !input.value.trim()) return;
      const term = Models.createTerm(input.value);
      this.state.terms.push(term);
      input.value = "";
      this.commit();
    },

    "select-term"(btn, termId) {
      this.goTo("dashboard", { termId });
    },

    "delete-term"(btn, termId) {
      if (!confirm("Delete this term and all its courses?")) return;
      this.state.terms = this.state.terms.filter((t) => t.id !== termId);
      this.commit();
    },

    // --- Dashboard screen ---
    "back-to-terms"() {
      this.goTo("terms");
    },

    "add-course"(btn) {
      const name   = document.getElementById("new-course-name");
      const target = document.getElementById("new-course-target");
      if (!name || !name.value.trim()) return;
      const term = this.activeTerm();
      const subj = Models.createSubject(name.value, target.value || 90);
      term.subjects.push(subj);
      name.value   = "";
      target.value = "";
      this.commit();
    },

    "select-course"(btn, courseId) {
      this.goTo("course", { courseId });
    },

    "delete-course"(btn, courseId) {
      if (!confirm("Delete this course?")) return;
      const term = this.activeTerm();
      term.subjects = term.subjects.filter((s) => s.id !== courseId);
      this.commit();
    },

    "reset-all"() {
      if (!confirm("Delete everything? This can't be undone.")) return;
      Storage.reset();
      this.state          = Storage.load();
      this.calibrationLog = [];
      this.goTo("terms");
    },

    // --- Course editor screen ---
    "back-to-dashboard"() {
      this.goTo("dashboard");
    },

    "set-target"(el, id) {
      const course = this.activeCourse();
      if (course) course.target = Number(el.value);
      this.commit();
    },

    "set-final-weight"(el) {
      const course = this.activeCourse();
      if (course) course.finalWeight = Number(el.value);
      this.commit();
    },

    "set-final-confidence"(el) {
      const course = this.activeCourse();
      if (course) course.finalConfidence = Number(el.value);
      this.commit();
    },

    "add-category"(btn, courseId) {
      const form   = btn.closest("[data-course]");
      const name   = this.fieldVal(form, "name");
      const weight = this.fieldVal(form, "weight");
      if (!name.trim()) return;
      const course = this.activeCourse();
      course.categories.push(Models.createCategory(name, weight || 0, 50));
      this.commit();
    },

    "delete-category"(btn, catId) {
      const course = this.activeCourse();
      course.categories = course.categories.filter((c) => c.id !== catId);
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

    "set-deadline"(el, catId) {
      const cat = this.findCategory(catId);
      if (cat) cat.deadline = el.value || null;
      this.commit();
    },

    "add-score"(btn, catId) {
      const form              = btn.closest(".mini-form");
      const label             = this.fieldVal(form, "label");
      const score             = this.fieldVal(form, "score");
      const max               = this.fieldVal(form, "max");
      const confRaw           = this.fieldVal(form, "confidence-at-entry");
      const confidenceAtEntry = confRaw !== "" ? Number(confRaw) : null;
      if (score === "" || max === "" || Number(max) <= 0) return;
      const cat = this.findCategory(catId);
      cat.scores.push(Models.createScore(label, score, max, undefined, confidenceAtEntry));
      if (confidenceAtEntry !== null) {
        const actualPct = (Number(score) / Number(max)) * 100;
        Storage.appendCalibration({
          subjectId:  this.activeCourse().id,
          categoryId: catId,
          confidence: confidenceAtEntry,
          actualScore: Math.round(actualPct * 10) / 10,
        });
        this.calibrationLog = Storage.loadCalibration();
      }
      this.commit();
    },

    "delete-score"(btn, catId) {
      const scoreId = btn.dataset.score;
      const cat = this.findCategory(catId);
      cat.scores = cat.scores.filter((s) => s.id !== scoreId);
      this.commit();
    },

    "what-if"(btn, courseId) {
      const card  = btn.closest("[data-course]");
      const catId = this.fieldVal(card, "wi-cat");
      const score = this.fieldVal(card, "wi-score");
      const max   = this.fieldVal(card, "wi-max");
      const out   = card.querySelector("#what-if-result");
      if (score === "" || max === "" || Number(max) <= 0) {
        out.textContent = "Enter a score and a max above.";
        return;
      }
      const course = this.activeCourse();
      const { before, after } = Calc.whatIf(course, catId, score, max);
      const arrow = after >= before ? "↑" : "↓";
      out.innerHTML = `Grade: <strong>${UI.fmt(before)}</strong> → <strong>${UI.fmt(after)}</strong> ${arrow}`;
    },
  },

  findCategory(catId) {
    const course = this.activeCourse();
    return course ? course.categories.find((c) => c.id === catId) : null;
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
window.addEventListener("resize", () => App.drawCharts());
