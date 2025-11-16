import { OdePropertiesSync } from '../../../src/entities/ode-properties-sync.entity';

describe('OdePropertiesSync Entity', () => {
  describe('Entity Creation', () => {
    it('should create an OdePropertiesSync instance with all required fields', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'odeVersionName';
      property.value = '1.0.0';
      property.description = 'ODE Version';

      expect(property.odeSessionId).toBe('session-123');
      expect(property.key).toBe('odeVersionName');
      expect(property.value).toBe('1.0.0');
      expect(property.description).toBe('ODE Version');
    });

    it('should create an OdePropertiesSync instance with null description', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-456';
      property.key = 'projectType';
      property.value = 'standard';
      property.description = null;

      expect(property.description).toBeNull();
    });

    it('should inherit BaseEntity fields', () => {
      const property = new OdePropertiesSync();

      // BaseEntity fields should be accessible
      expect(property.id).toBeUndefined();
      expect(property.isActive).toBeUndefined();
      expect(property.createdAt).toBeUndefined();
      expect(property.updatedAt).toBeUndefined();
    });

    it('should trigger lifecycle hooks from BaseEntity', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-789';
      property.key = 'testKey';
      property.value = 'testValue';

      // Simulate @BeforeInsert
      property.setCreatedAt();

      expect(property.createdAt).toBeDefined();
      expect(property.updatedAt).toBeDefined();
      expect(property.isActive).toBe(true);
    });
  });

  describe('Field Constraints', () => {
    it('should handle long text values', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'longConfig';
      property.value = 'x'.repeat(10000); // Very long value

      expect(property.value.length).toBe(10000);
    });

    it('should handle special characters in values', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session@special';
      property.key = 'config.nested.key';
      property.value = '{"json": "value", "special": "<>&\'\""}';

      expect(property.value).toContain('"json"');
      expect(property.value).toContain('<>&');
    });

    it('should handle empty string values', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'emptyProp';
      property.value = '';

      expect(property.value).toBe('');
    });

    it('should handle session IDs up to 20 characters', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = '12345678901234567890'; // 20 chars (max length)
      property.key = 'testKey';
      property.value = 'testValue';

      expect(property.odeSessionId.length).toBe(20);
    });
  });

  describe('Common Use Cases', () => {
    it('should represent an ODE version property', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'odeVersionName';
      property.value = '1.0.0';
      property.description = 'ODE version number';

      expect(property.value).toBe('1.0.0');
    });

    it('should represent a project type property', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'projectType';
      property.value = 'SCORM';
      property.description = 'Export format';

      expect(property.value).toBe('SCORM');
    });

    it('should represent a JSON object property', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'projectSettings';
      property.value = JSON.stringify({
        width: 1024,
        height: 768,
        responsive: true,
      });

      const parsed = JSON.parse(property.value);
      expect(parsed.width).toBe(1024);
      expect(parsed.responsive).toBe(true);
    });

    it('should represent a boolean property as string', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'isPublished';
      property.value = 'true';

      expect(property.value).toBe('true');
      expect(property.value === 'true').toBe(true);
    });
  });

  describe('Lifecycle Management', () => {
    it('should maintain timestamps across updates', async () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'testKey';
      property.value = 'initialValue';

      // Simulate insert
      property.setCreatedAt();
      const initialCreatedAt = property.createdAt;
      const initialUpdatedAt = property.updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate update
      property.value = 'updatedValue';
      property.setUpdatedAt();

      // createdAt should not change
      expect(property.createdAt).toBe(initialCreatedAt);
      // updatedAt should be newer
      expect(property.updatedAt!.getTime()).toBeGreaterThan(
        initialUpdatedAt!.getTime(),
      );
    });

    it('should handle soft delete via isActive flag', () => {
      const property = new OdePropertiesSync();
      property.odeSessionId = 'session-123';
      property.key = 'testKey';
      property.value = 'testValue';
      property.setCreatedAt();

      // Initially active
      expect(property.isActive).toBe(true);

      // Soft delete
      property.isActive = false;

      expect(property.isActive).toBe(false);
      expect(property.value).toBe('testValue'); // Data still present
    });
  });
});
