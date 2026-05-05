import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PermissionOverrideMatrix,
  permissionOverrideDraftDirty,
  type PermissionGroup,
} from './PermissionOverrideMatrix';

const groups: PermissionGroup[] = [
  {
    module: 'users',
    label: 'Utenti',
    permissions: [
      {
        id: 'users.read',
        module: 'users',
        action: 'read',
        actionLabel: 'Lettura',
        label: 'Utenti — Lettura',
      },
      {
        id: 'users.invite',
        module: 'users',
        action: 'invite',
        actionLabel: 'Invito',
        label: 'Utenti — Invito',
      },
    ],
  },
  {
    module: 'projects',
    label: 'Progetti',
    permissions: [
      {
        id: 'projects.read',
        module: 'projects',
        action: 'read',
        actionLabel: 'Lettura',
        label: 'Progetti — Lettura',
      },
    ],
  },
];

describe('PermissionOverrideMatrix', () => {
  it('renderizza un gruppo per modulo con label localizzata', () => {
    render(
      <PermissionOverrideMatrix groups={groups} selectedIds={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Utenti')).toBeInTheDocument();
    expect(screen.getByText('Progetti')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('disabilita i permessi gia base e li mostra come ·base', () => {
    render(
      <PermissionOverrideMatrix
        groups={groups}
        selectedIds={[]}
        basePermissions={['users.read']}
        onChange={vi.fn()}
      />,
    );
    const usersRead = screen.getByTestId('permission-checkbox-users.read') as HTMLInputElement;
    expect(usersRead.disabled).toBe(true);
    expect(usersRead.checked).toBe(true);
    expect(screen.getByText('·base')).toBeInTheDocument();
  });

  it('aggiunge un permesso override on toggle', () => {
    const onChange = vi.fn();
    render(
      <PermissionOverrideMatrix groups={groups} selectedIds={[]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId('permission-checkbox-users.invite'));
    expect(onChange).toHaveBeenCalledWith(['users.invite']);
  });

  it('rimuove un permesso override quando deselezionato', () => {
    const onChange = vi.fn();
    render(
      <PermissionOverrideMatrix
        groups={groups}
        selectedIds={['users.invite', 'projects.read']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('permission-checkbox-users.invite'));
    expect(onChange).toHaveBeenCalledWith(['projects.read']);
  });

  it('mostra il marker +override solo per permessi non base', () => {
    render(
      <PermissionOverrideMatrix
        groups={groups}
        selectedIds={['users.invite']}
        basePermissions={['users.read']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('+override')).toBeInTheDocument();
  });

  it('disabled=true congela tutti i checkbox', () => {
    const onChange = vi.fn();
    render(
      <PermissionOverrideMatrix
        groups={groups}
        selectedIds={[]}
        onChange={onChange}
        disabled
      />,
    );
    fireEvent.click(screen.getByTestId('permission-checkbox-users.invite'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('messaggio di fallback quando il catalogo e vuoto', () => {
    render(<PermissionOverrideMatrix groups={[]} selectedIds={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Catalogo permessi vuoto.')).toBeInTheDocument();
  });
});

describe('permissionOverrideDraftDirty', () => {
  it('false per liste vuote/null', () => {
    expect(permissionOverrideDraftDirty(null, null)).toBe(false);
    expect(permissionOverrideDraftDirty([], [])).toBe(false);
    expect(permissionOverrideDraftDirty(undefined, [])).toBe(false);
  });

  it('false per stesse permission ignorando ordine', () => {
    expect(permissionOverrideDraftDirty(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('true per dimensione diversa', () => {
    expect(permissionOverrideDraftDirty(['a'], ['a', 'b'])).toBe(true);
  });

  it('true per permission diverso anche se stessa size', () => {
    expect(permissionOverrideDraftDirty(['a'], ['b'])).toBe(true);
  });
});
