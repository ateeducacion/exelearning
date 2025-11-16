import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdePagStructureSyncService } from '../../../src/modules/ode-sync-structures/services/ode-pag-structure-sync.service';
import { OdePagStructureSync } from '../../../src/entities/ode-pag-structure-sync.entity';
import { OdePagStructureSyncProperties } from '../../../src/entities/ode-pag-structure-sync-properties.entity';

describe('OdePagStructureSyncService', () => {
  let service: OdePagStructureSyncService;
  let pagRepository: Repository<OdePagStructureSync>;

  const mockPagRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
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
        OdePagStructureSyncService,
        {
          provide: getRepositoryToken(OdePagStructureSync),
          useValue: mockPagRepository,
        },
        {
          provide: getRepositoryToken(OdePagStructureSyncProperties),
          useValue: mockPropertiesRepository,
        },
      ],
    }).compile();

    service = module.get<OdePagStructureSyncService>(OdePagStructureSyncService);
    pagRepository = module.get<Repository<OdePagStructureSync>>(
      getRepositoryToken(OdePagStructureSync),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new page block structure', async () => {
      const dto = {
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        odeBlockId: 'block-789',
        blockName: 'Main Block',
        iconName: 'icon.png',
        odePagStructureSyncOrder: 0,
        odeNavStructureSyncId: 1,
      };

      const mockPagStructure = {
        ...dto,
        id: 1,
      };

      mockPagRepository.create.mockReturnValue(mockPagStructure);
      mockPagRepository.save.mockResolvedValue(mockPagStructure);

      const result = await service.create(dto);

      expect(mockPagRepository.create).toHaveBeenCalled();
      expect(mockPagRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create page block with properties', async () => {
      const dto = {
        odeSessionId: 'session-123',
        odePageId: 'page-456',
        odeBlockId: 'block-789',
        blockName: 'Main Block',
        iconName: null,
        odePagStructureSyncOrder: 0,
        odeNavStructureSyncId: 1,
        properties: [
          { key: 'isHeritable', value: 'true', description: null },
        ],
      };

      const mockProperty = { key: 'isHeritable', value: 'true', description: null };
      const mockPagStructure = {
        ...dto,
        id: 1,
        odePagStructureSyncProperties: [mockProperty],
      };

      mockPropertiesRepository.create.mockReturnValue(mockProperty);
      mockPagRepository.create.mockReturnValue(mockPagStructure);
      mockPagRepository.save.mockResolvedValue(mockPagStructure);

      const result = await service.create(dto);

      expect(mockPagRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('createBulk', () => {
    it('should create multiple page blocks', async () => {
      const dtos = [
        {
          odeSessionId: 'session-123',
          odePageId: 'page-1',
          odeBlockId: 'block-1',
          blockName: 'Block 1',
          iconName: null,
          odePagStructureSyncOrder: 0,
          odeNavStructureSyncId: 1,
          properties: [],
        },
        {
          odeSessionId: 'session-123',
          odePageId: 'page-1',
          odeBlockId: 'block-2',
          blockName: 'Block 2',
          iconName: null,
          odePagStructureSyncOrder: 1,
          odeNavStructureSyncId: 1,
          properties: [],
        },
      ];

      const mockStructures = dtos.map((dto, index) => ({
        ...dto,
        id: index + 1,
      }));

      mockPagRepository.create.mockImplementation((data) => data);
      mockPagRepository.save.mockResolvedValue(mockStructures);

      const result = await service.createBulk(dtos);

      expect(mockPagRepository.create).toHaveBeenCalledTimes(2);
      expect(mockPagRepository.save).toHaveBeenCalled();
    });
  });

  describe('findBySessionId', () => {
    it('should find all page blocks for a session', async () => {
      const mockStructures = [
        { id: 1, odeSessionId: 'session-123', odeBlockId: 'block-1' },
        { id: 2, odeSessionId: 'session-123', odeBlockId: 'block-2' },
      ];

      mockPagRepository.find.mockResolvedValue(mockStructures);

      const result = await service.findBySessionId('session-123');

      expect(result).toEqual(mockStructures);
      expect(mockPagRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', isActive: true },
        relations: ['odePagStructureSyncProperties'],
        order: { odePagStructureSyncOrder: 'ASC' },
      });
    });
  });

  describe('findByPageId', () => {
    it('should find all blocks for a specific page', async () => {
      const mockStructures = [
        { id: 1, odeSessionId: 'session-123', odePageId: 'page-456', odeBlockId: 'block-1' },
        { id: 2, odeSessionId: 'session-123', odePageId: 'page-456', odeBlockId: 'block-2' },
      ];

      mockPagRepository.find.mockResolvedValue(mockStructures);

      const result = await service.findByPageId('session-123', 'page-456');

      expect(result).toEqual(mockStructures);
      expect(mockPagRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odePageId: 'page-456', isActive: true },
        relations: ['odePagStructureSyncProperties'],
        order: { odePagStructureSyncOrder: 'ASC' },
      });
    });
  });

  describe('findByBlockId', () => {
    it('should find page block by block ID', async () => {
      const mockStructure = {
        id: 1,
        odeSessionId: 'session-123',
        odeBlockId: 'block-789',
      };

      mockPagRepository.findOne.mockResolvedValue(mockStructure);

      const result = await service.findByBlockId('session-123', 'block-789');

      expect(result).toEqual(mockStructure);
      expect(mockPagRepository.findOne).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odeBlockId: 'block-789', isActive: true },
        relations: ['odePagStructureSyncProperties'],
      });
    });
  });

  describe('updateName', () => {
    it('should update block name', async () => {
      const mockStructure = {
        id: 1,
        blockName: 'Old Name',
      };

      const updatedStructure = {
        ...mockStructure,
        blockName: 'New Name',
      };

      mockPagRepository.findOneByOrFail.mockResolvedValue(mockStructure);
      mockPagRepository.save.mockResolvedValue(updatedStructure);

      const result = await service.updateName(1, 'New Name');

      expect(result.blockName).toBe('New Name');
      expect(mockPagRepository.save).toHaveBeenCalled();
    });
  });

  describe('deleteBySessionId', () => {
    it('should delete all page blocks for a session', async () => {
      mockPagRepository.delete.mockResolvedValue({ affected: 5 });

      await service.deleteBySessionId('session-123');

      expect(mockPagRepository.delete).toHaveBeenCalledWith({ odeSessionId: 'session-123' });
    });
  });

  describe('countBySessionId', () => {
    it('should count page blocks in a session', async () => {
      mockPagRepository.count.mockResolvedValue(10);

      const result = await service.countBySessionId('session-123');

      expect(result).toBe(10);
      expect(mockPagRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', isActive: true },
      });
    });
  });

  describe('countByPageId', () => {
    it('should count blocks for a specific page', async () => {
      mockPagRepository.count.mockResolvedValue(3);

      const result = await service.countByPageId('session-123', 'page-456');

      expect(result).toBe(3);
      expect(mockPagRepository.count).toHaveBeenCalledWith({
        where: { odeSessionId: 'session-123', odePageId: 'page-456', isActive: true },
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
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      };

      mockPagRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockPropertiesRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.markAsClean('session-123', baselineDate);

      expect(mockPagRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });
  });
});
