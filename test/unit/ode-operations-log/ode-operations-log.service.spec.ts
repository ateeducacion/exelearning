import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeOperationsLogService } from '../../../src/modules/ode-operations-log/ode-operations-log.service';
import { OdeOperationsLog } from '../../../src/entities/ode-operations-log.entity';

describe('OdeOperationsLogService', () => {
  let service: OdeOperationsLogService;
  let repository: Repository<OdeOperationsLog>;

  // Mock repository
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
        OdeOperationsLogService,
        {
          provide: getRepositoryToken(OdeOperationsLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OdeOperationsLogService>(OdeOperationsLogService);
    repository = module.get<Repository<OdeOperationsLog>>(
      getRepositoryToken(OdeOperationsLog),
    );

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new operation log', async () => {
      const logData = {
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'ADD_IDEVICE',
        idSource: 'block-123',
        idDestination: 'idevice-456',
        user: 'user@example.com',
        doneFlag: 0,
      };

      const mockCreated = logData as OdeOperationsLog;
      const mockSaved = { id: 1, ...logData, isActive: true } as OdeOperationsLog;

      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockSaved);

      const result = await service.create(logData);

      expect(result).toEqual(mockSaved);
      expect(mockRepository.create).toHaveBeenCalledWith(logData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCreated);
    });
  });

  describe('insertOperation', () => {
    it('should insert a new operation log with all parameters', async () => {
      const mockLog = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'MOVE_BLOCK_TO',
        idSource: 'block-source',
        idDestination: 'block-dest',
        user: 'user@example.com',
        additionalData: '{"blockId":"block-123"}',
        doneFlag: 0,
        doneDatetime: null,
        isActive: true,
      } as OdeOperationsLog;

      mockRepository.create.mockReturnValue(mockLog);
      mockRepository.save.mockResolvedValue(mockLog);

      const result = await service.insertOperation(
        'ode-123',
        'version-456',
        'session-789',
        'MOVE_BLOCK_TO',
        'block-source',
        'block-dest',
        'user@example.com',
        '{"blockId":"block-123"}',
      );

      expect(result).toEqual(mockLog);
      expect(mockRepository.create).toHaveBeenCalledWith({
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'MOVE_BLOCK_TO',
        idSource: 'block-source',
        idDestination: 'block-dest',
        user: 'user@example.com',
        additionalData: '{"blockId":"block-123"}',
        doneFlag: 0,
        doneDatetime: null,
      });
    });
  });

  describe('findAllByOdeId', () => {
    it('should return all active logs for an ODE', async () => {
      const odeId = 'ode-123';
      const mockLogs = [
        {
          id: 1,
          odeId,
          odeVersionId: 'version-456',
          odeSessionId: 'session-789',
          operation: 'ADD_PAGE',
          idSource: 'page-1',
          user: 'user@example.com',
          doneFlag: 0,
          isActive: true,
        },
        {
          id: 2,
          odeId,
          odeVersionId: 'version-789',
          odeSessionId: 'session-abc',
          operation: 'CLONE_BLOCK',
          idSource: 'block-1',
          user: 'admin@example.com',
          doneFlag: 1,
          isActive: true,
        },
      ] as OdeOperationsLog[];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findAllByOdeId(odeId);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findAllByOdeVersionId', () => {
    it('should return all active logs for an ODE version', async () => {
      const odeVersionId = 'version-456';
      const mockLogs = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId,
          odeSessionId: 'session-789',
          operation: 'MOVE_PAGE',
          idSource: 'page-1',
          user: 'user@example.com',
          doneFlag: 0,
          isActive: true,
        },
      ] as OdeOperationsLog[];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findAllByOdeVersionId(odeVersionId);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeVersionId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findAllByOdeSessionId', () => {
    it('should return all active logs for a session', async () => {
      const odeSessionId = 'session-789';
      const mockLogs = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeSessionId,
          operation: 'ADD_IDEVICE',
          idSource: 'block-1',
          idDestination: 'idevice-1',
          user: 'user@example.com',
          doneFlag: 0,
          isActive: true,
        },
      ] as OdeOperationsLog[];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findAllByOdeSessionId(odeSessionId);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findAllBySessionAndUser', () => {
    it('should return all active logs for a session and user', async () => {
      const odeSessionId = 'session-789';
      const user = 'user@example.com';
      const mockLogs = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeSessionId,
          operation: 'CLONE_PAGE',
          idSource: 'page-1',
          user,
          doneFlag: 0,
          isActive: true,
        },
      ] as OdeOperationsLog[];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findAllBySessionAndUser(odeSessionId, user);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId, user, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('should return a log by ID', async () => {
      const mockLog = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'ADD_PAGE',
        idSource: 'page-1',
        user: 'user@example.com',
        doneFlag: 0,
        isActive: true,
      } as OdeOperationsLog;

      mockRepository.findOne.mockResolvedValue(mockLog);

      const result = await service.findById(1);

      expect(result).toEqual(mockLog);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
      });
    });

    it('should return null if log not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('getLastOperationLog', () => {
    it('should return the most recent operation log', async () => {
      const mockLog = {
        id: 5,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'MOVE_BLOCK_ON',
        idSource: 'block-1',
        user: 'user@example.com',
        doneFlag: 0,
        isActive: true,
      } as OdeOperationsLog;

      mockRepository.findOne.mockResolvedValue(mockLog);

      const result = await service.getLastOperationLog();

      expect(result).toEqual(mockLog);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return null if no logs exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getLastOperationLog();

      expect(result).toBeNull();
    });
  });

  describe('getLastOperationLogBySession', () => {
    it('should return the most recent log for a session', async () => {
      const odeSessionId = 'session-789';
      const mockLog = {
        id: 3,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId,
        operation: 'DELETE',
        idSource: 'element-1',
        user: 'user@example.com',
        doneFlag: 1,
        isActive: true,
      } as OdeOperationsLog;

      mockRepository.findOne.mockResolvedValue(mockLog);

      const result = await service.getLastOperationLogBySession(odeSessionId);

      expect(result).toEqual(mockLog);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { odeSessionId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getLastOperationLogBySessionAndUser', () => {
    it('should return the most recent log for a session and user', async () => {
      const odeSessionId = 'session-789';
      const user = 'user@example.com';
      const mockLog = {
        id: 2,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId,
        operation: 'MOVE_IDEVICE_TO',
        idSource: 'idevice-1',
        idDestination: 'block-2',
        user,
        doneFlag: 0,
        isActive: true,
      } as OdeOperationsLog;

      mockRepository.findOne.mockResolvedValue(mockLog);

      const result = await service.getLastOperationLogBySessionAndUser(
        odeSessionId,
        user,
      );

      expect(result).toEqual(mockLog);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { odeSessionId, user, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findPendingOperations', () => {
    it('should return all pending operations', async () => {
      const mockLogs = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeSessionId: 'session-789',
          operation: 'ADD_PAGE',
          idSource: 'page-1',
          user: 'user@example.com',
          doneFlag: 0,
          isActive: true,
        },
        {
          id: 2,
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeSessionId: 'session-abc',
          operation: 'CLONE_BLOCK',
          idSource: 'block-1',
          user: 'admin@example.com',
          doneFlag: 0,
          isActive: true,
        },
      ] as OdeOperationsLog[];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findPendingOperations();

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { doneFlag: 0, isActive: true },
        order: { createdAt: 'ASC' },
      });
    });

    it('should return pending operations for a specific session', async () => {
      const odeSessionId = 'session-789';
      const mockLogs = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeSessionId,
          operation: 'MOVE_PAGE',
          idSource: 'page-1',
          user: 'user@example.com',
          doneFlag: 0,
          isActive: true,
        },
      ] as OdeOperationsLog[];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findPendingOperations(odeSessionId);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId, doneFlag: 0, isActive: true },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('markAsDone', () => {
    it('should mark an operation as done', async () => {
      const mockLog = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'ADD_IDEVICE',
        idSource: 'block-1',
        user: 'user@example.com',
        doneFlag: 0,
        doneDatetime: null,
        isActive: true,
      } as OdeOperationsLog;

      mockRepository.findOne.mockResolvedValue(mockLog);
      mockRepository.save.mockImplementation((log) => Promise.resolve(log));

      const result = await service.markAsDone(1);

      expect(result?.doneFlag).toBe(1);
      expect(result?.doneDatetime).toBeInstanceOf(Date);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return null if log not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.markAsDone(999);

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update an operation log', async () => {
      const existing = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'ADD_PAGE',
        idSource: 'page-1',
        user: 'user@example.com',
        doneFlag: 0,
        additionalData: null,
        isActive: true,
      } as OdeOperationsLog;

      const updated = {
        ...existing,
        additionalData: '{"pageId":"page-123"}',
      };

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.update(1, {
        additionalData: '{"pageId":"page-123"}',
      });

      expect(result?.additionalData).toBe('{"pageId":"page-123"}');
    });

    it('should return null if log not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.update(999, { doneFlag: 1 });

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete an operation log', async () => {
      const log = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        odeSessionId: 'session-789',
        operation: 'DELETE',
        idSource: 'element-1',
        user: 'user@example.com',
        doneFlag: 1,
        isActive: true,
      } as OdeOperationsLog;

      mockRepository.findOne.mockResolvedValue(log);
      mockRepository.save.mockResolvedValue({ ...log, isActive: false });

      const result = await service.delete(1);

      expect(result).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should return false if log not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.delete(999);

      expect(result).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllBySession', () => {
    it('should soft delete all logs for a session', async () => {
      const odeSessionId = 'session-789';
      const mockLogs = [
        { id: 1, odeSessionId, isActive: true } as OdeOperationsLog,
        { id: 2, odeSessionId, isActive: true } as OdeOperationsLog,
      ];

      mockRepository.find.mockResolvedValue(mockLogs);
      mockRepository.save.mockResolvedValue({} as OdeOperationsLog);

      const result = await service.deleteAllBySession(odeSessionId);

      expect(result).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCountBySession', () => {
    it('should return count of operations for a session', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getCountBySession('session-789');

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-789', isActive: true },
      });
    });
  });

  describe('getPendingCountBySession', () => {
    it('should return count of pending operations for a session', async () => {
      mockRepository.count.mockResolvedValue(3);

      const result = await service.getPendingCountBySession('session-789');

      expect(result).toBe(3);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-789', doneFlag: 0, isActive: true },
      });
    });
  });
});
