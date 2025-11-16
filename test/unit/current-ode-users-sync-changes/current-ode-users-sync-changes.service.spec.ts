import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentOdeUsersSyncChangesService } from '../../../src/modules/current-ode-users-sync-changes/current-ode-users-sync-changes.service';
import { CurrentOdeUsersSyncChanges } from '../../../src/entities/current-ode-users-sync-changes.entity';

describe('CurrentOdeUsersSyncChangesService', () => {
  let service: CurrentOdeUsersSyncChangesService;
  let repository: Repository<CurrentOdeUsersSyncChanges>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrentOdeUsersSyncChangesService,
        {
          provide: getRepositoryToken(CurrentOdeUsersSyncChanges),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CurrentOdeUsersSyncChangesService>(
      CurrentOdeUsersSyncChangesService,
    );
    repository = module.get<Repository<CurrentOdeUsersSyncChanges>>(
      getRepositoryToken(CurrentOdeUsersSyncChanges),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new sync change', async () => {
      const syncChangeData = {
        odePageIdUpdate: 'page-123',
        odeComponentIdUpdate: 'component-456',
        actionTypeUpdate: 'MOVE_COMPONENT',
        destinationPageIdUpdate: 'page-789',
        userUpdate: 'user@example.com',
      };

      const mockCreated = syncChangeData as CurrentOdeUsersSyncChanges;
      const mockSaved = {
        id: 1,
        ...syncChangeData,
        isActive: true,
      } as CurrentOdeUsersSyncChanges;

      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockSaved);

      const result = await service.create(syncChangeData);

      expect(result).toEqual(mockSaved);
      expect(mockRepository.create).toHaveBeenCalledWith(syncChangeData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCreated);
    });
  });

  describe('findAll', () => {
    it('should return all sync changes ordered by creation time', async () => {
      const mockSyncChanges = [
        {
          id: 1,
          odePageIdUpdate: 'page-1',
          actionTypeUpdate: 'UPDATE_PAGE',
          userUpdate: 'user1@example.com',
          isActive: true,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 2,
          odePageIdUpdate: 'page-2',
          actionTypeUpdate: 'UPDATE_PAGE',
          userUpdate: 'user2@example.com',
          isActive: true,
          createdAt: new Date('2024-01-15T10:05:00Z'),
        },
      ] as CurrentOdeUsersSyncChanges[];

      mockRepository.find.mockResolvedValue(mockSyncChanges);

      const result = await service.findAll();

      expect(result).toEqual(mockSyncChanges);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findById', () => {
    it('should find sync change by ID', async () => {
      const mockSyncChange = {
        id: 1,
        odePageIdUpdate: 'page-123',
        actionTypeUpdate: 'UPDATE_PAGE',
        userUpdate: 'user@example.com',
        isActive: true,
      } as CurrentOdeUsersSyncChanges;

      mockRepository.findOne.mockResolvedValue(mockSyncChange);

      const result = await service.findById(1);

      expect(result).toEqual(mockSyncChange);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
      });
    });

    it('should return null if sync change not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('getSyncChangesListByUser', () => {
    it('should get sync changes by user ordered by creation time', async () => {
      const mockSyncChanges = [
        {
          id: 1,
          odePageIdUpdate: 'page-1',
          actionTypeUpdate: 'UPDATE_PAGE',
          userUpdate: 'user@example.com',
          isActive: true,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 2,
          odeComponentIdUpdate: 'component-2',
          actionTypeUpdate: 'ADD_COMPONENT',
          userUpdate: 'user@example.com',
          isActive: true,
          createdAt: new Date('2024-01-15T10:05:00Z'),
        },
      ] as CurrentOdeUsersSyncChanges[];

      mockRepository.find.mockResolvedValue(mockSyncChanges);

      const result =
        await service.getSyncChangesListByUser('user@example.com');

      expect(result).toEqual(mockSyncChanges);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userUpdate: 'user@example.com', isActive: true },
        order: { createdAt: 'ASC' },
      });
    });

    it('should return empty array if user has no sync changes', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getSyncChangesListByUser(
        'nonexistent@example.com',
      );

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update sync change', async () => {
      const mockSyncChange = {
        id: 1,
        odePageIdUpdate: 'page-123',
        actionTypeUpdate: 'UPDATE_PAGE',
        userUpdate: 'user@example.com',
        isActive: true,
      } as CurrentOdeUsersSyncChanges;

      const updateData = {
        actionTypeUpdate: 'DELETE_PAGE',
      };

      mockRepository.findOne.mockResolvedValue(mockSyncChange);
      mockRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.update(1, updateData);

      expect(result?.actionTypeUpdate).toBe('DELETE_PAGE');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return null if sync change not found for update', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.update(999, { actionTypeUpdate: 'UPDATE' });

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete sync change', async () => {
      const mockSyncChange = {
        id: 1,
        odePageIdUpdate: 'page-123',
        actionTypeUpdate: 'UPDATE_PAGE',
        userUpdate: 'user@example.com',
        isActive: true,
      } as CurrentOdeUsersSyncChanges;

      mockRepository.findOne.mockResolvedValue(mockSyncChange);
      mockRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.delete(1);

      expect(result).toBe(true);
      expect(mockSyncChange.isActive).toBe(false);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return false if sync change not found for delete', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.delete(999);

      expect(result).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeCurrentOdeUsersSyncChangesByUser', () => {
    it('should hard delete all sync changes for a user', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 3 });

      const result = await service.removeCurrentOdeUsersSyncChangesByUser(
        'user@example.com',
      );

      expect(result).toBe(3);
      expect(mockRepository.delete).toHaveBeenCalledWith({
        userUpdate: 'user@example.com',
      });
    });

    it('should return 0 if no sync changes deleted', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.removeCurrentOdeUsersSyncChangesByUser(
        'nonexistent@example.com',
      );

      expect(result).toBe(0);
    });

    it('should handle undefined affected count', async () => {
      mockRepository.delete.mockResolvedValue({ affected: undefined });

      const result = await service.removeCurrentOdeUsersSyncChangesByUser(
        'user@example.com',
      );

      expect(result).toBe(0);
    });
  });

  describe('softDeleteByUser', () => {
    it('should soft delete all sync changes for a user', async () => {
      const mockSyncChanges = [
        {
          id: 1,
          userUpdate: 'user@example.com',
          isActive: true,
        },
        {
          id: 2,
          userUpdate: 'user@example.com',
          isActive: true,
        },
      ] as CurrentOdeUsersSyncChanges[];

      mockRepository.find.mockResolvedValue(mockSyncChanges);
      mockRepository.save.mockResolvedValue({} as CurrentOdeUsersSyncChanges);

      const result = await service.softDeleteByUser('user@example.com');

      expect(result).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(mockSyncChanges[0].isActive).toBe(false);
      expect(mockSyncChanges[1].isActive).toBe(false);
    });

    it('should return 0 if user has no sync changes', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.softDeleteByUser('nonexistent@example.com');

      expect(result).toBe(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getCountByUser', () => {
    it('should return count of sync changes for a user', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getCountByUser('user@example.com');

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { userUpdate: 'user@example.com', isActive: true },
      });
    });

    it('should return 0 if user has no sync changes', async () => {
      mockRepository.count.mockResolvedValue(0);

      const result = await service.getCountByUser('nonexistent@example.com');

      expect(result).toBe(0);
    });
  });
});
