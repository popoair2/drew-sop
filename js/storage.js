/**
 * storage.js — Supabase-only storage (no localStorage fallback)
 *
 * All data is stored in Supabase PostgreSQL for cross-device sync.
 * If Supabase is unreachable, data is NOT loaded from localStorage.
 */

const Storage = {
  SUPABASE_URL: 'https://tkmnvfpmssfzwnuvenax.supabase.co',
  SUPABASE_KEY: 'sb_publishable_qlEBaRYaqQVtUcvbK4t8fg_3Tjj7yvv',
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

  // =============================================
  // CATEGORIES
  // =============================================

  async getCategories() {
    const sb = this.initSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('ds_categories').select('*').order('created_at');
    if (error) {
      console.error('Supabase getCategories error:', error);
      return [];
    }
    return (data || []).map(c => ({ id: c.id, name: c.name, color: c.color }));
  },

  async saveCategories(categories) {
    const sb = this.initSupabase();
    if (!sb) return;
    for (const cat of categories) {
      const { error } = await sb.from('ds_categories').upsert({ id: cat.id, name: cat.name, color: cat.color });
      if (error) console.error('Supabase saveCategory error:', error);
    }
  },

  async addCategory(name, color) {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    const cat = { id, name, color };
    const sb = this.initSupabase();
    if (sb) {
      const { error } = await sb.from('ds_categories').insert(cat);
      if (error) console.error('Supabase addCategory error:', error);
    }
    return cat;
  },

  async deleteCategory(id) {
    const sb = this.initSupabase();
    if (!sb) return false;
    const { error } = await sb.from('ds_categories').delete().eq('id', id);
    if (error) console.error('Supabase deleteCategory error:', error);
    return !error;
  },

  // =============================================
  // ASSETS
  // =============================================

  async getAssets() {
    const sb = this.initSupabase();
    if (!sb) {
      console.warn('Supabase not available');
      return [];
    }
    const { data, error } = await sb.from('ds_assets').select('*').order('created_at');
    if (error) {
      console.error('Supabase getAssets error:', error);
      return [];
    }
    return (data || []).map(a => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      type: a.type,
      category: a.category_id,
      quantity: parseFloat(a.quantity) || 0,
      currency: a.currency
    }));
  },

  async addAsset(asset) {
    const sb = this.initSupabase();
    if (!sb) return;
    const id = asset.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const { error } = await sb.from('ds_assets').insert({
      id: id,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      category_id: asset.category,
      quantity: asset.quantity,
      currency: asset.currency
    });
    if (error) {
      console.error('Supabase addAsset error:', error);
      throw error;
    }
    return id;
  },

  async saveAsset(asset) {
    return this.addAsset(asset);
  },

  async deleteAsset(id) {
    const sb = this.initSupabase();
    if (!sb) return;
    const { error } = await sb.from('ds_assets').delete().eq('id', id);
    if (error) console.error('Supabase deleteAsset error:', error);
  },

  async updateAsset(id, asset) {
    const sb = this.initSupabase();
    if (!sb) return;
    const { error } = await sb.from('ds_assets').update({
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      category_id: asset.category,
      quantity: asset.quantity,
      currency: asset.currency
    }).eq('id', id);
    if (error) {
      console.error('Supabase updateAsset error:', error);
      throw error;
    }
  },

  async saveAllAssets(assets) {
    const sb = this.initSupabase();
    if (!sb) return;
    for (const asset of assets) {
      await this.saveAsset(asset);
    }
  },

  // =============================================
  // DIVIDEND YIELD (localStorage fallback — Supabase column may not exist yet)
  // =============================================

  getDividendYields() {
    try {
      return JSON.parse(localStorage.getItem('ds_dividend_yields') || '{}');
    } catch (e) {
      return {};
    }
  },

  async saveDividendYield(assetId, yieldValue) {
    const yields = this.getDividendYields();
    yields[assetId] = yieldValue;
    localStorage.setItem('ds_dividend_yields', JSON.stringify(yields));
  },

  async removeDividendYield(assetId) {
    const yields = this.getDividendYields();
    delete yields[assetId];
    localStorage.setItem('ds_dividend_yields', JSON.stringify(yields));
  },

  // =============================================
  // PRICE SNAPSHOTS (for chart history)
  // =============================================

  async saveSnapshot(snapshot) {
    const sb = this.initSupabase();
    if (!sb) return;
    const { error } = await sb.from('ds_snapshots').insert(snapshot);
    if (error) console.error('Supabase saveSnapshot error:', error);
  },

  async getSnapshots(days = 30) {
    const sb = this.initSupabase();
    if (!sb) return [];
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data, error } = await sb.from('ds_snapshots')
      .select('*')
      .gte('date', sinceStr)
      .order('date');
    if (error) {
      console.error('Supabase getSnapshots error:', error);
      return [];
    }
    return data || [];
  },

  /** Migrate any existing localStorage data to Supabase (one-time) */
  async migrateLocalToSupabase() {
    try {
      const localAssets = JSON.parse(localStorage.getItem('ds_assets_cache') || '[]');
      if (localAssets.length > 0) {
        console.log('Migrating', localAssets.length, 'assets from localStorage to Supabase');
        for (const asset of localAssets) {
          await this.saveAsset(asset);
        }
        localStorage.removeItem('ds_assets_cache');
      }
      const localCats = JSON.parse(localStorage.getItem('ds_categories_cache') || '[]');
      if (localCats.length > 0) {
        for (const cat of localCats) {
          const sb = this.initSupabase();
          if (sb) {
            await sb.from('ds_categories').upsert({ id: cat.id, name: cat.name, color: cat.color });
          }
        }
        localStorage.removeItem('ds_categories_cache');
      }
    } catch (e) {
      console.warn('Migration failed:', e);
    }
  },

  /** Get cached prices (from Supabase ds_snapshots) */
  getPrices() {
    return {};
  },

  /** Save prices cache (no-op for Supabase-only mode — prices are live) */
  savePrices(prices) {
    // Prices are always fetched live; no caching needed
  },

  /** Save a daily snapshot of total portfolio value to Supabase */
  async saveDailySnapshot(totalHKD, assetValues) {
    const sb = this.initSupabase();
    if (!sb) return;
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = {
      date: today,
      total_value_hkd: totalHKD,
      asset_values: assetValues
    };
    const { error } = await sb.from('ds_snapshots').insert(snapshot);
    if (error) console.error('Supabase saveDailySnapshot error:', error);
  },

  /** Get snapshot from N days ago (synchronous — returns null, use getSnapshots async instead) */
  getSnapshotDaysAgo(days) {
    // Synchronous stub — returns null; caller should use async getSnapshots()
    return null;
  },

  /** Clear all data (assets + categories) from Supabase */
  async clearAll() {
    const sb = this.initSupabase();
    if (!sb) return;
    await sb.from('ds_assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('ds_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('ds_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  },

  /** Set API key (no-op — using free APIs) */
  setApiKey(key) {
    // No API key needed — Yahoo Finance + CoinGecko are free
  }
};
