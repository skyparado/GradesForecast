const Models = {
  uid() { return crypto.randomUUID(); },

  createTerm(name) {
    return {
      id:       this.uid(),
      name:     name.trim(),
      courses:  [],
      dlTarget: 3.0,
    };
  },

  createCourse(name) {
    return {
      id:                this.uid(),
      name:              name.trim(),
      fullName:          "",
      units:             3,
      passingThreshold:  60,
      overallConfidence: 1,
      flatGrade:         false,
      flatScore:         null,
      components:        [],
    };
  },

  createComponent(name, weight = 0) {
    return {
      id:            this.uid(),
      name:          name.trim(),
      weight:        Number(weight),
      confidence:    1,
      subcomponents: [],
      totalMarks:    null,
      realScore:     null,
      locked:        false,
    };
  },

  createSubcomponent(name) {
    return {
      id:         this.uid(),
      name:       name.trim(),
      totalMarks: null,
      realScore:  null,
      locked:     false,
    };
  },
};
