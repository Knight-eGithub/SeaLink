export const Colors = {
  // SeaLink Clean Maritime Sea-Green Palette
  primary: '#167D6A',       // SeaLink Teal / Sea Green
  primaryDark: '#0E5C4E',   // Deep Forest Sea Green
  primaryLight: '#B5E8DC',  // Soft Mint Border / Selection
  primaryBubble: '#D5F5E9', // User Message Bubble Mint
  accent: '#E5A34B',        // Nautical Amber / Warning
  online: '#42B883',        // Emerald Active Dot
  danger: '#DC2626',        // Alert Red

  background: '#F7F9FA',    // Clean Light Neutral Canvas
  surface: '#FFFFFF',       // Card / Header Surface
  surfaceMuted: '#F2F5F6',  // Composer Input / Secondary Surface
  border: '#E8ECEF',        // Card / Divider Border
  borderLight: '#E7ECEF',

  text: '#17252D',          // Primary Dark Slate
  textBody: '#203039',      // Message Body Text
  textSecondary: '#667780', // Subtle Gray Text
  textMuted: '#778790',     // Secondary Muted
  textPlaceholder: '#82919B',
  textFootnote: '#95A1A7',

  noticeBackground: '#EAF1EF', // Notice / Status Pill Background
  noticeText: '#536A64',

  // Delivery State Colors
  delivery: {
    queued_local: '#7D8C93',
    accepted_by_gateway: '#168A71',
    transmitted_to_next_hop: '#E5A34B',
    delivered_to_destination_gateway: '#347F78',
    delivered_to_recipient: '#168A71',
    failed: '#DC2626',
    expired: '#94A3B8',
  },

  // Contact Avatar Palettes
  contacts: [
    { id: 'BOAT-104', color: '#347F78' },
    { id: 'BOAT-207', color: '#5679A6' },
    { id: 'BOAT-315', color: '#8C6CA8' },
    { id: 'BOAT-421', color: '#A77A48' },
    { id: 'BOAT-BRAVO', color: '#347F78' },
    { id: 'BOAT-CHARLIE', color: '#5679A6' },
    { id: 'BOAT-DELTA', color: '#8C6CA8' },
  ],
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;
