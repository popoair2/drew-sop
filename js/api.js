/**
 * api.js — Price fetching from Finnhub + CoinGecko
 */

const API = {
  /** Fetch a single price from Finnhub */
  async fetchFinnhubQuote(symbol, apiKey) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.c === 0) throw new Error(`No data for ${symbol}`);
    return { price: data.c, currency: this.inferCurrency(symbol) };
  },

  /** Fetch forex rate from Finnhub (e.g. USDHKD) */
  async fetchFinnhubForex(from, to, apiKey) {
    const symbol = `OANDA:${from.toUpperCase()}${to.toUpperCase()}`;
    return this.fetchFinnhubQuote(symbol, apiKey);
  },

  /** Fetch crypto price from CoinGecko */
  async fetchCoinGeckoPrice(coinId) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    if (!data[coinId] || data[coinId].usd == null) throw new Error(`No data for ${coinId}`);
    return { price: data[coinId].usd, currency: 'USD' };
  },

  /** Fetch all asset prices */
  async fetchAllPrices(assets, apiKey) {
    const prices = {};
    const errors = [];

    // Group by API source
    const finnhubAssets = assets.filter(a => Utils.getApiSource(a.type) === 'finnhub');
    const coingeckoAssets = assets.filter(a => Utils.getApiSource(a.type) === 'coingecko');

    // Fetch Finnhub (one at a time to respect rate limits)
    for (const asset of finnhubAssets) {
      try {
        let result;
        if (asset.type === 'forex') {
          // Forex: symbol like "USDJPY" → convert to HKD
          const base = asset.symbol.slice(0, 3);
          const quote = asset.symbol.slice(3, 6);
          if (quote === 'HKD') {
            result = await this.fetchFinnhubForex(base, 'HKD', apiKey);
            result.currency = 'HKD';
          } else {
            // Get rate to HKD via USD
            const toUSD = await this.fetchFinnhubForex(base, 'USD', apiKey);
            const hkdUSD = await this.fetchFinnhubForex('HKD', 'USD', apiKey);
            result = {
              price: toUSD.price / hkdUSD.price,
              currency: 'HKD'
            };
          }
        } else {
          result = await this.fetchFinnhubQuote(asset.symbol, apiKey);
        }
        prices[asset.id] = result;
        // Small delay to respect rate limits
        await this.sleep(1200);
      } catch (err) {
        errors.push({ symbol: asset.symbol, error: err.message });
      }
    }

    // Fetch CoinGecko (batch)
    if (coingeckoAssets.length > 0) {
      try {
        const ids = coingeckoAssets.map(a => Utils.toCoinGeckoId(a.symbol)).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;
        const res = await fetch(url);
        const data = await res.json();
        for (const asset of coingeckoAssets) {
          const id = Utils.toCoinGeckoId(asset.symbol);
          if (data[id] && data[id].usd != null) {
            prices[asset.id] = { price: data[id].usd, currency: 'USD' };
          } else {
            errors.push({ symbol: asset.symbol, error: 'No CoinGecko data' });
          }
        }
      } catch (err) {
        coingeckoAssets.forEach(a => {
          errors.push({ symbol: a.symbol, error: err.message });
        });
      }
    }

    // Cash / money market funds: price = 1.0 in their currency
    assets.filter(a => a.type === 'cash').forEach(asset => {
      prices[asset.id] = { price: 1.0, currency: asset.currency };
    });

    return { prices, errors };
  },

  /** Fetch forex rate for currency conversion to HKD */
  async fetchForexRate(currency, apiKey) {
    if (currency === 'HKD') return 1.0;
    if (currency === 'USD') {
      const result = await this.fetchFinnhubForex('USD', 'HKD', apiKey);
      return result.price;
    }
    // Convert via USD
    const toUSD = await this.fetchForexRateToUSD(currency, apiKey);
    const usdToHKD = await this.fetchFinnhubForex('USD', 'HKD', apiKey);
    return toUSD * usdToHKD.price;
  },

  /** Get rate: 1 unit of currency = ? USD */
  async fetchForexRateToUSD(currency, apiKey) {
    if (currency === 'USD') return 1.0;
    // Try direct: currency to USD
    try {
      const result = await this.fetchFinnhubForex(currency, 'USD', apiKey);
      return result.price;
    } catch {
      // Fallback: use cached or default
      return this.getFallbackRate(currency);
    }
  },

  /** Fallback forex rates (approximate, updated rarely) */
  getFallbackRate(currency) {
    const rates = {
      USD: 1.0,
      HKD: 0.128,
      JPY: 0.0067,
      EUR: 1.08,
      CNY: 0.14,
      GBP: 1.27,
      KRW: 0.00075,
      SGD: 0.74
    };
    return rates[currency] || 1.0;
  },

  /** Infer currency from symbol */
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
