import { OdeFiles } from '../../../src/entities/ode-files.entity';

describe('OdeFiles Entity', () => {
  describe('Entity Creation', () => {
    it('should create an OdeFiles instance with all required fields', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.odeIdeviceId = 'idevice-789';
      file.odePlatformId = 'platform-abc';
      file.title = 'Test Image';
      file.versionName = 'v1.0';
      file.fileName = 'test-image.jpg';
      file.fileType = 'image/jpeg';
      file.diskFilename = '{{files_dir}}/images/test-image.jpg';
      file.size = 1024000;
      file.user = 'user@example.com';
      file.isManualSave = true;

      expect(file.odeId).toBe('ode-123');
      expect(file.odeVersionId).toBe('version-456');
      expect(file.odeIdeviceId).toBe('idevice-789');
      expect(file.odePlatformId).toBe('platform-abc');
      expect(file.title).toBe('Test Image');
      expect(file.versionName).toBe('v1.0');
      expect(file.fileName).toBe('test-image.jpg');
      expect(file.fileType).toBe('image/jpeg');
      expect(file.diskFilename).toBe('{{files_dir}}/images/test-image.jpg');
      expect(file.size).toBe(1024000);
      expect(file.user).toBe('user@example.com');
      expect(file.isManualSave).toBe(true);
    });

    it('should create an OdeFiles instance with nullable fields as null', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.odeIdeviceId = null;
      file.odePlatformId = null;
      file.title = 'Test File';
      file.versionName = null;
      file.fileName = 'test.pdf';
      file.fileType = 'application/pdf';
      file.diskFilename = '{{files_dir}}/documents/test.pdf';
      file.size = 500000;
      file.user = 'admin@example.com';
      file.isManualSave = false;

      expect(file.odeIdeviceId).toBeNull();
      expect(file.odePlatformId).toBeNull();
      expect(file.versionName).toBeNull();
      expect(file.isManualSave).toBe(false);
    });

    it('should inherit BaseEntity fields', () => {
      const file = new OdeFiles();

      // BaseEntity fields should be accessible
      expect(file.id).toBeUndefined();
      expect(file.isActive).toBeUndefined();
      expect(file.createdAt).toBeUndefined();
      expect(file.updatedAt).toBeUndefined();
    });

    it('should trigger lifecycle hooks from BaseEntity', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Test File';
      file.fileName = 'test.txt';
      file.fileType = 'text/plain';
      file.diskFilename = '{{files_dir}}/test.txt';
      file.size = 100;
      file.user = 'user@example.com';

      // Simulate @BeforeInsert
      file.setCreatedAt();

      expect(file.createdAt).toBeDefined();
      expect(file.updatedAt).toBeDefined();
      expect(file.isActive).toBe(true);
    });
  });

  describe('getDiskFilenameWithFilesDir', () => {
    it('should replace placeholder with actual files directory', () => {
      const file = new OdeFiles();
      file.diskFilename = '{{files_dir}}/images/photo.jpg';

      const result = file.getDiskFilenameWithFilesDir('/var/www/files');

      expect(result).toBe('/var/www/files/images/photo.jpg');
    });

    it('should handle Windows-style paths', () => {
      const file = new OdeFiles();
      file.diskFilename = '{{files_dir}}/documents/report.pdf';

      const result = file.getDiskFilenameWithFilesDir('C:\\files');

      expect(result).toBe('C:\\files/documents/report.pdf');
    });

    it('should handle paths without placeholder', () => {
      const file = new OdeFiles();
      file.diskFilename = '/absolute/path/file.txt';

      const result = file.getDiskFilenameWithFilesDir('/var/www/files');

      expect(result).toBe('/absolute/path/file.txt');
    });

    it('should handle nested directory structures', () => {
      const file = new OdeFiles();
      file.diskFilename = '{{files_dir}}/projects/2024/january/file.zip';

      const result = file.getDiskFilenameWithFilesDir('/storage/exelearning');

      expect(result).toBe('/storage/exelearning/projects/2024/january/file.zip');
    });
  });

  describe('File Type Examples', () => {
    it('should represent an image file', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Profile Photo';
      file.fileName = 'profile.png';
      file.fileType = 'image/png';
      file.diskFilename = '{{files_dir}}/images/profile.png';
      file.size = 204800; // 200 KB
      file.user = 'user@example.com';
      file.isManualSave = true;

      expect(file.fileType).toBe('image/png');
      expect(file.size).toBe(204800);
    });

    it('should represent a PDF document', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Course Material';
      file.fileName = 'material.pdf';
      file.fileType = 'application/pdf';
      file.diskFilename = '{{files_dir}}/documents/material.pdf';
      file.size = 1048576; // 1 MB
      file.user = 'teacher@example.com';
      file.isManualSave = true;

      expect(file.fileType).toBe('application/pdf');
    });

    it('should represent a video file', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Tutorial Video';
      file.fileName = 'tutorial.mp4';
      file.fileType = 'video/mp4';
      file.diskFilename = '{{files_dir}}/videos/tutorial.mp4';
      file.size = 10485760; // 10 MB
      file.user = 'instructor@example.com';
      file.isManualSave = false;

      expect(file.fileType).toBe('video/mp4');
      expect(file.isManualSave).toBe(false);
    });

    it('should represent an audio file', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Background Music';
      file.fileName = 'music.mp3';
      file.fileType = 'audio/mpeg';
      file.diskFilename = '{{files_dir}}/audio/music.mp3';
      file.size = 5242880; // 5 MB
      file.user = 'content@example.com';
      file.isManualSave = true;

      expect(file.fileType).toBe('audio/mpeg');
    });
  });

  describe('Field Constraints', () => {
    it('should handle maximum length string IDs', () => {
      const file = new OdeFiles();
      file.odeId = '12345678901234567890'; // 20 chars
      file.odeVersionId = '12345678901234567890'; // 20 chars
      file.odeIdeviceId = '12345678901234567890'; // 20 chars

      expect(file.odeId.length).toBe(20);
      expect(file.odeVersionId.length).toBe(20);
      expect(file.odeIdeviceId.length).toBe(20);
    });

    it('should handle long filenames', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Very Long File Title That Contains Many Words And Descriptions';
      file.fileName = 'a'.repeat(255);
      file.fileType = 'text/plain';
      file.diskFilename = '{{files_dir}}/' + 'b'.repeat(240);
      file.size = 1000;
      file.user = 'user@example.com';

      expect(file.fileName.length).toBe(255);
    });

    it('should handle large file sizes', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Large Video File';
      file.fileName = 'large-video.mp4';
      file.fileType = 'video/mp4';
      file.diskFilename = '{{files_dir}}/videos/large-video.mp4';
      file.size = 5368709120; // 5 GB
      file.user = 'admin@example.com';
      file.isManualSave = true;

      expect(file.size).toBe(5368709120);
    });

    it('should handle special characters in filenames', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Special File (2024) [Final]';
      file.fileName = 'file_name-with.special+chars (1).pdf';
      file.fileType = 'application/pdf';
      file.diskFilename = '{{files_dir}}/special/file_name-with.special+chars (1).pdf';
      file.size = 1000;
      file.user = 'user@example.com';

      expect(file.title).toContain('(2024)');
      expect(file.fileName).toContain('+');
    });
  });

  describe('Lifecycle Management', () => {
    it('should maintain timestamps across updates', async () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'Test File';
      file.fileName = 'test.txt';
      file.fileType = 'text/plain';
      file.diskFilename = '{{files_dir}}/test.txt';
      file.size = 100;
      file.user = 'user@example.com';

      // Simulate insert
      file.setCreatedAt();
      const initialCreatedAt = file.createdAt;
      const initialUpdatedAt = file.updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate update
      file.size = 200;
      file.setUpdatedAt();

      // createdAt should not change
      expect(file.createdAt).toBe(initialCreatedAt);
      // updatedAt should be newer
      expect(file.updatedAt!.getTime()).toBeGreaterThan(
        initialUpdatedAt!.getTime(),
      );
    });

    it('should handle soft delete via isActive flag', () => {
      const file = new OdeFiles();
      file.odeId = 'ode-123';
      file.odeVersionId = 'version-456';
      file.title = 'File to delete';
      file.fileName = 'delete-me.txt';
      file.fileType = 'text/plain';
      file.diskFilename = '{{files_dir}}/delete-me.txt';
      file.size = 100;
      file.user = 'user@example.com';
      file.setCreatedAt();

      // Initially active
      expect(file.isActive).toBe(true);

      // Soft delete
      file.isActive = false;

      expect(file.isActive).toBe(false);
      expect(file.fileName).toBe('delete-me.txt'); // Data still present
    });
  });
});
