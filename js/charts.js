/**
 * charts.js — Chart.js wrappers for pie + line charts
 */

const Charts = {
  pieChart: null,
  lineChart: null,

  /** Color palette for categories (Neo-Brutalist) */
  categoryColors: [
    '#B8E986', // green
    '#F5D76E', // yellow
    '#C7A8E8', // purple
    '#FF6B6B', // orange-red
    '#7EC8E3', // blue
    '#FFB6C1', // pink
    '#87CEEB', // sky
    '#DDA0DD', // plum
    '#98FB98', // pale green
    '#F0E68C', // khaki
  ],

  /** Get color by index */
  color(i) {
    return this.categoryColors[i % this.categoryColors.length];
  },

  /** Render/update pie chart */
  renderPie(canvasId, categoryData) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const labels = categoryData.map(c => c.name);
    const data = categoryData.map(c => c.value);
    const colors = categoryData.map((c, i) => c.color || this.color(i));

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
          borderColor: '#000000',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#000000',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            borderColor: '#FFFFFF',
            borderWidth: 2,
            cornerRadius: 12,
            padding: 12,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` HK$${Utils.fmt(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  /** Render/update line chart */
  renderLine(canvasId, snapshots, period) {
    const ctx = document.getElementById(canvasId).getContext('2d');

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
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const filtered = snapshots.filter(s => s.date >= cutoffStr);
    const labels = filtered.map(s => s.date.slice(5)); // MM-DD
    const data = filtered.map(s => s.totalValueHKD);

    if (this.lineChart) {
      this.lineChart.destroy();
    }

    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '總資產 (HKD)',
          data,
          borderColor: '#000000',
          backgroundColor: 'rgba(184, 233, 134, 0.2)',
          borderWidth: 3,
          fill: true,
          tension: 0,
          pointRadius: 0,
          pointHitRadius: 10,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#000000',
          pointHoverBorderColor: '#FFFFFF',
          pointHoverBorderWidth: 2
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
            backgroundColor: '#000000',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            borderColor: '#FFFFFF',
            borderWidth: 2,
            cornerRadius: 12,
            padding: 12,
            callbacks: {
              label: (ctx) => ` HK$${Utils.fmt(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#000000',
              font: { family: "'Space Grotesk', sans-serif", size: 11 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.1)' },
            ticks: {
              color: '#000000',
              font: { family: "'Space Grotesk', sans-serif", size: 11 },
              callback: (v) => '$' + Utils.fmt(v)
            }
          }
        }
      }
    });
  }
};
