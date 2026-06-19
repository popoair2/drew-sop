/**
 * app.js — Main application logic (Supabase-backed)
 */

const App = {
  assets: [],
  categories: [],
  prices: {},
  snapshots: [],
  apiKey: '',
  refreshInterval: null,
  linePeriod: 'month',
  isLoading: false,
  fetchErrors: [],

  /** Boot sequence animation */
  async _bootSequence() {
    const el = document.getElementById('bootSequence');
    if (!el) return;
    const lines = [
      { text: 'DREW-SOP ASSET TERMINAL v2.0', cls: 'cmd' },
      { text: 'Initializing system...', cls: 'info' },
      { text: '[OK] Loading kernel modules', cls: 'ok', delay: 200 },
      { text: '[OK] Connecting to Supabase backend', cls: 'ok', delay: 400 },
      { text: '[OK] Price feeds online (Yahoo + CoinGecko)', cls: 'ok', delay: 300 },
      { text: '[OK] Dashboard ready.', cls: 'ok', delay: 200 },
    ];
    for (const line of lines) {
      const div = document.createElement('div');
      div.className = `boot-line ${line.cls}`;
      div.textContent = line.text;
      el.appendChild(div);
      if (line.delay) await new Promise(r => setTimeout(r, line.delay));
    }
    await new Promise(r => setTimeout(r, 300));
    el.style.display = 'none';
  },

  /** Initialize app */
  async init() {
    // ── Init theme engine BEFORE anything visual ──
    ThemeEngine.init();
    this._renderThemeSwitcher();

    // Listen for theme changes to re-render charts (colours may differ)
    window.addEventListener('themechange', () => {
      this._renderThemeSwitcher();
      this.renderPieChart();
      this.renderLineChart();
    });

    // Boot animation
    await this._bootSequence();

    // Load from Supabase (with localStorage fallback)
    this.assets = await Storage.getAssets();
    this.categories = await Storage.getCategories();
    this.prices = Storage.getPrices();
    this.snapshots = await Storage.getSnapshots();
    this.dividendYields = Storage.getDividendYields();

    // Migrate any existing local data to Supabase
    await Storage.migrateLocalToSupabase();

    // Re-read after migration
    this.assets = await Storage.getAssets();
    this.categories = await Storage.getCategories();

    this.bindEvents();
    this.render();

    // API key is embedded, always refresh
    await this.refreshPrices();
    this.startAutoRefresh();
  },

  // ── THEME SWITCHER ──────────────────────────────────────────────

  /** Render the theme switcher buttons */
  _renderThemeSwitcher() {
    const container = document.getElementById('themeOptions');
    if (!container) return;

    const themes = ThemeEngine.list();
    const current = ThemeEngine.current();

    container.innerHTML = themes.map(id => {
      const active = id === current ? ' active' : '';
      // Format: "hacker-terminal" → "HACKER TERMINAL"
      const label = id.replace(/-/g, ' ').toUpperCase();
      return `<button class="theme-btn${active}" data-theme="${id}" onclick="App._switchTheme('${id}')">[${label}]</button>`;
    }).join('');
  },

  /** Switch theme (called by button onclick) */
  _switchTheme(name) {
    ThemeEngine.apply(name);
    // The 'themechange' event listener in init() handles re-render
  },

  /** Bind all event listeners */
  bindEvents() {
    document.getElementById('btnAddAsset').addEventListener('click', () => this.openAssetModal());
    document.getElementById('btnCancelAsset').addEventListener('click', () => this.closeModal('modalAsset'));
    document.getElementById('formAsset').addEventListener('submit', (e) => { e.preventDefault(); this.saveAsset(); });
    document.getElementById('btnRefreshPrices').addEventListener('click', () => this.refreshPrices());

    // Search dropdown — debounce input on SYMBOL field (not name)
    const symInput = document.getElementById('inputSymbol');
    const searchDD = document.getElementById('searchDropdown');
    this._searchDebounced = Utils.debounce(async (q) => {
      if (!q || q.length < 1) { searchDD.innerHTML = ''; searchDD.style.display = 'none'; return; }
      searchDD.innerHTML = '<div class="search-loading">搜尋中…</div>';
      searchDD.style.display = 'block';
      try {
        // Read current asset type selection to decide which API to use
        const typeSelect = document.getElementById('inputType');
        const selectedType = typeSelect ? typeSelect.value : '';
        let results;
        if (selectedType === 'crypto') {
          // Crypto selected → only search CoinGecko
          results = await API.searchCrypto(q);
        } else {
          // Stocks/ETFs/forex/cash → search Yahoo Finance
          results = await API.searchYahoo(q);
        }
        if (results.length === 0) {
          searchDD.innerHTML = '<div class="search-empty">搵唔到結果</div>';
          return;
        }
        this._renderSearchResults(results, searchDD);
      } catch (e) {
        searchDD.innerHTML = `<div class="search-empty">搜尋錯誤: ${e.message}</div>`;
      }
    }, 350);
    symInput.addEventListener('input', (e) => this._searchDebounced(e.target.value.trim()));
    symInput.addEventListener('focus', (e) => {
      if (searchDD.innerHTML) searchDD.style.display = 'block';
    });
    searchDD.addEventListener('click', (e) => {
      const item = e.target.closest('.search-item');
      if (!item) return;
      const symbol = item.dataset.symbol;
      const name = item.dataset.name;
      const type = item.dataset.type;
      symInput.value = symbol;
      document.getElementById('inputName').value = name;
      // Auto-set type if matching
      const typeSelect = document.getElementById('inputType');
      if (type && typeSelect.querySelector(`option[value="${type}"]`)) {
        typeSelect.value = type;
      }
      // Auto-set currency based on symbol
      const currSelect = document.getElementById('inputCurrency');
      if (symbol.endsWith('.HK')) currSelect.value = 'HKD';
      else if (symbol.endsWith('.T')) currSelect.value = 'JPY';
      else if (symbol.endsWith('.L')) currSelect.value = 'GBP';
      else if (type === 'crypto') currSelect.value = 'USD';
      searchDD.style.display = 'none';
    });
    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.form-group-search')) searchDD.style.display = 'none';
    });

    // When type changes to 'cash', auto-fill symbol from currency
    document.getElementById('inputType').addEventListener('change', (e) => {
      const type = e.target.value;
      const symInput = document.getElementById('inputSymbol');
      const nameInput = document.getElementById('inputName');
      const currInput = document.getElementById('inputCurrency');
      if (type === 'cash') {
        const cur = currInput.value;
        symInput.value = cur;
        symInput.readOnly = true;
        nameInput.value = cur + ' 現金';
      } else {
        symInput.readOnly = false;
        if (symInput.value === symInput._prevCash) symInput.value = '';
        if (nameInput.value.endsWith(' 現金')) nameInput.value = '';
      }
    });

    // When currency changes and type is cash, update symbol
    document.getElementById('inputCurrency').addEventListener('change', (e) => {
      const type = document.getElementById('inputType').value;
      if (type === 'cash') {
        const cur = e.target.value;
        document.getElementById('inputSymbol').value = cur;
        document.getElementById('inputName').value = cur + ' 現金';
      }
    });
    document.getElementById('btnManageCategories').addEventListener('click', () => this.openCategoryModal());
    document.getElementById('btnCloseCategories').addEventListener('click', () => this.closeModal('modalCategories'));
    document.getElementById('formAddCategory').addEventListener('submit', (e) => { e.preventDefault(); this.addCategory(); });

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

    // Pull-to-refresh
    this._initPullToRefresh();
  },

  /** Pull-to-refresh for PWA / mobile */
  _initPullToRefresh() {
    let startY = 0;
    let pulling = false;
    const threshold = 80;
    const indicator = document.getElementById('pullIndicator');

    document.addEventListener('touchstart', (e) => {
      // Only activate when scrolled to top
      if (window.scrollY === 0 && !this._modalOpen()) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && dy < threshold * 2.5) {
        indicator.style.height = Math.min(dy, threshold) + 'px';
        indicator.style.opacity = Math.min(dy / threshold, 1);
        if (dy >= threshold) {
          indicator.querySelector('.pull-text').textContent = '放手更新';
        } else {
          indicator.querySelector('.pull-text').textContent = '向下拉更新';
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', async () => {
      if (!pulling) return;
      pulling = false;
      const h = parseInt(indicator.style.height) || 0;
      if (h >= threshold) {
        indicator.querySelector('.pull-text').textContent = '更新中…';
        indicator.style.height = '40px';
        // Reload data from Supabase then refresh prices
        this.assets = await Storage.getAssets();
        this.categories = await Storage.getCategories();
        this.snapshots = await Storage.getSnapshots();
        await this.refreshPrices();
        this.render();
      }
      // Animate closed
      indicator.style.height = '0px';
      indicator.style.opacity = '0';
    });
  },

  /** Check if any modal is open */
  _modalOpen() {
    return document.querySelector('.modal-overlay.active') !== null;
  },

  /** Render search results into dropdown */
  _renderSearchResults(results, dd) {
    dd.innerHTML = results.map((r, i) => {
      const typeLabel = { us_stock: '美股', hk_stock: '港股', etf: '美股ETF', hk_etf: '港股ETF', crypto: '加密' }[r.type] || '';
      return `<div class="search-item" data-idx="${i}" data-symbol="${r.symbol}" data-name="${r.name}" data-type="${r.type}">
        <span class="search-symbol">${r.symbol}</span>
        <span class="search-name">${r.name}</span>
        <span class="search-type">${typeLabel}</span>
      </div>`;
    }).join('');
    this._searchResults = results;
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

  toHKD(price, currency, forexInfo) {
    if (currency === 'HKD') return price;
    const rates = this.getForexRates();
    const key = `${currency}_HKD`;
    if (rates[key]) return price * rates[key];
    if (forexInfo && forexInfo.rateToHKD) return price * forexInfo.rateToHKD;
    return price;
  },

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

  renderTotalValue() {
    const total = this.calcTotalValue();
    const el = document.getElementById('totalValue');
    el.textContent = this.assets.length > 0
      ? '$' + Utils.fmt(total)
      : '—';
  },

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
      `updated: ${now.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })} UTC+8`;
  },

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
                <th>TICKER</th><th>NAME</th><th>QTY</th><th>PRICE</th><th>YIELD</th><th>VALUE_HKD</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${group.assets.map(asset => {
                const p = this.prices[asset.id];
                const priceStr = p ? `${Utils.currencySymbol(p.currency)}${Utils.fmt(p.price)}` : '<span class="loading-dots"><span></span><span></span><span></span></span>';
                const priceHKD = p ? this.toHKD(p.price, p.currency, p) : 0;
                const valueHKD = priceHKD * (asset.quantity || 0);
                // Show dividend yield — prefer manual localStorage value, fall back to API data
                let yieldStr = '—';
                const manualYield = this.dividendYields[asset.id] != null ? parseFloat(this.dividendYields[asset.id]) : null;
                if (manualYield != null && manualYield > 0) {
                  yieldStr = manualYield.toFixed(2) + '%';
                } else if (p && p.dividendYield != null && p.dividendYield > 0) {
                  yieldStr = (p.dividendYield * 100).toFixed(2) + '%';
                } else if (p && p.trailingAnnualDividendRate != null && p.trailingAnnualDividendRate > 0 && p.price > 0) {
                  // Calculate yield from annual dividend rate / price
                  const calcYield = (p.trailingAnnualDividendRate / p.price * 100);
                  yieldStr = calcYield.toFixed(2) + '%';
                }
                return `
                  <tr>
                    <td class="symbol">${asset.symbol}</td>
                    <td>${asset.name}</td>
                    <td>${Utils.fmt(asset.quantity, 4)}</td>
                    <td class="price">${priceStr}</td>
                    <td class="yield">${yieldStr}</td>
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

  renderPieChart() {
    const container = document.getElementById('cliBarChart');
    if (this.assets.length === 0) {
      if (container) container.innerHTML = '<div class="empty-state">no assets loaded<br>run: ./add_asset.sh</div>';
      const legendEl = document.getElementById('categoryLegend');
      if (legendEl) legendEl.innerHTML = '';
      return;
    }
    const catValues = {};
    this.categories.forEach(cat => { catValues[cat.id] = { name: cat.name, color: cat.color, value: 0, weightedYield: 0, yieldWeight: 0 }; });
    this.assets.forEach(asset => {
      const p = this.prices[asset.id];
      if (!p) return;
      const priceHKD = this.toHKD(p.price, p.currency, p);
      const value = priceHKD * (asset.quantity || 0);
      if (catValues[asset.category]) {
        catValues[asset.category].value += value;
        const y = this.dividendYields[asset.id];
        if (y != null && y > 0) {
          catValues[asset.category].weightedYield += y * value;
          catValues[asset.category].yieldWeight += value;
        }
      }
    });
    const data = Object.values(catValues).filter(c => c.value > 0);
    if (data.length > 0 && container) {
      Charts.renderCliBar('cliBarChart', data);
    }
    // Legend
    const legendEl = document.getElementById('categoryLegend');
    if (legendEl) {
      const total = data.reduce((s, c) => s + c.value, 0);
      legendEl.innerHTML = data.map(c => {
        const pct = total > 0 ? ((c.value / total) * 100).toFixed(1) : '0.0';
        let yieldStr = '';
        if (c.yieldWeight > 0) {
          const avgYield = c.weightedYield / c.yieldWeight;
          yieldStr = ` <span class="legend-yield">DY:${avgYield.toFixed(2)}%</span>`;
        }
        return `
          <div class="legend-item">
            <span class="legend-dot filled" style="background:${c.color}; border-color:${c.color};"></span>
            <span>${c.name} <span class="legend-pct">${pct}%</span> · ${Utils.fmtHKD(c.value)}${yieldStr}</span>
          </div>
        `;
      }).join('');
    }
  },

  renderLineChart() {
    Charts.renderLine('lineChart', this.snapshots, this.linePeriod);
  },

  setPeriod(period) {
    this.linePeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });
    this.renderLineChart();
  },

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
    errorBar.style.display = 'flex';
    if (this.isLoading) {
      errorBar.innerHTML = `<span class="loading-dots"><span></span><span></span><span></span></span><span class="error-text">downloading market data...</span>`;
      return;
    }
    if (this.fetchErrors.length > 0) {
      const errText = this.fetchErrors.map(e => e.symbol + ' [' + e.error + ']').join(' | ');
      errorBar.innerHTML = '<span class="error-icon">⚠</span><span class="error-text">ERR: ' + errText + '</span><button class="btn-dismiss" onclick="App.dismissErrors()">[×]</button>';
    }
  },

  dismissErrors() {
    this.fetchErrors = [];
    this.renderErrors();
  },

  // =============================================
  // PRICE REFRESH
  // =============================================

  async refreshPrices() {
    if (this.assets.length === 0) return;

    this.isLoading = true;
    this.fetchErrors = [];
    this.renderErrors();

    try {
      const { prices, errors } = await API.fetchAllPrices(this.assets);
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
      await Storage.saveDailySnapshot(totalHKD, assetValues);
      this.snapshots = await Storage.getSnapshots();
    } catch (err) {
      this.fetchErrors.push({ symbol: 'ALL', name: '', error: err.message });
    }

    this.isLoading = false;
    this.render();
  },

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
      document.getElementById('inputDividendYield').value = this.dividendYields[asset.id] || '';
      form.dataset.editId = asset.id;
    } else {
      document.getElementById('modalAssetTitle').textContent = '新增資產';
      delete form.dataset.editId;
    }
    this.showModal('modalAsset');
  },

  async saveAsset() {
    const form = document.getElementById('formAsset');
    const editId = form.dataset.editId;
    const dividendYield = parseFloat(document.getElementById('inputDividendYield').value) || 0;
    const asset = {
      symbol: document.getElementById('inputSymbol').value.trim().toUpperCase(),
      name: document.getElementById('inputName').value.trim(),
      type: document.getElementById('inputType').value,
      category: document.getElementById('inputCategory').value,
      quantity: parseFloat(document.getElementById('inputQuantity').value) || 0,
      currency: document.getElementById('inputCurrency').value
    };
    try {
      if (editId) {
        await Storage.updateAsset(editId, asset);
        await Storage.saveDividendYield(editId, dividendYield);
        this.dividendYields[editId] = dividendYield;
      } else {
        const newId = await Storage.addAsset(asset);
        if (newId) {
          await Storage.saveDividendYield(newId, dividendYield);
          this.dividendYields[newId] = dividendYield;
        }
      }
      this.assets = await Storage.getAssets();
      this.closeModal('modalAsset');
      this.render();
    } catch (err) {
      alert('儲存失敗: ' + err.message);
    }
  },

  async editAsset(id) {
    const asset = this.assets.find(a => a.id === id);
    if (asset) this.openAssetModal(asset);
  },

  async deleteAsset(id) {
    if (confirm('確定要刪除此資產？')) {
      await Storage.deleteAsset(id);
      await Storage.removeDividendYield(id);
      delete this.dividendYields[id];
      this.assets = await Storage.getAssets();
      this.render();
    }
  },

  async openCategoryModal() {
    this.categories = await Storage.getCategories();
    this.renderCategoryList();
    this.showModal('modalCategories');
  },

  renderCategoryList() {
    const container = document.getElementById('categoryList');
    container.innerHTML = this.categories.map(cat => `
      <div class="cat-manage-item" data-id="${cat.id}">
        <span class="cat-color" style="background:${cat.color};"></span>
        <span class="cat-name">${cat.name}</span>
        <button class="btn-edit-cat" onclick="App.editCategory('${cat.id}')">編輯</button>
        <button class="btn-delete-cat" onclick="App.deleteCategory('${cat.id}')">刪除</button>
      </div>
    `).join('');
  },

  editCategory(id) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) return;

    const item = document.querySelector(`.cat-manage-item[data-id="${id}"]`);
    if (!item) return;

    item.innerHTML = `
      <input type="color" value="${cat.color}" class="edit-color" style="width:36px;height:36px;border:2px solid #1A1410;border-radius:50%;cursor:pointer;padding:2px;">
      <input type="text" value="${cat.name}" class="edit-name" style="flex:1;font-family:var(--font);font-size:0.85rem;font-weight:700;padding:8px 12px;border:2px solid var(--taupe);border-radius:12px;background:var(--cream);color:var(--espresso);outline:none;text-transform:uppercase;letter-spacing:1px;">
      <button class="btn-save-cat" onclick="App.saveCategoryEdit('${id}')" style="font-family:var(--font);font-size:0.65rem;font-weight:700;padding:6px 14px;border-radius:var(--radius-pill);border:2px solid #1A1410;background:#1A1410;color:var(--cream);cursor:pointer;text-transform:uppercase;letter-spacing:1px;">儲存</button>
      <button class="btn-cancel-cat" onclick="App.cancelCategoryEdit('${id}')" style="font-family:var(--font);font-size:0.65rem;font-weight:700;padding:6px 14px;border-radius:var(--radius-pill);border:2px solid var(--taupe);background:transparent;color:var(--espresso);cursor:pointer;text-transform:uppercase;letter-spacing:1px;">取消</button>
    `;
  },

  async saveCategoryEdit(id) {
    const item = document.querySelector(`.cat-manage-item[data-id="${id}"]`);
    if (!item) return;

    const name = item.querySelector('.edit-name').value.trim();
    const color = item.querySelector('.edit-color').value;

    if (!name) return;

    // Update in Supabase
    const sb = Storage.initSupabase();
    if (sb) {
      const { error } = await sb.from('ds_categories').update({ name, color }).eq('id', id);
      if (error) {
        console.error('Supabase updateCategory error:', error);
        return;
      }
    }

    // Update local state
    const cat = this.categories.find(c => c.id === id);
    if (cat) {
      cat.name = name;
      cat.color = color;
    }

    // Re-render
    this.renderCategoryList();
    this.render();
  },

  cancelCategoryEdit(id) {
    this.renderCategoryList();
  },

  async addCategory() {
    const name = document.getElementById('inputCategoryName').value.trim();
    const color = document.getElementById('inputCategoryColor').value;
    if (!name) return;
    await Storage.addCategory(name, color);
    this.categories = await Storage.getCategories();
    document.getElementById('inputCategoryName').value = '';
    this.renderCategoryList();
  },

  async deleteCategory(id) {
    if (await Storage.deleteCategory(id)) {
      this.categories = await Storage.getCategories();
      this.renderCategoryList();
    } else {
      alert('無法刪除此分類，因為有資產正在使用。');
    }
  }
};

// Start immediately if DOM is already loaded, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
