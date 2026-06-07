/**
 * charts.js — Chart.js wrappers for line chart + CLI bar chart for allocation
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

      // Weighted avg dividend yield
      let yieldStr = '';
      if (cat.yieldWeight > 0) {
        const avgYield = cat.weightedYield / cat.yieldWeight;
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

  /** Render/update line chart — terminal green on black */
  renderLine(canvasId, snapshots, period) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle empty snapshots
    if (!snapshots || snapshots.length === 0) {
      if (this.lineChart) {
        this.lineChart.destroy();
        this.lineChart = null;
      }
      ctx.save();
      ctx.fillStyle = '#008F11';
      ctx.font = "700 12px 'Courier New', monospace";
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
      ctx.fillStyle = '#008F11';
      ctx.font = "700 12px 'Courier New', monospace";
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
          borderColor: '#00FF41',
          backgroundColor: 'rgba(0, 255, 65, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 3,
          pointHitRadius: 12,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#00FF41',
          pointHoverBorderColor: '#000000',
          pointHoverBorderWidth: 2,
          pointBackgroundColor: '#00FF41',
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
            backgroundColor: '#0A0A0A',
            titleColor: '#00FF41',
            bodyColor: '#00FF41',
            borderColor: '#00FF41',
            borderWidth: 1,
            cornerRadius: 0,
            padding: 10,
            titleFont: { family: "'Courier New', monospace", size: 11 },
            bodyFont: { family: "'Courier New', monospace", size: 12 },
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
              borderColor: '#003B00'
            },
            ticks: {
              color: '#008F11',
              font: { family: "'Courier New', monospace", size: 10 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 59, 0, 0.2)',
              drawBorder: true,
              borderColor: '#003B00'
            },
            ticks: {
              color: '#008F11',
              font: { family: "'Courier New', monospace", size: 10 },
              callback: (v) => '$' + Utils.fmt(v)
            }
          }
        }
      }
    });
  }
};
