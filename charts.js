/* ============================================================================
 * charts.js
 * ----------------------------------------------------------------------------
 * Two small hand-drawn charts using the plain <canvas> API — no libraries, so
 * nothing to install and nothing to break. Both take a canvas element and an
 * array of data, and just draw. Keep them dumb: they don't read app state.
 * ========================================================================== */

const Charts = {
  // Reads CSS variables so the charts match the theme automatically.
  colors(canvas) {
    const css = getComputedStyle(document.documentElement);
    return {
      ink: css.getPropertyValue("--ink").trim() || "#1b2030",
      muted: css.getPropertyValue("--muted").trim() || "#6b7280",
      line: css.getPropertyValue("--line").trim() || "#e6e8ec",
      brand: css.getPropertyValue("--brand").trim() || "#4338ca",
      amber: css.getPropertyValue("--amber").trim() || "#d97706",
    };
  },

  // Makes the canvas crisp on high-DPI screens and clears it.
  prep(canvas) {
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  },

  // ----- Line chart: grade or score over time --------------------------------
  // points = [{ label, value }]  (value is 0–100). Draws a 0–100 axis.
  line(canvas, points) {
    const { ctx, w, h } = this.prep(canvas);
    const c = this.colors(canvas);
    const pad = { l: 34, r: 12, t: 12, b: 24 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    if (!points.length) return this.empty(ctx, w, h, c, "No data yet");

    // Gridlines + y labels at 0, 50, 100
    ctx.strokeStyle = c.line;
    ctx.fillStyle = c.muted;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "right";
    [0, 50, 100].forEach((val) => {
      const y = pad.t + plotH * (1 - val / 100);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillText(val, pad.l - 6, y + 3);
    });

    // The line itself
    const x = (i) => pad.l + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
    const y = (v) => pad.t + plotH * (1 - Math.max(0, Math.min(100, v)) / 100);

    ctx.strokeStyle = c.brand;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.value)) : ctx.moveTo(x(i), y(p.value))));
    ctx.stroke();

    // Dots
    ctx.fillStyle = c.brand;
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(p.value), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  // ----- Bar chart: confidence per category ----------------------------------
  // bars = [{ label, value }]  (value 0–100).
  bars(canvas, bars) {
    const { ctx, w, h } = this.prep(canvas);
    const c = this.colors(canvas);
    const pad = { l: 10, r: 10, t: 12, b: 34 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    if (!bars.length) return this.empty(ctx, w, h, c, "No categories yet");

    const gap = 12;
    const barW = Math.min(56, (plotW - gap * (bars.length - 1)) / bars.length);

    bars.forEach((b, i) => {
      const x = pad.l + i * (barW + gap);
      const barH = plotH * (Math.max(0, Math.min(100, b.value)) / 100);
      const y = pad.t + plotH - barH;

      ctx.fillStyle = b.value < 50 ? c.amber : c.brand;
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = c.muted;
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(Math.round(b.value), x + barW / 2, y - 4);

      const short = b.label.length > 8 ? b.label.slice(0, 7) + "…" : b.label;
      ctx.fillText(short, x + barW / 2, h - pad.b + 16);
    });
  },

  empty(ctx, w, h, c, msg) {
    ctx.fillStyle = c.muted;
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(msg, w / 2, h / 2);
  },
};
