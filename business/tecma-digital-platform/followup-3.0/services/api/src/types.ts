import type { Db } from 'mongodb';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AppConfig } from '@followup/shared-config';
import type { Permission } from '@followup/shared-rbac';

import type { AuditService } from './modules/auditService.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    mongoDb: Db;
    auditService: AuditService;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      permission: Permission,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAnyPermission: (
      permissions: readonly Permission[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTecmaAdmin: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireCanAccessWorkspace: () => (request: any, reply: any) => Promise<void>;
    requireWorkspaceAdminOrOwner: () => (request: any, reply: any) => Promise<void>;
    requireCanAccessProject: () => (request: any, reply: any) => Promise<void>;
  }
}
