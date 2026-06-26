/* ============================================================================
 * calculations.js — DL Planner pure math
 * ========================================================================== */

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

  // Confidence level (0/1/2) → percentage value (75/82/90)
  cv(lvl) { return [75, 82, 90][Number(lvl)] ?? 82; },

  // Raw percentage → GWA using the correct table
  gwa(pct, threshold) {
    const tbl = threshold === 70 ? GWA_B : GWA_A;
    for (const [min, val] of tbl) if (pct >= min) return val;
    return 0.0;
  },

  // --------------------------------------------------------------------------
  // Component projected % (accounting for locked subcomponent real scores)
  // --------------------------------------------------------------------------
  compPct(comp) {
    const subs = comp.subcomponents;
    if (!subs.length) {
      // Leaf component: use its own real score if locked
      if (comp.locked && comp.realScore !== null && comp.totalMarks > 0) {
        return (comp.realScore / comp.totalMarks) * 100;
      }
      return this.cv(comp.confidence);
    }
    const vals = subs.map(s =>
      s.locked && s.realScore !== null && s.totalMarks > 0
        ? (s.realScore / s.totalMarks) * 100
        : this.cv(comp.confidence)
    );
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  },

  // --------------------------------------------------------------------------
  // Subject (course) projected %
  // --------------------------------------------------------------------------
  courseProjPct(course) {
    const tw = course.components.reduce((s, c) => s + (c.weight || 0), 0);
    if (!tw) return 0;
    return course.components.reduce((s, c) =>
      s + (c.weight / 100) * this.compPct(c), 0
    );
  },

  // Subject goal % — driven by overall confidence slider
  courseGoalPct(course) { return this.cv(course.overallConfidence); },

  // Subject GWA conversions
  courseProjGWA(course) {
    return this.gwa(this.courseProjPct(course), course.passingThreshold);
  },
  courseGoalGWA(course) {
    return this.gwa(this.courseGoalPct(course), course.passingThreshold);
  },

  // --------------------------------------------------------------------------
  // Term-level GWA (weighted by units)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // Maximum achievable % (assume 100% on all unlocked items)
  // --------------------------------------------------------------------------
  maxPct(course) {
    let sum = 0;
    for (const comp of course.components) {
      const subs = comp.subcomponents;
      if (!subs.length) {
        const score = comp.locked && comp.realScore !== null && comp.totalMarks > 0
          ? (comp.realScore / comp.totalMarks) * 100 : 100;
        sum += (comp.weight / 100) * score;
        continue;
      }
      const vals = subs.map(s =>
        s.locked && s.realScore !== null && s.totalMarks > 0
          ? (s.realScore / s.totalMarks) * 100 : 100
      );
      sum += (comp.weight / 100) * (vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return sum;
  },

  // --------------------------------------------------------------------------
  // Card status for a single course
  // --------------------------------------------------------------------------
  cardStatus(course, dlTarget) {
    if (!course.components.length) return "grey";
    const maxGWA = this.gwa(this.maxPct(course), course.passingThreshold);
    if (maxGWA < 1.0) return "grey";             // unrecoverable
    const projGWA = this.courseProjGWA(course);
    if (projGWA < 1.0) return "red";             // projected below passing
    const goalGWA = this.courseGoalGWA(course);
    if (goalGWA >= dlTarget) return "green";
    if (goalGWA >= dlTarget - 0.5) return "yellow";
    return "red";
  },

  // --------------------------------------------------------------------------
  // Study priority per component
  // --------------------------------------------------------------------------
  studyPriority(comp) {
    return comp.weight * (100 - this.cv(comp.confidence));
  },

  topPriorityComp(course) {
    if (!course.components.length) return null;
    return course.components.reduce((best, c) =>
      this.studyPriority(c) > this.studyPriority(best) ? c : best
    );
  },

  // --------------------------------------------------------------------------
  // Weight validation
  // --------------------------------------------------------------------------
  weightCheck(course) {
    const total = course.components.reduce((s, c) => s + (Number(c.weight) || 0), 0);
    return { total, ok: Math.abs(total - 100) < 0.5 };
  },

  // --------------------------------------------------------------------------
  // Gap analysis — which subjects to push if DL not reachable
  // --------------------------------------------------------------------------
  dlGap(courses, dlTarget) {
    const goalGWA = this.termGoalGWA(courses);
    if (goalGWA === null) return null;
    return dlTarget - goalGWA;
  },

  // Subjects to push (sorted: highest overall confidence slider first)
  subjectsToPush(courses) {
    return [...courses].sort((a, b) => b.overallConfidence - a.overallConfidence);
  },

  fmt(n, dec = 2) {
    return n === null || n === undefined || isNaN(n) ? "—" : Number(n).toFixed(dec);
  },
};
