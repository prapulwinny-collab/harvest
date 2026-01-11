
export interface HarvestEntry {
  id: string;
  tank: string;
  count: number; // pcs/kg
  weight: number; // gross kg
  crateWeight: number; // weight of a single crate
  crateCount: number; // Number of physical crates (usually 1 or 2)
  team: string;
  timestamp: string;
  synced: boolean;
  farmName: string;
  sessionName: string;
}

export interface HarvestSettings {
  activeTank: string;
  shrimpCount: number;
  tankCounts: Record<string, number>; 
  tankPrices: Record<string, string>; 
  crateWeight: number;
  teamName: string;
  farmName: string;
  sessionName: string;
  googleSheetUrl?: string; 
}

export interface TankSummary {
  tank: string;
  entryCount: number; 
  patluCount: number; 
  singlesCount: number; 
  crateCount: number; 
  totalWeight: number; // Gross
  absoluteWeight: number; // Net
  shrimpCount: number; 
}

export enum View {
  ENTRY = 'entry',
  CONTROL = 'control',
  ABSTRACT = 'abstract',
  LOG = 'log',
  SYNC = 'sync',
  HISTORY = 'history',
  REVENUE = 'revenue'
}

export const formatPatluDisplay = (patlu: number, singles: number): string => {
  if (patlu > 0 && singles > 0) return `${patlu} patlu + ${singles} singles`;
  if (patlu > 0) return `${patlu} patlu`;
  if (singles > 0) return `${singles} singles`;
  return '0 collections';
};

export const formatPatluShort = (patlu: number, singles: number): string => {
  return `${patlu}P + ${singles}S`;
};

export const AVAILABLE_COLORS = [
  'blue', 'purple', 'rose', 'amber', 'emerald', 'indigo', 
  'orange', 'cyan', 'fuchsia', 'teal', 'lime', 'violet'
];

export const getTankColorName = (tankName: string): string => {
  const tankNum = parseInt(tankName.replace(/\D/g, '')) || 1;
  return AVAILABLE_COLORS[(tankNum - 1) % AVAILABLE_COLORS.length];
};

export const getTankColor = (tankName: string): string => {
  const color = getTankColorName(tankName);
  return `bg-${color}-600`;
};

export const getTankText = (tankName: string): string => {
  const color = getTankColorName(tankName);
  return `text-${color}-600`;
};

export const getTankBorder = (tankName: string): string => {
  const color = getTankColorName(tankName);
  return `border-${color}-600`;
}
