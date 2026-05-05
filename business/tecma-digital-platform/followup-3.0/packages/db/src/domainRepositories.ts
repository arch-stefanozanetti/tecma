import type {
  AuditEvent,
  InviteToken,
  Project,
  User,
  Workspace,
  WorkspaceMember,
} from '@followup/shared-types';
import type { Collection, Db, Filter, ObjectId, UpdateFilter } from 'mongodb';

import { MongoRepository } from './repository.js';

type DomainId = string | ObjectId | unknown;

type SoftDeletable = {
  _id: DomainId;
  status?: string;
  deletedAt?: string;
  deactivatedAt?: string;
};

const activeFilter = <T extends SoftDeletable>(filter: Filter<T>): Filter<T> =>
  ({
    ...filter,
    status: { $nin: ['deleted', 'deactivated'] },
    deletedAt: { $exists: false },
  }) as Filter<T>;

export class SoftDeleteRepository<T extends SoftDeletable> extends MongoRepository<T> {
  constructor(collection: Collection<T>) {
    super(collection);
  }

  async findActive(filter: Filter<T>): Promise<T | null> {
    return this.findOne(activeFilter(filter)) as Promise<T | null>;
  }

  async deactivate(filter: Filter<T>): Promise<void> {
    await this.updateOne(filter, {
      $set: { status: 'deactivated', deactivatedAt: new Date().toISOString() },
    } as unknown as UpdateFilter<T>);
  }

  async reactivate(filter: Filter<T>): Promise<void> {
    await this.updateOne(filter, {
      $set: { status: 'active' },
      $unset: { deactivatedAt: '' },
    } as unknown as UpdateFilter<T>);
  }

  async softDelete(filter: Filter<T>): Promise<void> {
    await this.updateOne(filter, {
      $set: { status: 'deleted', deletedAt: new Date().toISOString() },
    } as unknown as UpdateFilter<T>);
  }
}

export class UsersRepository extends SoftDeleteRepository<User & SoftDeletable> {
  constructor(db: Db) {
    super(db.collection<User & SoftDeletable>('tz_users'));
  }
}

export class WorkspacesRepository extends SoftDeleteRepository<Workspace & SoftDeletable> {
  constructor(db: Db) {
    super(db.collection<Workspace & SoftDeletable>('tz_workspaces'));
  }
}

export class ProjectsRepository extends SoftDeleteRepository<Project & SoftDeletable> {
  constructor(db: Db) {
    super(db.collection<Project & SoftDeletable>('tz_projects'));
  }
}

export class WorkspaceMembersRepository extends SoftDeleteRepository<
  WorkspaceMember & SoftDeletable
> {
  constructor(db: Db) {
    super(db.collection<WorkspaceMember & SoftDeletable>('tz_user_workspaces'));
  }
}

export class InviteTokensRepository extends SoftDeleteRepository<InviteToken & SoftDeletable> {
  constructor(db: Db) {
    super(db.collection<InviteToken & SoftDeletable>('tz_inviteTokens'));
  }
}

export class AuditEventsRepository extends MongoRepository<AuditEvent & { _id: DomainId }> {
  constructor(db: Db) {
    super(db.collection<AuditEvent & { _id: DomainId }>('tz_authEvents'));
  }

  async findLatest(
    filter: Filter<AuditEvent & { _id: DomainId }>,
    limit = 100,
  ): Promise<AuditEvent[]> {
    return this.collectionRef
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray() as Promise<AuditEvent[]>;
  }
}
