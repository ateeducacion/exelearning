import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeComponentsSync } from '../../../entities/ode-components-sync.entity';
import { OdeComponentsSyncProperties } from '../../../entities/ode-components-sync-properties.entity';

export interface CreateComponentDto {
  odeSessionId: string;
  odePageId: string;
  odeBlockId: string;
  odeIdeviceId: string;
  odeIdeviceTypeName: string;
  htmlView?: string | null;
  jsonProperties?: string | null;
  odeComponentsSyncOrder: number;
  odePagStructureSyncId: number;
  properties?: Array<{
    key: string;
    value: string;
    description?: string | null;
  }>;
}

/**
 * OdeComponentsSyncService
 * Service for managing iDevice components within blocks
 *
 * Provides CRUD operations for content components (iDevices)
 */
@Injectable()
export class OdeComponentsSyncService {
  constructor(
    @InjectRepository(OdeComponentsSync)
    private readonly componentsRepository: Repository<OdeComponentsSync>,
    @InjectRepository(OdeComponentsSyncProperties)
    private readonly componentPropertiesRepository: Repository<OdeComponentsSyncProperties>,
  ) {}

  /**
   * Create a new component with properties
   */
  async create(dto: CreateComponentDto): Promise<OdeComponentsSync> {
    const component = this.componentsRepository.create({
      odeSessionId: dto.odeSessionId,
      odePageId: dto.odePageId,
      odeBlockId: dto.odeBlockId,
      odeIdeviceId: dto.odeIdeviceId,
      odeIdeviceTypeName: dto.odeIdeviceTypeName,
      htmlView: dto.htmlView || null,
      jsonProperties: dto.jsonProperties || null,
      odeComponentsSyncOrder: dto.odeComponentsSyncOrder,
      odePagStructureSyncId: dto.odePagStructureSyncId,
      odeComponentsSyncProperties: dto.properties
        ? dto.properties.map((prop) =>
            this.componentPropertiesRepository.create({
              key: prop.key,
              value: prop.value,
              description: prop.description || null,
            }),
          )
        : [],
    });

    return this.componentsRepository.save(component);
  }

  /**
   * Create multiple components in bulk (transaction)
   */
  async createBulk(dtos: CreateComponentDto[]): Promise<OdeComponentsSync[]> {
    const components = dtos.map((dto) =>
      this.componentsRepository.create({
        odeSessionId: dto.odeSessionId,
        odePageId: dto.odePageId,
        odeBlockId: dto.odeBlockId,
        odeIdeviceId: dto.odeIdeviceId,
        odeIdeviceTypeName: dto.odeIdeviceTypeName,
        htmlView: dto.htmlView || null,
        jsonProperties: dto.jsonProperties || null,
        odeComponentsSyncOrder: dto.odeComponentsSyncOrder,
        odePagStructureSyncId: dto.odePagStructureSyncId,
        odeComponentsSyncProperties: dto.properties
          ? dto.properties.map((prop) =>
              this.componentPropertiesRepository.create({
                key: prop.key,
                value: prop.value,
                description: prop.description || null,
              }),
            )
          : [],
      }),
    );

    return this.componentsRepository.save(components);
  }

  /**
   * Find all components for a session
   */
  async findBySessionId(odeSessionId: string): Promise<OdeComponentsSync[]> {
    return this.componentsRepository.find({
      where: { odeSessionId, isActive: true },
      relations: ['odeComponentsSyncProperties'],
      order: { odeComponentsSyncOrder: 'ASC' },
    });
  }

  /**
   * Find all components for a specific page
   */
  async findByPageId(
    odeSessionId: string,
    odePageId: string,
  ): Promise<OdeComponentsSync[]> {
    return this.componentsRepository.find({
      where: { odeSessionId, odePageId, isActive: true },
      relations: ['odeComponentsSyncProperties'],
      order: { odeComponentsSyncOrder: 'ASC' },
    });
  }

  /**
   * Find all components within a specific block
   */
  async findByBlockId(
    odeSessionId: string,
    odeBlockId: string,
  ): Promise<OdeComponentsSync[]> {
    return this.componentsRepository.find({
      where: { odeSessionId, odeBlockId, isActive: true },
      relations: ['odeComponentsSyncProperties'],
      order: { odeComponentsSyncOrder: 'ASC' },
    });
  }

  /**
   * Find all components associated with a page structure ID
   */
  async findByPagStructureId(
    odePagStructureSyncId: number,
  ): Promise<OdeComponentsSync[]> {
    return this.componentsRepository.find({
      where: { odePagStructureSyncId, isActive: true },
      relations: ['odeComponentsSyncProperties'],
      order: { odeComponentsSyncOrder: 'ASC' },
    });
  }

