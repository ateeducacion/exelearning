import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeNavStructureSyncService } from '../../../src/modules/ode-sync-structures/services/ode-nav-structure-sync.service';
import { OdeNavStructureSync } from '../../../src/entities/ode-nav-structure-sync.entity';
import { OdeNavStructureSyncProperties } from '../../../src/entities/ode-nav-structure-sync-properties.entity';

describe('OdeNavStructureSyncService', () => {
  let service: OdeNavStructureSyncService;
  let navRepository: Repository<OdeNavStructureSync>;

  const mockNavRepository = {
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
        OdeNavStructureSyncService,
        {
          provide: getRepositoryToken(OdeNavStructureSync),
          useValue: mockNavRepository,
        },
        {
          provide: getRepositoryToken(OdeNavStructureSyncProperties),
          useValue: mockPropertiesRepository,
        },
      ],
    }).compile();

    service = module.get<OdeNavStructureSyncService>(OdeNavStructureSyncService);
    navRepository = module.get<Repository<OdeNavStructureSync>>(
      getRepositoryToken(OdeNavStructureSync),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new navigation structure', async () => {
      const dto = {
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        odeParentPageId: null,
        pageName: 'Main Page',
        odeNavStructureSyncOrder: 0,
      };

      const mockNavStructure = {
        ...dto,
        id: 1,
      };

      mockNavRepository.create.mockReturnValue(mockNavStructure);
      mockNavRepository.save.mockResolvedValue(mockNavStructure);

      const result = await service.create(dto);

      expect(mockNavRepository.create).toHaveBeenCalled();
      expect(mockNavRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findBySessionId', () => {
    it('should find all navigation structures for a session', async () => {
      const mockStructures = [
        { id: 1, odeSessionId: 'session-123', odePageId: 'page-1' },
        { id: 2, odeSessionId: 'session-123', odePageId: 'page-2' },
      ];

      mockNavRepository.find.mockResolvedValue(mockStructures);

      const result = await service.findBySessionId('session-123');

      expect(result).toEqual(mockStructures);
      expect(mockNavRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', isActive: true },
        relations: ['odeNavStructureSyncProperties'],
        order: { odeNavStructureSyncOrder: 'ASC' },
      });
    });
  });

  describe('findByPageId', () => {
    it('should find navigation structure by page ID', async () => {
      const mockStructure = {
        id: 1,
        odeSessionId: 'session-123',
        odePageId: 'page-456',
      };

      mockNavRepository.findOne.mockResolvedValue(mockStructure);

      const result = await service.findByPageId('session-123', 'page-456');

      expect(result).toEqual(mockStructure);
      expect(mockNavRepository.findOne).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odePageId: 'page-456', isActive: true },
        relations: ['odeNavStructureSyncProperties'],
      });
    });
  });

  describe('deleteBySessionId', () => {
    it('should delete all navigation structures for a session', async () => {
      mockNavRepository.delete.mockResolvedValue({ affected: 3 });

      await service.deleteBySessionId('session-123');

      expect(mockNavRepository.delete).toHaveBeenCalledWith({ odeSessionId: 'session-123' });
    });
  });

  describe('countBySessionId', () => {
    it('should count navigation structures in a session', async () => {
      mockNavRepository.count.mockResolvedValue(5);

      const result = await service.countBySessionId('session-123');

      expect(result).toBe(5);
      expect(mockNavRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', isActive: true },
      });
    });
  });

  describe('markAsClean', () => {
    it('should mark all structures as clean with baseline timestamp', async () => {
      const baselineDate = new Date('2024-01-01T00:00:00Z');
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      };

      mockNavRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockPropertiesRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.markAsClean('session-123', baselineDate);

      expect(mockNavRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });
  });
});
