const Models = {
  uid(p = "id") {
    return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  CONF_LABELS: ["Low", "Medium", "High"],
  CONF_VALUES: [75, 82, 90],

  createTerm(name) {
    return {
      id:       this.uid("t"),
      name:     name.trim(),
      courses:  [],
      dlTarget: 3.0,
    };
  },

  createCourse(name) {
    return {
      id:                this.uid("c"),
      name:              name.trim(),
      units:             3,
      passingThreshold:  60,   // 60 or 70
      overallConfidence: 1,    // 0=Low 1=Med 2=High
      components:        [],
    };
  },

  createComponent(name, weight = 0) {
    return {
      id:             this.uid("comp"),
      name:           name.trim(),
      weight:         Number(weight),
      confidence:     1,    // 0=Low 1=Med 2=High
      subcomponents:  [],
      // used when subcomponents.length === 0
      totalMarks:     null,
      realScore:      null,
      locked:         false,
    };
  },

  createSubcomponent(name) {
    return {
      id:         this.uid("sub"),
      name:       name.trim(),
      totalMarks: null,
      realScore:  null,
      locked:     false,
    };
  },
};
