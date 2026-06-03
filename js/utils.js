/**
 * utils.js — Helpers: formatting, currency conversion, UUID, etc.
 */

const Utils = {
  /** Generate a short UUID */
  uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  },

  /** Format number with commas, N decimal places */
  fmt(n, decimals = 2) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  /** Format HKD currency */
  fmtHKD(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + this.fmt(n);
  },

  /** Format percentage with +/- sign */
  fmtPct(n) {
    if (n == null || isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return sign + this.fmt(n, 2) + '%';
  },

  /** Format change: +$1,234.56 (+5.67%) */
  fmtChange(value, pct) {
    if (value == null || isNaN(value)) return '—';
    const sign = value >= 0 ? '+' : '';
    const pctStr = pct != null && !isNaN(pct) ? ` (${this.fmtPct(pct)})` : '';
    return sign + '$' + this.fmt(value) + pctStr;
  },

  /** Get today's date string YYYY-MM-DD */
  todayStr() {
    return new Date().toISOString().slice(0, 10);
  },

  /** Get current timestamp */
  now() {
    return Date.now();
  },

  /** Debounce */
  debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  /** Map of currency symbols for display */
  currencySymbols: {
    USD: '$', HKD: 'HK$', JPY: '¥', EUR: '€',
    CNY: '¥', GBP: '£', KRW: '₩', SGD: 'S$'
  },

  /** Get symbol for currency */
  currencySymbol(cur) {
    return this.currencySymbols[cur] || cur;
  },

  /** Determine API source for asset type */
  getApiSource(type) {
    if (type === 'crypto') return 'coingecko';
    return 'finnhub';
  },

  /** Get Finnhub symbol from asset symbol */
  toFinnhubSymbol(symbol, type) {
    if (type === 'forex') {
      // e.g. USDJPY → forex symbol
      return symbol;
    }
    return symbol;
  },

  /** Get CoinGecko ID from symbol */
  toCoinGeckoId(symbol) {
    const map = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'DOGE': 'dogecoin',
      'XRP': 'ripple',
      'BNB': 'binancecoin',
      'AVAX': 'avalanche-2',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'LTC': 'litecoin',
      'FIL': 'filecoin',
      'NEAR': 'near',
      'APT': 'aptos',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'SUI': 'sui'
    };
    const sym = symbol.toUpperCase().replace(/-(USD|USDT|BTC|ETH)$/, '');
    return map[sym] || sym.toLowerCase();
  }
};
