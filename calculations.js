/* ============================================================================
 * calculations.js
 * ----------------------------------------------------------------------------
 * The "brain". Every function here is PURE: it takes data in and returns a
 * number/object out, without touching the page or saving anything. Pure
 * functions are easy to read, easy to test, and easy to trust.
 * ========================================================================== */

const Calc = {
  // ----- Basic helpers -------------------------------------------------------

  // Average percent for ONE category, e.g. two scores 18/20 and 45/50
  // -> (90 + 90) / 2 = 90. Returns null if the category has no scores yet,
  // so the rest of the app can tell "not graded" apart from "scored a 0".
  categoryAverage(category) {
    if (!category.scores.length) return null;
    const percents = category.scores.map((s) => (s.max > 0 ? (s.score / s.max) * 100 : 0));
    const sum = percents.reduce((a, b) => a + b, 0);
    return sum / percents.length;
  },

  totalWeight(subject) {
    return subject.categories.reduce((sum, c) => sum + (c.weight || 0), 0);
  },

  // ----- Current grade -------------------------------------------------------
  // Your standing based ONLY on work that has been graded so far. We weight
  // each scored category by its weight, then divide by the weight that has
  // actually been used. That way an empty gradebook isn't treated as a zero.
  currentGrade(subject) {
    let earned = 0;     // weight * average, summed
    let weightUsed = 0; // weight of categories that have a score
    for (const cat of subject.categories) {
      const avg = this.categoryAverage(cat);
      if (avg === null) continue;
      earned += avg * cat.weight;
      weightUsed += cat.weight;
    }
    if (weightUsed === 0) return null; // nothing graded yet
    return earned / weightUsed;
  },

  // ----- Risk per category ---------------------------------------------------
  // The core idea of the app. A category deserves your attention when it is:
  //   1. IMPACTFUL   — worth a big share of the final grade (high weight)
  //   2. BEHIND      — its current average is below your target (a "gap")
  //   3. UNCERTAIN   — you feel low confidence about it ("doubt")
  //
  // We turn each of those into a 0–1 number and combine them:
  //
  //   impact = weight / totalWeight
  //   gap    = how far below target you are (0 = at/above target, 1 = nothing earned)
  //   doubt  = (100 - confidence) / 100
  //   risk   = impact * (0.6 * gap + 0.4 * doubt) * 100   ->  0..100
  //
  // Gap is weighted a bit more than doubt because real performance matters more
  // than a feeling — but feelings still nudge the order. Tune the 0.6 / 0.4 if
  // you want confidence to count for more or less.
  categoryRisk(subject, category) {
    const total = this.totalWeight(subject) || 1; // avoid divide-by-zero
    const impact = category.weight / total;

    const avg = this.categoryAverage(category);
    const target = subject.target || 90;
    // If graded: how far below target (clamped to 0..1).
    // If not graded yet: full gap, because none of this weight is secured.
    const gap =
      avg === null ? target / 100 : Math.max(0, (target - avg)) / 100;

    const doubt = (100 - category.confidence) / 100;

    return impact * (0.6 * gap + 0.4 * doubt) * 100;
  },

  // ----- Recommendations -----------------------------------------------------
  // Rank every category across ALL subjects by risk, highest first, and attach
  // a plain-English reason so the UI doesn't have to guess what to say.
  recommendations(state) {
    const items = [];
    for (const subject of state.subjects) {
      for (const cat of subject.categories) {
        const risk = this.categoryRisk(subject, cat);
        const avg = this.categoryAverage(cat);
        items.push({
          subjectName: subject.name,
          categoryName: cat.name,
          risk,
          level: this.riskLevel(risk),
          reason: this.reasonText(subject, cat, avg),
        });
      }
    }
    items.sort((a, b) => b.risk - a.risk);
    return items;
  },

  // Bucket a 0–100 risk number into a label the UI can color.
  riskLevel(risk) {
    if (risk >= 18) return "high";
    if (risk >= 8) return "medium";
    return "low";
  },

  reasonText(subject, category, avg) {
    const bits = [];
    if (avg === null) bits.push("nothing graded yet");
    else if (avg < subject.target) bits.push(`averaging ${avg.toFixed(0)}%, below your ${subject.target} target`);
    if (category.confidence <= 40) bits.push(`low confidence (${category.confidence}%)`);
    if (category.weight >= 30) bits.push(`worth ${category.weight}% of the grade`);
    if (!bits.length) return "on track — keep it up";
    return bits.join(", ");
  },

  // ----- "What if" simulator -------------------------------------------------
  // Pretend you add one more score to a category and see what your current
  // grade becomes. We clone the subject so we never modify real data.
  whatIf(subject, categoryId, score, max) {
    const before = this.currentGrade(subject);
    const clone = JSON.parse(JSON.stringify(subject));
    const cat = clone.categories.find((c) => c.id === categoryId);
    if (cat) cat.scores.push({ id: "temp", label: "what-if", score: Number(score), max: Number(max), date: "" });
    const after = this.currentGrade(clone);
    return { before, after };
  },

  // ----- Goal calculator -----------------------------------------------------
  // "I want a final grade of T. What do I need on the work I haven't done yet?"
  //
  // A category contributes  average% * (weight/100)  points to the final grade.
  //   secured   = points already locked in from categories that have scores
  //   remaining = total weight (as a fraction) of categories with NO scores yet
  //   needed    = (T - secured) / remaining
  //
  // Returns a status so the UI can explain achievable / impossible / done.
  goalNeeded(subject) {
    const target = subject.target || 90;
    let secured = 0;        // points already in the bank (out of 100)
    let remainingWeight = 0; // weight fraction still up for grabs

    for (const cat of subject.categories) {
      const avg = this.categoryAverage(cat);
      if (avg === null) {
        remainingWeight += cat.weight / 100;
      } else {
        secured += avg * (cat.weight / 100);
      }
    }

    if (remainingWeight === 0) {
      return { status: "no-remaining", secured, target };
    }

    const needed = (target - secured) / remainingWeight;

    let status = "ok";
    if (needed <= 0) status = "already-met"; // you've basically secured it
    else if (needed > 100) status = "impossible"; // can't score over 100%

    return { status, needed, secured, remainingWeight: remainingWeight * 100, target };
  },

  // Does the weights add up to 100%? Returns the total so the UI can warn.
  weightCheck(subject) {
    const total = this.totalWeight(subject);
    return { total, ok: Math.abs(total - 100) < 0.01 };
  },

  // ----- Grade trend ---------------------------------------------------------
  // Replays your scores in date order, recomputing the current grade after each
  // one, so the chart shows how your standing moved as results came in. This
  // works from the data you already have — no daily snapshots needed.
  gradeTrend(subject) {
    // Flatten every score with the category it belongs to.
    const entries = [];
    subject.categories.forEach((cat) => {
      cat.scores.forEach((s) => entries.push({ catId: cat.id, score: s }));
    });
    entries.sort((a, b) => String(a.score.date).localeCompare(String(b.score.date)));

    // A skeleton copy of the categories with empty scores; we'll fill it as we go.
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
