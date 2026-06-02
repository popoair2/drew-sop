/**
 * app.js — Main application logic
 */

const App = {
  assets: [],
  categories: [],
  prices: {},
  snapshots: [],
  apiKey: '',
  refreshInterval: null,
  linePeriod: 'month', // day | month | year

  /** Initialize app */
  async init() {
    this.assets = Storage.getAssets();
    this.categories = Storage.getCategories();
    this.prices = Storage.getPrices();
    this.snapshots = Storage.getSnapshots();
    this.apiKey = Storage.getApiKey();

    this.bindEvents();
    this.render();

    // Check API key
    if (!this.apiKey) {
      this.showModal('modalApiKey');
    } else {
      await this.refreshPrices();
      this.startAutoRefresh();
    }
  },

  /** Bind all event listeners */
  bindEvents() {
    // Add asset
    document.getElementById('btnAddAsset').addEventListener('click', () => {
      this.openAssetModal();
    });

    // Cancel asset modal
    document.getElementById('btnCancelAsset').addEventListener('click', () => {
      this.closeModal('modalAsset');
    });

    // Asset form submit
    document.getElementById('formAsset').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAsset();
    });

    // Refresh prices
    document.getElementById('btnRefreshPrices').addEventListener('click', () => {
      this.refreshPrices();
    });

    // Manage categories
    document.getElementById('btnManageCategories').addEventListener('click', () => {
      this.openCategoryModal();
    });

    // Close categories modal
    document.getElementById('btnCloseCategories').addEventListener('click', () => {
      this.closeModal('modalCategories');
    });

    // Add category form
    document.getElementById('formAddCategory').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addCategory();
    });

    // Clear all data
    document.getElementById('btnClearData').addEventListener('click', () => {
      if (confirm('確定要清除所有數據？此操作無法復原。')) {
        Storage.clearAll();
        location.reload();
      }
    });

    // API key form
    document.getElementById('formApiKey').addEventListener('submit', (e) => {
      e.preventDefault();
      const key = document.getElementById('inputApiKey').value.trim();
      if (key) {
        Storage.setApiKey(key);
        this.apiKey = key;
        this.closeModal('modalApiKey');
        this.refreshPrices();
        this.startAutoRefresh();
      }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  },

  /** Render everything */
  render() {
    this.renderTotalValue();
    this.renderChangeBar();
    this.renderAssetList();
    this.renderPieChart();
    this.renderLineChart();
  },

  /** Calculate total value in HKD */
  calcTotalValue() {
    let total = 0;
    for (const asset of this.assets) {
      const priceInfo = this.prices[asset.id];
      if (!priceInfo) continue;
      const priceHKD = this.toHKD(priceInfo.price, priceInfo.currency);
      total += priceHKD * (asset.quantity || 0);
    }
    return total;
  },

  /** Convert price to HKD */
  toHKD(price, currency) {
    if (currency === 'HKD') return price;
    // Use cached forex or fallback
    const cacheKey = `${currency}_HKD`;
    const cached = this.prices[cacheKey];
    if (cached && Utils.now() - cached.timestamp < 3600000) {
      return price * cached.price;
    }
    // Fallback approximate rates
    const rates = { USD: 7.8, JPY: 0.053, EUR: 8.4, CNY: 1.07, GBP: 9.8, KRW: 0.0058, SGD: 5.8 };
    return price * (rates[currency] || 1);
  },

  /** Render total value in header */
  renderTotalValue() {
    const total = this.calcTotalValue();
    document.getElementById('totalValue').textContent = Utils.fmtHKD(total);
  },

  /** Render day/month/year change bar */
  renderChangeBar() {
    const current = this.calcTotalValue();
    const today = Utils.todayStr();

    // Day change
    const yesterday = Storage.getSnapshotDaysAgo(1);
    const dayEl = document.getElementById('changeDay');
    if (yesterday && current > 0) {
      const diff = current - yesterday.totalValueHKD;
      const pct = yesterday.totalValueHKD > 0 ? (diff / yesterday.totalValueHKD) * 100 : 0;
      dayEl.textContent = Utils.fmtChange(diff, pct);
      dayEl.className = 'change-value ' + (diff >= 0 ? 'positive' : 'negative');
    } else {
      dayEl.textContent = '—';
      dayEl.className = 'change-value';
    }

    // Month change
    const monthAgo = Storage.getSnapshotDaysAgo(30);
    const monthEl = document.getElementById('changeMonth');
    if (monthAgo && current > 0) {
      const diff = current - monthAgo.totalValueHKD;
      const pct = monthAgo.totalValueHKD > 0 ? (diff / monthAgo.totalValueHKD) * 100 : 0;
      monthEl.textContent = Utils.fmtChange(diff, pct);
      monthEl.className = 'change-value ' + (diff >= 0 ? 'positive' : 'negative');
    } else {
      monthEl.textContent = '—';
      monthEl.className = 'change-value';
    }

    // Year change
    const yearAgo = Storage.getSnapshotDaysAgo(365);
    const yearEl = document.getElementById('changeYear');
    if (yearAgo && current > 0) {
      const diff = current - yearAgo.totalValueHKD;
      const pct = yearAgo.totalValueHKD > 0 ? (diff / yearAgo.totalValueHKD) * 100 : 0;
      yearEl.textContent = Utils.fmtChange(diff, pct);
      yearEl.className = 'change-value ' + (diff >= 0 ? 'positive' : 'negative');
    } else {
      yearEl.textContent = '—';
      yearEl.className = 'change-value';
    }

    // Last update time
    const lastUpdate = document.getElementById('lastUpdate');
    const now = new Date();
    lastUpdate.textContent = `更新: ${now.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}`;
  },

  /** Render asset list grouped by category */
  renderAssetList() {
    const container = document.getElementById('assetList');

    if (this.assets.length === 0) {
      container.innerHTML = '<div class="empty-state">尚未新增任何資產<br>按「新增資產」開始</div>';
      return;
    }

    // Group by category
    const grouped = {};
    this.categories.forEach(cat => { grouped[cat.id] = { ...cat, assets: [] }; });
    const uncategorized = { id: null, name: '未分類', color: '#888888', assets: [] };

    this.assets.forEach(asset => {
      if (grouped[asset.category]) {
        grouped[asset.category].assets.push(asset);
      } else {
        uncategorized.assets.push(asset);
      }
    });

    let html = '';
    const groups = [...Object.values(grouped), uncategorized].filter(g => g.assets.length > 0);

    for (const group of groups) {
      let groupTotal = 0;
      group.assets.forEach(a => {
        const p = this.prices[a.id];
        if (p) groupTotal += this.toHKD(p.price, p.currency) * (a.quantity || 0);
      });

      html += `
        <div class="category-section">
          <div class="category-header">
            <h3>${group.name}</h3>
            <span class="cat-total">${Utils.fmtHKD(groupTotal)}</span>
          </div>
          <table class="asset-table">
            <thead>
              <tr>
                <th>代號</th>
                <th>名稱</th>
                <th>數量</th>
                <th>價格</th>
                <th>價值 (HKD)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${group.assets.map(asset => {
                const p = this.prices[asset.id];
                const priceStr = p ? `${Utils.currencySymbol(p.currency)}${Utils.fmt(p.price)}` : '—';
                const priceHKD = p ? this.toHKD(p.price, p.currency) : 0;
                const valueHKD = priceHKD * (asset.quantity || 0);
                return `
                  <tr>
                    <td class="symbol">${asset.symbol}</td>
                    <td>${asset.name}</td>
                    <td>${Utils.fmt(asset.quantity, 4)}</td>
                    <td class="price">${priceStr}</td>
                    <td class="value">${Utils.fmtHKD(valueHKD)}</td>
                    <td class="actions">
                      <button onclick="App.editAsset('${asset.id}')">編輯</button>
                      <button onclick="App.deleteAsset('${asset.id}')">刪除</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  /** Render pie chart */
  renderPieChart() {
    if (this.assets.length === 0) {
      if (Charts.pieChart) { Charts.pieChart.destroy(); Charts.pieChart = null; }
      return;
    }

    // Group by category, sum values
    const catValues = {};
    this.categories.forEach(cat => { catValues[cat.id] = { name: cat.name, color: cat.color, value: 0 }; });

    this.assets.forEach(asset => {
      const p = this.prices[asset.id];
      if (!p) return;
      const priceHKD = this.toHKD(p.price, p.currency);
      const value = priceHKD * (asset.quantity || 0);
      if (catValues[asset.category]) {
        catValues[asset.category].value += value;
      }
    });

    const data = Object.values(catValues).filter(c => c.value > 0);
    Charts.renderPie('pieChart', data);

    // Render legend
    const legendEl = document.getElementById('categoryLegend');
    legendEl.innerHTML = data.map(c => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${c.color}; border-color:#000;"></span>
        <span>${c.name}</span>
      </div>
    `).join('');
  },

  /** Render line chart */
  renderLineChart() {
    Charts.renderLine('lineChart', this.snapshots, this.linePeriod);
  },

  /** Refresh all prices */
  async refreshPrices() {
    if (!this.apiKey) return;
    if (this.assets.length === 0) return;

    try {
      const { prices, errors } = await API.fetchAllPrices(this.assets, this.apiKey);
      this.prices = { ...this.prices, ...prices };
      Storage.savePrices(this.prices);

      // Save daily snapshot
      const assetValues = {};
      let totalHKD = 0;
      this.assets.forEach(a => {
        const p = prices[a.id];
        if (p) {
          const priceHKD = this.toHKD(p.price, p.currency);
          const valueHKD = priceHKD * (a.quantity || 0);
          assetValues[a.id] = { priceHKD, valueHKD };
          totalHKD += valueHKD;
        }
      });
      Storage.saveDailySnapshot(totalHKD, assetValues);
      this.snapshots = Storage.getSnapshots();

      if (errors.length > 0) {
        console.warn('Price fetch errors:', errors);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    }

    this.render();
  },

  /** Start auto-refresh every 5 minutes */
  startAutoRefresh() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => this.refreshPrices(), 5 * 60 * 1000);
  }

  // --- MODAL & FORM HANDLERS ---

  showModal(id) {
    document.getElementById(id).classList.add('active');
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('active');
  },

  /** Open modal for add/edit asset */
  openAssetModal(asset = null) {
    const form = document.getElementById('formAsset');
    form.reset();

    // Populate category select
    const catSelect = document.getElementById('inputCategory');
    catSelect.innerHTML = this.categories.map(c =>
      `<option value="${c.id}">${c.name}</option>`
    ).join('');

    if (asset) {
      document.getElementById('modalAssetTitle').textContent = '編輯資產';
      document.getElementById('inputSymbol').value = asset.symbol;
      document.getElementById('inputName').value = asset.name;
      document.getElementById('inputType').value = asset.type;
      document.getElementById('inputCategory').value = asset.category || '';
      document.getElementById('inputQuantity').value = asset.quantity;
      document.getElementById('inputCurrency').value = asset.currency || 'USD';
      form.dataset.editId = asset.id;
    } else {
      document.getElementById('modalAssetTitle').textContent = '新增資產';
      delete form.dataset.editId;
    }

    this.showModal('modalAsset');
  },

  /** Save asset from form */
  saveAsset() {
    const form = document.getElementById('formAsset');
    const editId = form.dataset.editId;

    const asset = {
      symbol: document.getElementById('inputSymbol').value.trim().toUpperCase(),
      name: document.getElementById('inputName').value.trim(),
      type: document.getElementById('inputType').value,
      category: document.getElementById('inputCategory').value,
      quantity: parseFloat(document.getElementById('inputQuantity').value) || 0,
      currency: document.getElementById('inputCurrency').value
    };

    if (editId) {
      Storage.updateAsset(editId, asset);
    } else {
      Storage.addAsset(asset);
    }

    this.assets = Storage.getAssets();
    this.closeModal('modalAsset');
    this.render();
  },

  /** Edit asset */
  editAsset(id) {
    const asset = this.assets.find(a => a.id === id);
    if (asset) this.openAssetModal(asset);
  },

  /** Delete asset */
  deleteAsset(id) {
    if (confirm('確定要刪除此資產？')) {
      Storage.deleteAsset(id);
      this.assets = Storage.getAssets();
      this.render();
    }
  },

  /** Open category management modal */
  openCategoryModal() {
    this.renderCategoryList();
    this.showModal('modalCategories');
  },

  /** Render category list in modal */
  renderCategoryList() {
    const container = document.getElementById('categoryList');
    container.innerHTML = this.categories.map(cat => `
      <div class="cat-manage-item">
        <span class="cat-color" style="background:${cat.color};"></span>
        <span class="cat-name">${cat.name}</span>
        <button class="btn-delete-cat" onclick="App.deleteCategory('${cat.id}')">刪除</button>
      </div>
    `).join('');
  },

  /** Add new category */
  addCategory() {
    const name = document.getElementById('inputCategoryName').value.trim();
    const color = document.getElementById('inputCategoryColor').value;
    if (!name) return;

    Storage.addCategory(name, color);
    this.categories = Storage.getCategories();
    document.getElementById('inputCategoryName').value = '';
    this.renderCategoryList();
  },

  /** Delete category */
  deleteCategory(id) {
    if (Storage.deleteCategory(id)) {
      this.categories = Storage.getCategories();
      this.renderCategoryList();
    } else {
      alert('無法刪除此分類，因為有資產正在使用。');
    }
  }
};

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
