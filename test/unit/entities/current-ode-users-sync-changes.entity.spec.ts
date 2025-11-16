import { CurrentOdeUsersSyncChanges } from '../../../src/entities/current-ode-users-sync-changes.entity';

describe('CurrentOdeUsersSyncChanges Entity', () => {
  describe('Entity Creation', () => {
    it('should create a CurrentOdeUsersSyncChanges instance with all fields', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odePageIdUpdate = 'page-123';
      syncChange.odeBlockIdUpdate = 'block-456';
      syncChange.odeComponentIdUpdate = 'component-789';
      syncChange.destinationPageIdUpdate = 'dest-page-abc';
      syncChange.styleThemeIdUpdate = 'theme-def';
      syncChange.actionTypeUpdate = 'MOVE_COMPONENT';
      syncChange.userUpdate = 'user@example.com';

      expect(syncChange.odePageIdUpdate).toBe('page-123');
      expect(syncChange.odeBlockIdUpdate).toBe('block-456');
      expect(syncChange.odeComponentIdUpdate).toBe('component-789');
      expect(syncChange.destinationPageIdUpdate).toBe('dest-page-abc');
      expect(syncChange.styleThemeIdUpdate).toBe('theme-def');
      expect(syncChange.actionTypeUpdate).toBe('MOVE_COMPONENT');
      expect(syncChange.userUpdate).toBe('user@example.com');
    });

    it('should create a CurrentOdeUsersSyncChanges with all fields as null', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odePageIdUpdate = null;
      syncChange.odeBlockIdUpdate = null;
      syncChange.odeComponentIdUpdate = null;
      syncChange.destinationPageIdUpdate = null;
      syncChange.styleThemeIdUpdate = null;
      syncChange.actionTypeUpdate = null;
      syncChange.userUpdate = null;

      expect(syncChange.odePageIdUpdate).toBeNull();
      expect(syncChange.odeBlockIdUpdate).toBeNull();
      expect(syncChange.odeComponentIdUpdate).toBeNull();
      expect(syncChange.destinationPageIdUpdate).toBeNull();
      expect(syncChange.styleThemeIdUpdate).toBeNull();
      expect(syncChange.actionTypeUpdate).toBeNull();
      expect(syncChange.userUpdate).toBeNull();
    });

    it('should create a CurrentOdeUsersSyncChanges for page update', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odePageIdUpdate = 'page-update-1';
      syncChange.actionTypeUpdate = 'UPDATE_PAGE';
      syncChange.userUpdate = 'editor@example.com';

      expect(syncChange.odePageIdUpdate).toBe('page-update-1');
      expect(syncChange.actionTypeUpdate).toBe('UPDATE_PAGE');
      expect(syncChange.userUpdate).toBe('editor@example.com');
      expect(syncChange.odeBlockIdUpdate).toBeUndefined();
      expect(syncChange.odeComponentIdUpdate).toBeUndefined();
    });

    it('should create a CurrentOdeUsersSyncChanges for component move', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odeComponentIdUpdate = 'component-789';
      syncChange.destinationPageIdUpdate = 'new-page-123';
      syncChange.actionTypeUpdate = 'MOVE_COMPONENT';
      syncChange.userUpdate = 'mover@example.com';

      expect(syncChange.odeComponentIdUpdate).toBe('component-789');
      expect(syncChange.destinationPageIdUpdate).toBe('new-page-123');
      expect(syncChange.actionTypeUpdate).toBe('MOVE_COMPONENT');
      expect(syncChange.userUpdate).toBe('mover@example.com');
    });

    it('should create a CurrentOdeUsersSyncChanges for theme update', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.styleThemeIdUpdate = 'new-theme-modern';
      syncChange.actionTypeUpdate = 'UPDATE_THEME';
      syncChange.userUpdate = 'designer@example.com';

      expect(syncChange.styleThemeIdUpdate).toBe('new-theme-modern');
      expect(syncChange.actionTypeUpdate).toBe('UPDATE_THEME');
      expect(syncChange.userUpdate).toBe('designer@example.com');
    });

    it('should inherit BaseEntity fields', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();

      expect(syncChange.id).toBeUndefined();
      expect(syncChange.isActive).toBeUndefined();
      expect(syncChange.createdAt).toBeUndefined();
      expect(syncChange.updatedAt).toBeUndefined();
    });
  });

  describe('Action Types', () => {
    it('should handle various action types', () => {
      const actionTypes = [
        'MOVE_COMPONENT',
        'UPDATE_PAGE',
        'DELETE_PAGE',
        'UPDATE_THEME',
        'ADD_BLOCK',
        'REMOVE_BLOCK',
      ];

      actionTypes.forEach((actionType) => {
        const syncChange = new CurrentOdeUsersSyncChanges();
        syncChange.actionTypeUpdate = actionType;
        syncChange.userUpdate = 'user@example.com';

        expect(syncChange.actionTypeUpdate).toBe(actionType);
      });
    });
  });

  describe('User Updates', () => {
    it('should store user identifier correctly', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.userUpdate = 'long.email.address@subdomain.example.com';

      expect(syncChange.userUpdate).toBe('long.email.address@subdomain.example.com');
      expect(syncChange.userUpdate?.length).toBeLessThanOrEqual(128);
    });

    it('should allow different user identifier formats', () => {
      const users = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123',
      ];

      users.forEach((user) => {
        const syncChange = new CurrentOdeUsersSyncChanges();
        syncChange.userUpdate = user;

        expect(syncChange.userUpdate).toBe(user);
      });
    });
  });

  describe('Lifecycle Management', () => {
    it('should trigger lifecycle hooks from BaseEntity', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odePageIdUpdate = 'page-123';
      syncChange.actionTypeUpdate = 'UPDATE_PAGE';
      syncChange.userUpdate = 'user@example.com';

      syncChange.setCreatedAt();

      expect(syncChange.createdAt).toBeDefined();
      expect(syncChange.updatedAt).toBeDefined();
      expect(syncChange.isActive).toBe(true);
    });

    it('should handle soft delete', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odePageIdUpdate = 'page-123';
      syncChange.actionTypeUpdate = 'UPDATE_PAGE';
      syncChange.userUpdate = 'user@example.com';
      syncChange.setCreatedAt();

      expect(syncChange.isActive).toBe(true);

      syncChange.isActive = false;

      expect(syncChange.isActive).toBe(false);
      expect(syncChange.userUpdate).toBe('user@example.com');
    });
  });

  describe('Complex Update Scenarios', () => {
    it('should handle block update with page context', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odePageIdUpdate = 'page-123';
      syncChange.odeBlockIdUpdate = 'block-456';
      syncChange.actionTypeUpdate = 'UPDATE_BLOCK';
      syncChange.userUpdate = 'editor@example.com';

      expect(syncChange.odePageIdUpdate).toBe('page-123');
      expect(syncChange.odeBlockIdUpdate).toBe('block-456');
      expect(syncChange.actionTypeUpdate).toBe('UPDATE_BLOCK');
    });

    it('should handle component move with full context', () => {
      const syncChange = new CurrentOdeUsersSyncChanges();
      syncChange.odePageIdUpdate = 'source-page-1';
      syncChange.odeBlockIdUpdate = 'source-block-2';
      syncChange.odeComponentIdUpdate = 'component-3';
      syncChange.destinationPageIdUpdate = 'dest-page-4';
      syncChange.actionTypeUpdate = 'MOVE_COMPONENT';
      syncChange.userUpdate = 'mover@example.com';

      expect(syncChange.odePageIdUpdate).toBe('source-page-1');
      expect(syncChange.odeBlockIdUpdate).toBe('source-block-2');
      expect(syncChange.odeComponentIdUpdate).toBe('component-3');
      expect(syncChange.destinationPageIdUpdate).toBe('dest-page-4');
      expect(syncChange.actionTypeUpdate).toBe('MOVE_COMPONENT');
    });
  });
});
