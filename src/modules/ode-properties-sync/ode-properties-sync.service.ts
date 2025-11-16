import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdePropertiesSync } from '../../entities/ode-properties-sync.entity';

/**
 * OdePropertiesSyncService
 * Service for managing ODE/project properties (key-value store per session)
 */
@Injectable()
export class OdePropertiesSyncService {
  constructor(
    @InjectRepository(OdePropertiesSync)
    private readonly odePropertiesSyncRepository: Repository<OdePropertiesSync>,
  ) {}

  /**
   * Get all properties for an ODE session
   * @param odeSessionId ODE Session ID
   * @returns Array of ODE properties
   */
  async findAllBySessionId(odeSessionId: string): Promise<OdePropertiesSync[]> {
    return this.odePropertiesSyncRepository.find({
      where: { odeSessionId, isActive: true },
      order: { key: 'ASC' },
    });
  }

  /**
   * Get a specific property value for an ODE session
   * @param odeSessionId ODE Session ID
   * @param key Property key
   * @returns OdePropertiesSync or null
   */
  async findBySessionIdAndKey(
    odeSessionId: string,
    key: string,
  ): Promise<OdePropertiesSync | null> {
    return this.odePropertiesSyncRepository.findOne({
      where: { odeSessionId, key, isActive: true },
    });
  }

  /**
   * Get properties as a key-value object
   * @param odeSessionId ODE Session ID
   * @returns Object with property keys and values
   */
  async getPropertiesObject(
    odeSessionId: string,
  ): Promise<Record<string, string>> {
    const properties = await this.findAllBySessionId(odeSessionId);

    return properties.reduce(
      (acc, prop) => {
        acc[prop.key] = prop.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /**
   * Create or update a property
   * @param odeSessionId ODE Session ID
   * @param key Property key
   * @param value Property value
   * @param description Optional description
   * @returns Created/updated property
   */
  async upsertProperty(
    odeSessionId: string,
    key: string,
    value: string,
    description?: string,
  ): Promise<OdePropertiesSync> {
    const existing = await this.odePropertiesSyncRepository.findOne({
      where: { odeSessionId, key },
    });

    if (existing) {
      existing.value = value;
      if (description !== undefined) {
        existing.description = description;
      }
      existing.isActive = true;
      return this.odePropertiesSyncRepository.save(existing);
    } else {
      const newProperty = this.odePropertiesSyncRepository.create({
        odeSessionId,
        key,
        value,
        description: description || null,
      });
      return this.odePropertiesSyncRepository.save(newProperty);
    }
  }

  /**
   * Update multiple properties at once
   * @param odeSessionId ODE Session ID
   * @param properties Object with key-value pairs
   * @returns Array of updated properties
   */
  async upsertMultipleProperties(
    odeSessionId: string,
    properties: Record<string, string>,
  ): Promise<OdePropertiesSync[]> {
    const results: OdePropertiesSync[] = [];

    for (const [key, value] of Object.entries(properties)) {
      const updated = await this.upsertProperty(odeSessionId, key, value);
      results.push(updated);
    }

    return results;
  }

  /**
   * Delete a property (soft delete by setting isActive = false)
   * @param odeSessionId ODE Session ID
   * @param key Property key
   * @returns True if deleted, false if not found
   */
  async deleteProperty(odeSessionId: string, key: string): Promise<boolean> {
    const property = await this.odePropertiesSyncRepository.findOne({
      where: { odeSessionId, key, isActive: true },
    });

    if (!property) {
      return false;
    }

    property.isActive = false;
    await this.odePropertiesSyncRepository.save(property);
    return true;
  }

  /**
   * Delete all properties for an ODE session (soft delete)
   * @param odeSessionId ODE Session ID
   * @returns Number of properties deleted
   */
  async deleteAllBySessionId(odeSessionId: string): Promise<number> {
    const properties = await this.findAllBySessionId(odeSessionId);

    for (const prop of properties) {
      prop.isActive = false;
      await this.odePropertiesSyncRepository.save(prop);
    }

    return properties.length;
  }
}
