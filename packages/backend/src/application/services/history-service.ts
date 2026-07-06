import type { HistoryPage, SpinStats } from '../../domain/history.js';
import type { UnitOfWork } from '../ports/repositories.js';

export class HistoryService {
  constructor(private readonly uow: UnitOfWork) {}

  async page(limit: number, offset: number): Promise<HistoryPage> {
    return this.uow.run((repos) => repos.spins.history(limit, offset));
  }

  async stats(): Promise<SpinStats> {
    return this.uow.run((repos) => repos.spins.stats());
  }
}
