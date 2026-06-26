/* ============================================================================
 * main.js — controller: navigation + actions + modal system
 * ========================================================================== */

// ============================================================================
// Modal — replaces native prompt() / confirm()
// ============================================================================

const Modal = {
  _root() { return document.getElementById("modal-root"); },

  _hide() { this._root().innerHTML = ""; },

  confirm(msg) {
    return new Promise(resolve => {
      const done = val => { this._hide(); resolve(val); };
      this._root().innerHTML = `
        <div class="modal-backdrop" id="_mbdrop">
          <div class="modal-box" role="dialog" aria-modal="true">
            <p class="modal-msg">${UI.esc(msg)}</p>
            <div class="modal-actions">
              <button class="modal-btn modal-btn--danger" id="_mok">Confirm</button>
              <button class="modal-btn modal-btn--ghost"  id="_mcx">Cancel</button>
            </div>
          </div>
        </div>`;
      document.getElementById("_mok").onclick = () => done(true);
      document.getElementById("_mcx").onclick = () => done(false);
      document.getElementById("_mbdrop").onclick = e => {
        if (e.target === e.currentTarget) done(false);
      };
    });
  },

  prompt(msg, placeholder = "") {
    return new Promise(resolve => {
      const done = val => { this._hide(); resolve(val); };
      this._root().innerHTML = `
        <div class="modal-backdrop" id="_mbdrop">
          <div class="modal-box" role="dialog" aria-modal="true">
            <p class="modal-msg">${UI.esc(msg)}</p>
            <input class="modal-input" type="text"
                   placeholder="${UI.esc(placeholder)}" id="_minput" />
            <div class="modal-actions">
              <button class="modal-btn modal-btn--primary" id="_mok">OK</button>
              <button class="modal-btn modal-btn--ghost"   id="_mcx">Cancel</button>
            </div>
          </div>
        </div>`;
      const inp = document.getElementById("_minput");
      inp.focus();
      const submit = () => done(inp.value.trim() || null);
      document.getElementById("_mok").onclick = submit;
      document.getElementById("_mcx").onclick = () => done(null);
      inp.onkeydown = e => {
        if (e.key === "Enter")  submit();
        if (e.key === "Escape") done(null);
      };
      document.getElementById("_mbdrop").onclick = e => {
        if (e.target === e.currentTarget) done(null);
      };
    });
  },
};

// ============================================================================
// App
// ============================================================================

