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
  isLoading: false,
  fetchErrors: [],

  /** Initialize app */
  async init() {
    this.assets = Storage.getAssets();
    this.categories = Storage.getCategories();
    this.prices = Storage.getPrices();
    this.snapshots = Storage.getSnapshots();
    this.apiKey = Storage.getApiKey();

    this.bindEvents();
    this.render();

    if (!this.apiKey) {
      this.showModal('modalApiKey');
    } else {
      await this.refreshPrices();
      this.startAutoRefresh();
    }
  },

  /** Bind all event listeners */
  bindEvents() {
    document.getElementById('btnAddAsset').addEventListener('click', () => this.openAssetModal());
    document.getElementById('btnCancelAsset').addEventListener('click', () => this.closeModal('modalAsset'));
    document.getElementById('formAsset').addEventListener('submit', (e) => { e.preventDefault(); this.saveAsset(); });
    document.getElementById('btnRefreshPrices').addEventListener('click', () => this.refreshPrices());
    document.getElementById('btnManageCategories').addEventListener('click', () => this.openCategoryModal());
    document.getElementById('btnCloseCategories').addEventListener('click', () => this.closeModal('modalCategories'));
    document.getElementById('formAddCategory').addEventListener('submit', (e) => { e.preventDefault(); this.addCategory(); });

    document.getElementById('btnClearData').addEventListener('click', () => {
      if (confirm('確定要清除所有數據？此操作無法復原。')) {
        Storage.clearAll();
        location.reload();
      }
    });

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

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
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
    this.renderErrors();
  },

  // =============================================
  // VALUE CALCULATIONS
  // =============================================

  /** Get stored forex rates (for non-API conversions) */
  getForexRates() {
    const rates = {};
    rates['HKD_HKD'] = 1;
    for (const asset of this.assets) {
      const p = this.prices[asset.id];
      if (p && p.forexBase && p.rateToHKD) {
        rates[`${p.forexBase}_HKD`] = p.rateToHKD;
        rates[`${asset.currency}_HKD`] = p.rateToHKD / p.price;
      }
    }
    const fallback = {
      USD_HKD: 7.84, JPY_HKD: 0.053, EUR_HKD: 8.0,
      CNY_HKD: 1.07, GBP_HKD: 9.15, KRW_HKD: 0.0057, SGD_HKD: 5.75,
      HKD_HKD: 1.0
    };
    for (const [k, v] of Object.entries(fallback)) {
      if (!rates[k]) rates[k] = v;
    }
    return rates;
  },

  /** Convert price to HKD */
  toHKD(price, currency, forexInfo) {
    if (currency === 'HKD') return price;
    const rates = this.getForexRates();
    const key = `${currency}_HKD`;
    if (rates[key]) return price * rates[key];
    if (forexInfo && forexInfo.rateToHKD) return price * forexInfo.rateToHKD;
    return price;
  },

  /** Calculate total value in HKD */
  calcTotalValue() {
    let total = 0;
    for (const asset of this.assets) {
      const priceInfo = this.prices[asset.id];
      if (!priceInfo) continue;
      const priceHKD = this.toHKD(priceInfo.price, priceInfo.currency, priceInfo);
      total += priceHKD * (asset.quantity || 0);
    }
    return total;
  },

  // =============================================
  // RENDERERS
  // =============================================

  /** Render total value in header */
  renderTotalValue() {
    const total = this.calcTotalValue();
    const el = document.getElementById('totalValue');
    el.textContent = this.assets.length > 0 ? Utils.fmtHKD(total) : '—';
  },

  /** Render day/month/year change bar */
  renderChangeBar() {
    const current = this.calcTotalValue();

    const periods = [
      { id: 'changeDay', days: 1 },
      { id: 'changeMonth', days: 30 },
      { id: 'changeYear', days: 365 }
    ];

    for (const p of periods) {
      const el = document.getElementById(p.id);
      const snap = Storage.getSnapshotDaysAgo(p.days);
      if (snap && current > 0 && snap.totalValueHKD > 0) {
        const diff = current - snap.totalValueHKD;
        const pct = (diff / snap.totalValueHKD) * 100;
        el.textContent = Utils.fmtChange(diff, pct);
        el.className = 'change-value ' + (diff >= 0 ? 'positive' : 'negative');
      } else {
        el.textContent = '—';
        el.className = 'change-value';
      }
    }

    const now = new Date();
    document.getElementById('lastUpdate').textContent =
      `更新: ${now.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}`;
  },

  /** Render asset list grouped by category */
  renderAssetList() {
    const container = document.getElementById('assetList');

    if (this.assets.length === 0) {
      container.innerHTML = '<div class="empty-state">尚未新增任何資產<br>按「新增資產」開始</div>';
      return;
    }

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
        if (p) groupTotal += this.toHKD(p.price, p.currency, p) * (a.quantity || 0);
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
                const priceStr = p ? `${Utils.currencySymbol(p.currency)}${Utils.fmt(p.price)}` : '<span class="loading-dots"><span></span><span></span><span></span></span>';
                const priceHKD = p ? this.toHKD(p.price, p.currency, p) : 0;
                const valueHKD = priceHKD * (asset.quantity || 0);
                return `
                  <tr>
                    <td class="symbol">${asset.symbol}</td>
                    <td>${asset.name}</td>
                    <td>${Utils.fmt(asset.quantity, 4)}</td>
                    <td class="price">${priceStr}</td>
                    <td class="value">${p ? Utils.fmtHKD(valueHKD) : '—'}</td>
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
      const legendEl = document.getElementById('categoryLegend');
      if (legendEl) legendEl.innerHTML = '';
      return;
    }

    const catValues = {};
    this.categories.forEach(cat => { catValues[cat.id] = { name: cat.name, color: cat.color, value: 0 }; });

    this.assets.forEach(asset => {
      const p = this.prices[asset.id];
      if (!p) return;
      const priceHKD = this.toHKD(p.price, p.currency, p);
      const value = priceHKD * (asset.quantity || 0);
      if (catValues[asset.category]) {
        catValues[asset.category].value += value;
      }
    });

    const data = Object.values(catValues).filter(c => c.value > 0);
    if (data.length > 0) {
      Charts.renderPie('pieChart', data);
    }

    const legendEl = document.getElementById('categoryLegend');
    if (legendEl) {
      legendEl.innerHTML = data.map(c => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${c.color}; border-color:#000;"></span>
          <span>${c.name}: ${Utils.fmtHKD(c.value)}</span>
        </div>
      `).join('');
    }
  },

  /** Render line chart */
  renderLineChart() {
    Charts.renderLine('lineChart', this.snapshots, this.linePeriod);
  },

  /** Set line chart period */
  setPeriod(period) {
    this.linePeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });
    this.renderLineChart();
  },

  /** Render fetch errors */
  renderErrors() {
    let errorBar = document.getElementById('errorBar');
    if (!errorBar) {
      errorBar = document.createElement('div');
      errorBar.id = 'errorBar';
      errorBar.className = 'error-bar';
      const changeBar = document.getElementById('changeBar');
      changeBar?.insertAdjacentElement('afterend', errorBar);
    }

    if (this.fetchErrors.length === 0 && !this.isLoading) {
      errorBar.innerHTML = '';
      errorBar.style.display = 'none';
      return;
    }

    errorBar.style.display = 'block';

    if (this.isLoading) {
      errorBar.innerHTML = `
        <span class="loading-dots"><span></span><span></span><span></span></span>
        <span class="error-text">更新緊價格...</span>
      `;
      return;
    }

    if (this.fetchErrors.length > 0) {
      errorBar.innerHTML = `
        <span class="error-icon">⚠</span>
        <span class="error-text">部分資產更新失敗: ${this.fetchErrors.map(e => e.symbol).join(', ')}</span>
        <button class="btn-dismiss" onclick="App.dismissErrors()">✕</button>
      `;
    }
  },

  /** Dismiss error bar */
  dismissErrors() {
    this.fetchErrors = [];
    this.renderErrors();
  },

  // =============================================
  // PRICE REFRESH
  // =============================================

  /** Refresh all prices */
  async refreshPrices() {
    if (!this.apiKey) return;
    if (this.assets.length === 0) return;

    this.isLoading = true;
    this.fetchErrors = [];
    this.renderErrors();

    try {
      const { prices, errors } = await API.fetchAllPrices(this.assets, this.apiKey);
      this.prices = { ...this.prices, ...prices };
      this.fetchErrors = errors;
      Storage.savePrices(this.prices);

      const assetValues = {};
      let totalHKD = 0;
      this.assets.forEach(a => {
        const p = prices[a.id];
        if (p) {
          const priceHKD = this.toHKD(p.price, p.currency, p);
          const valueHKD = priceHKD * (a.quantity || 0);
          assetValues[a.id] = { priceHKD, valueHKD };
          totalHKD += valueHKD;
        }
      });
      Storage.saveDailySnapshot(totalHKD, assetValues);
      this.snapshots = Storage.getSnapshots();
    } catch (err) {
      this.fetchErrors.push({ symbol: 'ALL', name: '', error: err.message });
    }

    this.isLoading = false;
    this.render();
  },

  /** Start auto-refresh every 5 minutes */
  startAutoRefresh() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => this.refreshPrices(), 5 * 60 * 1000);
  },

  // =============================================
  // MODAL & FORM HANDLERS
  // =============================================

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

  editAsset(id) {
    const asset = this.assets.find(a => a.id === id);
    if (asset) this.openAssetModal(asset);
  },

  deleteAsset(id) {
    if (confirm('確定要刪除此資產？')) {
      Storage.deleteAsset(id);
      this.assets = Storage.getAssets();
      this.render();
    }
  },

  openCategoryModal() {
    this.renderCategoryList();
    this.showModal('modalCategories');
  },

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

  addCategory() {
    const name = document.getElementById('inputCategoryName').value.trim();
    const color = document.getElementById('inputCategoryColor').value;
    if (!name) return;
    Storage.addCategory(name, color);
    this.categories = Storage.getCategories();
    document.getElementById('inputCategoryName').value = '';
    this.renderCategoryList();
  },

  deleteCategory(id) {
    if (Storage.deleteCategory(id)) {
      this.categories = Storage.getCategories();
      this.renderCategoryList();
    } else {
      alert('無法刪除此分類，因為有資產正在使用。');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
