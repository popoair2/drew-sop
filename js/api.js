/**
 * api.js — Price fetching from Twelve Data + CoinGecko
 *
 * Twelve Data: free tier, 800 calls/day, 8 calls/min
 *   Search:  https://api.twelvedata.com/symbol_search?symbol=XXX&apikey=KEY
 *   Quote:  https://api.twelvedata.com/price?symbol=XXX&apikey=KEY
 *   Batch:  https://api.twelvedata.com/time_series?symbol=A,B,C&interval=1day&apikey=KEY
 *
 * CoinGecko: free, no key, for crypto only (no CORS issues)
 * ExchangeRate-API: free, no key, for forex/cash rates (no CORS issues)
 */

const API = {
  TWELVE_DATA_KEY: 'ede47da796864307a6805ed331eb6bcd',
  TWELVE_BASE: 'https://api.twelvedata.com',

  async tdFetch(path, params = {}) {
    const url = new URL(`${this.TWELVE_BASE}${path}`);
    url.searchParams.set('apikey', this.TWELVE_DATA_KEY);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
    return res.json();
  },

  /** Search Twelve Data for symbols (stocks + ETFs) */
  async searchTwelve(query) {
    if (!query || query.length < 1) return [];
    try {
      const data = await this.tdFetch('/symbol_search', { symbol: query });
      const results = data?.data || data?.result || (Array.isArray(data) ? data : []);
      return results.slice(0, 12).map(r => {
        const sym = r.symbol || r.ticker || '';
        const name = r.instrument_name || r.name || sym;
        const country = (r.country || '').toUpperCase();
        const exchange = (r.exchange || '').toUpperCase();
        const type = (r.type || r.instrument_type || '').toUpperCase();
        const isHK = country === 'HONG KONG' || exchange.includes('HONG KONG') || exchange === 'HKSE' || sym.endsWith('.HK');
        const isETF = type.includes('ETF') || name.toUpperCase().includes('ETF');
        let assetType = 'us_stock';
        if (isHK && isETF) assetType = 'hk_etf';
        else if (isHK) assetType = 'hk_stock';
        else if (isETF) assetType = 'etf';
        return { symbol: sym, name, type: assetType };
      }).filter(r => r.symbol);
    } catch (e) {
      return [];
    }
  },

  /** Search CoinGecko for crypto (fallback) */
  async searchCrypto(query) {
    if (!query || query.length < 2) return [];
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.coins || []).slice(0, 5).map(c => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      type: 'crypto'
    }));
  },

  /** Combined search — Twelve Data first, CoinGecko for crypto backup */
  async searchAll(query) {
    if (!query || query.length < 1) return [];
    const isCrypto = /^(btc|eth|sol|ada|dot|doge|xrp|bnb|avax|matic|link|uni|atom|ltc|fil|near|apt|arb|op|sui)/i.test(query);

    // Twelve Data (stocks + ETFs including HK)
    let results = await this.searchTwelve(query);

    // CoinGecko for crypto queries
    if (isCrypto) {
      const cg = await this.searchCrypto(query);
      results = [...results, ...cg];
    }

    // Dedupe
    const seen = new Set();
    return results.filter(r => {
      const key = r.symbol.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  }

  /**
   * Batch fetch quotes from Twelve Data time_series.
   * Pass up to 8 symbols per call (rate limit: 8/min).
   * Falls back to individual /price calls if batch fails.
   */
  async batchQuoteTwelve(symbols) {
    if (symbols.length === 0) return {};
    const result = {};
    // Process in chunks of 8 to respect rate limit
    const chunkSize = 8;
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      const symbolParam = chunk.join(',');
      try {
        const data = await this.tdFetch('/time_series', {
          symbol: symbolParam,
          interval: '1day',
          outputsize: 1
        });
        // Response can be a single object (1 symbol) or array (multiple)
        if (Array.isArray(data)) {
          for (const item of data) {
            const sym = item.meta?.symbol || item.symbol;
            if (sym) {
              const vals = item.values?.[0];
              if (vals) {
                const price = parseFloat(vals.close);
                if (price > 0) result[sym.toUpperCase()] = { price, currency: this.inferCurrency(sym, item.meta?.currency) };
              }
            }
          }
        } else if (data.meta?.symbol) {
          const sym = data.meta.symbol;
          const vals = data.values?.[0];
          if (vals) {
            const price = parseFloat(vals.close);
            if (price > 0) result[sym.toUpperCase()] = { price, currency: this.inferCurrency(sym, data.meta?.currency) };
          }
        }
      } catch (e) {
        // Fallback: try individual /price calls for this chunk
        for (const sym of chunk) {
          try {
            const d = await this.tdFetch('/price', { symbol: sym });
            const price = parseFloat(d?.price);
            if (price > 0) result[sym.toUpperCase()] = { price, currency: this.inferCurrency(sym) };
          } catch (_) {}
        }
      }
      // Rate limit: wait between chunks
      if (i + chunkSize < symbols.length) await this.sleep(8000);
    }
    return result;
  }

  /** Fetch crypto price from CoinGecko */
  async fetchCryptoPrice(coinIds) {
    if (coinIds.length === 0) return {};
    const ids = coinIds.join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return {};
    const data = await res.json();
    const result = {};
    for (const id of coinIds) {
      if (data[id]?.usd != null) result[id] = { price: data[id].usd, currency: 'USD' };
    }
    return result;
  }

  /** Fetch forex rates from ExchangeRate-API */
  async fetchForexRates(baseCurrency = 'USD') {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(baseCurrency)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`ExchangeRate HTTP ${res.status}`);
    const data = await res.json();
    return data.rates || {};
  }

  /** Fetch all asset prices */
  async fetchAllPrices(assets) {
    const prices = {};
    const errors = [];
    const tdAssets = assets.filter(a =>
      ['us_stock', 'hk_stock', 'etf', 'hk_etf'].includes(a.type)
    );
    const cryptoAssets = assets.filter(a => a.type === 'crypto');
    const forexAssets = assets.filter(a => a.type === 'forex');
    const cashAssets = assets.filter(a => a.type === 'cash');

    // 1. Twelve Data stocks/ETFs (batch)
    if (tdAssets.length > 0) {
      try {
        const symbols = tdAssets.map(a => a.symbol);
        const tdPrices = await this.batchQuoteTwelve(symbols);
        for (const asset of tdAssets) {
          const key = asset.symbol.toUpperCase();
          if (tdPrices[key]) {
            prices[asset.id] = tdPrices[key];
          } else {
            errors.push({ symbol: asset.symbol, name: asset.name, error: 'No Twelve Data quote' });
          }
        }
      } catch (err) {
        tdAssets.forEach(a => errors.push({ symbol: a.symbol, name: a.name, error: err.message }));
      }
    }

    // 2. CoinGecko crypto (batch)
    if (cryptoAssets.length > 0) {
      try {
        const coinIds = cryptoAssets.map(a => Utils.toCoinGeckoId(a.symbol));
        const cgPrices = await this.fetchCryptoPrice(coinIds);
        for (const asset of cryptoAssets) {
          const id = Utils.toCoinGeckoId(asset.symbol);
          if (cgPrices[id]) {
            prices[asset.id] = cgPrices[id];
          } else {
            errors.push({ symbol: asset.symbol, name: asset.name, error: 'No CoinGecko data' });
          }
        }
      } catch (err) {
        cryptoAssets.forEach(a => errors.push({ symbol: a.symbol, name: a.name, error: err.message }));
      }
    }

    // 3. Forex
    if (forexAssets.length > 0) {
      try {
        const baseCurrencies = [...new Set(forexAssets.map(a => a.currency))];
        const allRates = {};
        for (const base of baseCurrencies) {
          const rates = await this.fetchForexRates(base);
          allRates[base] = rates;
          await this.sleep(500);
        }
        for (const asset of forexAssets) {
          const base = asset.symbol.slice(0, 3);
          const quote = asset.symbol.slice(3, 6) || asset.currency;
          const baseRates = allRates[base];
          if (baseRates) {
            prices[asset.id] = {
              price: baseRates[quote] || 1,
              currency: quote,
              forexBase: base,
              rateToHKD: baseRates['HKD'] || 1
            };
          } else {
            errors.push({ symbol: asset.symbol, name: asset.name, error: 'No forex rate' });
          }
        }
      } catch (err) {
        forexAssets.forEach(a => errors.push({ symbol: a.symbol, name: a.name, error: err.message }));
      }
    }

    // 4. Cash
    for (const asset of cashAssets) {
      prices[asset.id] = { price: 1.0, currency: asset.currency };
    }

    return { prices, errors };
  }

  inferCurrency(symbol, apiCurrency) {
    if (apiCurrency) return apiCurrency.toUpperCase();
    if (symbol.endsWith('.HK')) return 'HKD';
    if (symbol.endsWith('.T')) return 'JPY';
    if (symbol.endsWith('.L')) return 'GBP';
    if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) return 'CNY';
    return 'USD';
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
};
