/**
 * api.js — Price fetching from Twelve Data + CoinGecko
 *
 * Twelve Data: free tier, 800 calls/day, 8 calls/min
 *   Search:  https://api.twelvedata.com/symbol_search?symbol=XXX&apikey=KEY
 *   Price:   https://api.twelvedata.com/price?symbol=XXX&apikey=KEY
 *   Batch:   https://api.twelvedata.com/time_series?symbol=A,B,C&interval=1day&apikey=KEY
 *
 * CoinGecko: free, no key, for crypto only (no CORS issues)
 * ExchangeRate-API: free, no key, for forex/cash rates (no CORS issues)
 */

const API = {
  TWELVE_DATA_KEY: 'ede47da796864307a6805ed331eb6bcd',
  TWELVE_BASE: 'https://api.twelvedata.com',

  async tdFetch(path, params) {
    params = params || {};
    const url = new URL(this.TWELVE_BASE + path);
    url.searchParams.set('apikey', this.TWELVE_DATA_KEY);
    for (const key of Object.keys(params)) {
      url.searchParams.set(key, params[key]);
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('Twelve Data HTTP ' + res.status);
    return res.json();
  },

  /** Search Twelve Data for symbols (stocks + ETFs) */
  async searchTwelve(query) {
    if (!query || query.length < 1) return [];
    try {
      const data = await this.tdFetch('/symbol_search', { symbol: query });
      const results = data && data.data ? data.data : (Array.isArray(data) ? data : []);
      const out = [];
      for (let i = 0; i < Math.min(results.length, 12); i++) {
        const r = results[i];
        const sym = r.symbol || r.ticker || '';
        if (!sym) continue;
        const name = r.instrument_name || r.name || sym;
        const country = (r.country || '').toUpperCase();
        const exchange = (r.exchange || '').toUpperCase();
        const type = (r.type || r.instrument_type || '').toUpperCase();
        const isHK = country === 'HONG KONG' || exchange.indexOf('HONG KONG') !== -1 || exchange === 'HKSE' || sym.endsWith('.HK');
        const isETF = type.indexOf('ETF') !== -1 || name.toUpperCase().indexOf('ETF') !== -1;
        let assetType = 'us_stock';
        if (isHK && isETF) assetType = 'hk_etf';
        else if (isHK) assetType = 'hk_stock';
        else if (isETF) assetType = 'etf';
        out.push({ symbol: sym, name: name, type: assetType });
      }
      return out;
    } catch (e) {
      return [];
    }
  },

  /** Search CoinGecko for crypto (fallback) */
  async searchCrypto(query) {
    if (!query || query.length < 2) return [];
    try {
      const url = 'https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(query);
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const data = await res.json();
      const out = [];
      const coins = data.coins || [];
      for (let i = 0; i < Math.min(coins.length, 5); i++) {
        out.push({
          symbol: coins[i].symbol.toUpperCase(),
          name: coins[i].name,
          type: 'crypto'
        });
      }
      return out;
    } catch (e) {
      return [];
    }
  },

  /** Combined search — Twelve Data first, CoinGecko for crypto backup */
  async searchAll(query) {
    if (!query || query.length < 1) return [];
    const isCrypto = /^(btc|eth|sol|ada|dot|doge|xrp|bnb|avax|matic|link|uni|atom|ltc|fil|near|apt|arb|op|sui)/i.test(query);

    let results = await this.searchTwelve(query);

    // CoinGecko for crypto queries
    if (isCrypto) {
      const cg = await this.searchCrypto(query);
      results = results.concat(cg);
    }

    // Dedupe
    const seen = {};
    const out = [];
    for (let i = 0; i < results.length; i++) {
      const key = results[i].symbol.toUpperCase();
      if (!seen[key]) {
        seen[key] = true;
        out.push(results[i]);
      }
    }
    return out.slice(0, 12);
  },

  /**
   * Batch fetch quotes from Twelve Data time_series.
   * Pass up to 8 symbols per call (rate limit: 8/min).
   */
  async batchQuoteTwelve(symbols) {
    if (!symbols || symbols.length === 0) return {};
    const result = {};
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
        if (Array.isArray(data)) {
          for (let j = 0; j < data.length; j++) {
            const item = data[j];
            const sym = (item.meta && item.meta.symbol) || item.symbol;
            const vals = item.values && item.values[0];
            if (sym && vals) {
              const price = parseFloat(vals.close);
              if (price > 0) {
                result[sym.toUpperCase()] = {
                  price: price,
                  currency: this.inferCurrency(sym, item.meta && item.meta.currency)
                };
              }
            }
          }
        } else if (data.meta && data.meta.symbol) {
          const sym = data.meta.symbol;
          const vals = data.values && data.values[0];
          if (vals) {
            const price = parseFloat(vals.close);
            if (price > 0) {
              result[sym.toUpperCase()] = {
                price: price,
                currency: this.inferCurrency(sym, data.meta && data.meta.currency)
              };
            }
          }
        }
      } catch (e) {
        // Fallback: individual /price calls
        for (let j = 0; j < chunk.length; j++) {
          try {
            const d = await this.tdFetch('/price', { symbol: chunk[j] });
            const price = parseFloat(d && d.price);
            if (price > 0) {
              result[chunk[j].toUpperCase()] = {
                price: price,
                currency: this.inferCurrency(chunk[j])
              };
            }
          } catch (err2) {
            // skip
          }
        }
      }
      // Rate limit: wait between chunks
      if (i + chunkSize < symbols.length) {
        await this.sleep(8000);
      }
    }
    return result;
  },

  /** Fetch crypto price from CoinGecko */
  async fetchCryptoPrice(coinIds) {
    if (!coinIds || coinIds.length === 0) return {};
    try {
      const ids = coinIds.join(',');
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(ids) + '&vs_currencies=usd',
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return {};
      const data = await res.json();
      const result = {};
      for (let i = 0; i < coinIds.length; i++) {
        if (data[coinIds[i]] && data[coinIds[i]].usd != null) {
          result[coinIds[i]] = { price: data[coinIds[i]].usd, currency: 'USD' };
        }
      }
      return result;
    } catch (e) {
      return {};
    }
  },

  /** Fetch forex rates from ExchangeRate-API */
  async fetchForexRates(baseCurrency) {
    baseCurrency = baseCurrency || 'USD';
    const res = await fetch(
      'https://api.exchangerate-api.com/v4/latest/' + encodeURIComponent(baseCurrency),
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error('ExchangeRate HTTP ' + res.status);
    const data = await res.json();
    return data.rates || {};
  },

  /** Fetch all asset prices */
  async fetchAllPrices(assets) {
    const prices = {};
    const errors = [];
    const tdAssets = [];
    const cryptoAssets = [];
    const forexAssets = [];
    const cashAssets = [];

    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a.type === 'us_stock' || a.type === 'hk_stock' || a.type === 'etf' || a.type === 'hk_etf') tdAssets.push(a);
      else if (a.type === 'crypto') cryptoAssets.push(a);
      else if (a.type === 'forex') forexAssets.push(a);
      else if (a.type === 'cash') cashAssets.push(a);
    }

    // 1. Twelve Data stocks/ETFs (batch)
    if (tdAssets.length > 0) {
      try {
        const symbols = tdAssets.map(function(a) { return a.symbol; });
        const tdPrices = await this.batchQuoteTwelve(symbols);
        for (let i = 0; i < tdAssets.length; i++) {
          const asset = tdAssets[i];
          const key = asset.symbol.toUpperCase();
          if (tdPrices[key]) {
            prices[asset.id] = tdPrices[key];
          } else {
            errors.push({ symbol: asset.symbol, name: asset.name, error: 'No Twelve Data quote' });
          }
        }
      } catch (err) {
        tdAssets.forEach(function(a) {
          errors.push({ symbol: a.symbol, name: a.name, error: err.message });
        });
      }
    }

    // 2. CoinGecko crypto (batch)
    if (cryptoAssets.length > 0) {
      try {
        const coinIds = cryptoAssets.map(function(a) { return Utils.toCoinGeckoId(a.symbol); });
        const cgPrices = await this.fetchCryptoPrice(coinIds);
        for (let i = 0; i < cryptoAssets.length; i++) {
          const asset = cryptoAssets[i];
          const id = Utils.toCoinGeckoId(asset.symbol);
          if (cgPrices[id]) {
            prices[asset.id] = cgPrices[id];
          } else {
            errors.push({ symbol: asset.symbol, name: asset.name, error: 'No CoinGecko data' });
          }
        }
      } catch (err) {
        cryptoAssets.forEach(function(a) {
          errors.push({ symbol: a.symbol, name: a.name, error: err.message });
        });
      }
    }

    // 3. Forex
    if (forexAssets.length > 0) {
      try {
        const baseCurrencies = [];
        const seenBases = {};
        for (let i = 0; i < forexAssets.length; i++) {
          if (!seenBases[forexAssets[i].currency]) {
            seenBases[forexAssets[i].currency] = true;
            baseCurrencies.push(forexAssets[i].currency);
          }
        }
        const allRates = {};
        for (let i = 0; i < baseCurrencies.length; i++) {
          const rates = await this.fetchForexRates(baseCurrencies[i]);
          allRates[baseCurrencies[i]] = rates;
          await this.sleep(500);
        }
        for (let i = 0; i < forexAssets.length; i++) {
          const asset = forexAssets[i];
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
        forexAssets.forEach(function(a) {
          errors.push({ symbol: a.symbol, name: a.name, error: err.message });
        });
      }
    }

    // 4. Cash
    for (let i = 0; i < cashAssets.length; i++) {
      prices[cashAssets[i].id] = { price: 1.0, currency: cashAssets[i].currency };
    }

    return { prices: prices, errors: errors };
  },

  inferCurrency(symbol, apiCurrency) {
    if (apiCurrency) return apiCurrency.toUpperCase();
    if (symbol.endsWith('.HK')) return 'HKD';
    if (symbol.endsWith('.T')) return 'JPY';
    if (symbol.endsWith('.L')) return 'GBP';
    if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) return 'CNY';
    return 'USD';
  },

  sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }
};
