import type { WheelProfile, WheelProfileInput } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import type { EventBus } from '../ports/event-bus.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { UnitOfWork } from '../ports/repositories.js';

const MAX_PROFILES = 30;

/**
 * CRUD over the reusable wheel profiles. Profiles never mutate live
 * state: entry snapshots already registered keep their baked membership;
 * only weightOverrides are consulted again at spin time.
 */
export class ProfileService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
    private readonly ids: IdGenerator,
  ) {}

  async save(input: WheelProfileInput & { id?: string | undefined }): Promise<void> {
    const profiles = await this.uow.run(async (repos) => {
      const current = await repos.settings.getWheelProfiles();
      let next: WheelProfile[];
      if (input.id === undefined) {
        if (current.length >= MAX_PROFILES) {
          throw new DomainError('INVALID_STATE', 'too many profiles');
        }
        next = [...current, { ...input, id: this.ids.next('profile') }];
      } else {
        const id = input.id;
        if (!current.some((profile) => profile.id === id)) {
          throw new DomainError('PROFILE_NOT_FOUND', `profile "${id}" does not exist`);
        }
        next = current.map((profile) => (profile.id === id ? { ...input, id } : profile));
      }
      await repos.settings.setWheelProfiles(next);
      return next;
    });
    this.events.publish({ kind: 'profiles.changed', profiles });
  }

  async delete(profileId: string): Promise<void> {
    const profiles = await this.uow.run(async (repos) => {
      const current = await repos.settings.getWheelProfiles();
      const next = current.filter((profile) => profile.id !== profileId);
      if (next.length === current.length) {
        throw new DomainError('PROFILE_NOT_FOUND', `profile "${profileId}" does not exist`);
      }
      await repos.settings.setWheelProfiles(next);
      return next;
    });
    this.events.publish({ kind: 'profiles.changed', profiles });
  }

  async list(): Promise<WheelProfile[]> {
    return this.uow.run((repos) => repos.settings.getWheelProfiles());
  }
}
