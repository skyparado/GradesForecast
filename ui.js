/* ============================================================================
 * ui.js — pure HTML builders, three screens
 * ========================================================================== */

const UI = {
  esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  },

  fmt(n) {
    return n === null || n === undefined || isNaN(n) ? "—" : n.toFixed(1);
  },

  gradeDotClass(grade, target) {
    if (grade === null || isNaN(grade)) return "grade-dot--none";
    if (grade >= target)      return "grade-dot--high";
    if (grade >= target - 10) return "grade-dot--medium";
    return "grade-dot--low";
  },

  gradeColorClass(grade, target) {
    if (grade === null || isNaN(grade)) return "";
    if (grade >= target)      return "grade--great";
    if (grade >= target - 10) return "grade--ok";
    return "grade--low";
  },

  // ==========================================================================
  // SCREEN 1 — Terms
  // ==========================================================================

  termsScreen(state) {
    const cards = state.terms.map((t) => {
      const count = t.subjects.length;
      return `
        <div class="term-card" data-action="select-term" data-id="${t.id}" title="Open ${this.esc(t.name)}">
          <div class="term-card__body">
            <h3 class="term-card__name">${this.esc(t.name)}</h3>
            <span class="term-card__count">${count} course${count !== 1 ? "s" : ""}</span>
          </div>
          <span class="term-card__arrow">→</span>
          <button class="icon-btn term-card__del" data-action="delete-term" data-id="${t.id}" title="Delete term">✕</button>
        </div>`;
    }).join("");

    return `
      <div class="screen screen--terms">
        <header class="topbar">
          <div class="brand">
            <span class="brand__mark">◆</span>
            <div>
              <h1>Coursemap</h1>
              <p class="brand__tag">Know where you stand.</p>
            </div>
          </div>
          <button class="ghost-btn danger-btn" data-action="reset-all">Reset all</button>
        </header>

        <section class="terms-section">
          <h2 class="section-title">Your terms</h2>
          <div class="terms-grid">
            ${cards}
            <div class="term-card term-card--add">
              <p class="add-card__label">New term</p>
              <input id="new-term-name" type="text" placeholder="e.g. Fall 2026" />
              <button class="primary-btn" data-action="add-term">+ Add term</button>
            </div>
          </div>
        </section>
      </div>`;
  },

  // ==========================================================================
  // SCREEN 2 — Dashboard (all courses in a term)
  // ==========================================================================

  dashboardScreen(term, calibrationLog) {
    if (!term) return `<p class="empty">Term not found.</p>`;

    const priorityHtml = this.priorityBoard(term, calibrationLog);

    const courseCards = term.subjects.map((s) => {
      const grade = Calc.currentGrade(s);
      const range = Calc.gradeRange(s, calibrationLog);
      const dot   = this.gradeDotClass(grade, s.target);
      const gradeColor = this.gradeColorClass(grade, s.target);
      const pct   = grade !== null ? Math.min(100, (grade / s.target) * 100).toFixed(1) : 0;

      const predLine = range && !range.locked
        ? `<span class="course-card__pred">predicted ${range.low.toFixed(0)}–${range.high.toFixed(0)}%</span>` : "";

      const catRows = s.categories.slice(0, 3).map((c) => {
        const avg = Calc.categoryAverage(c);
        return `<div class="course-card__cat">
          <span>${this.esc(c.name)}</span>
          <span>${c.weight}%</span>
          <span class="mono">${avg !== null ? avg.toFixed(0) + "%" : "—"}</span>
        </div>`;
      }).join("");
      const more = s.categories.length > 3
        ? `<div class="course-card__cat course-card__more">+${s.categories.length - 3} more</div>` : "";

      return `
        <div class="course-card" data-action="select-course" data-id="${s.id}">
          <div class="course-card__header">
            <div>
              <h3 class="course-card__name">${this.esc(s.name)}</h3>
              <span class="course-card__target">target ${s.target}%</span>
            </div>
            <div class="course-card__grade-wrap">
              <span class="course-card__grade ${gradeColor}">${this.fmt(grade)}</span>
              <span class="subject-pill__dot ${dot}"></span>
            </div>
          </div>
          <div class="course-card__bar-wrap">
            <div class="course-card__bar-fill" style="width:${pct}%"></div>
          </div>
          ${predLine}
          ${s.categories.length ? `<div class="course-card__cats">${catRows}${more}</div>` : `<p class="course-card__empty">Click to add categories</p>`}
          <div class="course-card__footer">
            <span class="course-card__open">Open →</span>
            <button class="icon-btn course-card__del" data-action="delete-course" data-id="${s.id}" title="Remove course">✕</button>
          </div>
        </div>`;
    }).join("");

    return `
      <div class="screen screen--dashboard">
        <header class="topbar">
          <button class="ghost-btn back-btn" data-action="back-to-terms">← Terms</button>
          <div>
            <h1>${this.esc(term.name)}</h1>
          </div>
        </header>

        ${term.subjects.length ? `
        <section class="priority card">
          <h2 class="priority__title">Focus next</h2>
          <p class="priority__sub">Ranked by impact, gap to target, and confidence</p>
          ${priorityHtml}
        </section>` : ""}

        <section class="courses-section">
          <h2 class="section-title">Courses</h2>
          <div class="courses-grid">
            ${courseCards}
            <div class="course-card course-card--add">
              <p class="add-card__label">New course</p>
              <input id="new-course-name" type="text" placeholder="e.g. Calculus I" />
              <input id="new-course-target" type="number" placeholder="Target %" min="0" max="100" />
              <button class="primary-btn" data-action="add-course">+ Add course</button>
            </div>
          </div>
        </section>
      </div>`;
  },

  priorityBoard(term, calibrationLog) {
    const recs = Calc.recommendations({ subjects: term.subjects }, calibrationLog).slice(0, 5);
    if (!recs.length) return `<p class="empty">Add courses and categories — your priority list will appear here.</p>`;
    return `<ol class="rec-list">${recs.map((r) => `
      <li class="rec rec--${r.level}">
        <span class="rec__dot"></span>
        <div class="rec__text">
          <strong>${this.esc(r.categoryName)}</strong>
          <span class="rec__sub">${this.esc(r.subjectName)} · ${this.esc(r.reason)}</span>
        </div>
        <span class="rec__risk">${r.risk.toFixed(0)}</span>
      </li>`).join("")}</ol>`;
  },

  // ==========================================================================
  // SCREEN 3 — Course editor
  // ==========================================================================

  courseScreen(course, calibrationLog) {
    if (!course) return `<p class="empty">Course not found.</p>`;

    const grade  = Calc.currentGrade(course);
    const range  = Calc.gradeRange(course, calibrationLog);
    const weight = Calc.weightCheck(course);

    const weightWarn = weight.ok ? "" : `
      <div class="warn">Weights add up to ${weight.total}% — adjust categories to total 100% for accurate results.</div>`;

    const predBadge = range && !range.locked ? `
      <span class="pred-badge">Predicted: ${range.low.toFixed(0)}–${range.high.toFixed(0)}%</span>` : "";

    return `
      <div class="screen screen--course">
        <header class="topbar">
          <button class="ghost-btn back-btn" data-action="back-to-dashboard">← Dashboard</button>
          <h1 class="course-title">${this.esc(course.name)}</h1>
        </header>

        <!-- Hero: natural-language grade + final calc -->
        <div class="hero-card card">
          <div class="hero-grade">
            <span class="hero-grade__num">${this.fmt(grade)}<span class="hero-grade__pct">%</span></span>
            <div class="hero-grade__meta">
              <span class="hero-grade__label">current grade</span>
              ${predBadge}
            </div>
          </div>

          <div class="hero-sentences">
            <p class="hero-sentence">
              You want at least
              <input class="inline-edit" type="number" min="0" max="100"
                     value="${course.target}" data-action="set-target" data-id="${course.id}" />%
              in this class.
            </p>
            <p class="hero-sentence">
              Your final is worth
              <input class="inline-edit inline-edit--sm" type="number" min="0" max="100"
                     value="${course.finalWeight || 0}" data-action="set-final-weight" />%
              of your grade.
            </p>
          </div>

          <div class="hero-result-wrap">
            <div class="hero-result" id="final-calc-result">
              ${this.finalCalcResult(course, calibrationLog)}
            </div>
            <label class="hero-conf-label">
              <span>How confident are you about the final?</span>
              <div class="conf-row">
                <input type="range" min="0" max="100" value="${course.finalConfidence ?? 50}"
                       data-action="set-final-confidence" />
                <span class="conf__val" id="final-conf-val">${course.finalConfidence ?? 50}%</span>
              </div>
            </label>
          </div>
        </div>

        ${weightWarn}

        <!-- Categories -->
        <section class="cats-section">
          <h2 class="section-title">Categories</h2>
          ${this.categoryList(course)}
          ${this.addCategoryForm(course)}
        </section>

        <!-- Tools row -->
        <div class="tools-row">
          ${this.whatIfTool(course)}
          ${this.goalTool(course)}
        </div>

        <!-- Calibration insights -->
        ${this.insightsPanel(calibrationLog)}

        <!-- Charts -->
        <div class="charts">
          <div class="chart-card">
            <h3>Grade trend</h3>
            <canvas id="chart-grade" height="160"></canvas>
          </div>
          <div class="chart-card">
            <h3>Confidence by category</h3>
            <canvas id="chart-confidence" height="160"></canvas>
          </div>
        </div>
      </div>`;
  },

  // ---- Final calc result (shared between hero and live update) ---------------

  finalCalcResult(course, calibrationLog) {
    const result = Calc.finalNeeded(course, calibrationLog);
    if (!result) {
      return `<span class="hero-result__empty">Set the final weight above to see what score you need.</span>`;
    }
    if (result.needed > 100) {
      return `<span class="result-impossible">You'd need over 100% on the final — try adjusting your target or recovering more points elsewhere.</span>`;
    }
    const adj = result.adjustedTarget !== course.target
      ? `<span class="result-adj"> (target nudged to ${result.adjustedTarget.toFixed(1)}% — you're confident, so you're banking a little extra)</span>`
      : "";
    const buf = result.safetyBuffer > 0
      ? `<span class="result-buf">+${result.safetyBuffer.toFixed(1)}% safety buffer added based on your calibration history</span>`
      : "";
    return `
      <span class="hero-result__label">You need</span>
      <strong class="result-num">${result.adjusted.toFixed(1)}%</strong>
      <span class="hero-result__label">on your final.${adj}</span>
      ${buf}`;
  },

  // ---- Category list --------------------------------------------------------

  categoryList(course) {
    if (!course.categories.length) {
      return `<p class="empty">No categories yet — add your first one below (e.g. Exams, Homework, Quizzes).</p>`;
    }

    return `<div class="cat-list">${course.categories.map((cat) => {
      const avg      = Calc.categoryAverage(cat);
      const risk     = Calc.categoryRisk(course, cat);
      const level    = Calc.riskLevel(risk);
      const drift    = Calc.confidenceDrift(cat);
      const days     = Calc.daysUntil(cat.deadline);
      const pressure = Calc.deadlinePressure(cat);

      const deadlineChip = cat.deadline ? (() => {
        if (days < 0)  return `<span class="chip chip--red">overdue</span>`;
        if (days <= 7) return `<span class="chip chip--red">${days}d left</span>`;
        if (days <= 14) return `<span class="chip chip--amber">${days}d left</span>`;
        return `<span class="chip chip--green">${days}d left</span>`;
      })() : "";

      const driftChip = drift && drift.drifting
        ? `<span class="chip chip--amber">↓ confidence ${drift.from}→${drift.to}%</span>` : "";

      return `
        <div class="cat">
          <div class="cat__head">
            <div class="cat__title-row">
              <strong class="cat__name">${this.esc(cat.name)}</strong>
              <span class="risk-badge risk-badge--${level}">${level} risk</span>
              ${deadlineChip}${driftChip}
            </div>
            <div class="cat__stats">
              <span class="cat__avg-label">avg</span>
              <span class="cat__avg">${avg !== null ? avg.toFixed(1) + "%" : "—"}</span>
            </div>
            <button class="icon-btn" data-action="delete-category" data-id="${cat.id}" title="Delete category">✕</button>
          </div>

          ${pressure > 0.3 ? `<div class="deadline-bar-wrap"><div class="deadline-bar-fill" style="width:${(pressure * 100).toFixed(0)}%"></div></div>` : ""}

          <div class="cat__controls">
            <label class="ctrl-label">
              Weight
              <div class="ctrl-input-wrap">
                <input type="number" min="0" max="100" value="${cat.weight}"
                  data-action="set-weight" data-id="${cat.id}" class="ctrl-num" />
                <span class="ctrl-unit">%</span>
              </div>
            </label>
            <label class="ctrl-label conf">
              Confidence
              <div class="conf-row">
                <input type="range" min="0" max="100" value="${cat.confidence}"
                  data-action="set-confidence" data-id="${cat.id}" />
                <span class="conf__val">${cat.confidence}%</span>
              </div>
            </label>
            <label class="ctrl-label">
              Deadline
              <input type="date" value="${cat.deadline || ""}"
                data-action="set-deadline" data-id="${cat.id}" class="ctrl-date" />
            </label>
          </div>

          ${this.scoreList(cat)}
          ${this.addScoreForm(cat)}
        </div>`;
    }).join("")}</div>`;
  },

  scoreList(cat) {
    if (!cat.scores.length) return `<p class="scores-empty">No scores yet.</p>`;
    return `<ul class="score-list">${cat.scores.map((s) => {
      const pct     = s.max > 0 ? ((s.score / s.max) * 100).toFixed(0) : 0;
      const confTag = s.confidenceAtEntry !== null
        ? `<span class="score-conf" title="Confidence when entered">${s.confidenceAtEntry}% conf</span>` : "";
      return `<li>
        <span class="score-label">${this.esc(s.label)}</span>
        <span class="score-val">${s.score}/${s.max} <em>${pct}%</em></span>
        ${confTag}
        <button class="icon-btn" data-action="delete-score" data-id="${cat.id}" data-score="${s.id}" title="Remove score">✕</button>
      </li>`;
    }).join("")}</ul>`;
  },

  addScoreForm(cat) {
    return `
      <div class="add-score-form mini-form" data-cat="${cat.id}">
        <input type="text" placeholder="Label (e.g. Quiz 1)" data-field="label" />
        <input type="number" placeholder="Score" data-field="score" />
        <span class="slash">/</span>
        <input type="number" placeholder="Max" data-field="max" />
        <input type="number" min="0" max="100" placeholder="Conf %" data-field="confidence-at-entry"
               title="How confident were you before seeing the result?" />
        <button data-action="add-score" data-id="${cat.id}" class="add-score-btn">+ Add</button>
      </div>`;
  },

  addCategoryForm(course) {
    return `
      <div class="add-cat-form mini-form" data-course="${course.id}">
        <input type="text" placeholder="Category name (e.g. Exams)" data-field="name" />
        <input type="number" placeholder="Weight %" data-field="weight" />
        <button data-action="add-category" data-id="${course.id}" class="primary-btn">+ Add category</button>
      </div>`;
  },

  // ---- What-if tool ---------------------------------------------------------

  whatIfTool(course) {
    const opts     = course.categories.map((c) => `<option value="${c.id}">${this.esc(c.name)}</option>`).join("");
    const disabled = course.categories.length ? "" : "disabled";
    return `
      <div class="tool-card" data-course="${course.id}">
        <h3>What if…</h3>
        <p class="tool-hint">See how one more score would move your grade.</p>
        <div class="mini-form">
          <select data-field="wi-cat" ${disabled}>${opts || `<option>— add categories first —</option>`}</select>
          <input type="number" placeholder="Score" data-field="wi-score" ${disabled} />
          <span class="slash">/</span>
          <input type="number" placeholder="Max" data-field="wi-max" ${disabled} />
          <button data-action="what-if" data-id="${course.id}" ${disabled}>Simulate</button>
        </div>
        <p class="tool-result" id="what-if-result"></p>
      </div>`;
  },

  // ---- Goal tool ------------------------------------------------------------

  goalTool(course) {
    const g = Calc.goalNeeded(course);
    let msg;
    if (g.status === "no-remaining")   msg = `Every category has a score — your grade is final.`;
    else if (g.status === "already-met") msg = `You've already hit your ${g.target}% target — you're good.`;
    else if (g.status === "impossible")  msg = `Reaching ${g.target}% requires over 100% on the remaining ${g.remainingWeight.toFixed(0)}% of the grade. Consider adjusting your target.`;
    else msg = `Average <strong>${g.needed.toFixed(1)}%</strong> on the remaining ${g.remainingWeight.toFixed(0)}% to finish at ${g.target}%.`;
    return `
      <div class="tool-card">
        <h3>Goal calculator</h3>
        <p class="tool-hint">What do you need to average on remaining work?</p>
        <p class="tool-result">${msg}</p>
      </div>`;
  },

  // ---- Calibration insights panel ------------------------------------------

  insightsPanel(calibrationLog) {
    const cal = Calc.calibrationSummary(calibrationLog);
    if (!cal.ready) {
      const needed = Math.max(0, 3 - cal.count);
      return `
        <div class="insights-panel insights-panel--building">
          <h3 class="insights-title">Personal calibration model</h3>
          <p class="insights-body">
            Add <strong>${needed} more score${needed === 1 ? "" : "s"} with confidence ratings</strong>
            (the "Conf %" field when adding a score) to unlock your personal prediction model.
          </p>
          <div class="cal-progress-wrap">
            <div class="cal-progress-fill" style="width:${Math.round((cal.count / 3) * 100)}%"></div>
          </div>
          <span class="cal-progress-label">${cal.count} / 3 data points</span>
        </div>`;
    }
    const tendencyColor = cal.tendency === "well-calibrated" ? "var(--low)"
                        : cal.tendency === "underconfident"  ? "var(--brand)"
                        : "var(--amber)";
    const tendencyMsg = cal.tendency === "well-calibrated"
      ? "Your confidence ratings match your actual scores really well."
      : cal.tendency === "underconfident"
      ? `You typically score <strong>${Math.abs(cal.avgOffset)}% higher</strong> than your confidence suggests — your gut undersells you.`
      : `You typically score <strong>${Math.abs(cal.avgOffset)}% lower</strong> than your confidence suggests — factor that in.`;
    return `
      <div class="insights-panel">
        <h3 class="insights-title">Personal calibration model
          <span class="insights-badge" style="background:${tendencyColor}20;color:${tendencyColor}">${cal.tendency}</span>
        </h3>
        <p class="insights-body">${tendencyMsg}</p>
        <div class="insights-stats">
          <div class="insights-stat">
            <span class="insights-stat__val">${cal.count}</span>
            <span class="insights-stat__label">data points</span>
          </div>
          <div class="insights-stat">
            <span class="insights-stat__val">${cal.avgOffset > 0 ? "+" : ""}${cal.avgOffset}%</span>
            <span class="insights-stat__label">avg offset</span>
          </div>
          <div class="insights-stat">
            <span class="insights-stat__val">${(cal.r2 * 100).toFixed(0)}%</span>
            <span class="insights-stat__label">model fit</span>
          </div>
        </div>
      </div>`;
  },
};
