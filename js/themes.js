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
    // NEON CYBER — Purple/cyan neon on deep dark, glow everywhere
    // ══════════════════════════════════════════════════════════════
    'neon-cyber': {
      // Palette
      '--green-bright': '#D946EF',
      '--green':         '#A855F7',
      '--green-dim':     '#7C3AED',
      '--green-dark':    '#1E1B4B',
      '--green-glow':    'rgba(217, 70, 239, 0.12)',
      '--green-glow-strong': 'rgba(217, 70, 239, 0.25)',

      // Backgrounds
      '--bg':       '#0C0A1A',
      '--bg-card':  '#13102B',
      '--bg-input': '#1A1635',

      // Text
      '--text':        '#E9D5FF',
      '--text-dim':    '#A78BFA',
      '--text-bright': '#F0ABFC',
      '--text-muted':  '#6B5B95',

      // Accents
      '--warn': '#FBBF24',
      '--err':  '#FB7185',
      '--cyan': '#22D3EE',

      // Borders
      '--border':       '#D946EF',
      '--border-dim':   '#3B1F6E',
      '--border-glow':  'rgba(217, 70, 239, 0.5)',

      // Radius
      '--radius': '12px',

      // Font
      '--font': "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",

      // Category colours (purple/pink/cyan palette)
      '--cat-1': '#D946EF',
      '--cat-2': '#A855F7',
      '--cat-3': '#22D3EE',
      '--cat-4': '#F472B6',
      '--cat-5': '#818CF8',
      '--cat-6': '#34D399',
      '--cat-7': '#FBBF24',
      '--cat-8': '#FB923C',

      // Scanline opacity
      '--scanline-opacity': '0.04',
    },

    // ══════════════════════════════════════════════════════════════
    // MINIMAL WHITE — Pure white, ultra-clean, no borders, modern
    // ══════════════════════════════════════════════════════════════
    'minimal-white': {
      // Palette
      '--green-bright': '#18181B',
      '--green':         '#3F3F46',
      '--green-dim':     '#71717A',
      '--green-dark':    '#E4E4E7',
      '--green-glow':    'rgba(24, 24, 27, 0.04)',
      '--green-glow-strong': 'rgba(24, 24, 27, 0.08)',

      // Backgrounds
      '--bg':       '#FFFFFF',
      '--bg-card':  '#FAFAFA',
      '--bg-input': '#F4F4F5',

      // Text
      '--text':        '#18181B',
      '--text-dim':    '#71717A',
      '--text-bright': '#09090B',
      '--text-muted':  '#A1A1AA',

      // Accents
      '--warn': '#D97706',
      '--err':  '#DC2626',
      '--cyan': '#0284C7',

      // Borders
      '--border':       '#18181B',
      '--border-dim':   '#E4E4E7',
      '--border-glow':  'rgba(24, 24, 27, 0.1)',

      // Radius
      '--radius': '16px',

      // Font
      '--font': "'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

      // Category colours (monochrome + accent)
      '--cat-1': '#18181B',
      '--cat-2': '#3F3F46',
      '--cat-3': '#52525B',
      '--cat-4': '#71717A',
      '--cat-5': '#0284C7',
      '--cat-6': '#0D9488',
      '--cat-7': '#D97706',
      '--cat-8': '#DC2626',

      // Scanline opacity (disabled)
      '--scanline-opacity': '0',
    },

    // ══════════════════════════════════════════════════════════════
    // RETRO AMBER — Amber phosphor on dark brown, CRT feel
    // ══════════════════════════════════════════════════════════════
    'retro-amber': {
      // Palette
      '--green-bright': '#FFB000',
      '--green':         '#CC8800',
      '--green-dim':     '#996600',
      '--green-dark':    '#332200',
      '--green-glow':    'rgba(255, 176, 0, 0.12)',
      '--green-glow-strong': 'rgba(255, 176, 0, 0.25)',

      // Backgrounds
      '--bg':       '#1A1209',
      '--bg-card':  '#221A0F',
      '--bg-input': '#2A2015',

      // Text
      '--text':        '#FFB000',
      '--text-dim':    '#996600',
      '--text-bright': '#FFC940',
      '--text-muted':  '#664400',

      // Accents
      '--warn': '#FF6600',
      '--err':  '#FF4444',
      '--cyan': '#FF8800',

      // Borders
      '--border':       '#FFB000',
      '--border-dim':   '#332200',
      '--border-glow':  'rgba(255, 176, 0, 0.4)',

      // Radius
      '--radius': '2px',

      // Font
      '--font': "'VT323', 'Courier New', 'Consolas', monospace",

      // Category colours (amber/warm palette)
      '--cat-1': '#FFB000',
      '--cat-2': '#CC8800',
      '--cat-3': '#FF8800',
      '--cat-4': '#FF6600',
      '--cat-5': '#FFC940',
      '--cat-6': '#E69900',
      '--cat-7': '#FF7700',
      '--cat-8': '#CC5500',

      // Scanline opacity (stronger CRT feel)
      '--scanline-opacity': '0.15',
    },
    // ══════════════════════════════════════════════════════════════
    // SMART HOME — Dark dashboard, soft green accent, rounded cards
    // Inspired by modern smart home control panels
    // ══════════════════════════════════════════════════════════════
    'smart-home': {
      // Palette — soft green on dark
      '--green-bright': '#34D399',
      '--green':         '#10B981',
      '--green-dim':     '#059669',
      '--green-dark':    '#064E3B',
      '--green-glow':    'rgba(52, 211, 153, 0.10)',
      '--green-glow-strong': 'rgba(52, 211, 153, 0.20)',

      // Backgrounds — dark charcoal with warm undertone
      '--bg':       '#111827',
      '--bg-card':  '#1F2937',
      '--bg-input': '#374151',

      // Text — high contrast white/gray
      '--text':        '#F9FAFB',
      '--text-dim':    '#9CA3AF',
      '--text-bright': '#FFFFFF',
      '--text-muted':  '#6B7280',

      // Accents
      '--warn': '#FBBF24',
      '--err':  '#F87171',
      '--cyan': '#38BDF8',

      // Borders — subtle, low contrast
      '--border':       '#34D399',
      '--border-dim':   '#374151',
      '--border-glow':  'rgba(52, 211, 153, 0.3)',

      // Radius — large rounded corners (card-like)
      '--radius': '16px',

      // Font — clean sans-serif
      '--font': "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

      // Category colours — varied, distinct hues
      '--cat-1': '#34D399',
      '--cat-2': '#38BDF8',
      '--cat-3': '#A78BFA',
      '--cat-4': '#F472B6',
      '--cat-5': '#FBBF24',
      '--cat-6': '#FB923C',
      '--cat-7': '#38BDF8',
      '--cat-8': '#4ADE80',

      // Scanline opacity (disabled)
      '--scanline-opacity': '0',
    },

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
