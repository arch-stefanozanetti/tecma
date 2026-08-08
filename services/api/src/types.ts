import type { Db } from 'mongodb';

import type { FastifyReply } from 'fastify';

import type { AppConfig } from '@followup/shared-config';
import type { Permission } from '@followup/shared-rbac';
import type { WorkspaceRole } from '@followup/shared-types';

import type { ProjectAccessCapability } from './lib/projectAccess.js';
import type { AuditService } from './modules/auditService.js';
import type { MailPort } from './modules/mail/createMailPort.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Ambiente della richiesta, letto dall'header `x-app-env`. */
    appEnv: 'demo' | 'prod';
    /** Database dell'ambiente della richiesta (demo o prod). */
    envDb: Db;
  }

  interface FastifyInstance {
    config: AppConfig;
    mongoDb: Db;
    auditService: AuditService;
    mail: MailPort;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      permission: Permission,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAnyPermission: (
      permissions: readonly Permission[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireSystemRole: (
      role: 'tecma_admin',
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireWorkspaceRole: (
      roles: readonly WorkspaceRole[],
      opts?: { allowTecmaAdmin?: boolean },
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTecmaAdmin: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireCanAccessWorkspace: () => (request: any, reply: any) => Promise<void>;
    requireWorkspaceAdminOrOwner: () => (request: any, reply: any) => Promise<void>;
    requireCanAccessProject: (
      capability?: ProjectAccessCapability,
    ) => (request: any, reply: any) => Promise<void>;
    requireProjectRole: (
      capability?: ProjectAccessCapability,
    ) => (request: any, reply: any) => Promise<void>;
  }
}
