import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentOdeUsersService } from '../../../src/modules/current-ode-users/current-ode-users.service';
import { CurrentOdeUsers } from '../../../src/entities/current-ode-users.entity';

describe('CurrentOdeUsersService', () => {
  let service: CurrentOdeUsersService;
  let repository: Repository<CurrentOdeUsers>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrentOdeUsersService,
        {
          provide: getRepositoryToken(CurrentOdeUsers),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CurrentOdeUsersService>(CurrentOdeUsersService);
    repository = module.get<Repository<CurrentOdeUsers>>(
      getRepositoryToken(CurrentOdeUsers),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new current user session', async () => {
      const userData = {
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        user: 'user@example.com',
        lastAction: new Date(),
        lastSync: new Date(),
        syncSaveFlag: false,
        syncNavStructureFlag: false,
        syncPagStructureFlag: false,
        syncComponentsFlag: false,
        syncUpdateFlag: false,
        nodeIp: '192.168.1.1',
      };

      const mockCreated = userData as CurrentOdeUsers;
      const mockSaved = { id: 1, ...userData, isActive: true } as CurrentOdeUsers;

      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockSaved);

      const result = await service.create(userData);

      expect(result).toEqual(mockSaved);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCreated);
    });
  });

  describe('findByCurrentComponentId', () => {
    it('should find user by current component ID', async () => {
      const mockUser = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        user: 'user@example.com',
        currentComponentId: 'component-abc',
        lastAction: new Date(),
        lastSync: new Date(),
        isActive: true,
      } as CurrentOdeUsers;

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByCurrentComponentId('component-abc');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { currentComponentId: 'component-abc', isActive: true },
      });
    });
  });

  describe('getCurrentUsers', () => {
    it('should get all current users without filters', async () => {
      const mockUsers = [
        { id: 1, odeId: 'ode-123', user: 'user1@example.com', isActive: true },
        { id: 2, odeId: 'ode-456', user: 'user2@example.com', isActive: true },
      ] as CurrentOdeUsers[];

      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.getCurrentUsers();

      expect(result).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { lastAction: 'DESC' },
      });
    });

    it('should get current users filtered by odeId', async () => {
      const mockUsers = [
        { id: 1, odeId: 'ode-123', user: 'user1@example.com', isActive: true },
      ] as CurrentOdeUsers[];

      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.getCurrentUsers('ode-123');

      expect(result).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeId: 'ode-123', isActive: true },
        order: { lastAction: 'DESC' },
      });
    });

    it('should get current users filtered by session and version', async () => {
      const mockUsers = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeSessionId: 'session-789',
          user: 'user1@example.com',
          isActive: true,
        },
      ] as CurrentOdeUsers[];

      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.getCurrentUsers('ode-123', 'version-456', 'session-789');

      expect(result).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeSessionId: 'session-789',
          isActive: true,
        },
        order: { lastAction: 'DESC' },
      });
    });
  });

  describe('getCurrentSessionForUser', () => {
    it('should get the most recent session for a user', async () => {
      const mockUser = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        user: 'user@example.com',
        lastAction: new Date('2024-01-15T10:30:00Z'),
        isActive: true,
      } as CurrentOdeUsers;

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getCurrentSessionForUser('user@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { user: 'user@example.com', isActive: true },
        order: { lastAction: 'DESC' },
      });
    });

    it('should return null if user has no active session', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getCurrentSessionForUser('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findBySessionAndUser', () => {
    it('should find user in a specific session', async () => {
      const mockUser = {
        id: 1,
        odeSessionId: 'session-789',
        user: 'user@example.com',
        isActive: true,
      } as CurrentOdeUsers;

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findBySessionAndUser('session-789', 'user@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-789', user: 'user@example.com', isActive: true },
      });
    });
  });

  describe('updateLastAction', () => {
    it('should update last action timestamp', async () => {
      const oldTimestamp = new Date('2024-01-15T10:00:00Z');
      const mockUser = {
        id: 1,
        odeSessionId: 'session-789',
        user: 'user@example.com',
        lastAction: oldTimestamp,
        isActive: true,
      } as CurrentOdeUsers;

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.updateLastAction(1);

      expect(result?.lastAction).toBeInstanceOf(Date);
      expect(result?.lastAction.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime(),
      );
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.updateLastAction(999);

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateSyncFlags', () => {
    it('should update multiple sync flags', async () => {
      const mockUser = {
        id: 1,
        syncSaveFlag: false,
        syncNavStructureFlag: false,
        syncPagStructureFlag: false,
        syncComponentsFlag: false,
        syncUpdateFlag: false,
        isActive: true,
      } as CurrentOdeUsers;

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.updateSyncFlags(1, {
        syncSaveFlag: true,
        syncComponentsFlag: true,
      });

      expect(result?.syncSaveFlag).toBe(true);
      expect(result?.syncComponentsFlag).toBe(true);
      expect(result?.syncNavStructureFlag).toBe(false);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('removeByOdeSessionIdAndUser', () => {
    it('should soft delete users by session and user', async () => {
      const mockUsers = [
        { id: 1, odeSessionId: 'session-789', user: 'user@example.com', isActive: true },
        { id: 2, odeSessionId: 'session-789', user: 'user@example.com', isActive: true },
      ] as CurrentOdeUsers[];

      mockRepository.find.mockResolvedValue(mockUsers);
      mockRepository.save.mockResolvedValue({} as CurrentOdeUsers);

      const result = await service.removeByOdeSessionIdAndUser('session-789', 'user@example.com');

      expect(result).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should return 0 if no users found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.removeByOdeSessionIdAndUser('session-789', 'user@example.com');

      expect(result).toBe(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeAllBySessionId', () => {
    it('should soft delete all users in a session', async () => {
      const mockUsers = [
        { id: 1, odeSessionId: 'session-789', user: 'user1@example.com', isActive: true },
        { id: 2, odeSessionId: 'session-789', user: 'user2@example.com', isActive: true },
      ] as CurrentOdeUsers[];

      mockRepository.find.mockResolvedValue(mockUsers);
      mockRepository.save.mockResolvedValue({} as CurrentOdeUsers);

      const result = await service.removeAllBySessionId('session-789');

      expect(result).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCountBySessionId', () => {
    it('should return count of users in a session', async () => {
      mockRepository.count.mockResolvedValue(3);

      const result = await service.getCountBySessionId('session-789');

      expect(result).toBe(3);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-789', isActive: true },
      });
    });
  });

  describe('getCountByOdeId', () => {
    it('should return count of users for an ODE', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getCountByOdeId('ode-123');

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { odeId: 'ode-123', isActive: true },
      });
    });
  });
});
