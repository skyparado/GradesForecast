/* ============================================================================
 * calculations.js — pure math, no DOM, no side-effects
 * ========================================================================== */

const Calc = {

  // ---------------------------------------------------------------------------
  // Basic helpers
  // ---------------------------------------------------------------------------

  categoryAverage(category) {
    if (!category.scores.length) return null;
    const percents = category.scores.map((s) => (s.max > 0 ? (s.score / s.max) * 100 : 0));
    return percents.reduce((a, b) => a + b, 0) / percents.length;
  },

  totalWeight(subject) {
    return subject.categories.reduce((sum, c) => sum + (c.weight || 0), 0);
  },

  currentGrade(subject) {
    let earned = 0;
    let weightUsed = 0;
    for (const cat of subject.categories) {
      const avg = this.categoryAverage(cat);
      if (avg === null) continue;
      earned += avg * cat.weight;
      weightUsed += cat.weight;
    }
    if (weightUsed === 0) return null;
    return earned / weightUsed;
  },

  // ---------------------------------------------------------------------------
  // Deadline helpers
  // ---------------------------------------------------------------------------

  daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },

  // Returns 0–1: 1 = due today or overdue, 0 = no deadline or far away (>30 days)
  deadlinePressure(category) {
    const days = this.daysUntil(category.deadline);
    if (days === null) return 0;
    if (days <= 0) return 1;
    if (days >= 30) return 0;
    return 1 - days / 30;
  },

  // ---------------------------------------------------------------------------
  // Risk scoring (extended from original: now includes deadline pressure)
  // ---------------------------------------------------------------------------

  categoryRisk(subject, category) {
    const total = this.totalWeight(subject) || 1;
    const impact = category.weight / total;

    const avg = this.categoryAverage(category);
    const target = subject.target || 90;
    const gap = avg === null
      ? target / 100
      : Math.max(0, (target - avg)) / 100;

    const doubt = (100 - category.confidence) / 100;
    const pressure = this.deadlinePressure(category);

    // deadline pressure can boost risk by up to 20 points
    return impact * (0.5 * gap + 0.3 * doubt) * 100 + pressure * 20;
  },

  riskLevel(risk) {
    if (risk >= 18) return "high";
    if (risk >= 8)  return "medium";
    return "low";
  },

  // ---------------------------------------------------------------------------
  // Confidence drift: has your confidence in a category been dropping?
  // Compares the average confidenceAtEntry of early scores vs recent scores.
  // Returns { drifting: bool, from: number, to: number } or null if not enough data.
  // ---------------------------------------------------------------------------

  confidenceDrift(category) {
    const scored = category.scores.filter((s) => s.confidenceAtEntry !== null);
    if (scored.length < 4) return null;
    const half = Math.floor(scored.length / 2);
    const early = scored.slice(0, half).map((s) => s.confidenceAtEntry);
    const recent = scored.slice(-half).map((s) => s.confidenceAtEntry);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const from = avg(early);
    const to = avg(recent);
    return { drifting: to < from - 15, from: Math.round(from), to: Math.round(to) };
  },

  // ---------------------------------------------------------------------------
  // Linear regression — the Phase 2 foundation, included now so it's ready.
  // points = [{ x, y }].  Returns { slope, intercept, r2 } or null if < 3 pts.
  // ---------------------------------------------------------------------------

  linearRegression(points) {
    const n = points.length;
    if (n < 3) return null;
    const sumX  = points.reduce((s, p) => s + p.x, 0);
    const sumY  = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
    const sumYY = points.reduce((s, p) => s + p.y * p.y, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    const slope     = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    // R² — how well the line fits (0 = useless, 1 = perfect)
    const meanY = sumY / n;
    const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { slope, intercept, r2 };
  },

  // Given a calibration log (all entries) and a raw confidence value (0–100),
  // returns your personally-adjusted predicted score. Falls back to raw confidence
  // if not enough data yet.
  calibratedPrediction(rawConfidence, calibrationLog) {
    if (!calibrationLog || calibrationLog.length < 3) return rawConfidence;
    const points = calibrationLog.map((e) => ({ x: e.confidence, y: e.actualScore }));
    const model = this.linearRegression(points);
    if (!model) return rawConfidence;
    const predicted = model.slope * rawConfidence + model.intercept;
    return Math.max(0, Math.min(100, predicted));
  },

  // ---------------------------------------------------------------------------
  // Grade prediction — projects your likely final grade with a low/mid/high range.
  // Uses calibration data if available; falls back to pure math otherwise.
  // ---------------------------------------------------------------------------

  gradeRange(subject, calibrationLog = []) {
    let securedPoints = 0;  // weighted points already locked in
    let securedWeight = 0;
    let ungradedWeight = 0; // weight of categories with no scores yet

    for (const cat of subject.categories) {
      const avg = this.categoryAverage(cat);
      if (avg !== null) {
        securedPoints += avg * (cat.weight / 100);
        securedWeight += cat.weight;
      } else {
        ungradedWeight += cat.weight;
      }
    }

    if (ungradedWeight === 0) {
      // Everything is graded — grade is exact.
      const exact = securedWeight > 0 ? (securedPoints / (securedWeight / 100)) : null;
      return exact !== null ? { low: exact, mid: exact, high: exact, locked: true } : null;
    }

    // Estimate what you'll score on remaining categories using calibration.
    // We use the average confidence across ungraded categories as the input.
    const ungradedCats = subject.categories.filter((c) => this.categoryAverage(c) === null);
    const avgConfidence = ungradedCats.reduce((s, c) => s + c.confidence, 0) / ungradedCats.length;

    const midPrediction  = this.calibratedPrediction(avgConfidence, calibrationLog);
    const lowPrediction  = Math.max(0,   midPrediction - 12);
    const highPrediction = Math.min(100, midPrediction + 8);

    const ungradedFraction = ungradedWeight / 100;
    const mid  = securedPoints + midPrediction  * ungradedFraction;
    const low  = securedPoints + lowPrediction  * ungradedFraction;
    const high = securedPoints + highPrediction * ungradedFraction;

    return { low: Math.max(0, low), mid, high: Math.min(100, high), locked: false };
  },

  // ---------------------------------------------------------------------------
  // Calibration accuracy summary — tells you how well your confidence predicts
  // your actual scores (used in the Insights panel).
  // ---------------------------------------------------------------------------

  calibrationSummary(calibrationLog) {
    if (!calibrationLog || calibrationLog.length < 3) {
      return { ready: false, count: calibrationLog ? calibrationLog.length : 0 };
    }
    const points = calibrationLog.map((e) => ({ x: e.confidence, y: e.actualScore }));
    const model  = this.linearRegression(points);
    if (!model) return { ready: false, count: points.length };

    const avgOffset = calibrationLog.reduce((s, e) => s + (e.actualScore - e.confidence), 0) / calibrationLog.length;
    const tendency  = avgOffset > 8  ? "underconfident"
                    : avgOffset < -8 ? "overconfident"
                    : "well-calibrated";

    return {
      ready: true,
      count: calibrationLog.length,
      slope: model.slope,
      intercept: model.intercept,
      r2: model.r2,
      avgOffset: Math.round(avgOffset),
      tendency,
    };
  },

  // ---------------------------------------------------------------------------
  // Recommendations (extended: includes deadline pressure and drift signals)
  // ---------------------------------------------------------------------------

  recommendations(state, calibrationLog = []) {
    const items = [];
    for (const subject of state.subjects) {
      for (const cat of subject.categories) {
        const risk  = this.categoryRisk(subject, cat);
        const avg   = this.categoryAverage(cat);
        const drift = this.confidenceDrift(cat);
        items.push({
          subjectName:  subject.name,
          categoryName: cat.name,
          risk,
          level:  this.riskLevel(risk),
          reason: this.reasonText(subject, cat, avg, drift),
        });
      }
    }
    items.sort((a, b) => b.risk - a.risk);
    return items;
  },

  reasonText(subject, category, avg, drift) {
    const bits = [];
    if (avg === null) bits.push("nothing graded yet");
    else if (avg < subject.target) bits.push(`averaging ${avg.toFixed(0)}%, below your ${subject.target} target`);
    if (category.confidence <= 40) bits.push(`low confidence (${category.confidence}%)`);
    if (category.weight >= 30) bits.push(`worth ${category.weight}% of the grade`);
    const days = this.daysUntil(category.deadline);
    if (days !== null && days <= 14 && days >= 0) bits.push(`due in ${days} day${days === 1 ? "" : "s"}`);
    if (days !== null && days < 0) bits.push("past deadline");
    if (drift && drift.drifting) bits.push(`confidence dropped ${drift.from}→${drift.to}%`);
    if (!bits.length) return "on track — keep it up";
    return bits.join(", ");
  },

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Final exam calculator with confidence adjustment
  // ---------------------------------------------------------------------------

  // If confidence is high (≥70), the app bumps the target slightly so you
  // bank extra points in subjects you're likely to ace. This leaves room for
  // lower-than-expected scores in subjects where you're less sure.
  adjustedTarget(baseTarget, confidence) {
    if (confidence >= 70) {
      const buffer = ((confidence - 70) / 30) * 5; // 0–5% boost at max confidence
      return Math.min(100, baseTarget + buffer);
    }
    // Low confidence: keep target as-is (don't over-promise)
    return baseTarget;
  },

  // How much you need on the final to reach your (adjusted) target.
  // currentGrade = your grade from non-final work only.
  // finalWeight  = % of total grade the final is worth (e.g. 30).
  // confidence   = how confident you feel about the final (0–100).
  finalNeeded(subject, calibrationLog = []) {
    const finalWeight = subject.finalWeight || 0;
    if (finalWeight <= 0) return null;

    const courseworkWeight = 1 - finalWeight / 100;
    const currentGrade     = this.currentGrade(subject) || 0;
    const confidence       = subject.finalConfidence ?? 50;
    const target           = this.adjustedTarget(subject.target, confidence);

    // Grade needed on final = (target - currentGrade * courseworkWeight) / (finalWeight/100)
    const needed = (target - currentGrade * courseworkWeight) / (finalWeight / 100);

    // Apply personal calibration: if you tend to underperform vs confidence,
    // add a safety buffer so the recommended score accounts for that.
    let safetyBuffer = 0;
    if (calibrationLog.length >= 3) {
      const summary = this.calibrationSummary(calibrationLog);
      if (summary.ready && summary.tendency === "overconfident") {
        // You usually score lower than your confidence suggests — pad by half your average offset
        safetyBuffer = Math.abs(summary.avgOffset) * 0.5;
      }
    }

    return {
      needed:        Math.max(0, Math.min(100, needed)),
      adjusted:      Math.max(0, Math.min(100, needed + safetyBuffer)),
      adjustedTarget: target,
      safetyBuffer,
      confidence,
    };
  },

  // ---------------------------------------------------------------------------
  // Unchanged from original
  // ---------------------------------------------------------------------------

  whatIf(subject, categoryId, score, max) {
    const before = this.currentGrade(subject);
    const clone  = JSON.parse(JSON.stringify(subject));
    const cat    = clone.categories.find((c) => c.id === categoryId);
    if (cat) cat.scores.push({ id: "temp", label: "what-if", score: Number(score), max: Number(max), date: "" });
    const after  = this.currentGrade(clone);
    return { before, after };
  },

  goalNeeded(subject) {
    const target = subject.target || 90;
    let secured = 0;
    let remainingWeight = 0;
    for (const cat of subject.categories) {
      const avg = this.categoryAverage(cat);
      if (avg === null) remainingWeight += cat.weight / 100;
      else secured += avg * (cat.weight / 100);
    }
    if (remainingWeight === 0) return { status: "no-remaining", secured, target };
    const needed = (target - secured) / remainingWeight;
    let status = "ok";
    if (needed <= 0)   status = "already-met";
    else if (needed > 100) status = "impossible";
    return { status, needed, secured, remainingWeight: remainingWeight * 100, target };
  },

  weightCheck(subject) {
    const total = this.totalWeight(subject);
    return { total, ok: Math.abs(total - 100) < 0.01 };
  },

  gradeTrend(subject) {
    const entries = [];
    subject.categories.forEach((cat) => {
      cat.scores.forEach((s) => entries.push({ catId: cat.id, score: s }));
    });
    entries.sort((a, b) => String(a.score.date).localeCompare(String(b.score.date)));
    const work = subject.categories.map((c) => ({ weight: c.weight, scores: [] }));
    const indexById = {};
    subject.categories.forEach((c, i) => (indexById[c.id] = i));
    const points = [];
    entries.forEach(({ catId, score }) => {
      work[indexById[catId]].scores.push(score);
      const grade = this.currentGrade({ categories: work });
      if (grade !== null) points.push({ label: score.date, value: grade });
    });
    return points;
  },
};
