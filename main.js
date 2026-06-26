/* ============================================================================
 * main.js — controller: 4-screen navigation + all actions
 * ========================================================================== */

const App = {
  state: null,
  nav:   { screen: "home", termId: null, courseId: null },

  init() {
    this.state = Storage.load();
    this.applyTheme(localStorage.getItem("dlplanner.theme") || "dark");
    this.injectThemeToggle();
    document.getElementById("app").addEventListener("click",  e => this.handleClick(e));
    document.getElementById("app").addEventListener("change", e => this.handleChange(e));
    document.getElementById("app").addEventListener("input",  e => this.handleInput(e));
    this.render();
  },

  applyTheme(theme) {
    this.theme = theme;
    document.body.classList.toggle("theme-light", theme === "light");
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) btn.textContent = theme === "light" ? "🌙" : "☀️";
    localStorage.setItem("dlplanner.theme", theme);
  },

  injectThemeToggle() {
    if (document.getElementById("theme-toggle-btn")) return;
    const btn = document.createElement("button");
    btn.id        = "theme-toggle-btn";
    btn.className = "theme-toggle";
    btn.title     = "Toggle light / dark mode";
    btn.textContent = this.theme === "light" ? "🌙" : "☀️";
    btn.addEventListener("click", () => {
      this.applyTheme(this.theme === "light" ? "dark" : "light");
    });
    document.body.appendChild(btn);
  },

  // ---- Save / render --------------------------------------------------------

  commit() { Storage.save(this.state); this.render(); },
  save()   { Storage.save(this.state); },

  render() {
    const { screen } = this.nav;
    const app = document.getElementById("app");
    if (screen === "home")          app.innerHTML = UI.homeScreen(this.state);
    if (screen === "summary")       app.innerHTML = UI.summaryScreen(this.activeTerm());
    if (screen === "score-editor")  app.innerHTML = UI.scoreEditorScreen(this.activeCourse());
    if (screen === "course-editor") app.innerHTML = UI.courseEditorScreen(this.activeCourse());
  },

  // ---- Navigators -----------------------------------------------------------

  goTo(screen, opts = {}) {
    this.nav = {
      screen,
      termId:   opts.termId   ?? this.nav.termId,
      courseId: opts.courseId ?? null,
    };
    this.render();
  },

  activeTerm()   { return this.state.terms.find(t => t.id === this.nav.termId) || null; },
  activeCourse() {
    const term = this.activeTerm();
    return term ? term.courses.find(c => c.id === this.nav.courseId) || null : null;
  },

  // ---- Finders --------------------------------------------------------------

  findComp(compId) {
    const course = this.activeCourse();
    return course ? course.components.find(c => c.id === compId) || null : null;
  },

  findEntity(compId, subId) {
    const comp = this.findComp(compId);
    if (!comp) return null;
    if (!subId) return comp; // leaf component
    return comp.subcomponents.find(s => s.id === subId) || null;
  },

  // ---- Event handling -------------------------------------------------------

  handleClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    e.stopPropagation();
    const { action, id, val } = btn.dataset;
    const handler = this.actions[action];
    if (handler) handler.call(this, btn, id, val, e);
  },

  handleChange(e) {
    const el = e.target;
    const action = el.dataset.action;
    if (!action) return;
    const scoreActions = ["set-real-score", "set-total-marks", "set-sub-marks",
                          "set-sub-name", "set-comp-name"];
    const handler = this.actions[action];
    if (handler) {
      handler.call(this, el, el.dataset.id || el.dataset.comp, el.dataset.val, e);
      // Score/name inputs: save without re-render to preserve focus
      if (scoreActions.includes(action)) { this.save(); return; }
    }
  },

  handleInput(e) {
    const el = e.target;
    // Live update slider labels without full re-render
    if (el.dataset.action === "set-overall-conf") {
      const lbl = el.closest(".conf-slider-wrap")?.querySelector(".conf-slider__val--lg");
      if (lbl) {
        const lvl = Number(el.value);
        lbl.textContent = ["LOW", "MEDIUM", "HIGH"][lvl];
        lbl.className = `conf-slider__val conf-slider__val--lg conf-val--${lvl}`;
        const hint = el.closest(".editor-field")?.querySelector(".conf-hint");
        if (hint) {
          const pct = Calc.cv(lvl);
          const course = this.activeCourse();
          const gwaVal = course ? Calc.gwa(pct, course.passingThreshold).toFixed(1) : "?";
          hint.textContent = `→ ${pct}% target (GWA ${gwaVal})`;
        }
      }
    }
    if (el.dataset.action === "set-comp-conf") {
      const wrap = el.closest(".comp-conf");
      const lbl = wrap?.querySelector(".conf-slider__val");
      if (lbl) {
        const lvl = Number(el.value);
        lbl.textContent = ["LOW", "MEDIUM", "HIGH"][lvl];
        lbl.className = `conf-slider__val conf-val--${lvl}`;
      }
    }
  },

  // ---- Actions --------------------------------------------------------------

  actions: {

    // Home
    "prompt-add-term"() {
      const name = prompt("Term name (e.g. Y1T1):");
      if (!name || !name.trim()) return;
      this.state.terms.push(Models.createTerm(name));
      this.commit();
    },

    "select-term"(btn, termId) {
      this.goTo("summary", { termId });
    },

    "delete-term"(btn, termId) {
      if (!confirm("Delete this term and all its courses?")) return;
      this.state.terms = this.state.terms.filter(t => t.id !== termId);
      this.commit();
    },

    "reset-all"() {
      if (!confirm("Delete everything? This cannot be undone.")) return;
      Storage.reset();
      this.state = Storage.load();
      this.goTo("home");
    },

    // Summary
    "back-to-home"() { this.goTo("home"); },

    "set-dl"(btn, id, val) {
      const term = this.activeTerm();
      if (term) { term.dlTarget = Number(val); this.commit(); }
    },

    "add-course"() {
      const term = this.activeTerm();
      if (!term) return;
      const course = Models.createCourse("New Course");
      term.courses.push(course);
      this.save();
      this.goTo("course-editor", { courseId: course.id });
    },

    "open-score-editor"(btn, courseId) {
      this.goTo("score-editor", { courseId });
    },

    "open-course-editor"(btn, courseId) {
      this.goTo("course-editor", { courseId });
    },

    "remove-course"(btn, courseId) {
      if (!confirm("Remove this course?")) return;
      const term = this.activeTerm();
      term.courses = term.courses.filter(c => c.id !== courseId);
      this.commit();
      this.goTo("summary");
    },

    // Score Editor / Course Editor
    "back-to-summary"() { this.save(); this.goTo("summary"); },

    "set-real-score"(el) {
      const entity = this.findEntity(el.dataset.comp, el.dataset.sub);
      if (entity) entity.realScore = el.value === "" ? null : Number(el.value);
    },

    "set-total-marks"(el) {
      const entity = this.findEntity(el.dataset.comp, el.dataset.sub);
      if (entity) entity.totalMarks = el.value === "" ? null : Number(el.value);
    },

    "unlock-score"(btn) {
      const entity = this.findEntity(btn.dataset.comp, btn.dataset.sub);
      if (entity) { entity.locked = false; this.commit(); }
    },

    "save-scores"() {
      const course = this.activeCourse();
      if (!course) return;
      for (const comp of course.components) {
        if (!comp.subcomponents.length) {
          if (comp.realScore !== null && comp.totalMarks > 0) comp.locked = true;
        } else {
          for (const sub of comp.subcomponents) {
            if (sub.realScore !== null && sub.totalMarks > 0) sub.locked = true;
          }
        }
      }
      this.commit();
    },

    // Course Editor
    "set-course-name"(el, id) {
      const course = this.activeCourse();
      if (course) course.name = el.value.trim() || "Untitled";
    },

    "set-threshold"(btn, id, val) {
      const course = this.activeCourse();
      if (course) { course.passingThreshold = Number(val); this.commit(); }
    },

    "set-overall-conf"(el, id) {
      const course = this.activeCourse();
      if (course) { course.overallConfidence = Number(el.value); this.save(); }
    },

    "set-units"(el, id) {
      const course = this.activeCourse();
      if (course) { course.units = Number(el.value) || 3; this.commit(); }
    },

    "add-comp"(btn, courseId) {
      const course = this.activeCourse();
      if (!course) return;
      const name = prompt("Component name:");
      if (!name || !name.trim()) return;
      course.components.push(Models.createComponent(name));
      this.commit();
    },

    "delete-comp"(btn, compId) {
      const course = this.activeCourse();
      if (!course) return;
      if (!confirm("Delete this component?")) return;
      course.components = course.components.filter(c => c.id !== compId);
      this.commit();
    },

    "set-comp-name"(el) {
      const comp = this.findComp(el.dataset.id);
      if (comp) comp.name = el.value;
    },

    "set-comp-weight"(el) {
      const comp = this.findComp(el.dataset.id);
      if (comp) { comp.weight = Number(el.value) || 0; this.commit(); }
    },

    "set-comp-conf"(el) {
      const comp = this.findComp(el.dataset.id);
      if (comp) { comp.confidence = Number(el.value); this.save(); }
    },

    "add-subcomp"(btn, compId) {
      const comp = this.findComp(compId);
      if (!comp) return;
      const name = prompt("Subcomponent name (e.g. Exam A):");
      if (!name || !name.trim()) return;
      comp.subcomponents.push(Models.createSubcomponent(name));
      this.commit();
    },

    "delete-subcomp"(btn) {
      const comp = this.findComp(btn.dataset.comp);
      if (!comp) return;
      const subId = btn.dataset.sub;
      if (!confirm("Remove this subcomponent?")) return;
      comp.subcomponents = comp.subcomponents.filter(s => s.id !== subId);
      this.commit();
    },

    "set-sub-name"(el) {
      const comp = this.findComp(el.dataset.comp);
      if (!comp) return;
      const sub = comp.subcomponents.find(s => s.id === el.dataset.sub);
      if (sub) sub.name = el.value;
    },

    "set-sub-marks"(el) {
      const comp = this.findComp(el.dataset.comp);
      if (!comp) return;
      const sub = comp.subcomponents.find(s => s.id === el.dataset.sub);
      if (sub) sub.totalMarks = el.value === "" ? null : Number(el.value);
    },
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
