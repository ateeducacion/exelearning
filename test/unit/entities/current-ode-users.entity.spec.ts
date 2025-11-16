import { CurrentOdeUsers } from '../../../src/entities/current-ode-users.entity';

describe('CurrentOdeUsers Entity', () => {
  describe('Entity Creation', () => {
    it('should create a CurrentOdeUsers instance with all required fields', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date('2024-01-15T10:00:00Z');
      user.lastSync = new Date('2024-01-15T10:05:00Z');
      user.syncSaveFlag = true;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = true;
      user.syncUpdateFlag = false;
      user.nodeIp = '192.168.1.100';

      expect(user.odeId).toBe('ode-123');
      expect(user.odeVersionId).toBe('version-456');
      expect(user.odeSessionId).toBe('session-789');
      expect(user.user).toBe('user@example.com');
      expect(user.lastAction).toBeInstanceOf(Date);
      expect(user.lastSync).toBeInstanceOf(Date);
      expect(user.syncSaveFlag).toBe(true);
      expect(user.syncNavStructureFlag).toBe(false);
      expect(user.syncPagStructureFlag).toBe(false);
      expect(user.syncComponentsFlag).toBe(true);
      expect(user.syncUpdateFlag).toBe(false);
      expect(user.nodeIp).toBe('192.168.1.100');
    });

    it('should create a CurrentOdeUsers with nullable location fields', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.currentPageId = null;
      user.currentBlockId = null;
      user.currentComponentId = null;
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;
      user.nodeIp = '127.0.0.1';

      expect(user.currentPageId).toBeNull();
      expect(user.currentBlockId).toBeNull();
      expect(user.currentComponentId).toBeNull();
    });

    it('should create a CurrentOdeUsers with current location fields', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.currentPageId = 'page-abc';
      user.currentBlockId = 'block-def';
      user.currentComponentId = 'component-ghi';
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;
      user.nodeIp = '10.0.0.1';

      expect(user.currentPageId).toBe('page-abc');
      expect(user.currentBlockId).toBe('block-def');
      expect(user.currentComponentId).toBe('component-ghi');
    });

    it('should create a CurrentOdeUsers with pending update fields', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.odePageIdUpdate = 'page-update-1';
      user.odeBlockIdUpdate = 'block-update-2';
      user.odeComponentIdUpdate = 'component-update-3';
      user.destinationPageIdUpdate = 'dest-page-4';
      user.actionTypeUpdate = 'MOVE_COMPONENT';
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = true;
      user.nodeIp = '172.16.0.1';

      expect(user.odePageIdUpdate).toBe('page-update-1');
      expect(user.odeBlockIdUpdate).toBe('block-update-2');
      expect(user.odeComponentIdUpdate).toBe('component-update-3');
      expect(user.destinationPageIdUpdate).toBe('dest-page-4');
      expect(user.actionTypeUpdate).toBe('MOVE_COMPONENT');
      expect(user.syncUpdateFlag).toBe(true);
    });

    it('should inherit BaseEntity fields', () => {
      const user = new CurrentOdeUsers();

      expect(user.id).toBeUndefined();
      expect(user.isActive).toBeUndefined();
      expect(user.createdAt).toBeUndefined();
      expect(user.updatedAt).toBeUndefined();
    });
  });

  describe('Sync Flags', () => {
    it('should handle all sync flags set to true', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.syncSaveFlag = true;
      user.syncNavStructureFlag = true;
      user.syncPagStructureFlag = true;
      user.syncComponentsFlag = true;
      user.syncUpdateFlag = true;
      user.nodeIp = '192.168.1.1';

      expect(user.syncSaveFlag).toBe(true);
      expect(user.syncNavStructureFlag).toBe(true);
      expect(user.syncPagStructureFlag).toBe(true);
      expect(user.syncComponentsFlag).toBe(true);
      expect(user.syncUpdateFlag).toBe(true);
    });

    it('should handle selective sync flags', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.syncSaveFlag = true;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = true;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = true;
      user.nodeIp = '192.168.1.1';

      expect(user.syncSaveFlag).toBe(true);
      expect(user.syncNavStructureFlag).toBe(false);
      expect(user.syncPagStructureFlag).toBe(true);
      expect(user.syncComponentsFlag).toBe(false);
      expect(user.syncUpdateFlag).toBe(true);
    });
  });

  describe('Timestamps', () => {
    it('should track lastAction and lastSync timestamps', () => {
      const lastAction = new Date('2024-01-15T10:00:00Z');
      const lastSync = new Date('2024-01-15T10:05:00Z');

      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = lastAction;
      user.lastSync = lastSync;
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;
      user.nodeIp = '192.168.1.1';

      expect(user.lastAction).toBe(lastAction);
      expect(user.lastSync).toBe(lastSync);
    });

    it('should allow updating timestamps independently', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date('2024-01-15T10:00:00Z');
      user.lastSync = new Date('2024-01-15T10:00:00Z');
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;
      user.nodeIp = '192.168.1.1';

      const newLastAction = new Date('2024-01-15T10:10:00Z');
      user.lastAction = newLastAction;

      expect(user.lastAction).toBe(newLastAction);
      expect(user.lastSync.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    });
  });

  describe('Node IP', () => {
    it('should store IPv4 addresses', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.nodeIp = '192.168.1.100';
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;

      expect(user.nodeIp).toBe('192.168.1.100');
    });

    it('should store IPv6 addresses', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.nodeIp = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;

      expect(user.nodeIp.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Lifecycle Management', () => {
    it('should trigger lifecycle hooks from BaseEntity', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;
      user.nodeIp = '192.168.1.1';

      user.setCreatedAt();

      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      expect(user.isActive).toBe(true);
    });

    it('should handle soft delete', () => {
      const user = new CurrentOdeUsers();
      user.odeId = 'ode-123';
      user.odeVersionId = 'version-456';
      user.odeSessionId = 'session-789';
      user.user = 'user@example.com';
      user.lastAction = new Date();
      user.lastSync = new Date();
      user.syncSaveFlag = false;
      user.syncNavStructureFlag = false;
      user.syncPagStructureFlag = false;
      user.syncComponentsFlag = false;
      user.syncUpdateFlag = false;
      user.nodeIp = '192.168.1.1';
      user.setCreatedAt();

      expect(user.isActive).toBe(true);

      user.isActive = false;

      expect(user.isActive).toBe(false);
      expect(user.user).toBe('user@example.com');
    });
  });
});
