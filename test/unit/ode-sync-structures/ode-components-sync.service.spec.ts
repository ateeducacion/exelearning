import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeComponentsSyncService } from '../../../src/modules/ode-sync-structures/services/ode-components-sync.service';
import { OdeComponentsSync } from '../../../src/entities/ode-components-sync.entity';
import { OdeComponentsSyncProperties } from '../../../src/entities/ode-components-sync-properties.entity';

describe('OdeComponentsSyncService', () => {
  let service: OdeComponentsSyncService;
  let componentsRepository: Repository<OdeComponentsSync>;

  const mockComponentsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPropertiesRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdeComponentsSyncService,
        {
          provide: getRepositoryToken(OdeComponentsSync),
          useValue: mockComponentsRepository,
        },
        {
          provide: getRepositoryToken(OdeComponentsSyncProperties),
          useValue: mockPropertiesRepository,
        },
      ],
    }).compile();

    service = module.get<OdeComponentsSyncService>(OdeComponentsSyncService);
    componentsRepository = module.get<Repository<OdeComponentsSync>>(
      getRepositoryToken(OdeComponentsSync),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new component', async () => {
      const dto = {
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        odeBlockId: 'block-789',
        odeIdeviceId: 'idevice-abc',
        odeIdeviceTypeName: 'TextIdevice',
        htmlView: '<div>Content</div>',
        jsonProperties: '{"key":"value"}',
        odeComponentsSyncOrder: 0,
        odePagStructureSyncId: 1,
      };

      const mockComponent = {
        ...dto,
        id: 1,
      };

      mockComponentsRepository.create.mockReturnValue(mockComponent);
      mockComponentsRepository.save.mockResolvedValue(mockComponent);

      const result = await service.create(dto);

      expect(mockComponentsRepository.create).toHaveBeenCalled();
      expect(mockComponentsRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findBySessionId', () => {
    it('should find all components for a session', async () => {
      const mockComponents = [
        { id: 1, odeSessionId: 'session-123', odeIdeviceId: 'comp-1' },
        { id: 2, odeSessionId: 'session-123', odeIdeviceId: 'comp-2' },
      ];

      mockComponentsRepository.find.mockResolvedValue(mockComponents);

      const result = await service.findBySessionId('session-123');

      expect(result).toEqual(mockComponents);
      expect(mockComponentsRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', isActive: true },
        relations: ['odeComponentsSyncProperties'],
        order: { odeComponentsSyncOrder: 'ASC' },
      });
    });
  });

  describe('findByPageId', () => {
    it('should find all components for a specific page', async () => {
      const mockComponents = [
        { id: 1, odeSessionId: 'session-123', odePageId: 'page-456' },
        { id: 2, odeSessionId: 'session-123', odePageId: 'page-456' },
      ];

      mockComponentsRepository.find.mockResolvedValue(mockComponents);

      const result = await service.findByPageId('session-123', 'page-456');

      expect(result).toEqual(mockComponents);
      expect(mockComponentsRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odePageId: 'page-456', isActive: true },
        relations: ['odeComponentsSyncProperties'],
        order: { odeComponentsSyncOrder: 'ASC' },
      });
    });
  });

  describe('findByBlockId', () => {
    it('should find all components for a specific block', async () => {
      const mockComponents = [
        { id: 1, odeSessionId: 'session-123', odeBlockId: 'block-789' },
      ];

      mockComponentsRepository.find.mockResolvedValue(mockComponents);

      const result = await service.findByBlockId('session-123', 'block-789');

      expect(result).toEqual(mockComponents);
      expect(mockComponentsRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odeBlockId: 'block-789', isActive: true },
        relations: ['odeComponentsSyncProperties'],
        order: { odeComponentsSyncOrder: 'ASC' },
      });
    });
  });

  describe('findByType', () => {
    it('should find components by iDevice type', async () => {
      const mockComponents = [
        { id: 1, odeSessionId: 'session-123', odeIdeviceTypeName: 'TextIdevice' },
      ];

      mockComponentsRepository.find.mockResolvedValue(mockComponents);

      const result = await service.findByType('session-123', 'TextIdevice');

      expect(result).toEqual(mockComponents);
      expect(mockComponentsRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odeIdeviceTypeName: 'TextIdevice', isActive: true },
        relations: ['odeComponentsSyncProperties'],
        order: { odeComponentsSyncOrder: 'ASC' },
      });
    });
  });

  describe('deleteBySessionId', () => {
    it('should delete all components for a session', async () => {
      mockComponentsRepository.delete.mockResolvedValue({ affected: 10 });

      await service.deleteBySessionId('session-123');

      expect(mockComponentsRepository.delete).toHaveBeenCalledWith({ odeSessionId: 'session-123' });
    });
  });

  describe('deleteByPageId', () => {
    it('should delete all components for a page', async () => {
      mockComponentsRepository.delete.mockResolvedValue({ affected: 5 });

      await service.deleteByPageId('session-123', 'page-456');

      expect(mockComponentsRepository.delete).toHaveBeenCalledWith({
        odeSessionId: 'session-123',
        odePageId: 'page-456'
      });
    });
  });

  describe('deleteByBlockId', () => {
    it('should delete all components for a block', async () => {
      mockComponentsRepository.delete.mockResolvedValue({ affected: 3 });

      await service.deleteByBlockId('session-123', 'block-789');

      expect(mockComponentsRepository.delete).toHaveBeenCalledWith({
        odeSessionId: 'session-123',
        odeBlockId: 'block-789'
      });
    });
  });

  describe('countBySessionId', () => {
    it('should count components in a session', async () => {
      mockComponentsRepository.count.mockResolvedValue(15);

      const result = await service.countBySessionId('session-123');

      expect(result).toBe(15);
      expect(mockComponentsRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', isActive: true },
      });
    });
  });

  describe('countByPageId', () => {
    it('should count components in a specific page', async () => {
      mockComponentsRepository.count.mockResolvedValue(5);

      const result = await service.countByPageId('session-123', 'page-456');

      expect(result).toBe(5);
      expect(mockComponentsRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odePageId: 'page-456', isActive: true },
      });
    });
  });

  describe('countByBlockId', () => {
    it('should count components within a specific block', async () => {
      mockComponentsRepository.count.mockResolvedValue(3);

      const result = await service.countByBlockId('session-123', 'block-789');

      expect(result).toBe(3);
      expect(mockComponentsRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odeBlockId: 'block-789', isActive: true },
      });
    });
  });

  describe('markAsClean', () => {
    it('should mark all components as clean with baseline timestamp', async () => {
      const baselineDate = new Date('2024-01-01T00:00:00Z');
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 10 }),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      };

      mockComponentsRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockPropertiesRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.markAsClean('session-123', baselineDate);

      expect(mockComponentsRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });
  });
});
