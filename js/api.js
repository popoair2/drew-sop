/**
 * api.js — Price fetching from Yahoo Finance + CoinGecko
 *
 * Yahoo Finance: free, no key, supports US + HK + forex
 *   Search: https://query1.finance.yahoo.com/v1/finance/search?q=XXX
 *   Quote:  https://query1.finance.yahoo.com/v8/finance/chart/SYMBOL?range=1d&interval=1d
 *
 * CoinGecko: free, no key, for crypto only (no CORS issues)
 * ExchangeRate-API: free, no key, for forex/cash rates (no CORS issues)
 */

const API = {
  YAHOO_BASE: 'https://query1.finance.yahoo.com',

  // CORS proxy chain — tried in order. Each entry: full URL with TARGET placeholder.
  CORS_PROXIES: [
    'https://drew-sop-proxy.popoandrew.workers.dev?url=TARGET',
    'https://api.allorigins.win/raw?url=TARGET',
    'https://corsproxy.io/?TARGET',
    'https://api.codetabs.com/v1/proxy?quest=TARGET',
  ],

  async yahooFetch(path) {
    const url = this.YAHOO_BASE + path;

    // 1. Try direct first (works on desktop / some networks)
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) throw new Error('Yahoo HTTP ' + res.status);
      return res.json();
    } catch (directErr) {
      console.warn('Yahoo direct fetch failed, trying CORS proxies:', directErr.message);
    }

    // 2. Try each CORS proxy in sequence
    for (let i = 0; i < this.CORS_PROXIES.length; i++) {
      const proxyUrl = this.CORS_PROXIES[i].replace('TARGET', encodeURIComponent(url));
      try {
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
        const data = await res.json();
        // Validate it looks like Yahoo response
        if (data && data.chart) {
          console.log('CORS proxy #' + (i + 1) + ' succeeded:', this.CORS_PROXIES[i]);
          return data;
        }
        throw new Error('Invalid response shape');
      } catch (proxyErr) {
        console.warn('CORS proxy #' + (i + 1) + ' failed:', proxyErr.message);
      }
    }

    throw new Error('All Yahoo Finance fetch methods failed (direct + ' + this.CORS_PROXIES.length + ' proxies)');
  },

  /** Search Yahoo Finance for symbols (stocks + ETFs) */
  async searchYahoo(query) {
    if (!query || query.length < 1) return [];
    // Try multiple endpoints — v1/finance/search first, then v6/finance/autocomplete as fallback
    const endpoints = [
      '/v1/finance/search?q=' + encodeURIComponent(query) + '&quotesCount=10&newsCount=0',
      '/v6/finance/autocomplete?query=' + encodeURIComponent(query) + '&lang=en-US&region=US',
    ];
    for (const path of endpoints) {
      try {
        const data = await this.yahooFetch(path);
        const out = [];
        // v1 format: data.quotes[]
        if (data && data.quotes && data.quotes.length > 0) {
          for (let i = 0; i < Math.min(data.quotes.length, 12); i++) {
            const q = data.quotes[i];
            const sym = q.symbol || '';
            if (!sym) continue;
            const isHK = sym.endsWith('.HK');
            const isETF = (q.quoteType || '').toUpperCase() === 'ETF' || (q.shortname || '').toUpperCase().indexOf('ETF') !== -1;
            const isCrypto = (q.quoteType || '').toUpperCase() === 'CRYPTOCURRENCY' || sym.indexOf('-') !== -1;
            let type = 'us_stock';
            if (isCrypto) type = 'crypto';
            else if (isHK && isETF) type = 'hk_etf';
            else if (isHK) type = 'hk_stock';
            else if (isETF) type = 'etf';
            out.push({ symbol: sym, name: q.shortname || q.longname || sym, type: type });
          }
          if (out.length > 0) return out;
        }
        // v6 format: data.ResultSet.Result[]
        if (data && data.ResultSet && data.ResultSet.Result && data.ResultSet.Result.length > 0) {
          for (let i = 0; i < Math.min(data.ResultSet.Result.length, 12); i++) {
            const r = data.ResultSet.Result[i];
            const sym = r.symbol || '';
            if (!sym) continue;
            const isHK = sym.endsWith('.HK');
            const isETF = (r.typeDisp || '').toUpperCase() === 'ETF' || (r.name || '').toUpperCase().indexOf('ETF') !== -1;
            let type = 'us_stock';
            if (isHK && isETF) type = 'hk_etf';
            else if (isHK) type = 'hk_stock';
            else if (isETF) type = 'etf';
            out.push({ symbol: sym, name: r.name || sym, type: type });
          }
          if (out.length > 0) return out;
        }
      } catch (e) {
        console.warn('Yahoo search endpoint failed:', path, e.message);
      }
    }
    return [];
  },

  /** Search CoinGecko for crypto */
  async searchCrypto(query) {
    if (!query || query.length < 1) return [];
    try {
      const url = 'https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(query);
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const data = await res.json();
      const out = [];
      const coins = data.coins || [];
      for (let i = 0; i < Math.min(coins.length, 5); i++) {
        out.push({ symbol: coins[i].symbol.toUpperCase(), name: coins[i].name, type: 'crypto' });
      }
      return out;
    } catch (e) {
      return [];
    }
  },

  /** Fetch a single stock/ETF quote from Yahoo Finance */
  async fetchYahooQuote(symbol) {
    const data = await this.yahooFetch('/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=1d&interval=1d');
    const result = data && data.chart && data.chart.result ? data.chart.result[0] : null;
    if (!result) throw new Error('No data for ' + symbol);
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    if (!price || price === 0) throw new Error('Zero price for ' + symbol);
    return {
      price: price,
      currency: meta.currency || this.inferCurrency(symbol),
      dividendYield: meta.dividendYield || null,
      trailingAnnualDividendRate: meta.trailingAnnualDividendRate || null
    };
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
    const yahooAssets = [];
    const cryptoAssets = [];
    const forexAssets = [];
    const cashAssets = [];

    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a.type === 'us_stock' || a.type === 'hk_stock' || a.type === 'etf' || a.type === 'hk_etf') yahooAssets.push(a);
      else if (a.type === 'crypto') cryptoAssets.push(a);
      else if (a.type === 'forex') forexAssets.push(a);
      else if (a.type === 'cash') cashAssets.push(a);
    }

    // 1. Yahoo Finance stocks/ETFs (sequential with delay)
    for (let i = 0; i < yahooAssets.length; i++) {
      const asset = yahooAssets[i];
      try {
        const result = await this.fetchYahooQuote(asset.symbol);
        prices[asset.id] = result;
      } catch (err) {
        errors.push({ symbol: asset.symbol, name: asset.name, error: err.message });
      }
      // Small delay to be polite
      if (i < yahooAssets.length - 1) await this.sleep(300);
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
