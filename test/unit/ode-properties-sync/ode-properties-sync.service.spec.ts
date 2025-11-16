import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdePropertiesSyncService } from '../../../src/modules/ode-properties-sync/ode-properties-sync.service';
import { OdePropertiesSync } from '../../../src/entities/ode-properties-sync.entity';

describe('OdePropertiesSyncService', () => {
  let service: OdePropertiesSyncService;
  let repository: Repository<OdePropertiesSync>;

  // Mock repository
  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdePropertiesSyncService,
        {
          provide: getRepositoryToken(OdePropertiesSync),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OdePropertiesSyncService>(OdePropertiesSyncService);
    repository = module.get<Repository<OdePropertiesSync>>(
      getRepositoryToken(OdePropertiesSync),
    );

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllBySessionId', () => {
    it('should return all active properties for a session', async () => {
      const sessionId = 'session-123';
      const mockProperties = [
        {
          id: 1,
          odeSessionId: sessionId,
          key: 'odeVersionName',
          value: '1.0.0',
          description: null,
          isActive: true,
        },
        {
          id: 2,
          odeSessionId: sessionId,
          key: 'projectType',
          value: 'SCORM',
          description: null,
          isActive: true,
        },
      ] as OdePropertiesSync[];

      mockRepository.find.mockResolvedValue(mockProperties);

      const result = await service.findAllBySessionId(sessionId);

      expect(result).toEqual(mockProperties);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeSessionId: sessionId, isActive: true },
        order: { key: 'ASC' },
      });
    });

    it('should return empty array if no properties found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAllBySessionId('nonexistent');

      expect(result).toEqual([]);
    });

    it('should order properties by key', async () => {
      const sessionId = 'session-123';
      mockRepository.find.mockResolvedValue([]);

      await service.findAllBySessionId(sessionId);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { key: 'ASC' },
        }),
      );
    });
  });

  describe('findBySessionIdAndKey', () => {
    it('should return a specific property', async () => {
      const sessionId = 'session-123';
      const key = 'odeVersionName';
      const mockProperty = {
        id: 1,
        odeSessionId: sessionId,
        key,
        value: '1.0.0',
        description: null,
        isActive: true,
      } as OdePropertiesSync;

      mockRepository.findOne.mockResolvedValue(mockProperty);

      const result = await service.findBySessionIdAndKey(sessionId, key);

      expect(result).toEqual(mockProperty);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { odeSessionId: sessionId, key, isActive: true },
      });
    });

    it('should return null if property not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findBySessionIdAndKey(
        'session-123',
        'nonexistent',
      );

      expect(result).toBeNull();
    });
  });

  describe('getPropertiesObject', () => {
    it('should return properties as key-value object', async () => {
      const sessionId = 'session-123';
      const mockProperties = [
        {
          id: 1,
          odeSessionId: sessionId,
          key: 'odeVersionName',
          value: '1.0.0',
          description: null,
          isActive: true,
        },
        {
          id: 2,
          odeSessionId: sessionId,
          key: 'projectType',
          value: 'SCORM',
          description: null,
          isActive: true,
        },
        {
          id: 3,
          odeSessionId: sessionId,
          key: 'isPublished',
          value: 'false',
          description: null,
          isActive: true,
        },
      ] as OdePropertiesSync[];

      mockRepository.find.mockResolvedValue(mockProperties);

      const result = await service.getPropertiesObject(sessionId);

      expect(result).toEqual({
        odeVersionName: '1.0.0',
        projectType: 'SCORM',
        isPublished: 'false',
      });
    });

    it('should return empty object if no properties', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getPropertiesObject('session-123');

      expect(result).toEqual({});
    });
  });

  describe('upsertProperty', () => {
    it('should create new property if not exists', async () => {
      const sessionId = 'session-123';
      const key = 'odeVersionName';
      const value = '1.0.0';
      const description = 'ODE Version';

      const mockCreated = {
        odeSessionId: sessionId,
        key,
        value,
        description,
      } as OdePropertiesSync;

      const mockSaved = {
        id: 1,
        ...mockCreated,
        isActive: true,
      } as OdePropertiesSync;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockSaved);

      const result = await service.upsertProperty(
        sessionId,
        key,
        value,
        description,
      );

      expect(result).toEqual(mockSaved);
      expect(mockRepository.create).toHaveBeenCalledWith({
        odeSessionId: sessionId,
        key,
        value,
        description,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockCreated);
    });

    it('should update existing property', async () => {
      const sessionId = 'session-123';
      const key = 'odeVersionName';
      const oldValue = '1.0.0';
      const newValue = '2.0.0';

      const existing = {
        id: 1,
        odeSessionId: sessionId,
        key,
        value: oldValue,
        description: 'Old version',
        isActive: true,
      } as OdePropertiesSync;

      const updated = {
        ...existing,
        value: newValue,
        description: 'New version',
      };

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.upsertProperty(
        sessionId,
        key,
        newValue,
        'New version',
      );

      expect(result.value).toBe(newValue);
      expect(result.description).toBe('New version');
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          value: newValue,
          description: 'New version',
        }),
      );
    });

    it('should not update description if not provided', async () => {
      const sessionId = 'session-123';
      const key = 'odeVersionName';
      const existing = {
        id: 1,
        odeSessionId: sessionId,
        key,
        value: '1.0.0',
        description: 'Original description',
        isActive: true,
      } as OdePropertiesSync;

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(existing);

      await service.upsertProperty(sessionId, key, '2.0.0');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Original description',
        }),
      );
    });

    it('should reactivate soft-deleted property', async () => {
      const sessionId = 'session-123';
      const key = 'deletedProp';
      const existing = {
        id: 1,
        odeSessionId: sessionId,
        key,
        value: 'oldValue',
        description: null,
        isActive: false, // Soft deleted
      } as OdePropertiesSync;

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue({ ...existing, isActive: true });

      const result = await service.upsertProperty(sessionId, key, 'newValue');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
        }),
      );
    });
  });

  describe('upsertMultipleProperties', () => {
    it('should update multiple properties', async () => {
      const sessionId = 'session-123';
      const properties = {
        odeVersionName: '1.0.0',
        projectType: 'SCORM',
        isPublished: 'false',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockImplementation((prop) => prop);
      mockRepository.save.mockImplementation((prop) =>
        Promise.resolve({ id: Math.random(), ...prop } as OdePropertiesSync),
      );

      const results = await service.upsertMultipleProperties(
        sessionId,
        properties,
      );

      expect(results).toHaveLength(3);
      expect(mockRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should handle empty properties object', async () => {
      const sessionId = 'session-123';
      const properties = {};

      const results = await service.upsertMultipleProperties(
        sessionId,
        properties,
      );

      expect(results).toHaveLength(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteProperty', () => {
    it('should soft delete an existing property', async () => {
      const sessionId = 'session-123';
      const key = 'odeVersionName';
      const existing = {
        id: 1,
        odeSessionId: sessionId,
        key,
        value: '1.0.0',
        description: null,
        isActive: true,
      } as OdePropertiesSync;

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue({ ...existing, isActive: false });

      const result = await service.deleteProperty(sessionId, key);

      expect(result).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it('should return false if property not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.deleteProperty('session-123', 'nonexistent');

      expect(result).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllBySessionId', () => {
    it('should soft delete all session properties', async () => {
      const sessionId = 'session-123';
      const mockProperties = [
        {
          id: 1,
          odeSessionId: sessionId,
          key: 'prop1',
          value: 'val1',
          description: null,
          isActive: true,
        },
        {
          id: 2,
          odeSessionId: sessionId,
          key: 'prop2',
          value: 'val2',
          description: null,
          isActive: true,
        },
      ] as OdePropertiesSync[];

      mockRepository.find.mockResolvedValue(mockProperties);
      mockRepository.save.mockResolvedValue({} as OdePropertiesSync);

      const result = await service.deleteAllBySessionId(sessionId);

      expect(result).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should return 0 if no properties to delete', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.deleteAllBySessionId('session-123');

      expect(result).toBe(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in keys and values', async () => {
      const sessionId = 'session@special';
      const key = 'config.nested.key';
      const value = '{"json": "value"}';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        odeSessionId: sessionId,
        key,
        value,
      } as OdePropertiesSync);
      mockRepository.save.mockResolvedValue({
        id: 1,
        odeSessionId: sessionId,
        key,
        value,
      } as OdePropertiesSync);

      const result = await service.upsertProperty(sessionId, key, value);

      expect(result.key).toBe(key);
      expect(result.value).toBe(value);
    });

    it('should handle very long values', async () => {
      const sessionId = 'session-123';
      const key = 'longValue';
      const value = 'x'.repeat(10000);

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        odeSessionId: sessionId,
        key,
        value,
      } as OdePropertiesSync);
      mockRepository.save.mockResolvedValue({
        id: 1,
        odeSessionId: sessionId,
        key,
        value,
      } as OdePropertiesSync);

      const result = await service.upsertProperty(sessionId, key, value);

      expect(result.value.length).toBe(10000);
    });

    it('should handle session IDs with maximum length', async () => {
      const sessionId = '12345678901234567890'; // 20 chars
      const key = 'testKey';
      const value = 'testValue';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        odeSessionId: sessionId,
        key,
        value,
      } as OdePropertiesSync);
      mockRepository.save.mockResolvedValue({
        id: 1,
        odeSessionId: sessionId,
        key,
        value,
      } as OdePropertiesSync);

      const result = await service.upsertProperty(sessionId, key, value);

      expect(result.odeSessionId.length).toBe(20);
    });
  });
});
