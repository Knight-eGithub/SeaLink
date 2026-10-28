/**
 * Crew Identity and Local Boat Configuration
 */

export interface CrewIdentity {
  userId: string;       // Unique crew identifier, e.g. "CREW-01"
  displayName: string;  // Crew name, e.g. "Captain"
  role: string;         // Role, e.g. "Skipper", "First Mate", "Navigator"
  boatId: string;       // Boat identifier shared by crew aboard this vessel, e.g. "BOAT-001"
  boatName: string;     // Vessel name, e.g. "SeaLink Vessel"
  callSign: string;     // Marine VHF/Radio callsign, e.g. "SL-01"
}

export const DEFAULT_IDENTITY: CrewIdentity = {
  userId: 'CREW-01',
  displayName: 'Captain',
  role: 'Skipper',
  boatId: 'BOAT-001',
  boatName: 'SeaLink One',
  callSign: 'SL-01',
};

export function validateIdentity(identity: Partial<CrewIdentity>): { valid: boolean; error?: string } {
  if (!identity.boatId || identity.boatId.trim().length === 0) {
    return { valid: false, error: 'Boat ID is required' };
  }
  if (!identity.userId || identity.userId.trim().length === 0) {
    return { valid: false, error: 'Crew User ID is required' };
  }
  if (!identity.displayName || identity.displayName.trim().length === 0) {
    return { valid: false, error: 'Display Name is required' };
  }
  return { valid: true };
}
