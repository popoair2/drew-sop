/**
 * charts.js — Chart.js wrappers for line chart + pie chart for allocation
 */

const Charts = {
  pieChart: null,
  lineChart: null,

  /** Green palette for categories (terminal style) */
  categoryColors: [
    '#00FF41', // bright green
    '#00D936', // green
    '#00B32D', // medium green
    '#008F11', // dim green
    '#39FF14', // neon green
    '#00FF80', // green-cyan
    '#4AFF9E', // light green
    '#00CC33', // dark green
  ],

  /** Get color by index */
  color(i) {
    return this.categoryColors[i % this.categoryColors.length];
  },

  /**
   * Read a CSS custom property value from :root
   */
  _css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  },

  /**
   * Render pie/doughnut chart for category allocation
   * categoryData: [{ name, color, value, weightedYield }]
   */
  renderPie(canvasId, categoryData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Read theme-aware colours from CSS
    const greenBright = this._css('--green-bright') || '#00FF41';
    const greenDim    = this._css('--green-dim')    || '#008F11';
    const bgCard      = this._css('--bg-card')      || '#0A0A0A';
    const fontFamily  = this._css('--font')         || "'Courier New', monospace";
    const radius      = parseInt(this._css('--radius')) || 0;

    const total = categoryData.reduce((sum, c) => sum + c.value, 0);

    if (total === 0 || categoryData.length === 0) {
      if (this.pieChart) {
        this.pieChart.destroy();
        this.pieChart = null;
      }
      ctx.save();
      ctx.fillStyle = greenDim;
      ctx.font = "700 12px " + fontFamily;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5;
      ctx.fillText('[ NO ALLOCATION DATA ]', canvas.width / 2, canvas.height / 2);
      ctx.restore();
      return;
    }

    // Sort by value descending
    const sorted = [...categoryData].sort((a, b) => b.value - a.value);

    const labels = sorted.map(c => c.name);
    const data   = sorted.map(c => c.value);
    const colors = sorted.map(c => c.color || '#00FF41');

    if (this.pieChart) {
      this.pieChart.destroy();
    }

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: bgCard,
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverBorderColor: greenBright,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: bgCard,
            titleColor: greenBright,
            bodyColor: greenBright,
            borderColor: greenBright,
            borderWidth: 1,
            cornerRadius: radius,
            padding: 10,
            titleFont: { family: fontFamily, size: 11 },
            bodyFont: { family: fontFamily, size: 12 },
            displayColors: true,
            callbacks: {
              title: (items) => `[ ${items[0].label} ]`,
              label: (ctx) => {
                const val = ctx.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                return ` HK$${Utils.fmtVal(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * Render CLI-style horizontal bar chart (replaces pie chart)
   * categoryData: [{ name, color, value, weightedYield, yieldWeight }]
   */
  renderCliBar(canvasId, categoryData) {
    const container = document.getElementById(canvasId);
    if (!container) return;

    const total = categoryData.reduce((sum, c) => sum + c.value, 0);

    if (total === 0 || categoryData.length === 0) {
      container.innerHTML = '<div class="empty-state">no allocation data</div>';
      return;
    }

    // Sort by value descending
    const sorted = [...categoryData].sort((a, b) => b.value - a.value);

    let html = '';
    for (const cat of sorted) {
      const pct = total > 0 ? ((cat.value / total) * 100) : 0;
      const barWidth = Math.max(pct, 1);
      const fillClass = pct > 30 ? 'high' : (pct > 10 ? 'mid' : '');
      const barColor = cat.color || '#00FF41';

      // Weighted avg dividend yield (weighted by ALL assets in category, not just yielding ones)
      let yieldStr = '';
      if (cat.value > 0 && cat.weightedYield > 0) {
        const avgYield = cat.weightedYield / cat.value;
        yieldStr = ` <span class="legend-yield">DY:${avgYield.toFixed(2)}%</span>`;
      }

      html += `
        <div class="cli-bar-row">
          <span class="cli-bar-label" title="${cat.name}">${cat.name}</span>
          <div class="cli-bar-track">
            <div class="cli-bar-fill ${fillClass}" style="width:${barWidth}%; background:${barColor}; ${pct > 30 ? 'box-shadow:0 0 8px rgba(0,255,65,0.3)' : ''}"></div>
          </div>
          <span class="cli-bar-pct">${pct.toFixed(1)}%</span>
          <span class="cli-bar-value">${Utils.fmtHKD(cat.value)}${yieldStr}</span>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  /** Render/update line chart — reads colours from CSS variables for theme support */
  renderLine(canvasId, snapshots, period) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Read theme-aware colours from CSS
    const greenBright = this._css('--green-bright') || '#00FF41';
    const greenDim    = this._css('--green-dim')    || '#008F11';
    const greenDark   = this._css('--green-dark')   || '#003B00';
    const bgCard      = this._css('--bg-card')      || '#0A0A0A';
    const fontFamily  = this._css('--font')         || "'Courier New', monospace";
    const radius      = parseInt(this._css('--radius')) || 0;

    // Handle empty snapshots
    if (!snapshots || snapshots.length === 0) {
      if (this.lineChart) {
        this.lineChart.destroy();
        this.lineChart = null;
      }
      ctx.save();
      ctx.fillStyle = greenDim;
      ctx.font = "700 12px " + fontFamily;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5;
      ctx.fillText('[ NO HISTORICAL DATA ]', canvas.width / 2, canvas.height / 2);
      ctx.restore();
      return;
    }

    // Filter snapshots based on period
    const now = new Date();
    let cutoff = new Date();
    if (period === 'day') {
      cutoff.setDate(now.getDate() - 1);
    } else if (period === 'month') {
      cutoff.setMonth(now.getMonth() - 1);
    } else if (period === 'year') {
      cutoff.setFullYear(now.getFullYear() - 1);
    }

    const filtered = snapshots.filter(s => {
      const d = new Date(s.created_at);
      return d >= cutoff;
    });

    if (filtered.length === 0) {
      if (this.lineChart) {
        this.lineChart.destroy();
        this.lineChart = null;
      }
      ctx.save();
      ctx.fillStyle = greenDim;
      ctx.font = "700 12px " + fontFamily;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5;
      ctx.fillText('[ NO HISTORICAL DATA ]', canvas.width / 2, canvas.height / 2);
      ctx.restore();
      return;
    }

    const labels = filtered.map(s => {
      const d = new Date(s.created_at);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const data = filtered.map(s => s.total_value_hkd);

    if (this.lineChart) {
      this.lineChart.destroy();
    }

    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'TOTAL (HKD)',
          data,
          borderColor: greenBright,
          backgroundColor: 'rgba(0, 255, 65, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 3,
          pointHitRadius: 12,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: greenBright,
          pointHoverBorderColor: '#000000',
          pointHoverBorderWidth: 2,
          pointBackgroundColor: greenBright,
          pointBorderColor: '#000000'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: bgCard,
            titleColor: greenBright,
            bodyColor: greenBright,
            borderColor: greenBright,
            borderWidth: 1,
            cornerRadius: radius,
            padding: 10,
            titleFont: { family: fontFamily, size: 11 },
            bodyFont: { family: fontFamily, size: 12 },
            displayColors: false,
            callbacks: {
              title: (items) => `[ ${items[0].label} ]`,
              label: (ctx) => ` HK$${Utils.fmt(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(0, 59, 0, 0.3)',
              drawBorder: true,
              borderColor: greenDark
            },
            ticks: {
              color: greenDim,
              font: { family: fontFamily, size: 10 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 59, 0, 0.2)',
              drawBorder: true,
              borderColor: greenDark
            },
            ticks: {
              color: greenDim,
              font: { family: fontFamily, size: 10 },
              callback: (v) => '$' + Utils.fmt(v)
            }
          }
        }
      }
    });
  }
};
