import { describe, expect, it, vi } from 'vitest';

import { parseApartmentsQueryInput, queryApartments } from './queryApartments.js';

describe('queryApartments', () => {
  it('parses minimal list query body', () => {
    const parsed = parseApartmentsQueryInput({
      workspaceId: 'ws-1',
      projectIds: ['p1'],
      page: 2,
      perPage: 10,
    });
    expect(parsed.page).toBe(2);
    expect(parsed.perPage).toBe(10);
  });

  it('returns paginated rows without assignment filter for admin viewer', async () => {
    const rows = [
      {
        _id: 'apt-1',
        workspaceId: 'ws-1',
        projectId: 'p1',
        code: 'A-01',
        name: 'Unit 1',
        status: 'AVAILABLE',
        mode: 'SELL',
      },
    ];
    const find = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    });
    const countDocuments = vi.fn().mockResolvedValue(1);

    const result = await queryApartments(
      {
        collection: { find, countDocuments, aggregate: vi.fn() },
        applyEntityAssignmentFilter: false,
      },
      { workspaceId: 'ws-1', projectIds: ['p1'], page: 1, perPage: 25 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.code).toBe('A-01');
    expect(result.paginationInfo.totalDocs).toBe(1);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        projectId: { $in: ['p1'] },
      }),
    );
  });

  it('applies searchText filter on name and code', async () => {
    const find = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    const countDocuments = vi.fn().mockResolvedValue(0);

    await queryApartments(
      {
        collection: { find, countDocuments, aggregate: vi.fn() },
        applyEntityAssignmentFilter: false,
      },
      {
        workspaceId: 'ws-1',
        projectIds: ['p1'],
        searchText: 'aurora',
      },
    );

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ $regex: 'aurora' }) }),
              expect.objectContaining({ code: expect.objectContaining({ $regex: 'aurora' }) }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('filters apartments without floor plan when hasPlanimetry is false', async () => {
    const find = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    const countDocuments = vi.fn().mockResolvedValue(0);

    await queryApartments(
      {
        collection: { find, countDocuments, aggregate: vi.fn() },
        applyEntityAssignmentFilter: false,
      },
      {
        workspaceId: 'ws-1',
        projectIds: ['p1'],
        filters: { hasPlanimetry: false },
      },
    );

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $and: expect.arrayContaining([
              expect.objectContaining({
                $or: [{ planimetryAssetId: { $exists: false } }, { planimetryAssetId: '' }],
              }),
              expect.objectContaining({
                $or: [{ planimetryUrl: { $exists: false } }, { planimetryUrl: '' }],
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});
