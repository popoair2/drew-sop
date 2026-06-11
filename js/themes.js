/**
 * themes.js — Theme Engine + Theme Definitions
 *
 * ThemeEngine: lightweight, zero-dependency theme manager.
 * Themes are defined as CSS custom property maps.
 * Persistence via localStorage key: ds_theme
 *
 * Usage:
 *   ThemeEngine.init();                          // apply saved/default theme
 *   ThemeEngine.apply('hacker-terminal');        // switch theme
 *   ThemeEngine.list();                          // → ['hacker-terminal', 'paper-light']
 *   ThemeEngine.current();                       // → 'hacker-terminal'
 */

const ThemeEngine = {
  STORAGE_KEY: 'ds_theme',
  DATA_ATTR: 'data-theme',

  // ── Theme Definitions ──────────────────────────────────────────
  // Each theme is a map of CSS custom property names → values.
  // Only override what differs from the base; the engine applies
  // every key in the map to document.documentElement.style.

  themes: {
    // ══════════════════════════════════════════════════════════════
    // HACKER TERMINAL — Matrix green on pure black (current default)
    // ══════════════════════════════════════════════════════════════
    'hacker-terminal': {
      // Palette
      '--green-bright': '#00FF41',
      '--green':         '#00D936',
      '--green-dim':     '#008F11',
      '--green-dark':    '#003B00',
      '--green-glow':    'rgba(0, 255, 65, 0.15)',
      '--green-glow-strong': 'rgba(0, 255, 65, 0.3)',

      // Backgrounds
      '--bg':       '#000000',
      '--bg-card':  '#0A0A0A',
      '--bg-input': '#0D0D0D',

      // Text
      '--text':        '#00FF41',
      '--text-dim':    '#008F11',
      '--text-bright': '#39FF14',
      '--text-muted':  '#005F0A',

      // Accents
      '--warn': '#FFB000',
      '--err':  '#FF3333',
      '--cyan': '#00FFFF',

      // Borders
      '--border':       '#00FF41',
      '--border-dim':   '#003B00',
      '--border-glow':  'rgba(0, 255, 65, 0.4)',

      // Radius
      '--radius': '0px',

      // Font
      '--font': "'Courier New', 'Consolas', 'Monaco', 'Lucida Console', monospace",

      // Category colours (green variants)
      '--cat-1': '#00FF41',
      '--cat-2': '#00D936',
      '--cat-3': '#00B32D',
      '--cat-4': '#008F11',
      '--cat-5': '#39FF14',
      '--cat-6': '#00FF80',
      '--cat-7': '#4AFF9E',
      '--cat-8': '#00CC33',

      // Scanline opacity
      '--scanline-opacity': '0.08',
    },

    // ══════════════════════════════════════════════════════════════
    // PAPER LIGHT — Clean white/blue, modern sans-serif
    // ══════════════════════════════════════════════════════════════
    'paper-light': {
      // Palette
      '--green-bright': '#2563EB',
      '--green':         '#3B82F6',
      '--green-dim':     '#60A5FA',
      '--green-dark':    '#DBEAFE',
      '--green-glow':    'rgba(37, 99, 235, 0.08)',
      '--green-glow-strong': 'rgba(37, 99, 235, 0.15)',

      // Backgrounds
      '--bg':       '#F8FAFC',
      '--bg-card':  '#FFFFFF',
      '--bg-input': '#F1F5F9',

      // Text
      '--text':        '#1E293B',
      '--text-dim':    '#64748B',
      '--text-bright': '#0F172A',
      '--text-muted':  '#94A3B8',

      // Accents
      '--warn': '#F59E0B',
      '--err':  '#EF4444',
      '--cyan': '#0891B2',

      // Borders
      '--border':       '#2563EB',
      '--border-dim':   '#CBD5E1',
      '--border-glow':  'rgba(37, 99, 235, 0.25)',

      // Radius
      '--radius': '8px',

      // Font
      '--font': "'Inter', 'Segoe UI', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",

      // Category colours (blue palette)
      '--cat-1': '#2563EB',
      '--cat-2': '#3B82F6',
      '--cat-3': '#60A5FA',
      '--cat-4': '#0891B2',
      '--cat-5': '#0D9488',
      '--cat-6': '#7C3AED',
      '--cat-7': '#DB2777',
      '--cat-8': '#EA580C',

      // Scanline opacity (disabled for light theme)
      '--scanline-opacity': '0',
    },
  },

  // ── Public API ──────────────────────────────────────────────────

  /** Return array of registered theme IDs */
  list() {
    return Object.keys(this.themes);
  },

  /** Return the currently applied theme ID, or null */
  current() {
    return document.documentElement.getAttribute(this.DATA_ATTR) || null;
  },

  /**
   * Apply a theme by ID.
   * Sets data-theme attribute on <html> and applies CSS variables.
   * Falls back to the first registered theme if name is unknown.
   */
  apply(name) {
    const theme = this.themes[name];
    if (!theme) {
      console.warn('ThemeEngine: unknown theme "' + name + '", falling back to default');
      name = this.list()[0];
    }

    const root = document.documentElement;
    root.setAttribute(this.DATA_ATTR, name);

    // Apply every CSS custom property
    for (const [prop, value] of Object.entries(this.themes[name])) {
      root.style.setProperty(prop, value);
    }

    // Persist
    try {
      localStorage.setItem(this.STORAGE_KEY, name);
    } catch (e) { /* ignore */ }

    // Dispatch custom event so other modules can react
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: name } }));
  },

  /**
   * Initialise: read saved theme from localStorage or use default.
   * Call once on page load, BEFORE any rendering.
   */
  init() {
    let saved = null;
    try {
      saved = localStorage.getItem(this.STORAGE_KEY);
    } catch (e) { /* ignore */ }

    if (!saved || !this.themes[saved]) {
      saved = this.list()[0]; // default = first registered
    }

    this.apply(saved);
  },
};
