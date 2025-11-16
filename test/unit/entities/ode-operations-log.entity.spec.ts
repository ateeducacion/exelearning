import { OdeOperationsLog } from '../../../src/entities/ode-operations-log.entity';

describe('OdeOperationsLog Entity', () => {
  describe('Entity Creation', () => {
    it('should create an OdeOperationsLog instance with all required fields', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'ADD_IDEVICE';
      log.idSource = 'source-abc';
      log.idDestination = 'dest-def';
      log.user = 'user@example.com';
      log.additionalData = '{"key":"value"}';
      log.doneFlag = 0;
      log.doneDatetime = null;

      expect(log.odeId).toBe('ode-123');
      expect(log.odeVersionId).toBe('version-456');
      expect(log.odeSessionId).toBe('session-789');
      expect(log.operation).toBe('ADD_IDEVICE');
      expect(log.idSource).toBe('source-abc');
      expect(log.idDestination).toBe('dest-def');
      expect(log.user).toBe('user@example.com');
      expect(log.additionalData).toBe('{"key":"value"}');
      expect(log.doneFlag).toBe(0);
      expect(log.doneDatetime).toBeNull();
    });

    it('should create an OdeOperationsLog with nullable fields as null', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'MOVE_PAGE';
      log.idSource = 'source-abc';
      log.idDestination = null;
      log.user = 'admin@example.com';
      log.additionalData = null;
      log.doneFlag = 0;
      log.doneDatetime = null;

      expect(log.idDestination).toBeNull();
      expect(log.additionalData).toBeNull();
      expect(log.doneDatetime).toBeNull();
    });

    it('should inherit BaseEntity fields', () => {
      const log = new OdeOperationsLog();

      // BaseEntity fields should be accessible
      expect(log.id).toBeUndefined();
      expect(log.isActive).toBeUndefined();
      expect(log.createdAt).toBeUndefined();
      expect(log.updatedAt).toBeUndefined();
    });

    it('should trigger lifecycle hooks from BaseEntity', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'ADD_PAGE';
      log.idSource = 'source-123';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      // Simulate @BeforeInsert
      log.setCreatedAt();

      expect(log.createdAt).toBeDefined();
      expect(log.updatedAt).toBeDefined();
      expect(log.isActive).toBe(true);
    });
  });

  describe('Operation Types', () => {
    it('should represent ADD_IDEVICE operation', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'ADD_IDEVICE';
      log.idSource = 'block-123';
      log.idDestination = 'idevice-456';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      expect(log.operation).toBe('ADD_IDEVICE');
    });

    it('should represent MOVE_BLOCK_TO operation', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'MOVE_BLOCK_TO';
      log.idSource = 'block-source';
      log.idDestination = 'block-dest';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      expect(log.operation).toBe('MOVE_BLOCK_TO');
    });

    it('should represent CLONE_PAGE operation', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'CLONE_PAGE';
      log.idSource = 'page-source';
      log.idDestination = 'page-clone';
      log.user = 'admin@example.com';
      log.doneFlag = 0;

      expect(log.operation).toBe('CLONE_PAGE');
    });

    it('should represent DELETE operation', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'DELETE';
      log.idSource = 'element-123';
      log.idDestination = null;
      log.user = 'user@example.com';
      log.doneFlag = 0;

      expect(log.operation).toBe('DELETE');
      expect(log.idDestination).toBeNull();
    });
  });

  describe('Additional Data', () => {
    it('should store JSON additional data', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'ADD_IDEVICE';
      log.idSource = 'block-123';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      const additionalData = {
        blockId: 'block-123',
        odeIdeviceId: 'idevice-456',
        position: 2,
      };
      log.additionalData = JSON.stringify(additionalData);

      expect(log.additionalData).toBe(JSON.stringify(additionalData));

      // Parse it back
      const parsed = JSON.parse(log.additionalData);
      expect(parsed.blockId).toBe('block-123');
      expect(parsed.odeIdeviceId).toBe('idevice-456');
      expect(parsed.position).toBe(2);
    });

    it('should handle large additional data', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'MOVE_PAGE';
      log.idSource = 'page-123';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      // Create data that approaches the 4096 character limit
      const largeData = {
        description: 'x'.repeat(3000),
        metadata: { key1: 'value1', key2: 'value2' },
      };
      log.additionalData = JSON.stringify(largeData);

      expect(log.additionalData.length).toBeLessThan(4096);
    });
  });

  describe('Done Flag and Datetime', () => {
    it('should track pending operations with doneFlag = 0', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'ADD_PAGE';
      log.idSource = 'page-123';
      log.user = 'user@example.com';
      log.doneFlag = 0;
      log.doneDatetime = null;

      expect(log.doneFlag).toBe(0);
      expect(log.doneDatetime).toBeNull();
    });

    it('should track completed operations with doneFlag = 1', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'CLONE_BLOCK';
      log.idSource = 'block-123';
      log.user = 'user@example.com';
      log.doneFlag = 1;
      log.doneDatetime = new Date('2024-01-15T10:30:00Z');

      expect(log.doneFlag).toBe(1);
      expect(log.doneDatetime).toBeInstanceOf(Date);
      expect(log.doneDatetime?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should update doneFlag and doneDatetime when marking as done', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'MOVE_IDEVICE_TO';
      log.idSource = 'idevice-123';
      log.idDestination = 'block-456';
      log.user = 'user@example.com';
      log.doneFlag = 0;
      log.doneDatetime = null;

      // Mark as done
      log.doneFlag = 1;
      log.doneDatetime = new Date();

      expect(log.doneFlag).toBe(1);
      expect(log.doneDatetime).toBeInstanceOf(Date);
    });
  });

  describe('Field Constraints', () => {
    it('should handle maximum length string IDs', () => {
      const log = new OdeOperationsLog();
      log.odeId = '12345678901234567890'; // 20 chars
      log.odeVersionId = '12345678901234567890'; // 20 chars
      log.odeSessionId = '12345678901234567890'; // 20 chars
      log.idSource = '12345678901234567890'; // 20 chars
      log.idDestination = '12345678901234567890'; // 20 chars
      log.operation = 'ADD_IDEVICE';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      expect(log.odeId.length).toBe(20);
      expect(log.odeVersionId.length).toBe(20);
      expect(log.odeSessionId.length).toBe(20);
      expect(log.idSource.length).toBe(20);
      expect(log.idDestination?.length).toBe(20);
    });

    it('should handle maximum length operation type', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'A'.repeat(16); // 16 chars max
      log.idSource = 'source-123';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      expect(log.operation.length).toBe(16);
    });

    it('should handle maximum length user field', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'ADD_PAGE';
      log.idSource = 'page-123';
      log.user = 'a'.repeat(128); // Exactly 128 chars
      log.doneFlag = 0;

      // Should be able to store up to 128 chars
      expect(log.user.length).toBe(128);
    });
  });

  describe('Lifecycle Management', () => {
    it('should maintain timestamps across updates', async () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'MOVE_BLOCK_ON';
      log.idSource = 'block-123';
      log.user = 'user@example.com';
      log.doneFlag = 0;

      // Simulate insert
      log.setCreatedAt();
      const initialCreatedAt = log.createdAt;
      const initialUpdatedAt = log.updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate update
      log.doneFlag = 1;
      log.doneDatetime = new Date();
      log.setUpdatedAt();

      // createdAt should not change
      expect(log.createdAt).toBe(initialCreatedAt);
      // updatedAt should be newer
      expect(log.updatedAt!.getTime()).toBeGreaterThan(
        initialUpdatedAt!.getTime(),
      );
    });

    it('should handle soft delete via isActive flag', () => {
      const log = new OdeOperationsLog();
      log.odeId = 'ode-123';
      log.odeVersionId = 'version-456';
      log.odeSessionId = 'session-789';
      log.operation = 'DELETE';
      log.idSource = 'element-123';
      log.user = 'user@example.com';
      log.doneFlag = 1;
      log.doneDatetime = new Date();
      log.setCreatedAt();

      // Initially active
      expect(log.isActive).toBe(true);

      // Soft delete
      log.isActive = false;

      expect(log.isActive).toBe(false);
      expect(log.operation).toBe('DELETE'); // Data still present
    });
  });

  describe('Session and User Tracking', () => {
    it('should track operations by session', () => {
      const sessionId = 'session-xyz';

      const log1 = new OdeOperationsLog();
      log1.odeId = 'ode-123';
      log1.odeVersionId = 'version-456';
      log1.odeSessionId = sessionId;
      log1.operation = 'ADD_PAGE';
      log1.idSource = 'page-1';
      log1.user = 'user1@example.com';
      log1.doneFlag = 0;

      const log2 = new OdeOperationsLog();
      log2.odeId = 'ode-123';
      log2.odeVersionId = 'version-456';
      log2.odeSessionId = sessionId;
      log2.operation = 'ADD_IDEVICE';
      log2.idSource = 'idevice-1';
      log2.user = 'user2@example.com';
      log2.doneFlag = 0;

      expect(log1.odeSessionId).toBe(sessionId);
      expect(log2.odeSessionId).toBe(sessionId);
    });

    it('should track operations by user', () => {
      const userId = 'user@example.com';

      const log1 = new OdeOperationsLog();
      log1.odeId = 'ode-123';
      log1.odeVersionId = 'version-456';
      log1.odeSessionId = 'session-1';
      log1.operation = 'CLONE_PAGE';
      log1.idSource = 'page-1';
      log1.user = userId;
      log1.doneFlag = 0;

      const log2 = new OdeOperationsLog();
      log2.odeId = 'ode-123';
      log2.odeVersionId = 'version-456';
      log2.odeSessionId = 'session-2';
      log2.operation = 'MOVE_PAGE';
      log2.idSource = 'page-2';
      log2.user = userId;
      log2.doneFlag = 0;

      expect(log1.user).toBe(userId);
      expect(log2.user).toBe(userId);
    });
  });
});
