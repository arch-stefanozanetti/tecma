import { describe, expect, it } from 'vitest';

import {
  AuditEventSchema,
  AuditOutcomeSchema,
  AuditSeveritySchema,
  EntityStatusSchema,
  InvitationSchema,
  InviteTokenSchema,
  ProjectModeSchema,
  ProjectRoleSchema,
  ProjectSchema,
  RecordStatusSchema,
  RoleDefinitionSchema,
  SystemRoleSchema,
  UserSchema,
  UserStatusSchema,
  WorkspaceMemberSchema,
  WorkspaceRoleSchema,
  WorkspaceSchema,
  WorkspaceUserProjectSchema,
} from './index';

const ISO = '2026-05-04T18:00:00.000Z';
const ID = '64a000000000000000000001';

describe('shared-types domain schemas', () => {
  describe('enums', () => {
    it('UserStatusSchema include lifecycle valori canonici e legacy', () => {
      ['active', 'invited', 'disabled', 'suspended', 'deactivated', 'deleted'].forEach((v) => {
        expect(UserStatusSchema.parse(v)).toBe(v);
      });
      expect(() => UserStatusSchema.parse('pending')).toThrow();
    });

    it('EntityStatusSchema copre lifecycle workspace/project (no invited)', () => {
      ['active', 'archived', 'deleted'].forEach((v) => {
        expect(EntityStatusSchema.parse(v)).toBe(v);
      });
      expect(() => EntityStatusSchema.parse('invited')).toThrow();
    });

    it('SystemRoleSchema include solo tecma_admin e user', () => {
      expect(SystemRoleSchema.parse('tecma_admin')).toBe('tecma_admin');
      expect(SystemRoleSchema.parse('user')).toBe('user');
      expect(() => SystemRoleSchema.parse('admin')).toThrow();
    });

    it('WorkspaceRoleSchema copre i 4 ruoli workspace', () => {
      ['owner', 'admin', 'collaborator', 'viewer'].forEach((v) => {
        expect(WorkspaceRoleSchema.parse(v)).toBe(v);
      });
    });

    it('ProjectRoleSchema copre i 3 ruoli progetto', () => {
      ['project_admin', 'project_member', 'project_viewer'].forEach((v) => {
        expect(ProjectRoleSchema.parse(v)).toBe(v);
      });
    });

    it('ProjectModeSchema copre sale/rent/mixed', () => {
      ['sale', 'rent', 'mixed'].forEach((v) => {
        expect(ProjectModeSchema.parse(v)).toBe(v);
      });
      expect(() => ProjectModeSchema.parse('lease')).toThrow();
    });

    it('AuditOutcomeSchema copre success/failure', () => {
      expect(AuditOutcomeSchema.parse('success')).toBe('success');
      expect(AuditOutcomeSchema.parse('failure')).toBe('failure');
      expect(() => AuditOutcomeSchema.parse('maybe')).toThrow();
    });

    it('AuditSeveritySchema accetta sia info|warn|error che alias legacy', () => {
      ['info', 'warn', 'warning', 'error', 'critical'].forEach((v) => {
        expect(AuditSeveritySchema.parse(v)).toBe(v);
      });
    });

    it('RecordStatusSchema è alias deprecato di UserStatus', () => {
      expect(RecordStatusSchema.parse('invited')).toBe('invited');
    });
  });

  describe('UserSchema', () => {
    const validUser = { _id: ID, email: 'foo@example.com' };

    it('parsa user minimo (status default active)', () => {
      const out = UserSchema.parse(validUser);
      expect(out.email).toBe('foo@example.com');
      expect(out.status).toBe('active');
    });

    it('accetta firstName/lastName e systemRole', () => {
      const out = UserSchema.parse({
        ...validUser,
        firstName: 'Mario',
        lastName: 'Rossi',
        systemRole: 'tecma_admin',
      });
      expect(out.firstName).toBe('Mario');
      expect(out.systemRole).toBe('tecma_admin');
    });

    it('accetta system_role legacy snake_case (retro-compat)', () => {
      const out = UserSchema.parse({ ...validUser, system_role: 'tecma_superadmin' });
      expect(out.system_role).toBe('tecma_superadmin');
    });

    it('rifiuta email malformata', () => {
      expect(() => UserSchema.parse({ ...validUser, email: 'not-an-email' })).toThrow();
    });

    it('rifiuta status sconosciuto', () => {
      expect(() => UserSchema.parse({ ...validUser, status: 'foo' })).toThrow();
    });

    it('richiede email valida', () => {
      // _id è z.union(string, unknown) per retro-compat → accetta anche valori
      // legacy ObjectId; email è invece sempre richiesta e validata.
      expect(() => UserSchema.parse({ _id: ID })).toThrow();
    });
  });

  describe('WorkspaceSchema', () => {
    const validWs = { _id: ID, name: 'Acme Corp' };

    it('parsa workspace minimo (status default active)', () => {
      const out = WorkspaceSchema.parse(validWs);
      expect(out.name).toBe('Acme Corp');
      expect(out.status).toBe('active');
    });

    it('accetta slug valido', () => {
      const out = WorkspaceSchema.parse({ ...validWs, slug: 'acme-corp_01' });
      expect(out.slug).toBe('acme-corp_01');
    });

    it('rifiuta slug con maiuscole o spazi', () => {
      expect(() => WorkspaceSchema.parse({ ...validWs, slug: 'Acme Corp' })).toThrow();
    });

    it('accetta branding/billing/settings', () => {
      const out = WorkspaceSchema.parse({
        ...validWs,
        branding: { primaryColor: '#ff0000' },
        billing: { plan: 'enterprise', billingEmail: 'fin@acme.com' },
        settings: { mfaRequired: true, sessionTimeoutMinutes: 30 },
      });
      expect(out.branding?.primaryColor).toBe('#ff0000');
      expect(out.billing?.plan).toBe('enterprise');
      expect(out.settings?.mfaRequired).toBe(true);
    });

    it('rifiuta status non in EntityStatus (no invited!)', () => {
      expect(() => WorkspaceSchema.parse({ ...validWs, status: 'invited' })).toThrow();
    });
  });

  describe('ProjectSchema', () => {
    const validProj = {
      _id: ID,
      workspaceId: ID,
      code: 'PRJ-01',
      displayName: 'Progetto pilota',
    };

    it('parsa project minimo (status default active)', () => {
      const out = ProjectSchema.parse(validProj);
      expect(out.code).toBe('PRJ-01');
      expect(out.status).toBe('active');
    });

    it('accetta mode e metadata', () => {
      const out = ProjectSchema.parse({
        ...validProj,
        mode: 'rent',
        metadata: { city: 'Milano' },
      });
      expect(out.mode).toBe('rent');
      expect(out.metadata).toEqual({ city: 'Milano' });
    });

    it('rifiuta mode sconosciuto', () => {
      expect(() => ProjectSchema.parse({ ...validProj, mode: 'lease' })).toThrow();
    });

    it('richiede workspaceId/code/displayName', () => {
      expect(() => ProjectSchema.parse({ _id: ID })).toThrow();
    });
  });

  describe('WorkspaceMemberSchema', () => {
    it('parsa membership valida', () => {
      const out = WorkspaceMemberSchema.parse({
        _id: ID,
        workspaceId: ID,
        userId: ID,
        role: 'admin',
      });
      expect(out.role).toBe('admin');
      expect(out.status).toBe('active');
    });

    it('rifiuta role non in workspace enum', () => {
      expect(() =>
        WorkspaceMemberSchema.parse({
          _id: ID,
          workspaceId: ID,
          userId: ID,
          role: 'super',
        }),
      ).toThrow();
    });

    it('accetta status invited (membership creata da invito)', () => {
      const out = WorkspaceMemberSchema.parse({
        _id: ID,
        workspaceId: ID,
        userId: ID,
        role: 'collaborator',
        status: 'invited',
      });
      expect(out.status).toBe('invited');
    });
  });

  describe('InvitationSchema', () => {
    it('parsa invito minimo con projectIds di default', () => {
      const out = InvitationSchema.parse({
        email: 'guest@acme.com',
        workspaceId: ID,
        role: 'collaborator',
      });
      expect(out.projectIds).toEqual([]);
    });

    it('accetta projectIds esplicito', () => {
      const out = InvitationSchema.parse({
        email: 'guest@acme.com',
        workspaceId: ID,
        role: 'admin',
        projectIds: [ID],
      });
      expect(out.projectIds).toEqual([ID]);
    });

    it('rifiuta email malformata e role non workspace', () => {
      expect(() =>
        InvitationSchema.parse({
          email: 'foo',
          workspaceId: ID,
          role: 'admin',
        }),
      ).toThrow();
      expect(() =>
        InvitationSchema.parse({
          email: 'guest@acme.com',
          workspaceId: ID,
          role: 'super',
        }),
      ).toThrow();
    });
  });

  describe('InviteTokenSchema', () => {
    const validToken = {
      _id: ID,
      tokenHash: 'a'.repeat(32),
      userId: ID,
      expiresAt: ISO,
    };

    it('parsa invite token minimo (status default active)', () => {
      const out = InviteTokenSchema.parse(validToken);
      expect(out.status).toBe('active');
      expect(out.tokenHash).toHaveLength(32);
    });

    it('rifiuta tokenHash troppo corto', () => {
      expect(() => InviteTokenSchema.parse({ ...validToken, tokenHash: 'short' })).toThrow();
    });

    it('accetta status used/expired/revoked', () => {
      ['used', 'expired', 'revoked'].forEach((s) => {
        const out = InviteTokenSchema.parse({ ...validToken, status: s });
        expect(out.status).toBe(s);
      });
    });
  });

  describe('UserSchema permissionsOverride', () => {
    const validUser = { _id: ID, email: 'foo@example.com' };

    it('accetta permissionsOverride camelCase come array', () => {
      const out = UserSchema.parse({
        ...validUser,
        permissionsOverride: ['users.read', 'projects.write'],
      });
      expect(out.permissionsOverride).toEqual(['users.read', 'projects.write']);
    });

    it('accetta permissions_override snake_case (legacy)', () => {
      const out = UserSchema.parse({
        ...validUser,
        permissions_override: ['users.read'],
      });
      expect(out.permissions_override).toEqual(['users.read']);
    });

    it('rifiuta override con stringhe vuote', () => {
      expect(() =>
        UserSchema.parse({
          ...validUser,
          permissionsOverride: [''],
        }),
      ).toThrow();
    });
  });

  describe('WorkspaceUserProjectSchema', () => {
    it('parsa assignment minimo con default status active', () => {
      const out = WorkspaceUserProjectSchema.parse({
        _id: ID,
        workspaceId: ID,
        userId: ID,
        projectId: ID,
      });
      expect(out.status).toBe('active');
    });

    it('accetta status revoked', () => {
      const out = WorkspaceUserProjectSchema.parse({
        _id: ID,
        workspaceId: ID,
        userId: ID,
        projectId: ID,
        status: 'revoked',
      });
      expect(out.status).toBe('revoked');
    });

    it('rifiuta status sconosciuto', () => {
      expect(() =>
        WorkspaceUserProjectSchema.parse({
          _id: ID,
          workspaceId: ID,
          userId: ID,
          projectId: ID,
          status: 'pending',
        }),
      ).toThrow();
    });
  });

  describe('RoleDefinitionSchema', () => {
    it('parsa role definition minima', () => {
      const out = RoleDefinitionSchema.parse({
        _id: ID,
        roleKey: 'admin',
        permissions: ['users.read', 'projects.read'],
      });
      expect(out.roleKey).toBe('admin');
      expect(out.permissions).toEqual(['users.read', 'projects.read']);
    });

    it('rifiuta roleKey vuoto', () => {
      expect(() =>
        RoleDefinitionSchema.parse({
          _id: ID,
          roleKey: '',
          permissions: ['users.read'],
        }),
      ).toThrow();
    });

    it('accetta wildcard nei permessi', () => {
      const out = RoleDefinitionSchema.parse({
        _id: ID,
        roleKey: 'tecma_admin',
        permissions: ['*'],
        label: 'Tecma admin',
        description: 'Bypass full',
      });
      expect(out.permissions).toEqual(['*']);
      expect(out.label).toBe('Tecma admin');
    });
  });

  describe('AuditEventSchema', () => {
    const validEvent = {
      _id: ID,
      eventType: 'auth.login_success',
      actorUserId: ID,
      createdAt: ISO,
    };

    it('parsa audit event minimo (severity default info)', () => {
      const out = AuditEventSchema.parse(validEvent);
      expect(out.eventType).toBe('auth.login_success');
      expect(out.severity).toBe('info');
    });

    it('accetta target/network/payload', () => {
      const out = AuditEventSchema.parse({
        ...validEvent,
        targetUserId: ID,
        workspaceId: ID,
        projectId: ID,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        traceId: 'abc',
        details: { reason: 'manual' },
        outcome: 'success',
      });
      expect(out.ip).toBe('127.0.0.1');
      expect(out.details).toEqual({ reason: 'manual' });
      expect(out.outcome).toBe('success');
    });

    it('rifiuta severity non in enum', () => {
      expect(() => AuditEventSchema.parse({ ...validEvent, severity: 'panic' })).toThrow();
    });

    it('richiede actorUserId stringa non vuota', () => {
      expect(() => AuditEventSchema.parse({ ...validEvent, actorUserId: '' })).toThrow();
    });
  });
});
