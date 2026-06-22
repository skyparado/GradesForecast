/* ============================================================================
 * ui.js
 * ----------------------------------------------------------------------------
 * Turns app state into HTML strings. These functions DON'T save, fetch, or
 * attach event listeners — main.js does all of that. Splitting "what it looks
 * like" (here) from "what it does" (main.js) keeps both halves easy to follow.
 *
 * Buttons/inputs carry data-action and data-id attributes. main.js listens
 * once on a parent element and reacts based on those — a pattern called event
 * delegation, which means we don't re-bind listeners every time we re-render.
 * ========================================================================== */

const UI = {
  // Escape user text so a subject named "<b>" can't break the page.
  esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  },

  fmt(n) {
    return n === null || n === undefined || isNaN(n) ? "—" : n.toFixed(1);
  },

  // --- The signature panel: what to focus on, across every subject ----------
  priorityBoard(state) {
    const recs = Calc.recommendations(state).slice(0, 5);
    if (!recs.length) {
      return `<p class="empty">Add a subject and some categories below, and your
        priorities will appear here — ranked by how much they need your attention.</p>`;
    }
    const rows = recs
      .map(
        (r) => `
        <li class="rec rec--${r.level}">
          <span class="rec__dot"></span>
          <div class="rec__text">
            <strong>${this.esc(r.categoryName)}</strong>
            <span class="rec__sub">${this.esc(r.subjectName)} · ${this.esc(r.reason)}</span>
          </div>
          <span class="rec__risk">${r.risk.toFixed(0)}</span>
        </li>`
      )
      .join("");
    return `<ol class="rec-list">${rows}</ol>`;
  },

  // --- Left column: the list of subjects ------------------------------------
  subjectList(state, selectedId) {
    if (!state.subjects.length) return "";
    return state.subjects
      .map((s) => {
        const grade = Calc.currentGrade(s);
        const active = s.id === selectedId ? " is-active" : "";
        return `
        <button class="subject-pill${active}" data-action="select-subject" data-id="${s.id}">
          <span>${this.esc(s.name)}</span>
          <span class="subject-pill__grade">${this.fmt(grade)}</span>
        </button>`;
      })
      .join("");
  },

  // --- Main column: everything about the selected subject -------------------
  subjectDetail(subject) {
    if (!subject) {
      return `<p class="empty">Select a subject on the left, or add your first one to begin.</p>`;
    }

    const grade = Calc.currentGrade(subject);
    const weight = Calc.weightCheck(subject);
    const weightWarn = weight.ok
      ? ""
      : `<p class="warn">Your category weights add up to ${weight.total}%, not 100%.
         Grades will still calculate, but they're most accurate at 100%.</p>`;

    return `
      <div class="detail-head">
        <div>
          <h2>${this.esc(subject.name)}</h2>
          <label class="target">Target grade
            <input type="number" min="0" max="100" value="${subject.target}"
                   data-action="set-target" data-id="${subject.id}" />
          </label>
        </div>
        <div class="grade-now">
          <span class="grade-now__num">${this.fmt(grade)}</span>
          <span class="grade-now__label">current grade</span>
        </div>
      </div>
      ${weightWarn}

      ${this.categoryTable(subject)}
      ${this.addCategoryForm(subject)}

      <div class="tools">
        ${this.whatIfTool(subject)}
        ${this.goalTool(subject)}
      </div>

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
    `;
  },

  categoryTable(subject) {
    if (!subject.categories.length) {
      return `<p class="empty small">No categories yet. Add one below (e.g. Exams 40%, Quizzes 20%).</p>`;
    }
    const rows = subject.categories
      .map((cat) => {
        const avg = Calc.categoryAverage(cat);
        const risk = Calc.categoryRisk(subject, cat);
        const level = Calc.riskLevel(risk);
        return `
        <div class="cat">
          <div class="cat__head">
            <strong>${this.esc(cat.name)}</strong>
            <span class="risk-badge risk-badge--${level}">${level} risk</span>
            <button class="icon-btn" title="Delete category"
              data-action="delete-category" data-id="${cat.id}">✕</button>
          </div>

          <div class="cat__controls">
            <label>Weight %
              <input type="number" min="0" max="100" value="${cat.weight}"
                data-action="set-weight" data-id="${cat.id}" />
            </label>
            <label class="conf">Confidence
              <input type="range" min="0" max="100" value="${cat.confidence}"
                data-action="set-confidence" data-id="${cat.id}" />
              <span class="conf__val">${cat.confidence}%</span>
            </label>
            <span class="cat__avg">avg ${avg === null ? "—" : avg.toFixed(0) + "%"}</span>
          </div>

          ${this.scoreList(cat)}
          ${this.addScoreForm(cat)}
        </div>`;
      })
      .join("");
    return `<div class="cat-list">${rows}</div>`;
  },

  scoreList(cat) {
    if (!cat.scores.length) return "";
    const items = cat.scores
      .map(
        (s) => `
        <li>
          <span>${this.esc(s.label)}</span>
          <span class="score-val">${s.score}/${s.max}
            <em>${s.max > 0 ? ((s.score / s.max) * 100).toFixed(0) : 0}%</em></span>
          <button class="icon-btn" title="Delete score"
            data-action="delete-score" data-id="${cat.id}" data-score="${s.id}">✕</button>
        </li>`
      )
      .join("");
    return `<ul class="score-list">${items}</ul>`;
  },

  addScoreForm(cat) {
    return `
      <div class="mini-form" data-cat="${cat.id}">
        <input type="text" placeholder="Label (e.g. Quiz 1)" data-field="label" />
        <input type="number" placeholder="Score" data-field="score" />
        <span class="slash">/</span>
        <input type="number" placeholder="Max" data-field="max" />
        <button data-action="add-score" data-id="${cat.id}">Add score</button>
      </div>`;
  },

  addCategoryForm(subject) {
    return `
      <div class="mini-form add-cat" data-subject="${subject.id}">
        <input type="text" placeholder="Category name (e.g. Exams)" data-field="name" />
        <input type="number" placeholder="Weight %" data-field="weight" />
        <button data-action="add-category" data-id="${subject.id}">Add category</button>
      </div>`;
  },

  whatIfTool(subject) {
    const options = subject.categories
      .map((c) => `<option value="${c.id}">${this.esc(c.name)}</option>`)
      .join("");
    const disabled = subject.categories.length ? "" : "disabled";
    return `
      <div class="tool-card" data-subject="${subject.id}">
        <h3>What if…</h3>
        <p class="tool-hint">See how one more score would move your current grade.</p>
        <div class="mini-form">
          <select data-field="wi-cat" ${disabled}>${options}</select>
          <input type="number" placeholder="Score" data-field="wi-score" ${disabled} />
          <span class="slash">/</span>
          <input type="number" placeholder="Max" data-field="wi-max" ${disabled} />
          <button data-action="what-if" data-id="${subject.id}" ${disabled}>Simulate</button>
        </div>
        <p class="tool-result" id="what-if-result"></p>
      </div>`;
  },

  goalTool(subject) {
    const g = Calc.goalNeeded(subject);
    let msg;
    if (g.status === "no-remaining") {
      msg = `Every category already has a score, so there's no remaining work to model.
             Your grade is set by what's entered.`;
    } else if (g.status === "already-met") {
      msg = `You've already secured your ${g.target} target — anything reasonable keeps you there.`;
    } else if (g.status === "impossible") {
      msg = `Reaching ${g.target} would need over 100% on the remaining ${g.remainingWeight.toFixed(0)}%
             of weight, which isn't possible. Consider adjusting the target.`;
    } else {
      msg = `To finish at ${g.target}, average <strong>${g.needed.toFixed(1)}%</strong>
             across the remaining ${g.remainingWeight.toFixed(0)}% of your grade.`;
    }
    return `
      <div class="tool-card">
        <h3>Goal calculator</h3>
        <p class="tool-hint">Based on your target grade above.</p>
        <p class="tool-result">${msg}</p>
      </div>`;
  },
};
