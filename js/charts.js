/**
 * charts.js — Chart.js wrappers for pie + line charts
 */

const Charts = {
  pieChart: null,
  lineChart: null,

  /** Color palette for categories (Retro-Futuristic) */
  categoryColors: [
    '#E8735A', // coral
    '#D4A843', // mustard
    '#E07A3A', // orange
    '#C084FC', // purple (muted)
    '#60A5FA', // blue (muted)
    '#F472B6', // pink (muted)
    '#2DD4BF', // teal
    '#F08C72', // salmon
    '#A8E063', // green (muted)
    '#FFD93D', // yellow (muted)
  ],

  /** Get color by index */
  color(i) {
    return this.categoryColors[i % this.categoryColors.length];
  },

  /** Render/update pie chart */
  renderPie(canvasId, categoryData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const total = categoryData.reduce((sum, c) => sum + c.value, 0);

    // Build labels with percentage
    const labels = categoryData.map(c => {
      const pct = total > 0 ? ((c.value / total) * 100).toFixed(1) : '0.0';
      return `${c.name} ${pct}%`;
    });
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
          borderColor: '#1A1410',
          borderWidth: 2.5,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1410',
            titleColor: '#F5F0E8',
            bodyColor: '#F5F0E8',
            borderColor: '#F5F0E8',
            borderWidth: 2,
            cornerRadius: 14,
            padding: 14,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
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
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle empty snapshots
    if (!snapshots || snapshots.length === 0) {
      // Draw empty state
      if (this.lineChart) {
        this.lineChart.destroy();
        this.lineChart = null;
      }
      ctx.save();
      ctx.fillStyle = '#1A1410';
      ctx.font = "600 13px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.4;
      ctx.fillText('暫無歷史數據', canvas.width / 2, canvas.height / 2);
      ctx.restore();
      return;
    }

    // Filter snapshots based on period
    // Supabase returns: { created_at: "2026-06-04T...", total_value_hkd: 123456, values: {...} }
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
      ctx.fillStyle = '#1A1410';
      ctx.font = "600 13px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.4;
      ctx.fillText('暫無歷史數據', canvas.width / 2, canvas.height / 2);
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
          label: '總資產 (HKD)',
          data,
          borderColor: '#1A1410',
          backgroundColor: 'rgba(232, 115, 90, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHitRadius: 12,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#1A1410',
          pointHoverBorderColor: '#F5F0E8',
          pointHoverBorderWidth: 2.5
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
            backgroundColor: '#1A1410',
            titleColor: '#F5F0E8',
            bodyColor: '#F5F0E8',
            borderColor: '#F5F0E8',
            borderWidth: 2,
            cornerRadius: 14,
            padding: 14,
            callbacks: {
              label: (ctx) => ` HK$${Utils.fmt(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#1A1410',
              font: { family: "'Space Grotesk', sans-serif", size: 11, weight: '600' },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: { color: 'rgba(26,20,16,0.08)' },
            ticks: {
              color: '#1A1410',
              font: { family: "'Space Grotesk', sans-serif", size: 11, weight: '600' },
              callback: (v) => '$' + Utils.fmt(v)
            }
          }
        }
      }
    });
  }
};
