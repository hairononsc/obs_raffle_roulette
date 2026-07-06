export interface SpinHistoryItem {
  spinId: string;
  entryId: string;
  buyerName: string;
  prizeId: string;
  prizeName: string;
  startedAt: number;
  completedAt: number;
}

export interface HistoryPage {
  items: SpinHistoryItem[];
  total: number;
}

export interface PrizeStat {
  prizeId: string;
  prizeName: string;
  count: number;
}

export interface SpinStats {
  totalSpins: number;
  totalBuyers: number;
  prizeCounts: PrizeStat[];
}
