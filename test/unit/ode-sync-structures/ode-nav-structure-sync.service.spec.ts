import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeNavStructureSyncService } from '../../../src/modules/ode-sync-structures/services/ode-nav-structure-sync.service';
import { OdeNavStructureSync } from '../../../src/entities/ode-nav-structure-sync.entity';
import { OdeNavStructureSyncProperties } from '../../../src/entities/ode-nav-structure-sync-properties.entity';

describe('OdeNavStructureSyncService', () => {
  let service: OdeNavStructureSyncService;
  let navRepository: Repository<OdeNavStructureSync>;
  let propertiesRepository: Repository<OdeNavStructureSyncProperties>;

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
    propertiesRepository = module.get<Repository<OdeNavStructureSyncProperties>>(
      getRepositoryToken(OdeNavStructureSyncProperties),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new navigation structure with properties', async () => {
      const dto = {
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        odeParentPageId: null,
        pageName: 'Main Page',
        odeNavStructureOrder: 0,
        properties: [
          { key: 'isVisible', value: 'true', description: 'Page visibility' },
        ],
      };

      const mockProperty = { key: 'isVisible', value: 'true', description: 'Page visibility' };
      const mockNavStructure = {
        id: 1,
        odeSessionId: dto.odeSessionId,
        odePageId: dto.odePageId,
        odeParentPageId: dto.odeParentPageId,
        pageName: dto.pageName,
        odeNavStructureOrder: dto.odeNavStructureOrder,
        odeNavStructureSyncProperties: [mockProperty],
        isActive: true,
      } as OdeNavStructureSync;

      mockPropertiesRepository.create.mockReturnValue(mockProperty);
      mockNavRepository.create.mockReturnValue(mockNavStructure);
      mockNavRepository.save.mockResolvedValue(mockNavStructure);

      const result = await service.create(dto);

      expect(result).toEqual(mockNavStructure);
      expect(mockNavRepository.create).toHaveBeenCalled();
      expect(mockNavRepository.save).toHaveBeenCalledWith(mockNavStructure);
    });

    it('should create navigation structure without properties', async () => {
      const dto = {
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        odeParentPageId: null,
        pageName: 'Main Page',
        odeNavStructureOrder: 0,
      };

      const mockNavStructure = {
        id: 1,
        ...dto,
        odeNavStructureSyncProperties: [],
        isActive: true,
      } as OdeNavStructureSync;

      mockNavRepository.create.mockReturnValue(mockNavStructure);
      mockNavRepository.save.mockResolvedValue(mockNavStructure);

      const result = await service.create(dto);

      expect(result).toEqual(mockNavStructure);
      expect(mockPropertiesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('createBulk', () => {
    it('should create multiple navigation structures', async () => {
      const dtos = [
        {
          odeSessionId: 'session-123',
          odePageId: 'page-1',
          odeParentPageId: null,
          pageName: 'Page 1',
          odeNavStructureOrder: 0,
          properties: [],
        },
        {
          odeSessionId: 'session-123',
          odePageId: 'page-2',
          odeParentPageId: 'page-1',
          pageName: 'Page 2',
          odeNavStructureOrder: 1,
          properties: [],
        },
      ];

      const mockStructures = dtos.map((dto, index) => ({
        id: index + 1,
        ...dto,
        odeNavStructureSyncProperties: [],
        isActive: true,
      })) as OdeNavStructureSync[];

      mockNavRepository.create.mockImplementation((data) => data);
      mockNavRepository.save.mockResolvedValue(mockStructures);

      const result = await service.createBulk(dtos);

      expect(result).toEqual(mockStructures);
      expect(mockNavRepository.create).toHaveBeenCalledTimes(2);
      expect(mockNavRepository.save).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('findBySessionId', () => {
    it('should find all navigation structures for a session', async () => {
      const mockStructures = [
        {
          id: 1,
          odeSessionId: 'session-123',
          odePageId: 'page-1',
          odeParentPageId: null,
          pageName: 'Page 1',
          odeNavStructureOrder: 0,
          isActive: true,
        },
        {
          id: 2,
          odeSessionId: 'session-123',
          odePageId: 'page-2',
          odeParentPageId: 'page-1',
          pageName: 'Page 2',
          odeNavStructureOrder: 1,
          isActive: true,
        },
      ] as OdeNavStructureSync[];

      mockNavRepository.find.mockResolvedValue(mockStructures);

      const result = await service.findBySessionId('session-123');

      expect(result).toEqual(mockStructures);
      expect(mockNavRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', isActive: true },
        relations: ['odeNavStructureSyncProperties'],
        order: { odeNavStructureOrder: 'ASC' },
      });
    });
  });

  describe('findByPageId', () => {
    it('should find navigation structure by page ID', async () => {
      const mockStructure = {
        id: 1,
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        odeParentPageId: null,
        pageName: 'Main Page',
        odeNavStructureOrder: 0,
        isActive: true,
      } as OdeNavStructureSync;

      mockNavRepository.findOne.mockResolvedValue(mockStructure);

      const result = await service.findByPageId('session-123', 'page-456');

      expect(result).toEqual(mockStructure);
      expect(mockNavRepository.findOne).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odePageId: 'page-456', isActive: true },
        relations: ['odeNavStructureSyncProperties'],
      });
    });

    it('should return null if page not found', async () => {
      mockNavRepository.findOne.mockResolvedValue(null);

      const result = await service.findByPageId('session-123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('buildTree', () => {
    it('should build hierarchical tree from flat navigation structures', async () => {
      const mockStructures = [
        {
          id: 1,
          odeSessionId: 'session-123',
          odePageId: 'page-1',
          odeParentPageId: null,
          pageName: 'Root Page',
          odeNavStructureOrder: 0,
          isActive: true,
        },
        {
          id: 2,
          odeSessionId: 'session-123',
          odePageId: 'page-2',
          odeParentPageId: 'page-1',
          pageName: 'Child Page',
          odeNavStructureOrder: 1,
          isActive: true,
        },
      ] as OdeNavStructureSync[];

      mockNavRepository.find.mockResolvedValue(mockStructures);

      const result = await service.buildTree('session-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe(2);
    });

    it('should handle multiple root nodes', async () => {
      const mockStructures = [
        {
          id: 1,
          odeSessionId: 'session-123',
          odePageId: 'page-1',
          odeParentPageId: null,
          pageName: 'Root 1',
          odeNavStructureOrder: 0,
          isActive: true,
        },
        {
          id: 2,
          odeSessionId: 'session-123',
          odePageId: 'page-2',
          odeParentPageId: null,
          pageName: 'Root 2',
          odeNavStructureOrder: 1,
          isActive: true,
        },
      ] as OdeNavStructureSync[];

      mockNavRepository.find.mockResolvedValue(mockStructures);

      const result = await service.buildTree('session-123');

      expect(result).toHaveLength(2);
      expect(result[0].children).toHaveLength(0);
      expect(result[1].children).toHaveLength(0);
    });
  });

  describe('updatePageName', () => {
    it('should update page name', async () => {
      const mockStructure = {
        id: 1,
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        pageName: 'Old Name',
        isActive: true,
      } as OdeNavStructureSync;

      const updatedStructure = {
        ...mockStructure,
        pageName: 'New Name',
      };

      mockNavRepository.findOne.mockResolvedValue(mockStructure);
      mockNavRepository.save.mockResolvedValue(updatedStructure);

      const result = await service.updatePageName(1, 'New Name');

      expect(result.pageName).toBe('New Name');
      expect(mockNavRepository.save).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete navigation structure', async () => {
      mockNavRepository.find.mockResolvedValue([]);

      await service.softDelete(1);

      expect(mockNavRepository.find).toHaveBeenCalledWith({
        where: { odeParentPageId: expect.any(String) },
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
      };

      mockNavRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockPropertiesRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockNavIds = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];
      mockQueryBuilder.select = jest.fn().mockReturnThis();
      mockQueryBuilder.getRawMany = jest.fn().mockResolvedValue(mockNavIds);

      await service.markAsClean('session-123', baselineDate);

      expect(mockNavRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        createdAt: baselineDate,
        updatedAt: baselineDate,
      });
    });
  });
});
