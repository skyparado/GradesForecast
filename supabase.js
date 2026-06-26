/* ============================================================================
 * supabase.js — thin Supabase REST API wrapper
 * ========================================================================== */

const DB = {
  BASE: "https://fhdywtdbcxpkqtotbxgd.supabase.co/rest/v1",
  KEY:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZHl3dGRiY3hwa3F0b3RieGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzkyNjQsImV4cCI6MjA5ODA1NTI2NH0.qsRiGxgkmjFWoIiEyKawfoW58P5ff1AMae9pmGIM6Ok",

  _h(extra = {}) {
    return {
      apikey:        this.KEY,
      Authorization: `Bearer ${this.KEY}`,
      "Content-Type": "application/json",
      ...extra,
    };
  },

  async get(table, qs = "") {
    const r = await fetch(`${this.BASE}/${table}?${qs}`, { headers: this._h() });
    if (!r.ok) throw new Error(`GET ${table}: ${await r.text()}`);
    return r.json();
  },

  async post(table, body) {
    const r = await fetch(`${this.BASE}/${table}`, {
      method:  "POST",
      headers: this._h({ Prefer: "return=representation" }),
      body:    JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${table}: ${await r.text()}`);
    return r.json();
  },

  async patch(table, id, body) {
    const r = await fetch(`${this.BASE}/${table}?id=eq.${id}`, {
      method:  "PATCH",
      headers: this._h({ Prefer: "return=representation" }),
      body:    JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`PATCH ${table}/${id}: ${await r.text()}`);
    return r.json();
  },

  async del(table, filter) {
    const r = await fetch(`${this.BASE}/${table}?${filter}`, {
      method:  "DELETE",
      headers: this._h(),
    });
    if (!r.ok) throw new Error(`DELETE ${table} (${filter}): ${await r.text()}`);
  },
};
