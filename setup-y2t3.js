/* ============================================================================
 * setup-y2t3.js — Paste this entire block into the browser console
 * while DL Planner is open to pre-load AY 2025-2026 Term 3 grades.
 * ========================================================================== */
(function () {
  const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Pre-filled course: single "Final Grade" component with the overall %.
  const locked = (name, units, pct, conf) => ({
    id: uid(), name, units, passingThreshold: 60, overallConfidence: conf,
    components: [{
      id: uid(), name: 'Final Grade', weight: 100, confidence: conf,
      subcomponents: [], totalMarks: 100, realScore: pct, locked: false,
    }],
  });

  // Planning course: real component breakdown, Medium confidence, not yet graded.
  const planned = (name, units, comps) => ({
    id: uid(), name, units, passingThreshold: 60, overallConfidence: 1,
    components: comps.map(([n, w]) => ({
      id: uid(), name: n, weight: w, confidence: 1,
      subcomponents: [], totalMarks: null, realScore: null, locked: false,
    })),
  });

  const y2t3 = {
    id: uid(),
    name: 'Y2T3',
    dlTarget: 3.4,   // 1st DL target — change via toggle in the app
    courses: [
      locked('CSINTSY', 3, 100,   2),   // 100% → GWA 4.0
      // NSSECU2: midterm 47/50 = 94%; finals TBD
      {
        id: uid(), name: 'NSSECU2', units: 3, passingThreshold: 60, overallConfidence: 2,
        flatGrade: false, flatScore: null,
        components: [
          { id: uid(), name: 'Midterm', weight: 50, confidence: 2, subcomponents: [], totalMarks: 50, realScore: 47, locked: true },
          { id: uid(), name: 'Finals',  weight: 50, confidence: 2, subcomponents: [], totalMarks: null, realScore: null, locked: false },
        ],
      },
      planned('CCDEVAP', 3, [            // grades not yet posted
        ['Attendance + Recitation + Hands-on',  10],
        ['Mini Challenges',                     30],
        ['Machine Project - Phase 1',           20],
        ['Machine Project - Phase 2',           20],
        ['Machine Project - Phase 3',           20],
      ]),
      // CSARCH2: Exam 1 = 70/100 = 70%; remaining exams TBD
      {
        id: uid(), name: 'CSARCH2', units: 3, passingThreshold: 60, overallConfidence: 0,
        flatGrade: false, flatScore: null,
        components: [
          { id: uid(), name: 'Exam 1', weight: 34, confidence: 0, subcomponents: [], totalMarks: 100, realScore: 70, locked: true },
          { id: uid(), name: 'Exam 2', weight: 33, confidence: 0, subcomponents: [], totalMarks: null, realScore: null, locked: false },
          { id: uid(), name: 'Exam 3', weight: 33, confidence: 0, subcomponents: [], totalMarks: null, realScore: null, locked: false },
        ],
      },
      locked('NSCOM02', 3, 97.5,  2),   // 97.5% → GWA 4.0
      locked('PE',      2, 94,    2),   // GWA 4.0 → 94%+ in Table A
    ],
  };

  const raw   = localStorage.getItem('dlplanner.v1');
  const state = raw ? JSON.parse(raw) : { version: 1, terms: [] };
  state.terms = state.terms.filter(t => t.name !== 'Y2T3');
  state.terms.push(y2t3);
  localStorage.setItem('dlplanner.v1', JSON.stringify(state));
  console.log('✓ Y2T3 loaded. Reloading...');
  location.reload();
})();
