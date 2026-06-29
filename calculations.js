/* ============================================================================
 * calculations.js — DL Planner pure math
 * ========================================================================== */

// Per-component placeholder % stored in localStorage so it persists across
// page loads without needing a DB column. Keyed by component/subcomponent id.
const PlaceholderStore = {
  _key: "dlplanner.placeholders",
  _data() {
    try { return JSON.parse(localStorage.getItem(this._key) || "{}"); }
    catch { return {}; }
  },
  get(id)       { return this._data()[id] ?? null; },
  set(id, pct)  {
    const d = this._data();
    if (pct === null || pct === undefined) { delete d[id]; }
    else { d[id] = Number(pct); }
    localStorage.setItem(this._key, JSON.stringify(d));
  },
};

// GWA Table A — 60% passing
const GWA_A = [
  [94, 4.0], [89, 3.5], [83, 3.0], [78, 2.5],
  [72, 2.0], [66, 1.5], [60, 1.0], [0, 0.0],
];

// GWA Table B — 70% passing
const GWA_B = [
  [97, 4.0], [93, 3.5], [89, 3.0], [85, 2.5],
  [80, 2.0], [75, 1.5], [70, 1.0], [0, 0.0],
];

const Calc = {

  cv(lvl) { return [75, 82, 90][Number(lvl)] ?? 82; },

  gwa(pct, threshold) {
    const tbl = threshold === 70 ? GWA_B : GWA_A;
    for (const [min, val] of tbl) if (pct >= min) return val;
    return 0.0;
  },

  // Custom placeholder % for an entity, falling back to confidence-based default.
  placeholder(entity, confidence) {
    return PlaceholderStore.get(entity.id) ?? this.cv(confidence);
  },

  compPct(comp) {
    const subs = comp.subcomponents;
    if (!subs.length) {
      if (comp.realScore !== null && comp.totalMarks > 0)
        return (comp.realScore / comp.totalMarks) * 100;
      return this.placeholder(comp, comp.confidence);
    }
    const parentPh = this.placeholder(comp, comp.confidence);
    const vals = subs.map(s =>
      s.realScore !== null && s.totalMarks > 0
        ? (s.realScore / s.totalMarks) * 100
        : (PlaceholderStore.get(s.id) ?? parentPh)
    );
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  },

  courseProjPct(course) {
    if (course.flatGrade) {
      return course.flatScore !== null
        ? course.flatScore
        : this.cv(course.overallConfidence);
    }
    const tw = course.components.reduce((s, c) => s + (c.weight || 0), 0);
    if (!tw) return 0;
    return course.components.reduce((s, c) =>
      s + (c.weight / 100) * this.compPct(c), 0
    );
  },

  courseGoalPct(course) {
    if (course.flatGrade) {
      return course.flatScore !== null
        ? course.flatScore
        : this.cv(course.overallConfidence);
    }
    const tw = course.components.reduce((s, c) => s + (c.weight || 0), 0);
    if (!tw) return this.cv(course.overallConfidence);
    return course.components.reduce((s, comp) => {
      const subs = comp.subcomponents;
      let pct;
      if (!subs.length) {
        pct = (comp.realScore !== null && comp.totalMarks > 0)
          ? (comp.realScore / comp.totalMarks) * 100
          : this.cv(comp.confidence);
      } else {
        const target = this.cv(comp.confidence);
        const vals = subs.map(sub =>
          (sub.realScore !== null && sub.totalMarks > 0)
            ? (sub.realScore / sub.totalMarks) * 100
            : target
        );
        pct = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
      return s + (comp.weight / 100) * pct;
    }, 0);
  },

  courseProjGWA(course) {
    return this.gwa(this.courseProjPct(course), course.passingThreshold);
  },
  courseGoalGWA(course) {
    return this.gwa(this.courseGoalPct(course), course.passingThreshold);
  },

  termProjGWA(courses) {
    const u = courses.reduce((s, c) => s + (Number(c.units) || 0), 0);
    if (!u) return null;
    return courses.reduce((s, c) =>
      s + this.courseProjGWA(c) * (Number(c.units) || 0), 0
    ) / u;
  },

  termGoalGWA(courses) {
    const u = courses.reduce((s, c) => s + (Number(c.units) || 0), 0);
    if (!u) return null;
    return courses.reduce((s, c) =>
      s + this.courseGoalGWA(c) * (Number(c.units) || 0), 0
    ) / u;
  },

  maxPct(course) {
    if (course.flatGrade) {
      return course.flatScore !== null ? course.flatScore : 100;
    }
    let sum = 0;
    for (const comp of course.components) {
      const subs = comp.subcomponents;
      if (!subs.length) {
        const score = comp.realScore !== null && comp.totalMarks > 0
          ? (comp.realScore / comp.totalMarks) * 100 : 100;
        sum += (comp.weight / 100) * score;
        continue;
      }
      const vals = subs.map(s =>
        s.realScore !== null && s.totalMarks > 0
          ? (s.realScore / s.totalMarks) * 100 : 100
      );
      sum += (comp.weight / 100) * (vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return sum;
  },

  cardStatus(course, dlTarget) {
    if (course.flatGrade && course.flatScore === null) return "grey";
    if (!course.flatGrade && !course.components.length) return "grey";
    const maxGWA = this.gwa(this.maxPct(course), course.passingThreshold);
    if (maxGWA < 1.0) return "grey";
    const projGWA = this.courseProjGWA(course);
    if (projGWA < 1.0) return "red";
    const goalGWA = this.courseGoalGWA(course);
    if (goalGWA >= dlTarget) return "green";
    if (goalGWA >= dlTarget - 0.5) return "yellow";
    return "red";
  },

  studyPriority(comp) {
    return comp.weight * (100 - this.cv(comp.confidence));
  },

  topPriorityComp(course) {
    if (!course.components.length) return null;
    return course.components.reduce((best, c) =>
      this.studyPriority(c) > this.studyPriority(best) ? c : best
    );
  },

  weightCheck(course) {
    const total = course.components.reduce((s, c) => s + (Number(c.weight) || 0), 0);
    return { total, ok: Math.abs(total - 100) < 0.5 };
  },

  dlGap(courses, dlTarget) {
    const goalGWA = this.termGoalGWA(courses);
    if (goalGWA === null) return null;
    return dlTarget - goalGWA;
  },

  subjectsToPush(courses) {
    return [...courses].sort((a, b) => b.overallConfidence - a.overallConfidence);
  },

  fmt(n, dec = 2) {
    return n === null || n === undefined || isNaN(n) ? "—" : Number(n).toFixed(dec);
  },
};
