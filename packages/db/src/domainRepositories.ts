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

import { assertWritableDatabase } from './assertWritableDatabase.js';
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
    status: { $nin: ['deleted', 'deactivated', 'suspended'] },
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

  async findPaginated(
    filter: Filter<AuditEvent & { _id: DomainId }>,
    options: {
      skip: number;
      limit: number;
      sort: Record<string, 1 | -1>;
    },
  ): Promise<{ data: AuditEvent[]; totalDocs: number }> {
    const [totalDocs, data] = await Promise.all([
      this.collectionRef.countDocuments(filter),
      this.collectionRef
        .find(filter)
        .sort(options.sort)
        .skip(options.skip)
        .limit(options.limit)
        .toArray() as Promise<AuditEvent[]>,
    ]);

    return { data, totalDocs };
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

  async countForWorkspace(workspaceId: string): Promise<number> {
    return this.collectionRef.countDocuments({
      workspaceId,
      status: { $ne: 'deleted' },
    } as unknown as Filter<Asset & { _id: DomainId }>);
  }

  async listForWorkspace(
    workspaceId: string,
    options: {
      skip?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    } = {},
  ): Promise<Array<Asset & { _id: DomainId }>> {
    return this.collectionRef
      .find({
        workspaceId,
        status: { $ne: 'deleted' },
      } as unknown as Filter<Asset & { _id: DomainId }>)
      .sort(options.sort ?? { createdAt: -1 })
      .skip(options.skip ?? 0)
      .limit(options.limit ?? 0)
      .toArray() as Promise<Array<Asset & { _id: DomainId }>>;
  }

  async findForWorkspaceAsset(
    workspaceId: string,
    assetId: string,
  ): Promise<(Asset & { _id: DomainId }) | null> {
    const idCandidate: DomainId = ObjectId.isValid(assetId)
      ? (new ObjectId(assetId) as unknown as DomainId)
      : (assetId as unknown as DomainId);
    const filter = {
      _id: idCandidate,
      workspaceId,
    } as unknown as Filter<Asset & { _id: DomainId }>;
    const asset = await this.collectionRef.findOne(filter);
    if (asset != null) return asset;
    if (idCandidate instanceof ObjectId) {
      return this.collectionRef.findOne({
        _id: assetId as unknown as DomainId,
        workspaceId,
      } as unknown as Filter<Asset & { _id: DomainId }>);
    }
    return null;
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

/** Documento bundle i18n globale: un documento per coppia `locale` + `namespace`. */
export type I18nGlobalBundleDoc = {
  locale: string;
  namespace: string;
  messages: Record<string, unknown>;
  version?: number;
  updatedAt: string;
};

/** Override i18n per workspace: stessa forma del globale + `workspaceId`. */
export type I18nWorkspaceBundleDoc = I18nGlobalBundleDoc & {
  workspaceId: string;
};

export class I18nGlobalBundlesRepository extends MongoRepository<
  I18nGlobalBundleDoc & { _id: DomainId }
> {
  constructor(db: Db) {
    super(db.collection<I18nGlobalBundleDoc & { _id: DomainId }>('tz_i18n_global_bundles'));
  }

  async findNamespace(locale: string, namespace: string): Promise<I18nGlobalBundleDoc | null> {
    const doc = await this.collectionRef.findOne({
      locale,
      namespace,
    } as Filter<I18nGlobalBundleDoc & { _id: DomainId }>);
    return doc as I18nGlobalBundleDoc | null;
  }

  /**
   * Upsert bundle globale per `(locale, namespace)`. `version` è il nuovo valore da persistere.
   */
  async upsertNamespace(
    locale: string,
    namespace: string,
    messages: Record<string, unknown>,
    version: number,
  ): Promise<void> {
    assertWritableDatabase(this.collectionRef, 'updateOne');
    const now = new Date().toISOString();
    await this.collectionRef.updateOne(
      { locale, namespace } as Filter<I18nGlobalBundleDoc & { _id: DomainId }>,
      {
        $set: { messages, updatedAt: now, version },
        $setOnInsert: { locale, namespace },
      } as UpdateFilter<I18nGlobalBundleDoc & { _id: DomainId }>,
      { upsert: true },
    );
  }

  async deleteNamespace(locale: string, namespace: string): Promise<number> {
    const result = await this.deleteOne({
      locale,
      namespace,
    } as Filter<I18nGlobalBundleDoc & { _id: DomainId }>);
    return result.deletedCount;
  }
}

export class I18nWorkspaceBundlesRepository extends MongoRepository<
  I18nWorkspaceBundleDoc & { _id: DomainId }
> {
  constructor(db: Db) {
    super(db.collection<I18nWorkspaceBundleDoc & { _id: DomainId }>('tz_i18n_workspace_bundles'));
  }

  async findNamespace(
    workspaceId: string,
    locale: string,
    namespace: string,
  ): Promise<I18nWorkspaceBundleDoc | null> {
    const doc = await this.collectionRef.findOne({
      workspaceId,
      locale,
      namespace,
    } as Filter<I18nWorkspaceBundleDoc & { _id: DomainId }>);
    return doc as I18nWorkspaceBundleDoc | null;
  }

  async upsertNamespace(
    workspaceId: string,
    locale: string,
    namespace: string,
    messages: Record<string, unknown>,
    version: number,
  ): Promise<void> {
    assertWritableDatabase(this.collectionRef, 'updateOne');
    const now = new Date().toISOString();
    await this.collectionRef.updateOne(
      {
        workspaceId,
        locale,
        namespace,
      } as Filter<I18nWorkspaceBundleDoc & { _id: DomainId }>,
      {
        $set: { messages, updatedAt: now, version },
        $setOnInsert: { workspaceId, locale, namespace },
      } as UpdateFilter<I18nWorkspaceBundleDoc & { _id: DomainId }>,
      { upsert: true },
    );
  }

  async deleteNamespace(workspaceId: string, locale: string, namespace: string): Promise<number> {
    const result = await this.deleteOne({
      workspaceId,
      locale,
      namespace,
    } as Filter<I18nWorkspaceBundleDoc & { _id: DomainId }>);
    return result.deletedCount;
  }
}