  /**
   * Find a single component by ID
   */
  async findById(id: number): Promise<OdeComponentsSync | null> {
    return this.componentsRepository.findOne({
      where: { id, isActive: true },
      relations: ['odeComponentsSyncProperties'],
    });
  }

  /**
   * Find component by iDevice ID
   */
  async findByIdeviceId(
    odeSessionId: string,
    odeIdeviceId: string,
  ): Promise<OdeComponentsSync | null> {
    return this.componentsRepository.findOne({
      where: { odeSessionId, odeIdeviceId, isActive: true },
      relations: ['odeComponentsSyncProperties'],
    });
  }

  /**
   * Update component HTML view
   */
  async updateHtmlView(id: number, htmlView: string): Promise<OdeComponentsSync> {
    const component = await this.componentsRepository.findOneByOrFail({ id });
    component.htmlView = htmlView;
    return this.componentsRepository.save(component);
  }

  /**
   * Update component JSON properties
   */
  async updateJsonProperties(
    id: number,
    jsonProperties: string,
  ): Promise<OdeComponentsSync> {
    const component = await this.componentsRepository.findOneByOrFail({ id });
    component.jsonProperties = jsonProperties;
    return this.componentsRepository.save(component);
  }

  /**
   * Update component order
   */
  async updateOrder(id: number, newOrder: number): Promise<OdeComponentsSync> {
    const component = await this.componentsRepository.findOneByOrFail({ id });
    component.odeComponentsSyncOrder = newOrder;
    return this.componentsRepository.save(component);
  }

  /**
   * Soft delete component (sets isActive = false)
   */
  async softDelete(id: number): Promise<void> {
    await this.componentsRepository.update(id, { isActive: false });
  }

  /**
   * Hard delete component
   */
  async delete(id: number): Promise<void> {
    await this.componentsRepository.delete(id);
  }

  /**
   * Delete all components for a session
   */
  async deleteBySessionId(odeSessionId: string): Promise<void> {
    await this.componentsRepository.delete({ odeSessionId });
  }

  /**
   * Delete all components for a specific page
   */
  async deleteByPageId(odeSessionId: string, odePageId: string): Promise<void> {
    await this.componentsRepository.delete({ odeSessionId, odePageId });
  }

  /**
   * Delete all components within a specific block
   */
  async deleteByBlockId(odeSessionId: string, odeBlockId: string): Promise<void> {
    await this.componentsRepository.delete({ odeSessionId, odeBlockId });
  }

  /**
   * Count components in a session
   */
  async countBySessionId(odeSessionId: string): Promise<number> {
    return this.componentsRepository.count({
      where: { odeSessionId, isActive: true },
    });
  }

  /**
   * Count components in a specific page
   */
  async countByPageId(odeSessionId: string, odePageId: string): Promise<number> {
    return this.componentsRepository.count({
      where: { odeSessionId, odePageId, isActive: true },
    });
  }

  /**
   * Count components within a specific block
   */
  async countByBlockId(odeSessionId: string, odeBlockId: string): Promise<number> {
    return this.componentsRepository.count({
      where: { odeSessionId, odeBlockId, isActive: true },
    });
  }

  /**
   * Get components by type (iDevice class name)
   */
  async findByType(
    odeSessionId: string,
    odeIdeviceTypeName: string,
  ): Promise<OdeComponentsSync[]> {
    return this.componentsRepository.find({
      where: { odeSessionId, odeIdeviceTypeName, isActive: true },
      relations: ['odeComponentsSyncProperties'],
      order: { odeComponentsSyncOrder: 'ASC' },
    });
  }

  /**
   * Mark all structures as "clean" by setting timestamps to a baseline
   * Used after initial import to establish change tracking baseline
   */
  async markAsClean(odeSessionId: string, baselineDate: Date): Promise<void> {
    await this.componentsRepository
      .createQueryBuilder()
      .update(OdeComponentsSync)
      .set({
        createdAt: baselineDate,
        updatedAt: baselineDate,
      })
      .where('ode_session_id = :odeSessionId', { odeSessionId })
      .execute();

    // Also update properties
    const componentIds = await this.componentsRepository
      .createQueryBuilder('comp')
      .select('comp.id')
      .where('comp.ode_session_id = :odeSessionId', { odeSessionId })
      .getRawMany();

    if (componentIds.length > 0) {
      const ids = componentIds.map((row) => row.id);
      await this.componentPropertiesRepository
        .createQueryBuilder()
        .update(OdeComponentsSyncProperties)
        .set({
          createdAt: baselineDate,
          updatedAt: baselineDate,
        })
        .where('ode_components_sync_id IN (:...ids)', { ids })
        .execute();
    }
  }
}
