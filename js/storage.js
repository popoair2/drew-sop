/**
 * storage.js — Supabase-backed storage with localStorage fallback
 *
 * Primary: Supabase PostgreSQL (cross-device sync)
 * Fallback: localStorage (offline cache, loaded if Supabase unreachable)
 */

const Storage = {
  KEYS: {
    ASSETS: 'ds_assets_cache',
    CATEGORIES: 'ds_categories_cache',
    PRICES: 'ds_prices_cache',
    SNAPSHOTS: 'ds_snapshots_cache',
    API_KEY: 'ds_api_key',
    FINNHUB_KEY: 'ds_finnhub_key'
  },

  SUPABASE_URL: 'https://mborjmbjqjhdootvzdti.supabase.co',
  SUPABASE_KEY: 'sb_publishable_BJG6Plmnr2q1hgBBWbmHwg_nWlyczFM',
  supabase: null,

  /** Initialize Supabase client */
  initSupabase() {
    if (this.supabase) return this.supabase;
    if (window.supabase) {
      this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
      return this.supabase;
    }
    return null;
  },

  /** Check if Supabase is available */
  isOnline() {
    return !!this.initSupabase();
  },

  // =============================================
  // CATEGORIES
  // =============================================

  async getCategories() {
    const sb = this.initSupabase();
    if (sb) {
      try {
        const { data, error } = await sb.from('ds_categories').select('*').order('created_at');
        if (!error && data && data.length > 0) {
          const cats = data.map(c => ({ id: c.id, name: c.name, color: c.color }));
          this.saveLocal(this.KEYS.CATEGORIES, cats);
          return cats;
        }
      } catch (e) {
        console.warn('Supabase getCategories failed, using cache:', e);
      }
    }
    return this.loadLocal(this.KEYS.CATEGORIES, []);
  },

  async saveCategories(categories) {
    this.saveLocal(this.KEYS.CATEGORIES, categories);
    const sb = this.initSupabase();
    if (!sb) return;
    // Upsert each category
    for (const cat of categories) {
      await sb.from('ds_categories').upsert({ id: cat.id, name: cat.name, color: cat.color });
    }
  },

  async addCategory(name, color) {
    const cat = { id: crypto.randomUUID ? crypto.randomUUID() : Utils.uuid(), name, color };
    const cats = await this.getCategories();
    cats.push(cat);
    await this.saveCategories(cats);
    return cat;
  },

  async deleteCategory(id) {
    const cats = await this.getCategories();
    const inUse = (await this.getAssets()).some(a => a.category === id);
    if (inUse) return false;
    const filtered = cats.filter(c => c.id !== id);
    await this.saveCategories(filtered);
    // Also delete from Supabase
    const sb = this.initSupabase();
    if (sb) {
      await sb.from('ds_categories').delete().eq('id', id);
    }
    return true;
  },

  // =============================================
  // ASSETS
  // =============================================

  async getAssets() {
    const sb = this.initSupabase();
    if (sb) {
      try {
        const { data, error } = await sb.from('ds_assets').select('*').order('created_at');
        if (!error && data) {
          const assets = data.map(a => ({
            id: a.id,
            symbol: a.symbol,
            name: a.name,
            type: a.type,
            category: a.category_id,
            quantity: parseFloat(a.quantity) || 0,
            currency: a.currency
          }));
          this.saveLocal(this.KEYS.ASSETS, assets);
          return assets;
        }
      } catch (e) {
        console.warn('Supabase getAssets failed, using cache:', e);
      }
    }
    return this.loadLocal(this.KEYS.ASSETS, []);
  },

  async saveAssets(assets) {
    this.saveLocal(this.KEYS.ASSETS, assets);
    const sb = this.initSupabase();
    if (!sb) return;
    for (const asset of assets) {
      await sb.from('ds_assets').upsert({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        category_id: asset.category,
        quantity: asset.quantity,
        currency: asset.currency,
        updated_at: new Date().toISOString()
      });
    }
  },

  async addAsset(asset) {
    asset.id = asset.id || (crypto.randomUUID ? crypto.randomUUID() : Utils.uuid());
    const assets = await this.getAssets();
    assets.push(asset);
    await this.saveAssets(assets);
    return asset;
  },

  async updateAsset(id, updates) {
    const assets = await this.getAssets();
    const idx = assets.findIndex(a => a.id === id);
    if (idx === -1) return null;
    assets[idx] = { ...assets[idx], ...updates };
    await this.saveAssets(assets);
    return assets[idx];
  },

  async deleteAsset(id) {
    const assets = (await this.getAssets()).filter(a => a.id !== id);
    await this.saveAssets(assets);
    const sb = this.initSupabase();
    if (sb) {
      await sb.from('ds_assets').delete().eq('id', id);
    }
  },

  // =============================================
  // PRICES CACHE (local only — ephemeral)
  // =============================================

  getPrices() {
    return this.loadLocal(this.KEYS.PRICES, {});
  },

  savePrices(prices) {
    this.saveLocal(this.KEYS.PRICES, prices);
  },

  // =============================================
  // DAILY SNAPSHOTS
  // =============================================

  async getSnapshots() {
    const sb = this.initSupabase();
    if (sb) {
      try {
        const { data, error } = await sb.from('ds_snapshots').select('*').order('date');
        if (!error && data) {
          const snaps = data.map(s => ({
            date: s.date,
            totalValueHKD: parseFloat(s.total_value_hkd) || 0,
            assets: s.asset_values || {},
            timestamp: new Date(s.created_at).getTime()
          }));
          this.saveLocal(this.KEYS.SNAPSHOTS, snaps);
          return snaps;
        }
      } catch (e) {
        console.warn('Supabase getSnapshots failed, using cache:', e);
      }
    }
    return this.loadLocal(this.KEYS.SNAPSHOTS, []);
  },

  async saveDailySnapshot(totalValueHKD, assetValues) {
    const today = Utils.todayStr();
    const snapshots = await this.getSnapshots();
    const idx = snapshots.findIndex(s => s.date === today);
    const snap = { date: today, totalValueHKD, assets: assetValues, timestamp: Utils.now() };
    if (idx >= 0) {
      snapshots[idx] = snap;
    } else {
      snapshots.push(snap);
    }
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    if (snapshots.length > 365) snapshots.splice(0, snapshots.length - 365);
    this.saveLocal(this.KEYS.SNAPSHOTS, snapshots);

    const sb = this.initSupabase();
    if (sb) {
      await sb.from('ds_snapshots').upsert({
        date: today,
        total_value_hkd: totalValueHKD,
        asset_values: assetValues
      });
    }
  },

  getSnapshotDaysAgo(n) {
    const snapshots = this.loadLocal(this.KEYS.SNAPSHOTS, []);
    if (snapshots.length === 0) return null;
    const target = new Date();
    target.setDate(target.getDate() - n);
    const targetStr = target.toISOString().slice(0, 10);
    const candidates = snapshots.filter(s => s.date <= targetStr);
    return candidates.length > 0 ? candidates[candidates.length - 1] : null;
  },

  // =============================================
  // API KEY (local only)
  // =============================================

  getApiKey() {
    return localStorage.getItem(this.KEYS.FINNHUB_KEY) || '';
  },

  setApiKey(key) {
    localStorage.setItem(this.KEYS.FINNHUB_KEY, key);
  },

  // =============================================
  // LOCAL HELPERS
  // =============================================

  saveLocal(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  },

  loadLocal(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },

  // =============================================
  // MIGRATION: localStorage → Supabase (one-time)
  // =============================================

  /** On first load with Supabase, push any local data to cloud */
  async migrateLocalToSupabase() {
    const sb = this.initSupabase();
    if (!sb) return;

    // Check if Supabase already has data
    const { data: existingCats } = await sb.from('ds_categories').select('id').limit(1);
    if (existingCats && existingCats.length > 0) return; // Already has data

    // Migrate categories from local
    const localCats = this.loadLocal(this.KEYS.CATEGORIES, []);
    if (localCats.length > 0) {
      for (const cat of localCats) {
        await sb.from('ds_categories').upsert({ id: cat.id, name: cat.name, color: cat.color });
      }
    }

    // Migrate assets from local
    const localAssets = this.loadLocal('ds_assets', []);
    if (localAssets.length > 0) {
      for (const a of localAssets) {
        await sb.from('ds_assets').upsert({
          id: a.id, symbol: a.symbol, name: a.name, type: a.type,
          category_id: a.category, quantity: a.quantity, currency: a.currency
        });
      }
    }

    console.log('Migrated local data to Supabase');
  },

  // =============================================
  // CLEAR ALL
  // =============================================

  async clearAll() {
    localStorage.clear();
    const sb = this.initSupabase();
    if (sb) {
      await sb.from('ds_assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await sb.from('ds_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Keep default categories
    }
  }
};
