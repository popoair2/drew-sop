/**
 * api.js — Price fetching from Yahoo Finance + CoinGecko
 *
 * Yahoo Finance: free, no API key needed
 *   Search: https://query1.finance.yahoo.com/v1/finance/search?q=XXX
 *   Quote:  https://query1.finance.yahoo.com/v8/finance/chart/SYMBOL?range=1d&interval=1d
 *
 * CoinGecko: free, no key, for crypto
 */

const API = {
  YAHOO_BASE: 'https://query1.finance.yahoo.com',

  async yahooFetch(path) {
    const url = `${this.YAHOO_BASE}${path}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    return res.json();
  },

  /** Search Yahoo Finance for symbols */
  async searchYahoo(query) {
    if (!query || query.length < 1) return [];
    try {
      const data = await this.yahooFetch(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`);
      const quotes = data?.quotes || [];
      return quotes.slice(0, 12).map(q => {
        const sym = q.symbol || '';
        const isHK = sym.endsWith('.HK');
        const isETF = (q.quoteType || '').toUpperCase() === 'ETF' || (q.shortname || '').toUpperCase().includes('ETF');
        const isCrypto = (q.quoteType || '').toUpperCase() === 'CRYPTOCURRENCY' || sym.includes('-');
        let type = 'us_stock';
        if (isCrypto) type = 'crypto';
        else if (isHK && isETF) type = 'hk_etf';
        else if (isHK) type = 'hk_stock';
        else if (isETF) type = 'etf';
        return {
          symbol: sym,
          name: q.shortname || q.longname || sym,
          type
        };
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

  /** Combined search — Yahoo first, CoinGecko for crypto backup */
  async searchAll(query) {
    if (!query || query.length < 1) return [];
    const isCrypto = /^(btc|eth|sol|ada|dot|doge|xrp|bnb|avax|matic|link|uni|atom|ltc|fil|near|apt|arb|op|sui)/i.test(query);

    // Yahoo Finance (covers stocks, ETFs, forex — US + HK)
    let results = await this.searchYahoo(query);

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
  },

  /** Fetch a single stock/ETF quote from Yahoo Finance */
  async fetchYahooQuote(symbol) {
    const data = await this.yahooFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`);
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${symbol}`);
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    if (!price || price === 0) throw new Error(`Zero price for ${symbol}`);
    return {
      price,
      currency: meta.currency || this.inferCurrency(symbol)
    };
  },

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
  },

  /** Fetch forex rates from ExchangeRate-API */
  async fetchForexRates(baseCurrency = 'USD') {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(baseCurrency)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`ExchangeRate HTTP ${res.status}`);
    const data = await res.json();
    return data.rates || {};
  },

  /** Fetch all asset prices */
  async fetchAllPrices(assets) {
    const prices = {};
    const errors = [];
    const finnhubAssets = assets.filter(a =>
      ['us_stock', 'hk_stock', 'etf', 'hk_etf'].includes(a.type)
    );
    const cryptoAssets = assets.filter(a => a.type === 'crypto');
    const forexAssets = assets.filter(a => a.type === 'forex');
    const cashAssets = assets.filter(a => a.type === 'cash');

    // 1. Yahoo Finance stocks/ETFs (sequential)
    for (const asset of finnhubAssets) {
      try {
        const result = await this.fetchYahooQuote(asset.symbol);
        prices[asset.id] = result;
        await this.sleep(500);
      } catch (err) {
        errors.push({ symbol: asset.symbol, name: asset.name, error: err.message });
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
  },

  inferCurrency(symbol) {
    if (symbol.endsWith('.HK')) return 'HKD';
    if (symbol.endsWith('.T')) return 'JPY';
    if (symbol.endsWith('.L')) return 'GBP';
    if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) return 'CNY';
    return 'USD';
  },

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
};
