/* ============================================================================
 * ui.js — HTML builders for all 4 screens
 * ========================================================================== */

const UI = {
  esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  },

  confLabel(lvl) { return ["LOW", "MEDIUM", "HIGH"][Number(lvl)] ?? "MEDIUM"; },
  confVal(lvl)   { return Calc.cv(lvl); },

  // ==========================================================================
  // PAGE 1 — Home
  // ==========================================================================
  homeScreen(state) {
    const cards = state.terms.map(t => `
      <div class="term-card" data-action="select-term" data-id="${t.id}">
        <span class="term-card__name">${this.esc(t.name)}</span>
        <span class="term-card__count">${t.courses.length} course${t.courses.length !== 1 ? "s" : ""}</span>
        <button class="term-card__del" data-action="delete-term" data-id="${t.id}" title="Delete">✕</button>
      </div>`).join("");

    return `
      <div class="screen screen--home">
        <header class="home-header">
          <div class="home-brand">
            <div class="home-brand__icon">◆</div>
            <div>
              <h1 class="home-brand__title">DL Planner</h1>
              <p class="home-brand__sub">Dean's List grade tracker</p>
            </div>
          </div>
          <button class="ghost-btn danger" data-action="reset-all">Reset all</button>
        </header>

        <p class="section-eyebrow">choose term</p>
        <div class="terms-grid">
          ${cards}
          <div class="term-card term-card--add" data-action="prompt-add-term">
            <div class="add-card__icon">+</div>
            <span class="add-card__label">add new term</span>
          </div>
        </div>
      </div>`;
  },

  // ==========================================================================
  // PAGE 2 — Summary (form table)
  // ==========================================================================
  summaryScreen(term) {
    if (!term) return `<p class="empty">Term not found.</p>`;

    const dl      = term.dlTarget || 3.0;
    const projGWA = Calc.termProjGWA(term.courses);
    const goalGWA = Calc.termGoalGWA(term.courses);
    const gap     = Calc.dlGap(term.courses, dl);
    const unreachable = gap !== null && gap > 0;

    const gwaBar = term.courses.length ? `
      <div class="gwa-bar">
        <div class="gwa-bar__stat">
          <span class="gwa-bar__label">Projected GWA</span>
          <span class="gwa-bar__val gwa-bar__val--proj">${Calc.fmt(projGWA)}</span>
        </div>
        <div class="gwa-bar__divider"></div>
        <div class="gwa-bar__stat">
          <span class="gwa-bar__label">Goal GWA</span>
          <span class="gwa-bar__val gwa-bar__val--goal">${Calc.fmt(goalGWA)}</span>
        </div>
        <div class="gwa-bar__divider"></div>
        <div class="gwa-bar__stat">
          <span class="gwa-bar__label">Target</span>
          <span class="gwa-bar__val gwa-bar__val--target">${dl.toFixed(2)}</span>
        </div>
      </div>` : "";

    const banner = unreachable ? `
      <div class="dl-banner dl-banner--warn">
        ⚠ DL not achievable under current projections — goal GWA is ${Calc.fmt(goalGWA)}, target is ${dl.toFixed(2)}.
        Push: ${Calc.subjectsToPush(term.courses).slice(0, 2).map(c => this.esc(c.name)).join(", ")}.
      </div>` : (term.courses.length && !unreachable && gap !== null ? `
      <div class="dl-banner dl-banner--ok">
        ✓ On track — goal GWA ${Calc.fmt(goalGWA)} meets ${dl.toFixed(2)} target.
      </div>` : "");

    const STATUS_ICON = { green: "✓", yellow: "~", red: "!", grey: "—" };

    const rows = term.courses.map(course => {
      const status   = Calc.cardStatus(course, dl);
      const cProjGWA = Calc.courseProjGWA(course);

      const statusCell = `<span class="status-dot status-dot--${status}"
        title="${{ green:"On track", yellow:"Close to target", red:"At risk", grey:"No data" }[status]}">
        ${STATUS_ICON[status]}</span>`;

      const actions = `
        <button class="icon-btn" data-action="open-course-editor" data-id="${course.id}" title="Edit structure">✎</button>
        <button class="icon-btn icon-btn--danger" data-action="remove-course" data-id="${course.id}" title="Remove">✕</button>`;

      const nameCell = `
        <span class="cf-name__code">${this.esc(course.name)}</span>
        ${course.fullName ? `<span class="cf-name__full">${this.esc(course.fullName)}</span>` : ""}`;

      // ---- flat grade (e.g. PE) ------------------------------------------
      if (course.flatGrade) {
        const val = course.flatScore !== null ? String(course.flatScore) : "";
        return `
          <tr class="course-row course-row--${status}">
            <td class="cf-name">${nameCell}</td>
            <td class="cf-units">${course.units}</td>
            <td class="cf-grade">
              <div class="grade-input-wrap">
                <input type="number" min="0" max="100" step="0.01" class="grade-input"
                       value="${this.esc(val)}" placeholder="—"
                       data-action="set-flat-score" data-course="${course.id}" />
                <span class="grade-pct-sign">%</span>
              </div>
            </td>
            <td class="cf-gwa"><span class="gwa-chip">${Calc.fmt(cProjGWA, 1)}</span></td>
            <td class="cf-status">${statusCell}</td>
            <td class="cf-actions">${actions}</td>
          </tr>`;
      }

      // ---- no components --------------------------------------------------
      if (!course.components.length) {
        return `
          <tr class="course-row course-row--grey">
            <td class="cf-name">${nameCell}</td>
            <td class="cf-units">${course.units}</td>
            <td class="cf-grade"><span class="multi-label">no components</span></td>
            <td class="cf-gwa">—</td>
            <td class="cf-status">${statusCell}</td>
            <td class="cf-actions">${actions}</td>
          </tr>`;
      }

      // ---- single leaf component (simple course) --------------------------
      const isSimple = course.components.length === 1 &&
                       course.components[0].subcomponents.length === 0;
      if (isSimple) {
        const comp = course.components[0];
        const pct  = comp.realScore !== null && comp.totalMarks > 0
          ? (comp.realScore / comp.totalMarks * 100).toFixed(2) : "";
        return `
          <tr class="course-row course-row--${status}">
            <td class="cf-name">${nameCell}</td>
            <td class="cf-units">${course.units}</td>
            <td class="cf-grade">
              <div class="grade-input-wrap">
                <input type="number" min="0" max="100" step="0.01" class="grade-input"
                       value="${pct}" placeholder="—"
                       data-action="set-course-pct" data-course="${course.id}" />
                <span class="grade-pct-sign">%</span>
              </div>
            </td>
            <td class="cf-gwa"><span class="gwa-chip">${Calc.fmt(cProjGWA, 1)}</span></td>
            <td class="cf-status">${statusCell}</td>
            <td class="cf-actions">${actions}</td>
          </tr>`;
      }

      // ---- multi-component course -----------------------------------------
      const compRows = course.components.flatMap(comp => {
        // Component with subcomponents — no direct input, show sub-rows
        if (comp.subcomponents.length) {
          const subRows = comp.subcomponents.map(sub => {
            const spct = sub.realScore !== null && sub.totalMarks > 0
              ? (sub.realScore / sub.totalMarks * 100).toFixed(2) : "";
            return `
              <tr class="course-row course-row--sub course-row--sub2">
                <td class="cf-name cf-name--sub2">
                  <span class="sub-indent">↳</span>${this.esc(sub.name)}
                  ${sub.locked ? `<span class="locked-tag">locked</span>` : ""}
                </td>
                <td class="cf-units">—</td>
                <td class="cf-grade">
                  <div class="grade-input-wrap">
                    <input type="number" min="0" max="100" step="0.01" class="grade-input"
                           value="${spct}" placeholder="—"
                           data-action="set-sub-pct"
                           data-course="${course.id}" data-comp="${comp.id}" data-sub="${sub.id}" />
                    <span class="grade-pct-sign">%</span>
                  </div>
                </td>
                <td class="cf-gwa">—</td>
                <td class="cf-status"></td>
                <td class="cf-actions"></td>
              </tr>`;
          });

          return [`
            <tr class="course-row course-row--sub">
              <td class="cf-name cf-name--sub">
                <span class="sub-indent">↳</span>${this.esc(comp.name)}
                <span class="comp-weight-tag">${comp.weight}%</span>
                <span class="multi-label">${comp.subcomponents.length} items</span>
              </td>
              <td class="cf-units">—</td>
              <td class="cf-grade"></td>
              <td class="cf-gwa">—</td>
              <td class="cf-status"></td>
              <td class="cf-actions"></td>
            </tr>`,
            ...subRows,
          ];
        }

        // Leaf component — direct input
        const cpct = comp.realScore !== null && comp.totalMarks > 0
          ? (comp.realScore / comp.totalMarks * 100).toFixed(2) : "";
        return [`
          <tr class="course-row course-row--sub">
            <td class="cf-name cf-name--sub">
              <span class="sub-indent">↳</span>${this.esc(comp.name)}
              <span class="comp-weight-tag">${comp.weight}%</span>
              ${comp.locked ? `<span class="locked-tag">locked</span>` : ""}
            </td>
            <td class="cf-units">—</td>
            <td class="cf-grade">
              <div class="grade-input-wrap">
                <input type="number" min="0" max="100" step="0.01" class="grade-input"
                       value="${cpct}" placeholder="—"
                       data-action="set-comp-pct"
                       data-course="${course.id}" data-comp="${comp.id}" />
                <span class="grade-pct-sign">%</span>
              </div>
            </td>
            <td class="cf-gwa">—</td>
            <td class="cf-status"></td>
            <td class="cf-actions"></td>
          </tr>`];
      }).join("");

      return `
        <tr class="course-row course-row--header course-row--${status}">
          <td class="cf-name">${nameCell}</td>
          <td class="cf-units">${course.units}</td>
          <td class="cf-grade cf-grade--multi">
            <span class="multi-label">${course.components.length} components</span>
          </td>
          <td class="cf-gwa"><span class="gwa-chip">${Calc.fmt(cProjGWA, 1)}</span></td>
          <td class="cf-status">${statusCell}</td>
          <td class="cf-actions">${actions}</td>
        </tr>
        ${compRows}`;
    }).join("");

    return `
      <div class="screen screen--summary">
        <header class="topbar">
          <button class="back-btn" data-action="back-to-home">← Home</button>
          <h1 class="topbar__title">${this.esc(term.name)}</h1>
        </header>

        <div class="dl-toggle">
          <button class="dl-toggle__btn ${dl >= 3.4 ? "active" : ""}"
                  data-action="set-dl" data-val="3.4">
            1st DL <span class="dl-toggle__range">3.40+</span>
          </button>
          <button class="dl-toggle__btn ${dl < 3.4 ? "active" : ""}"
                  data-action="set-dl" data-val="3.0">
            2nd DL <span class="dl-toggle__range">3.00–3.39</span>
          </button>
        </div>

        ${gwaBar}
        ${banner}

        ${term.courses.length ? `
        <div class="course-form-wrap">
          <table class="course-form-table">
            <thead>
              <tr>
                <th class="cf-name">Course</th>
                <th class="cf-units">Units</th>
                <th class="cf-grade">Grade %</th>
                <th class="cf-gwa">GWA</th>
                <th class="cf-status"></th>
                <th class="cf-actions"></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : ""}

        <button class="add-course-row-btn" data-action="add-course">+ Add course</button>
      </div>`;
  },

  // ==========================================================================
  // PAGE 3 — Score Editor
  // ==========================================================================
  scoreEditorScreen(course) {
    if (!course) return `<p class="empty">Course not found.</p>`;

    const projGWA = Calc.courseProjGWA(course);
    const goalGWA = Calc.courseGoalGWA(course);

    const rows = [];
    for (const comp of course.components) {
      const goalPct = Calc.cv(comp.confidence);

      if (comp.subcomponents.length === 0) {
        rows.push(this.scoreRow(comp.id, "", comp.name, comp, goalPct));
      } else {
        rows.push(`
          <tr class="score-comp-header">
            <td colspan="4">${this.esc(comp.name)}</td>
            <td class="score-comp-weight">${comp.weight}%</td>
          </tr>`);
        for (const sub of comp.subcomponents) {
          rows.push(this.scoreRow(comp.id, sub.id, sub.name, sub, goalPct));
        }
      }
    }

    const noComps = !course.components.length
      ? `<tr><td colspan="5" class="score-empty">No components — set up the course first.</td></tr>` : "";

    return `
      <div class="screen screen--score-editor">
        <header class="topbar">
          <button class="back-btn" data-action="back-to-summary">← Summary</button>
          <h1 class="topbar__title">${this.esc(course.name)}</h1>
        </header>

        <div class="score-table-wrap">
          <table class="score-table">
            <thead>
              <tr>
                <th></th>
                <th>placeholder score</th>
                <th>real score</th>
                <th>percentage</th>
                <th>goal %</th>
              </tr>
            </thead>
            <tbody>
              ${noComps}
              ${rows.join("")}
            </tbody>
          </table>
        </div>

        <div class="score-footer">
          <div class="score-footer__gwa">
            <span class="score-footer__label">cumulative current:</span>
            <span class="score-footer__val">${Calc.fmt(projGWA)}</span>
            <span class="score-footer__sep">·</span>
            <span class="score-footer__label">goal:</span>
            <span class="score-footer__val score-footer__val--goal">${Calc.fmt(goalGWA)}</span>
          </div>
          <div class="score-footer__actions">
            <button class="btn-primary" data-action="save-scores">Save</button>
            <button class="btn-ghost" data-action="open-course-editor" data-id="${course.id}">Edit course</button>
            <button class="btn-ghost btn-danger" data-action="remove-course" data-id="${course.id}">Remove</button>
          </div>
        </div>
      </div>`;
  },

  scoreRow(compId, subId, name, entity, goalPct) {
    const isLocked = entity.locked;
    const hasReal  = entity.realScore !== null && Number(entity.totalMarks) > 0;

    let phCell, realCell, pctCell;

    if (isLocked && hasReal) {
      const pct = (entity.realScore / entity.totalMarks) * 100;
      const cls = pct >= goalPct ? "pct--green" : "pct--red";
      const icon = pct >= goalPct ? "🟢" : "🔴";
      phCell   = `<td class="score-ph score-ph--empty">—</td>`;
      realCell = `
        <td class="score-real score-real--locked">
          ${entity.realScore}/${entity.totalMarks}
          <button class="unlock-btn" data-action="unlock-score"
                  data-comp="${compId}" data-sub="${subId}">edit</button>
        </td>`;
      pctCell  = `<td class="score-pct ${cls}">${pct.toFixed(0)}% ${icon}</td>`;
    } else {
      const phNum = entity.totalMarks
        ? Math.round(goalPct / 100 * entity.totalMarks) : null;
      const phDisplay = phNum !== null
        ? `${phNum}/${entity.totalMarks}` : `${goalPct}%`;

      phCell   = `<td class="score-ph">${phDisplay}</td>`;
      realCell = `
        <td class="score-real">
          <div class="score-inputs">
            <input type="number" min="0" class="score-num" placeholder="score"
                   value="${entity.realScore ?? ""}"
                   data-action="set-real-score" data-comp="${compId}" data-sub="${subId}" />
            <span class="score-slash">/</span>
            <input type="number" min="1" class="score-den" placeholder="total"
                   value="${entity.totalMarks ?? ""}"
                   data-action="set-total-marks" data-comp="${compId}" data-sub="${subId}" />
          </div>
          ${hasReal ? `<span class="score-draft">unsaved</span>` : ""}
        </td>`;
      pctCell  = `<td class="score-pct score-pct--auto">(auto)</td>`;
    }

    return `
      <tr class="score-row ${isLocked && hasReal ? "score-row--locked" : ""} ${!subId ? "score-row--comp" : "score-row--sub"}">
        <td class="score-name">${this.esc(name)}</td>
        ${phCell}
        ${realCell}
        ${pctCell}
        <td class="score-goal">${goalPct}%</td>
      </tr>`;
  },

  // ==========================================================================
  // PAGE 4 — Course Editor
  // ==========================================================================
  courseEditorScreen(course) {
    if (!course) return `<p class="empty">Course not found.</p>`;

    const wCheck = Calc.weightCheck(course);

    const compBlocks = course.components.map(comp => {
      const subRows = comp.subcomponents.map(sub => `
        <div class="sub-row" data-sub-id="${sub.id}">
          <span class="sub-bullet">•</span>
          <input class="sub-name-input" type="text" value="${this.esc(sub.name)}"
                 data-action="set-sub-name" data-comp="${comp.id}" data-sub="${sub.id}" />
          <div class="sub-marks">
            <span class="sub-marks__slash">/</span>
            <input type="number" min="1" class="sub-marks-input" placeholder="total marks"
                   value="${sub.totalMarks ?? ""}"
                   data-action="set-sub-marks" data-comp="${comp.id}" data-sub="${sub.id}" />
          </div>
          <button class="icon-btn" data-action="delete-subcomp"
                  data-comp="${comp.id}" data-sub="${sub.id}" title="Remove">✕</button>
        </div>`).join("");

      return `
        <div class="comp-block" data-comp-id="${comp.id}">
          <div class="comp-block__header">
            <input class="comp-name-input" type="text" value="${this.esc(comp.name)}"
                   data-action="set-comp-name" data-id="${comp.id}" />
            <div class="comp-weight-wrap">
              <input type="number" min="0" max="100" class="comp-weight-input"
                     value="${comp.weight}"
                     data-action="set-comp-weight" data-id="${comp.id}" />
              <span class="comp-weight-unit">%</span>
            </div>
            <button class="icon-btn icon-btn--danger" data-action="delete-comp"
                    data-id="${comp.id}" title="Delete component">✕</button>
          </div>

          <div class="comp-conf">
            <span class="comp-conf__label">confidence</span>
            <div class="conf-slider-wrap">
              <span class="conf-slider__edge">LOW</span>
              <input type="range" min="0" max="2" step="1" class="conf-slider"
                     value="${comp.confidence}"
                     data-action="set-comp-conf" data-id="${comp.id}" />
              <span class="conf-slider__edge">HIGH</span>
              <span class="conf-slider__val conf-val--${comp.confidence}">${this.confLabel(comp.confidence)}</span>
            </div>
          </div>

          <div class="subcomp-list">
            ${subRows}
          </div>

          <button class="add-sub-btn" data-action="add-subcomp" data-id="${comp.id}">
            + add subcomponent
          </button>
        </div>`;
    }).join("");

    return `
      <div class="screen screen--course-editor">
        <header class="topbar">
          <button class="back-btn" data-action="back-to-summary">← Summary</button>
          <div class="topbar__center">
            <input class="course-name-input" type="text" value="${this.esc(course.name)}"
                   data-action="set-course-name" data-id="${course.id}" placeholder="Course code" />
            <input class="course-fullname-input" type="text" value="${this.esc(course.fullName)}"
                   data-action="set-course-full-name" data-id="${course.id}" placeholder="Full name (optional)" />
            <span class="topbar__sub">edit course</span>
          </div>
          <div class="threshold-toggle">
            <button class="threshold-btn ${course.passingThreshold === 60 ? "active" : ""}"
                    data-action="set-threshold" data-id="${course.id}" data-val="60">60%</button>
            <button class="threshold-btn ${course.passingThreshold === 70 ? "active" : ""}"
                    data-action="set-threshold" data-id="${course.id}" data-val="70">70%</button>
          </div>
        </header>

        <div class="editor-section">
          <div class="editor-row">
            <div class="editor-field">
              <label class="editor-label">CONFIDENCE LEVEL</label>
              <div class="conf-slider-wrap conf-slider-wrap--lg">
                <span class="conf-slider__edge">LOW</span>
                <input type="range" min="0" max="2" step="1" class="conf-slider conf-slider--lg"
                       value="${course.overallConfidence}"
                       data-action="set-overall-conf" data-id="${course.id}" />
                <span class="conf-slider__edge">HIGH</span>
                <span class="conf-slider__val conf-slider__val--lg conf-val--${course.overallConfidence}">
                  ${this.confLabel(course.overallConfidence)}
                </span>
              </div>
              <p class="conf-hint">
                → ${this.confVal(course.overallConfidence)}% target
                (GWA ${Calc.gwa(this.confVal(course.overallConfidence), course.passingThreshold).toFixed(1)})
              </p>
            </div>

            <div class="editor-field editor-field--sm">
              <label class="editor-label">UNITS</label>
              <input type="number" min="1" max="12" class="units-input"
                     value="${course.units}"
                     data-action="set-units" data-id="${course.id}" />
            </div>
          </div>
        </div>

        ${course.flatGrade ? `
        <div class="editor-section">
          <p class="flat-grade-note">This course uses a flat grade (no components). Enter the final grade % on the summary screen.</p>
        </div>` : `
        <div class="editor-section">
          <div class="editor-section__head">
            <h2 class="editor-section__title">COMPONENTS</h2>
            <div class="weight-counter ${wCheck.ok ? "weight-counter--ok" : "weight-counter--warn"}">
              ${wCheck.total.toFixed(0)}% / 100%
            </div>
          </div>
          ${!wCheck.ok && course.components.length
            ? `<div class="weight-warn">⚠ Component weights must total 100% — currently ${wCheck.total.toFixed(0)}%</div>`
            : ""}

          <div class="comp-list">
            ${compBlocks}
          </div>

          <button class="add-comp-btn" data-action="add-comp" data-id="${course.id}">
            + add component
          </button>
        </div>`}

        <div class="editor-footer">
          <button class="btn-ghost btn-danger" data-action="remove-course" data-id="${course.id}">
            Remove course
          </button>
        </div>
      </div>`;
  },
};
