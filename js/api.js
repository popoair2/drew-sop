/**
 * api.js — Price fetching from Finnhub + CoinGecko + ExchangeRate-API
 *
 * Asset types & how prices are fetched:
 *   us_stock, hk_stock, etf  → Finnhub /quote
 *   crypto                    → CoinGecko /simple/price
 *   forex                     → Finnhub /quote (e.g. USDEUR) — NOT available on free tier
 *                               Fallback: user enters as "1 USD = X HKD" manually
 *   cash                      → price = 1.0 (user-managed value)
 */

const API = {
  /** Fetch a single stock/ETF price from Finnhub */
  async fetchFinnhubQuote(symbol, apiKey) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.c === 0) throw new Error(`No data for ${symbol}`);
    return { price: data.c, currency: this.inferCurrency(symbol) };
  },

  /** Fetch crypto price from CoinGecko (batch) */
  async fetchCoinGeckoPrices(coinIds) {
    if (coinIds.length === 0) return {};
    const ids = coinIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    const result = {};
    for (const id of coinIds) {
      if (data[id] && data[id].usd != null) {
        result[id] = { price: data[id].usd, currency: 'USD' };
      }
    }
    return result;
  },

  /** Fetch forex rates from ExchangeRate-API (free, no key) */
  async fetchForexRates(baseCurrency = 'USD') {
    const url = `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(baseCurrency)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ExchangeRate HTTP ${res.status}`);
    const data = await res.json();
    return data.rates || {};
  },

  /** Search Finnhub for stock/ETF symbols (US + HK) */
  async searchFinnhub(query, apiKey) {
    if (!query || query.length < 1) return [];
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.result) return [];
    return data.result
      .filter(r => r.symbol)
      .slice(0, 12)
      .map(r => {
        const isHK = r.symbol.endsWith('.HK');
        const desc = (r.description || '').toUpperCase();
        const isETF = desc.includes('ETF') || desc.includes('ETP') || desc.includes('TRUST') || desc.includes('INDEX');
        let type = 'us_stock';
        if (isHK && isETF) type = 'hk_etf';
        else if (isHK) type = 'hk_stock';
        else if (isETF) type = 'etf';
        return { symbol: r.symbol, name: r.description || r.symbol, type };
      });
  },

  /** Search CoinGecko for crypto */
  async searchCoinGecko(query) {
    if (!query || query.length < 2) return [];
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.coins) return [];
    return data.coins.slice(0, 8).map(c => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      type: 'crypto'
    }));
  },

  /** Combined search — returns deduplicated results */
  async searchAll(query, apiKey) {
    if (!query || query.length < 1) return [];
    const results = [];

    // Always search Finnhub (covers US + HK)
    if (apiKey) {
      try {
        const finnhubResults = await this.searchFinnhub(query, apiKey);
        results.push(...finnhubResults);
      } catch (e) {}
    }

    // Also search CoinGecko for crypto
    try {
      const cryptoResults = await this.searchCoinGecko(query);
      results.push(...cryptoResults);
    } catch (e) {}

    // Deduplicate by symbol
    const seen = new Set();
    return results.filter(r => {
      const key = r.symbol.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  },

  /** Fetch all asset prices */
  async fetchAllPrices(assets, apiKey) {
    const prices = {};
    const errors = [];

    // Group by API source
    const finnhubAssets = assets.filter(a =>
      ['us_stock', 'hk_stock', 'etf', 'hk_etf'].includes(a.type)
    );
    const cryptoAssets = assets.filter(a => a.type === 'crypto');
    const forexAssets = assets.filter(a => a.type === 'forex');
    const cashAssets = assets.filter(a => a.type === 'cash');

    // 1. Fetch Finnhub stocks/ETFs (sequential to respect 60/min rate limit)
    for (const asset of finnhubAssets) {
      try {
        const result = await this.fetchFinnhubQuote(asset.symbol, apiKey);
        prices[asset.id] = result;
        await this.sleep(1100); // ~1 call/sec to stay under 60/min
      } catch (err) {
        errors.push({ symbol: asset.symbol, name: asset.name, error: err.message });
      }
    }

    // 2. Fetch CoinGecko crypto (batch)
    if (cryptoAssets.length > 0) {
      try {
        const coinIds = cryptoAssets.map(a => Utils.toCoinGeckoId(a.symbol));
        const cgPrices = await this.fetchCoinGeckoPrices(coinIds);
        for (const asset of cryptoAssets) {
          const id = Utils.toCoinGeckoId(asset.symbol);
          if (cgPrices[id]) {
            prices[asset.id] = cgPrices[id];
          } else {
            errors.push({ symbol: asset.symbol, name: asset.name, error: 'No CoinGecko data' });
          }
        }
      } catch (err) {
        cryptoAssets.forEach(a => {
          errors.push({ symbol: a.symbol, name: a.name, error: err.message });
        });
      }
    }

    // 3. Fetch forex rates (single call for all currencies needed)
    if (forexAssets.length > 0) {
      try {
        // Get all unique base currencies
        const baseCurrencies = [...new Set(forexAssets.map(a => a.currency))];
        const allRates = {};
        for (const base of baseCurrencies) {
          const rates = await this.fetchForexRates(base);
          allRates[base] = rates;
          await this.sleep(500);
        }
        for (const asset of forexAssets) {
          // Forex asset: symbol like "USDJPY", currency is the quote currency
          // Price = how much quote currency per 1 unit of base
          // We need to convert to HKD
          const base = asset.symbol.slice(0, 3);
          const quote = asset.symbol.slice(3, 6) || asset.currency;
          const baseRates = allRates[base];
          if (baseRates) {
            const rateToQuote = baseRates[quote] || 1;
            const rateToHKD = baseRates['HKD'] || 1;
            // 1 unit of base = rateToQuote of quote
            // Convert: price in HKD = rateToHKD / rateToQuote * rateToQuote... 
            // Actually for forex, we store the rate and let toHKD handle it
            prices[asset.id] = {
              price: rateToQuote,
              currency: quote,
              forexBase: base,
              rateToHKD: rateToHKD
            };
          } else {
            errors.push({ symbol: asset.symbol, name: asset.name, error: 'No forex rate' });
          }
        }
      } catch (err) {
        forexAssets.forEach(a => {
          errors.push({ symbol: a.symbol, name: a.name, error: err.message });
        });
      }
    }

    // 4. Cash / money market funds: price = 1.0 in their currency
    for (const asset of cashAssets) {
      prices[asset.id] = { price: 1.0, currency: asset.currency };
    }

    return { prices, errors };
  },

  /** Infer currency from symbol suffix */
  inferCurrency(symbol) {
    if (symbol.endsWith('.HK')) return 'HKD';
    if (symbol.endsWith('.T')) return 'JPY';
    if (symbol.endsWith('.L')) return 'GBP';
    if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) return 'CNY';
    return 'USD';
  },

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
};
