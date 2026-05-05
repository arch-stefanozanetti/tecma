import type {
  Asset,
  AuditEvent,
  InviteToken,
  Project,
  RoleDefinition,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceUserProject,
} from '@followup/shared-types';
import { ObjectId, type Collection, type Db, type Filter, type UpdateFilter } from 'mongodb';

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

/**
 * Repository per `tz_workspace_user_projects`.
 * Tiene traccia delle assegnazioni progetto per utente all'interno di un workspace.
 */
export class WorkspaceUserProjectsRepository extends MongoRepository<
  WorkspaceUserProject & { _id: DomainId }
> {
  constructor(db: Db) {
    super(db.collection<WorkspaceUserProject & { _id: DomainId }>('tz_workspace_user_projects'));
  }

  async listForUser(
    workspaceId: string,
    userId: string,
  ): Promise<Array<WorkspaceUserProject & { _id: DomainId }>> {
    return this.collectionRef
      .find({
        workspaceId,
        userId,
        status: { $ne: 'revoked' },
      } as unknown as Filter<WorkspaceUserProject & { _id: DomainId }>)
      .toArray() as Promise<Array<WorkspaceUserProject & { _id: DomainId }>>;
  }

  async revoke(workspaceId: string, userId: string, projectId: string): Promise<void> {
    await this.updateOne(
      { workspaceId, userId, projectId } as unknown as Filter<
        WorkspaceUserProject & { _id: DomainId }
      >,
      {
        $set: {
          status: 'revoked',
          updatedAt: new Date().toISOString(),
        },
      } as unknown as UpdateFilter<WorkspaceUserProject & { _id: DomainId }>,
    );
  }
}

/**
 * Repository per `tz_assets`.
 * Asset workspace/progetto (branding logo, email header, attachments).
 * Supporta inline base64 fallback (dev/test) e signed URL upload (prod).
 */
export class AssetsRepository extends MongoRepository<Asset & { _id: DomainId }> {
  constructor(db: Db) {
    super(db.collection<Asset & { _id: DomainId }>('tz_assets'));
  }

  async listForWorkspace(workspaceId: string): Promise<Array<Asset & { _id: DomainId }>> {
    return this.collectionRef
      .find({
        workspaceId,
        status: { $ne: 'deleted' },
      } as unknown as Filter<Asset & { _id: DomainId }>)
      .sort({ createdAt: -1 })
      .toArray() as Promise<Array<Asset & { _id: DomainId }>>;
  }

  async softDelete(workspaceId: string, assetId: string): Promise<boolean> {
    const idCandidate: DomainId = ObjectId.isValid(assetId)
      ? (new ObjectId(assetId) as unknown as DomainId)
      : (assetId as unknown as DomainId);
    const result = await this.updateOne(
      { _id: idCandidate, workspaceId } as unknown as Filter<Asset & { _id: DomainId }>,
      {
        $set: {
          status: 'deleted',
          deletedAt: new Date().toISOString(),
        },
      } as unknown as UpdateFilter<Asset & { _id: DomainId }>,
    );
    if (result.matchedCount > 0) return true;
    if (idCandidate instanceof ObjectId) {
      // Retry with raw string id (in case the document was stored with string _id).
      const fallback = await this.updateOne(
        { _id: assetId as unknown as DomainId, workspaceId } as unknown as Filter<
          Asset & { _id: DomainId }
        >,
        {
          $set: {
            status: 'deleted',
            deletedAt: new Date().toISOString(),
          },
        } as unknown as UpdateFilter<Asset & { _id: DomainId }>,
      );
      return fallback.matchedCount > 0;
    }
    return false;
  }
}

/**
 * Repository per `tz_roleDefinitions`.
 * Override DB dei permessi per ruolo (chiave -> lista permessi).
 */
export class RoleDefinitionsRepository extends MongoRepository<RoleDefinition & { _id: DomainId }> {
  constructor(db: Db) {
    super(db.collection<RoleDefinition & { _id: DomainId }>('tz_roleDefinitions'));
  }

  /**
   * Restituisce una mappa `{ [roleKey]: permissions[] }` con tutte le definizioni note in DB.
   * Le chiavi sono normalizzate a lower-case trim per convenzione (idempotente con shared-rbac).
   */
  async loadDefinitions(): Promise<Record<string, readonly string[]>> {
    const docs = (await this.collectionRef.find({}).toArray()) as Array<
      RoleDefinition & { _id: DomainId }
    >;
    const map: Record<string, readonly string[]> = {};
    for (const doc of docs) {
      const key = doc.roleKey?.trim().toLowerCase();
      if (!key) continue;
      map[key] = doc.permissions ?? [];
    }
    return map;
  }
}
