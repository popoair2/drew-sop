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

  async saveAsset(asset) {
    const sb = this.initSupabase();
    if (!sb) return;
    const { error } = await sb.from('ds_assets').upsert({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      category_id: asset.category,
      quantity: asset.quantity,
      currency: asset.currency
    });
    if (error) console.error('Supabase saveAsset error:', error);
  },

  async deleteAsset(id) {
    const sb = this.initSupabase();
    if (!sb) return;
    const { error } = await sb.from('ds_assets').delete().eq('id', id);
    if (error) console.error('Supabase deleteAsset error:', error);
  },

  async saveAllAssets(assets) {
    const sb = this.initSupabase();
    if (!sb) return;
    for (const asset of assets) {
      await this.saveAsset(asset);
    }
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
    const { data, error } = await sb.from('ds_snapshots')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at');
    if (error) {
      console.error('Supabase getSnapshots error:', error);
      return [];
    }
    return data || [];
  }
};
