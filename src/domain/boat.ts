/**
 * Boat Directory Domain Model
 */

export type BoatLinkType = 'direct' | 'mesh' | 'unreachable';

export interface Boat {
  id: string;               // e.g. "BOAT-104" or "SHORE-BASE"
  name: string;             // Vessel or station name, e.g. "Coastal Command Shore"
  callSign: string;         // Marine Call Sign, e.g. "SHORE-01"
  color: string;            // Visual theme color for avatar
  lastSeen: number;         // Unix timestamp (ms)
  rssi?: number;            // Received Signal Strength Indicator (dBm)
  snr?: number;             // Signal to Noise Ratio (dB)
  hopCount: number;         // 1 = Direct Radio, 2+ = Multi-hop Mesh
  nextHopBoatId?: string;   // Gateway used to route to this boat
  linkType: BoatLinkType;
  isGatewayBoat?: boolean;  // True if this is the user's local vessel gateway
  isShoreStation?: boolean; // True if this node is on the coast and bridges to Cloud DB
  isBroadcast?: boolean;    // True if broadcast channel like SOS-ALL
}

export const INITIAL_KNOWN_BOATS: Boat[] = [
  {
    id: 'ONBOARD-CREW',
    name: 'Onboard Crew',
    callSign: 'LOCAL-WIFI',
    color: '#0F766E',
    lastSeen: Date.now(),
    hopCount: 0,
    linkType: 'direct',
    isGatewayBoat: true,
  },
  {
    id: 'SHORE-BASE',
    name: 'Coastal Guard Shore Station',
    callSign: 'COAST-GUARD',
    color: '#0284C7',
    lastSeen: Date.now() - 1000 * 30,
    rssi: -62,
    snr: 10.2,
    hopCount: 1,
    linkType: 'direct',
    isShoreStation: true,
  },
  {
    id: 'BOAT-001',
    name: 'SeaLink Alpha (Boat 1)',
    callSign: 'SL-01',
    color: '#0D9488',
    lastSeen: Date.now(),
    hopCount: 1,
    linkType: 'direct',
  },
  {
    id: 'BOAT-104',
    name: 'SeaLink Bravo (Boat 2)',
    callSign: 'SL-104',
    color: '#347F78',
    lastSeen: Date.now(),
    hopCount: 1,
    linkType: 'direct',
  },
  {
    id: 'BOAT-207',
    name: 'Sea Falcon',
    callSign: 'SF-207',
    color: '#5679A6',
    lastSeen: Date.now() - 1000 * 60 * 7,
    rssi: -75,
    snr: 7.8,
    hopCount: 1,
    linkType: 'direct',
  },
  {
    id: 'BOAT-315',
    name: 'Blue Horizon',
    callSign: 'BH-315',
    color: '#8C6CA8',
    lastSeen: Date.now() - 1000 * 60 * 18,
    rssi: -92,
    snr: 4.1,
    hopCount: 2,
    nextHopBoatId: 'BOAT-104',
    linkType: 'mesh',
  },
  {
    id: 'BOAT-421',
    name: 'Coastal Hope',
    callSign: 'CH-421',
    color: '#A77A48',
    lastSeen: Date.now() - 1000 * 60 * 35,
    hopCount: 3,
    nextHopBoatId: 'BOAT-207',
    linkType: 'mesh',
  },
];