const App = {
  state: null,
  nav:   { screen: "home", termId: null, courseId: null },

  async init() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="init-loading">
        <div class="spinner"></div>
        <p>Loading…</p>
      </div>`;

    try {
      this.state = await Storage.load();
    } catch (err) {
      app.innerHTML = `
        <div class="init-error">
          <p>Failed to connect to database.</p>
          <small>${UI.esc(String(err.message))}</small>
        </div>`;
      return;
    }

    this.applyTheme(localStorage.getItem("dlplanner.theme") || "dark");
    this.injectThemeToggle();

    app.addEventListener("click",  e => this.handleClick(e));
    app.addEventListener("change", e => this.handleChange(e));
    app.addEventListener("input",  e => this.handleInput(e));

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

  // ---- Render ---------------------------------------------------------------

  render() {
    const { screen } = this.nav;
    const app = document.getElementById("app");
    if (screen === "home")          app.innerHTML = UI.homeScreen(this.state);
    if (screen === "summary")       app.innerHTML = UI.summaryScreen(this.activeTerm());
    if (screen === "score-editor")  app.innerHTML = UI.scoreEditorScreen(this.activeCourse());
    if (screen === "course-editor") app.innerHTML = UI.courseEditorScreen(this.activeCourse());
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
    if (!subId) return comp;
    return comp.subcomponents.find(s => s.id === subId) || null;
  },

  // ---- Event handling -------------------------------------------------------

  handleClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    e.stopPropagation();
    const { action, id, val } = btn.dataset;
    const handler = this.actions[action];
    if (handler) {
      const r = handler.call(this, btn, id, val, e);
      if (r instanceof Promise) r.catch(err => console.error("[action]", action, err));
    }
  },

  handleChange(e) {
    const el = e.target;
    const action = el.dataset.action;
    if (!action) return;
    const handler = this.actions[action];
    if (handler) {
      const r = handler.call(this, el, el.dataset.id || el.dataset.comp, el.dataset.val, e);
      if (r instanceof Promise) r.catch(err => console.error("[action]", action, err));
    }
  },

  handleInput(e) {
    const el = e.target;
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

    // Home ----------------------------------------------------------------

    async "prompt-add-term"() {
      const name = await Modal.prompt("Term name (e.g. Y1T1):");
      if (!name) return;
      const term = Models.createTerm(name);
      this.state.terms.push(term);
      await Storage.insertTerm(term);
      this.render();
    },

    "select-term"(btn, termId) {
      this.goTo("summary", { termId });
    },

    async "delete-term"(btn, termId) {
      const ok = await Modal.confirm("Delete this term and all its courses?");
      if (!ok) return;
      this.state.terms = this.state.terms.filter(t => t.id !== termId);
      this.render();
      await Storage.deleteTerm(termId);
    },

    async "reset-all"() {
      const ok = await Modal.confirm("Delete everything and reload seed data? This cannot be undone.");
      if (!ok) return;
      this.state = { version: 1, terms: [] };
      this.render();
      await Storage.resetAll();
      this.state = await Storage.load();
      this.goTo("home");
    },

    // Summary -------------------------------------------------------------

    "back-to-home"() { this.goTo("home"); },

    "set-dl"(btn, id, val) {
      const term = this.activeTerm();
      if (!term) return;
      term.dlTarget = Number(val);
      this.render();
      Storage.syncTerm(term).catch(console.error);
    },

    async "add-course"() {
      const term = this.activeTerm();
      if (!term) return;
      const course = Models.createCourse("New Course");
      term.courses.push(course);
      await Storage.insertCourse(course, term.id);
      this.goTo("course-editor", { courseId: course.id });
    },

    "open-score-editor"(btn, courseId) {
      this.goTo("score-editor", { courseId });
    },

    "open-course-editor"(btn, courseId) {
      this.goTo("course-editor", { courseId });
    },

    async "remove-course"(btn, courseId) {
      const ok = await Modal.confirm("Remove this course?");
      if (!ok) return;
      const term = this.activeTerm();
      if (!term) return;
      term.courses = term.courses.filter(c => c.id !== courseId);
      this.goTo("summary");
      await Storage.deleteCourse(courseId);
    },

    // Inline grade inputs on summary screen

    "set-course-pct"(el) {
      const term = this.activeTerm();
      const course = term?.courses.find(c => c.id === el.dataset.course);
      if (!course || !course.components.length) return;
      const comp = course.components[0];
      const pct = el.value === "" ? null : Number(el.value);
      comp.realScore  = pct;
      comp.totalMarks = pct === null ? null : 100;
      this.render();
      Storage.syncComp(comp).catch(console.error);
    },

    "set-comp-pct"(el) {
      const term   = this.activeTerm();
      const course = term?.courses.find(c => c.id === el.dataset.course);
      const comp   = course?.components.find(c => c.id === el.dataset.comp);
      if (!comp) return;
      const pct = el.value === "" ? null : Number(el.value);
      comp.realScore  = pct;
      comp.totalMarks = pct === null ? null : 100;
      this.render();
      Storage.syncComp(comp).catch(console.error);
    },

    "set-sub-pct"(el) {
      const term   = this.activeTerm();
      const course = term?.courses.find(c => c.id === el.dataset.course);
      const comp   = course?.components.find(c => c.id === el.dataset.comp);
      const sub    = comp?.subcomponents.find(s => s.id === el.dataset.sub);
      if (!sub) return;
      const pct = el.value === "" ? null : Number(el.value);
      sub.realScore  = pct;
      sub.totalMarks = pct === null ? null : 100;
      this.render();
      Storage.syncSub(sub).catch(console.error);
    },

    "set-flat-score"(el) {
      const term = this.activeTerm();
      const course = term?.courses.find(c => c.id === el.dataset.course);
      if (!course) return;
      const pct = el.value === "" ? null : Number(el.value);
      course.flatScore = pct;
      this.render();
      Storage.syncCourse(course).catch(console.error);
    },

    // Score Editor --------------------------------------------------------

    "back-to-summary"() { this.goTo("summary"); },

    "set-real-score"(el) {
      const entity = this.findEntity(el.dataset.comp, el.dataset.sub);
      if (!entity) return;
      entity.realScore = el.value === "" ? null : Number(el.value);
      if (el.dataset.sub) {
        Storage.syncSub(entity).catch(console.error);
      } else {
        Storage.syncComp(entity).catch(console.error);
      }
    },

    "set-total-marks"(el) {
      const entity = this.findEntity(el.dataset.comp, el.dataset.sub);
      if (!entity) return;
      entity.totalMarks = el.value === "" ? null : Number(el.value);
      if (el.dataset.sub) {
        Storage.syncSub(entity).catch(console.error);
      } else {
        Storage.syncComp(entity).catch(console.error);
      }
    },

    async "unlock-score"(btn) {
      const entity = this.findEntity(btn.dataset.comp, btn.dataset.sub);
      if (!entity) return;
      entity.locked = false;
      if (btn.dataset.sub) {
        await Storage.syncSub(entity);
      } else {
        await Storage.syncComp(entity);
      }
      this.render();
    },

    async "save-scores"() {
      const course = this.activeCourse();
      if (!course) return;
      const ops = [];
      for (const comp of course.components) {
        if (!comp.subcomponents.length) {
          if (comp.realScore !== null && comp.totalMarks > 0) {
            comp.locked = true;
            ops.push(Storage.syncComp(comp));
          }
        } else {
          for (const sub of comp.subcomponents) {
            if (sub.realScore !== null && sub.totalMarks > 0) {
              sub.locked = true;
              ops.push(Storage.syncSub(sub));
            }
          }
        }
      }
      await Promise.all(ops);
      this.render();
    },

    // Course Editor -------------------------------------------------------

    "set-course-name"(el) {
      const course = this.activeCourse();
      if (!course) return;
      course.name = el.value.trim() || "Untitled";
      Storage.syncCourse(course).catch(console.error);
    },

    "set-course-full-name"(el) {
      const course = this.activeCourse();
      if (!course) return;
      course.fullName = el.value.trim();
      Storage.syncCourse(course).catch(console.error);
    },

    "set-threshold"(btn, id, val) {
      const course = this.activeCourse();
      if (!course) return;
      course.passingThreshold = Number(val);
      this.render();
      Storage.syncCourse(course).catch(console.error);
    },

    "set-overall-conf"(el) {
      const course = this.activeCourse();
      if (!course) return;
      course.overallConfidence = Number(el.value);
      Storage.syncCourse(course).catch(console.error);
    },

    "set-units"(el) {
      const course = this.activeCourse();
      if (!course) return;
      course.units = Number(el.value) || 3;
      this.render();
      Storage.syncCourse(course).catch(console.error);
    },

    async "add-comp"(btn, courseId) {
      const course = this.activeCourse();
      if (!course) return;
      const name = await Modal.prompt("Component name:");
      if (!name) return;
      const comp = Models.createComponent(name);
      course.components.push(comp);
      await Storage.insertComp(comp, course.id);
      this.render();
    },

    async "delete-comp"(btn, compId) {
      const course = this.activeCourse();
      if (!course) return;
      const ok = await Modal.confirm("Delete this component?");
      if (!ok) return;
      course.components = course.components.filter(c => c.id !== compId);
      this.render();
      await Storage.deleteComp(compId);
    },

    "set-comp-name"(el) {
      const comp = this.findComp(el.dataset.id);
      if (!comp) return;
      comp.name = el.value;
      Storage.syncComp(comp).catch(console.error);
    },

    "set-comp-weight"(el) {
      const comp = this.findComp(el.dataset.id);
      if (!comp) return;
      comp.weight = Number(el.value) || 0;
      this.render();
      Storage.syncComp(comp).catch(console.error);
    },

    "set-comp-conf"(el) {
      const comp = this.findComp(el.dataset.id);
      if (!comp) return;
      comp.confidence = Number(el.value);
      Storage.syncComp(comp).catch(console.error);
    },

    async "add-subcomp"(btn, compId) {
      const comp = this.findComp(compId);
      if (!comp) return;
      const name = await Modal.prompt("Subcomponent name (e.g. Exam A):");
      if (!name) return;
      const sub = Models.createSubcomponent(name);
      comp.subcomponents.push(sub);
      await Storage.insertSub(sub, comp.id);
      this.render();
    },

    async "delete-subcomp"(btn) {
      const comp = this.findComp(btn.dataset.comp);
      if (!comp) return;
      const subId = btn.dataset.sub;
      const ok = await Modal.confirm("Remove this subcomponent?");
      if (!ok) return;
      comp.subcomponents = comp.subcomponents.filter(s => s.id !== subId);
      this.render();
      await Storage.deleteSub(subId);
    },

    "set-sub-name"(el) {
      const comp = this.findComp(el.dataset.comp);
      if (!comp) return;
      const sub = comp.subcomponents.find(s => s.id === el.dataset.sub);
      if (sub) {
        sub.name = el.value;
        Storage.syncSub(sub).catch(console.error);
      }
    },

    "set-sub-marks"(el) {
      const comp = this.findComp(el.dataset.comp);
      if (!comp) return;
      const sub = comp.subcomponents.find(s => s.id === el.dataset.sub);
      if (sub) {
        sub.totalMarks = el.value === "" ? null : Number(el.value);
        Storage.syncSub(sub).catch(console.error);
      }
    },
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
