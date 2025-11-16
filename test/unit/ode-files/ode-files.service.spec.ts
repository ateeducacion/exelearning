import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeFilesService } from '../../../src/modules/ode-files/ode-files.service';
import { OdeFiles } from '../../../src/entities/ode-files.entity';

describe('OdeFilesService', () => {
  let service: OdeFilesService;
  let repository: Repository<OdeFiles>;

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
        OdeFilesService,
        {
          provide: getRepositoryToken(OdeFiles),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OdeFilesService>(OdeFilesService);
    repository = module.get<Repository<OdeFiles>>(
      getRepositoryToken(OdeFiles),
    );

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByOdeId', () => {
    it('should return all active files for an ODE', async () => {
      const odeId = 'ode-123';
      const mockFiles = [
        {
          id: 1,
          odeId,
          odeVersionId: 'version-456',
          title: 'Image 1',
          fileName: 'image1.jpg',
          fileType: 'image/jpeg',
          diskFilename: '{{files_dir}}/image1.jpg',
          size: 1024000,
          user: 'user@example.com',
          isManualSave: true,
          isActive: true,
        },
        {
          id: 2,
          odeId,
          odeVersionId: 'version-789',
          title: 'Image 2',
          fileName: 'image2.png',
          fileType: 'image/png',
          diskFilename: '{{files_dir}}/image2.png',
          size: 2048000,
          user: 'admin@example.com',
          isManualSave: false,
          isActive: true,
        },
      ] as OdeFiles[];

      mockRepository.find.mockResolvedValue(mockFiles);

      const result = await service.findAllByOdeId(odeId);

      expect(result).toEqual(mockFiles);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array if no files found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAllByOdeId('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findAllByOdeVersionId', () => {
    it('should return all active files for an ODE version', async () => {
      const odeVersionId = 'version-456';
      const mockFiles = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId,
          title: 'Document',
          fileName: 'doc.pdf',
          fileType: 'application/pdf',
          diskFilename: '{{files_dir}}/doc.pdf',
          size: 500000,
          user: 'user@example.com',
          isManualSave: true,
          isActive: true,
        },
      ] as OdeFiles[];

      mockRepository.find.mockResolvedValue(mockFiles);

      const result = await service.findAllByOdeVersionId(odeVersionId);

      expect(result).toEqual(mockFiles);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeVersionId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findAllByIdeviceId', () => {
    it('should return all active files for an iDevice', async () => {
      const odeIdeviceId = 'idevice-789';
      const mockFiles = [
        {
          id: 1,
          odeId: 'ode-123',
          odeVersionId: 'version-456',
          odeIdeviceId,
          title: 'Idevice Asset',
          fileName: 'asset.svg',
          fileType: 'image/svg+xml',
          diskFilename: '{{files_dir}}/asset.svg',
          size: 10000,
          user: 'user@example.com',
          isManualSave: true,
          isActive: true,
        },
      ] as OdeFiles[];

      mockRepository.find.mockResolvedValue(mockFiles);

      const result = await service.findAllByIdeviceId(odeIdeviceId);

      expect(result).toEqual(mockFiles);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { odeIdeviceId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('should return a file by ID', async () => {
      const mockFile = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        title: 'Test File',
        fileName: 'test.txt',
        fileType: 'text/plain',
        diskFilename: '{{files_dir}}/test.txt',
        size: 100,
        user: 'user@example.com',
        isManualSave: true,
        isActive: true,
      } as OdeFiles;

      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findById(1);

      expect(result).toEqual(mockFile);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
      });
    });

    it('should return null if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByDiskFilename', () => {
    it('should return a file by disk filename', async () => {
      const diskFilename = '{{files_dir}}/images/photo.jpg';
      const mockFile = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        title: 'Photo',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        diskFilename,
        size: 1024000,
        user: 'user@example.com',
        isManualSave: true,
        isActive: true,
      } as OdeFiles;

      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findByDiskFilename(diskFilename);

      expect(result).toEqual(mockFile);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { diskFilename, isActive: true },
      });
    });
  });

  describe('create', () => {
    it('should create a new file record', async () => {
      const fileData = {
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        title: 'New File',
        fileName: 'newfile.pdf',
        fileType: 'application/pdf',
        diskFilename: '{{files_dir}}/newfile.pdf',
        size: 500000,
        user: 'user@example.com',
        isManualSave: true,
      };

      const mockCreated = fileData as OdeFiles;
      const mockSaved = { id: 1, ...fileData, isActive: true } as OdeFiles;

      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockSaved);

      const result = await service.create(fileData);

      expect(result).toEqual(mockSaved);
      expect(mockRepository.create).toHaveBeenCalledWith(fileData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCreated);
    });
  });

  describe('update', () => {
    it('should update an existing file record', async () => {
      const existing = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        title: 'Old Title',
        fileName: 'file.pdf',
        fileType: 'application/pdf',
        diskFilename: '{{files_dir}}/file.pdf',
        size: 100000,
        user: 'user@example.com',
        isManualSave: true,
        isActive: true,
      } as OdeFiles;

      const updated = { ...existing, title: 'New Title', size: 200000 };

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.update(1, { title: 'New Title', size: 200000 });

      expect(result?.title).toBe('New Title');
      expect(result?.size).toBe(200000);
    });

    it('should return null if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.update(999, { title: 'New Title' });

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a file', async () => {
      const file = {
        id: 1,
        odeId: 'ode-123',
        odeVersionId: 'version-456',
        title: 'File',
        fileName: 'file.txt',
        fileType: 'text/plain',
        diskFilename: '{{files_dir}}/file.txt',
        size: 100,
        user: 'user@example.com',
        isManualSave: true,
        isActive: true,
      } as OdeFiles;

      mockRepository.findOne.mockResolvedValue(file);
      mockRepository.save.mockResolvedValue({ ...file, isActive: false });

      const result = await service.delete(1);

      expect(result).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should return false if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.delete(999);

      expect(result).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllByOdeId', () => {
    it('should soft delete all files for an ODE', async () => {
      const odeId = 'ode-123';
      const mockFiles = [
        { id: 1, odeId, isActive: true } as OdeFiles,
        { id: 2, odeId, isActive: true } as OdeFiles,
      ];

      mockRepository.find.mockResolvedValue(mockFiles);
      mockRepository.save.mockResolvedValue({} as OdeFiles);

      const result = await service.deleteAllByOdeId(odeId);

      expect(result).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTotalSizeByOdeId', () => {
    it('should calculate total size of files for an ODE', async () => {
      const odeId = 'ode-123';
      const mockFiles = [
        { id: 1, odeId, size: 1000 } as OdeFiles,
        { id: 2, odeId, size: 2000 } as OdeFiles,
        { id: 3, odeId, size: 3000 } as OdeFiles,
      ];

      mockRepository.find.mockResolvedValue(mockFiles);

      const result = await service.getTotalSizeByOdeId(odeId);

      expect(result).toBe(6000);
    });

    it('should return 0 if no files found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getTotalSizeByOdeId('ode-123');

      expect(result).toBe(0);
    });
  });

  describe('getFileCountByOdeId', () => {
    it('should return file count for an ODE', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getFileCountByOdeId('ode-123');

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { odeId: 'ode-123', isActive: true },
      });
    });
  });
});
