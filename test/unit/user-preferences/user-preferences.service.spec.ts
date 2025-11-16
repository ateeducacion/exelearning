import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreferencesService } from '../../../src/modules/user-preferences/user-preferences.service';
import { UserPreferences } from '../../../src/entities/user-preferences.entity';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let repository: Repository<UserPreferences>;

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
        UserPreferencesService,
        {
          provide: getRepositoryToken(UserPreferences),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserPreferencesService>(UserPreferencesService);
    repository = module.get<Repository<UserPreferences>>(
      getRepositoryToken(UserPreferences),
    );

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByUserId', () => {
    it('should return all active preferences for a user', async () => {
      const userId = 'user123';
      const mockPreferences = [
        {
          id: 1,
          userId,
          key: 'advancedMode',
          value: 'true',
          description: null,
          isActive: true,
        },
        {
          id: 2,
          userId,
          key: 'locale',
          value: 'en',
          description: null,
          isActive: true,
        },
      ] as UserPreferences[];

      mockRepository.find.mockResolvedValue(mockPreferences);

      const result = await service.findAllByUserId(userId);

      expect(result).toEqual(mockPreferences);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        order: { key: 'ASC' },
      });
    });

    it('should return empty array if no preferences found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAllByUserId('nonexistent');

      expect(result).toEqual([]);
    });

    it('should order preferences by key', async () => {
      const userId = 'user123';
      mockRepository.find.mockResolvedValue([]);

      await service.findAllByUserId(userId);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { key: 'ASC' },
        }),
      );
    });
  });

  describe('findByUserIdAndKey', () => {
    it('should return a specific preference', async () => {
      const userId = 'user123';
      const key = 'advancedMode';
      const mockPreference = {
        id: 1,
        userId,
        key,
        value: 'true',
        description: null,
        isActive: true,
      } as UserPreferences;

      mockRepository.findOne.mockResolvedValue(mockPreference);

      const result = await service.findByUserIdAndKey(userId, key);

      expect(result).toEqual(mockPreference);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { userId, key, isActive: true },
      });
    });

    it('should return null if preference not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUserIdAndKey('user123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPreferencesObject', () => {
    it('should return preferences as key-value object', async () => {
      const userId = 'user123';
      const mockPreferences = [
        {
          id: 1,
          userId,
          key: 'advancedMode',
          value: 'true',
          description: null,
          isActive: true,
        },
        {
          id: 2,
          userId,
          key: 'locale',
          value: 'en',
          description: null,
          isActive: true,
        },
        {
          id: 3,
          userId,
          key: 'versionControl',
          value: 'false',
          description: null,
          isActive: true,
        },
      ] as UserPreferences[];

      mockRepository.find.mockResolvedValue(mockPreferences);

      const result = await service.getPreferencesObject(userId);

      expect(result).toEqual({
        advancedMode: 'true',
        locale: 'en',
        versionControl: 'false',
      });
    });

    it('should return empty object if no preferences', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getPreferencesObject('user123');

      expect(result).toEqual({});
    });
  });

  describe('upsertPreference', () => {
    it('should create new preference if not exists', async () => {
      const userId = 'user123';
      const key = 'advancedMode';
      const value = 'true';
      const description = 'Enable advanced features';

      const mockCreated = {
        userId,
        key,
        value,
        description,
      } as UserPreferences;

      const mockSaved = {
        id: 1,
        ...mockCreated,
        isActive: true,
      } as UserPreferences;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockSaved);

      const result = await service.upsertPreference(
        userId,
        key,
        value,
        description,
      );

      expect(result).toEqual(mockSaved);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        key,
        value,
        description,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockCreated);
    });

    it('should update existing preference', async () => {
      const userId = 'user123';
      const key = 'advancedMode';
      const oldValue = 'false';
      const newValue = 'true';

      const existing = {
        id: 1,
        userId,
        key,
        value: oldValue,
        description: 'Old description',
        isActive: true,
      } as UserPreferences;

      const updated = {
        ...existing,
        value: newValue,
        description: 'New description',
      };

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.upsertPreference(
        userId,
        key,
        newValue,
        'New description',
      );

      expect(result.value).toBe(newValue);
      expect(result.description).toBe('New description');
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          value: newValue,
          description: 'New description',
        }),
      );
    });

    it('should not update description if not provided', async () => {
      const userId = 'user123';
      const key = 'advancedMode';
      const existing = {
        id: 1,
        userId,
        key,
        value: 'false',
        description: 'Original description',
        isActive: true,
      } as UserPreferences;

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(existing);

      await service.upsertPreference(userId, key, 'true');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Original description',
        }),
      );
    });

    it('should reactivate soft-deleted preference', async () => {
      const userId = 'user123';
      const key = 'deletedPref';
      const existing = {
        id: 1,
        userId,
        key,
        value: 'oldValue',
        description: null,
        isActive: false, // Soft deleted
      } as UserPreferences;

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue({ ...existing, isActive: true });

      const result = await service.upsertPreference(userId, key, 'newValue');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
        }),
      );
    });
  });

  describe('upsertMultiplePreferences', () => {
    it('should update multiple preferences', async () => {
      const userId = 'user123';
      const preferences = {
        advancedMode: 'true',
        locale: 'es',
        versionControl: 'false',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockImplementation((pref) => pref);
      mockRepository.save.mockImplementation((pref) =>
        Promise.resolve({ id: Math.random(), ...pref } as UserPreferences),
      );

      const results = await service.upsertMultiplePreferences(
        userId,
        preferences,
      );

      expect(results).toHaveLength(3);
      expect(mockRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should handle empty preferences object', async () => {
      const userId = 'user123';
      const preferences = {};

      const results = await service.upsertMultiplePreferences(
        userId,
        preferences,
      );

      expect(results).toHaveLength(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deletePreference', () => {
    it('should soft delete an existing preference', async () => {
      const userId = 'user123';
      const key = 'advancedMode';
      const existing = {
        id: 1,
        userId,
        key,
        value: 'true',
        description: null,
        isActive: true,
      } as UserPreferences;

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue({ ...existing, isActive: false });

      const result = await service.deletePreference(userId, key);

      expect(result).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it('should return false if preference not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.deletePreference('user123', 'nonexistent');

      expect(result).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllByUserId', () => {
    it('should soft delete all user preferences', async () => {
      const userId = 'user123';
      const mockPreferences = [
        {
          id: 1,
          userId,
          key: 'pref1',
          value: 'val1',
          description: null,
          isActive: true,
        },
        {
          id: 2,
          userId,
          key: 'pref2',
          value: 'val2',
          description: null,
          isActive: true,
        },
      ] as UserPreferences[];

      mockRepository.find.mockResolvedValue(mockPreferences);
      mockRepository.save.mockResolvedValue({} as UserPreferences);

      const result = await service.deleteAllByUserId(userId);

      expect(result).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should return 0 if no preferences to delete', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.deleteAllByUserId('user123');

      expect(result).toBe(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in keys and values', async () => {
      const userId = 'user@example.com';
      const key = 'config.nested.key';
      const value = '{"json": "value"}';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        userId,
        key,
        value,
      } as UserPreferences);
      mockRepository.save.mockResolvedValue({
        id: 1,
        userId,
        key,
        value,
      } as UserPreferences);

      const result = await service.upsertPreference(userId, key, value);

      expect(result.key).toBe(key);
      expect(result.value).toBe(value);
    });

    it('should handle very long values', async () => {
      const userId = 'user123';
      const key = 'longValue';
      const value = 'x'.repeat(10000);

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        userId,
        key,
        value,
      } as UserPreferences);
      mockRepository.save.mockResolvedValue({
        id: 1,
        userId,
        key,
        value,
      } as UserPreferences);

      const result = await service.upsertPreference(userId, key, value);

      expect(result.value.length).toBe(10000);
    });
  });
});
