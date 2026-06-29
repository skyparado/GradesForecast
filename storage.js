/* ============================================================================
 * storage.js — async Supabase-backed persistence
 * ========================================================================== */

const Storage = {

  async load() {
    const [terms, courses, comps, subs] = await Promise.all([
      DB.get("terms",         "select=*"),
      DB.get("courses",       "select=*"),
      DB.get("components",    "select=*"),
      DB.get("subcomponents", "select=*"),
    ]);

    if (!terms.length) {
      await this._seed();
      return this.load();
    }

    const state = this._build(terms, courses, comps, subs);
    await this._migrate(state);
    return state;
  },

  // One-time migrations run on every load but no-op once applied.
  async _migrate(state) {
    for (const term of state.terms) {
      const pe = term.courses.find(c => c.name === "PE" && c.flatGrade);
      if (pe) await this._fixupPE(pe);
    }
  },

  async _fixupPE(pe) {
    const uid = () => crypto.randomUUID();

    await DB.patch("courses", pe.id, {
      flat_grade:         false,
      flat_score:         null,
      overall_confidence: 2,
    });

    const attId   = uid();
    const skillId = uid();

    await DB.post("components", {
      id: attId, course_id: pe.id,
      name: "Attendance", weight: 20, confidence: 2,
      locked: true, real_score: 100, total_marks: 100,
    });
    await DB.post("components", {
      id: skillId, course_id: pe.id,
      name: "Skill Tests", weight: 80, confidence: 2,
      locked: true, real_score: 100, total_marks: 100,
    });

    pe.flatGrade         = false;
    pe.flatScore         = null;
    pe.overallConfidence = 2;
    pe.components        = [
      { id: attId,   name: "Attendance",  weight: 20, confidence: 2, locked: true,  realScore: 100, totalMarks: 100, subcomponents: [] },
      { id: skillId, name: "Skill Tests", weight: 80, confidence: 2, locked: true,  realScore: 100, totalMarks: 100, subcomponents: [] },
    ];
  },

  _build(terms, courses, comps, subs) {
    return {
      version: 1,
      terms: terms.map(t => ({
        id:       t.id,
        name:     t.label,
        dlTarget: Number(t.dl_target),
        courses:  courses
          .filter(c => c.term_id === t.id)
          .map(c => ({
            id:                c.id,
            name:              c.name,
            fullName:          c.full_name  || "",
            units:             c.units,
            passingThreshold:  c.passing_threshold,
            overallConfidence: c.overall_confidence,
            flatGrade:         c.flat_grade  || false,
            flatScore:         c.flat_score  ?? null,
            components: comps
              .filter(p => p.course_id === c.id)
              .map(p => ({
                id:            p.id,
                name:          p.name,
                weight:        p.weight,
                confidence:    p.confidence,
                locked:        p.locked      || false,
                realScore:     p.real_score  ?? null,
                totalMarks:    p.total_marks ?? null,
                subcomponents: subs
                  .filter(s => s.component_id === p.id)
                  .map(s => ({
                    id:         s.id,
                    name:       s.name,
                    locked:     s.locked      || false,
                    realScore:  s.real_score  ?? null,
                    totalMarks: s.total_marks ?? null,
                  })),
              })),
          })),
      })),
    };
  },

  // ---- Seed on first load ------------------------------------------------

  async _seed() {
    const uid = () => crypto.randomUUID();

    const termId = uid();
    await DB.post("terms", { id: termId, label: "AY2025-2026 Term 3", dl_target: 3.0 });

    const defs = [
      {
        name: "CSINTSY", full_name: "Intelligent Systems",
        units: 3, passing_threshold: 60, overall_confidence: 1,
        comps: [
          { name: "Course Activities",      weight: 10 },
          { name: "Major Course Output 1",  weight: 20 },
          { name: "Major Course Output 2",  weight: 20 },
          { name: "Major Course Output 3",  weight: 15 },
          { name: "Final Exam",             weight: 35 },
        ],
      },
      {
        name: "NSSECU2", full_name: "Network Security 2",
        units: 3, passing_threshold: 70, overall_confidence: 1,
        comps: [
          { name: "Activities and Exercises", weight: 35 },
          { name: "Hacking Tool Creation",    weight: 10 },
          { name: "Independent Lab Practice", weight: 15 },
          { name: "Midterm",                  weight: 15 },
          { name: "Finals",                   weight: 20 },
          { name: "Attendance", weight: 5, locked: true, real_score: 100, total_marks: 100 },
        ],
      },
      {
        name: "CCDEVAP", full_name: "Creative Computing / Dev Apps",
        units: 3, passing_threshold: 60, overall_confidence: 1,
        comps: [
          { name: "Attendance + Recitation + Hands-on", weight: 10 },
          { name: "Mini Challenges",                    weight: 30 },
          { name: "Machine Project Phase 1",            weight: 20 },
          { name: "Machine Project Phase 2",            weight: 20 },
          { name: "Machine Project Phase 3",            weight: 20 },
        ],
      },
      {
        name: "CSARCH2", full_name: "Computer Architecture 2",
        units: 3, passing_threshold: 60, overall_confidence: 1,
        comps: [
          { name: "Graded Work",    weight: 10 },
          {
            name: "Long Exam",      weight: 60,
            subs: [
              { name: "Exam 1", locked: true,  real_score: 70, total_marks: 100 },
              { name: "Exam 2", locked: false },
            ],
          },
          { name: "Case Project 1", weight: 15 },
          { name: "Case Project 2", weight: 15 },
        ],
      },
      {
        name: "NSCOM02", full_name: "Data Communications / Networking",
        units: 3, passing_threshold: 70, overall_confidence: 1,
        comps: [
          { name: "Assignments", weight: 25 },
          { name: "Exam 1",      weight: 15 },
          { name: "Exam 2",      weight: 15 },
          { name: "MCO 1",       weight: 20 },
          { name: "MCO 2",       weight: 25 },
        ],
      },
      {
        name: "LBYARCH", full_name: "Architecture Lab",
        units: 1, passing_threshold: 60, overall_confidence: 1,
        comps: [
          { name: "Lab Experiments",      weight: 40 },
          { name: "Long Exam",            weight: 30 },
          { name: "Programming Projects", weight: 30 },
        ],
      },
      {
        name: "PE", full_name: "Physical Education",
        units: 2, passing_threshold: 60, overall_confidence: 2,
        flat_grade: false, flat_score: null,
        comps: [
          { name: "Attendance",  weight: 20, confidence: 2, locked: true, real_score: 100, total_marks: 100 },
          { name: "Skill Tests", weight: 80, confidence: 2, locked: true, real_score: 100, total_marks: 100 },
        ],
      },
    ];

    for (const def of defs) {
      const courseId = uid();
      await DB.post("courses", {
        id:                 courseId,
        term_id:            termId,
        name:               def.name,
        full_name:          def.full_name,
        units:              def.units,
        passing_threshold:  def.passing_threshold,
        overall_confidence: def.overall_confidence,
        flat_grade:         def.flat_grade  || false,
        flat_score:         def.flat_score  ?? null,
      });

      for (const comp of def.comps) {
        const compId = uid();
        await DB.post("components", {
          id:          compId,
          course_id:   courseId,
          name:        comp.name,
          weight:      comp.weight,
          confidence:  comp.confidence ?? 1,
          locked:      comp.locked     || false,
          real_score:  comp.real_score  ?? null,
          total_marks: comp.total_marks ?? null,
        });

        for (const sub of comp.subs || []) {
          await DB.post("subcomponents", {
            id:           uid(),
            component_id: compId,
            name:         sub.name,
            locked:       sub.locked     || false,
            real_score:   sub.real_score  ?? null,
            total_marks:  sub.total_marks ?? null,
          });
        }
      }
    }
  },

  // ---- Targeted sync methods ---------------------------------------------

  async syncTerm(term) {
    await DB.patch("terms", term.id, {
      label:     term.name,
      dl_target: term.dlTarget,
    });
  },

  async syncCourse(course) {
    await DB.patch("courses", course.id, {
      name:               course.name,
      full_name:          course.fullName,
      units:              course.units,
      passing_threshold:  course.passingThreshold,
      overall_confidence: course.overallConfidence,
      flat_grade:         course.flatGrade,
      flat_score:         course.flatScore,
    });
  },

  async syncComp(comp) {
    await DB.patch("components", comp.id, {
      name:        comp.name,
      weight:      comp.weight,
      confidence:  comp.confidence,
      locked:      comp.locked,
      real_score:  comp.realScore,
      total_marks: comp.totalMarks,
    });
  },

  async syncSub(sub) {
    await DB.patch("subcomponents", sub.id, {
      name:        sub.name,
      locked:      sub.locked,
      real_score:  sub.realScore,
      total_marks: sub.totalMarks,
    });
  },

  // ---- Insert methods ----------------------------------------------------

  async insertTerm(term) {
    await DB.post("terms", {
      id:        term.id,
      label:     term.name,
      dl_target: term.dlTarget,
    });
  },

  async insertCourse(course, termId) {
    await DB.post("courses", {
      id:                 course.id,
      term_id:            termId,
      name:               course.name,
      full_name:          course.fullName  || null,
      units:              course.units,
      passing_threshold:  course.passingThreshold,
      overall_confidence: course.overallConfidence,
      flat_grade:         course.flatGrade || false,
      flat_score:         course.flatScore ?? null,
    });
  },

  async insertComp(comp, courseId) {
    await DB.post("components", {
      id:          comp.id,
      course_id:   courseId,
      name:        comp.name,
      weight:      comp.weight,
      confidence:  comp.confidence,
      locked:      comp.locked     || false,
      real_score:  comp.realScore  ?? null,
      total_marks: comp.totalMarks ?? null,
    });
  },

  async insertSub(sub, compId) {
    await DB.post("subcomponents", {
      id:           sub.id,
      component_id: compId,
      name:         sub.name,
      locked:       sub.locked     || false,
      real_score:   sub.realScore  ?? null,
      total_marks:  sub.totalMarks ?? null,
    });
  },

  // ---- Delete methods ----------------------------------------------------

  async deleteTerm(termId) {
    const courses = await DB.get("courses", `term_id=eq.${termId}&select=id`);
    for (const c of courses) await this._deleteCourseRows(c.id);
    if (courses.length) await DB.del("courses", `term_id=eq.${termId}`);
    await DB.del("terms", `id=eq.${termId}`);
  },

  async deleteCourse(courseId) {
    await this._deleteCourseRows(courseId);
    await DB.del("courses", `id=eq.${courseId}`);
  },

  async _deleteCourseRows(courseId) {
    const comps = await DB.get("components", `course_id=eq.${courseId}&select=id`);
    for (const comp of comps) {
      await DB.del("subcomponents", `component_id=eq.${comp.id}`);
    }
    if (comps.length) await DB.del("components", `course_id=eq.${courseId}`);
  },

  async deleteComp(compId) {
    await DB.del("subcomponents", `component_id=eq.${compId}`);
    await DB.del("components",    `id=eq.${compId}`);
  },

  async deleteSub(subId) {
    await DB.del("subcomponents", `id=eq.${subId}`);
  },

  async resetAll() {
    const terms = await DB.get("terms", "select=id");
    for (const t of terms) await this.deleteTerm(t.id);
  },
};
