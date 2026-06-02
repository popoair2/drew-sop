/**
 * storage.js — localStorage helpers for assets, categories, prices, snapshots
 */

const Storage = {
  KEYS: {
    ASSETS: 'ds_assets',
    CATEGORIES: 'ds_categories',
    PRICES: 'ds_prices',
    SNAPSHOTS: 'ds_snapshots',
    API_KEY: 'ds_api_key',
    FINNHUB_KEY: 'ds_finnhub_key'
  },

  // --- DEFAULT CATEGORIES ---
  getDefaultCategories() {
    return [
      { id: Utils.uuid(), name: '增長', color: '#B8E986' },
      { id: Utils.uuid(), name: '防守', color: '#F5D76E' },
      { id: Utils.uuid(), name: '現金', color: '#C7A8E8' }
    ];
  },

  // --- ASSETS ---
  getAssets() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.ASSETS) || '[]');
    } catch { return []; }
  },

  saveAssets(assets) {
    localStorage.setItem(this.KEYS.ASSETS, JSON.stringify(assets));
  },

  addAsset(asset) {
    const assets = this.getAssets();
    asset.id = asset.id || Utils.uuid();
    assets.push(asset);
    this.saveAssets(assets);
    return asset;
  },

  updateAsset(id, updates) {
    const assets = this.getAssets();
    const idx = assets.findIndex(a => a.id === id);
    if (idx === -1) return null;
    assets[idx] = { ...assets[idx], ...updates };
    this.saveAssets(assets);
    return assets[idx];
  },

  deleteAsset(id) {
    const assets = this.getAssets().filter(a => a.id !== id);
    this.saveAssets(assets);
  },

  // --- CATEGORIES ---
  getCategories() {
    try {
      let cats = JSON.parse(localStorage.getItem(this.KEYS.CATEGORIES) || 'null');
      if (!cats || cats.length === 0) {
        cats = this.getDefaultCategories();
        this.saveCategories(cats);
      }
      return cats;
    } catch {
      const cats = this.getDefaultCategories();
      this.saveCategories(cats);
      return cats;
    }
  },

  saveCategories(categories) {
    localStorage.setItem(this.KEYS.CATEGORIES, JSON.stringify(categories));
  },

  addCategory(name, color) {
    const cats = this.getCategories();
    const cat = { id: Utils.uuid(), name, color };
    cats.push(cat);
    this.saveCategories(cats);
    return cat;
  },

  deleteCategory(id) {
    // Don't delete if assets are using it
    const assets = this.getAssets();
    const inUse = assets.some(a => a.category === id);
    if (inUse) return false;
    const cats = this.getCategories().filter(c => c.id !== id);
    this.saveCategories(cats);
    return true;
  },

  // --- PRICES CACHE ---
  getPrices() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.PRICES) || '{}');
    } catch { return {}; }
  },

  savePrices(prices) {
    localStorage.setItem(this.KEYS.PRICES, JSON.stringify(prices));
  },

  setPrice(symbol, price, currency) {
    const prices = this.getPrices();
    prices[symbol] = { price, currency, timestamp: Utils.now() };
    this.savePrices(prices);
  },

  getPrice(symbol) {
    return this.getPrices()[symbol] || null;
  },

  // --- DAILY SNAPSHOTS ---
  getSnapshots() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.SNAPSHOTS) || '[]');
    } catch { return []; }
  },

  saveSnapshots(snapshots) {
    localStorage.setItem(this.KEYS.SNAPSHOTS, JSON.stringify(snapshots));
  },

  /** Save today's snapshot (overwrite if exists) */
  saveDailySnapshot(totalValueHKD, assetValues) {
    const snapshots = this.getSnapshots();
    const today = Utils.todayStr();
    const idx = snapshots.findIndex(s => s.date === today);
    const snap = { date: today, totalValueHKD, assets: assetValues, timestamp: Utils.now() };
    if (idx >= 0) {
      snapshots[idx] = snap;
    } else {
      snapshots.push(snap);
    }
    // Keep last 365 days
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    if (snapshots.length > 365) snapshots.splice(0, snapshots.length - 365);
    this.saveSnapshots(snapshots);
  },

  /** Get snapshot for a specific date */
  getSnapshot(date) {
    return this.getSnapshots().find(s => s.date === date) || null;
  },

  /** Get latest snapshot before today */
  getLatestSnapshot() {
    const snapshots = this.getSnapshots();
    if (snapshots.length === 0) return null;
    const today = Utils.todayStr();
    const beforeToday = snapshots.filter(s => s.date < today);
    return beforeToday.length > 0 ? beforeToday[beforeToday.length - 1] : null;
  },

  /** Get snapshot N days ago */
  getSnapshotDaysAgo(n) {
    const snapshots = this.getSnapshots();
    if (snapshots.length === 0) return null;
    const target = new Date();
    target.setDate(target.getDate() - n);
    const targetStr = target.toISOString().slice(0, 10);
    // Find closest snapshot on or before target
    const candidates = snapshots.filter(s => s.date <= targetStr);
    return candidates.length > 0 ? candidates[candidates.length - 1] : null;
  },

  // --- API KEY ---
  getApiKey() {
    return localStorage.getItem(this.KEYS.FINNHUB_KEY) || '';
  },

  setApiKey(key) {
    localStorage.setItem(this.KEYS.FINNHUB_KEY, key);
  },

  // --- CLEAR ALL ---
  clearAll() {
    Object.values(this.KEYS).forEach(k => localStorage.removeItem(k));
  }
};
