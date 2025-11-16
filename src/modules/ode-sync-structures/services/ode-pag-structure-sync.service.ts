import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdePagStructureSync } from '../../../entities/ode-pag-structure-sync.entity';
import { OdePagStructureSyncProperties } from '../../../entities/ode-pag-structure-sync-properties.entity';

export interface CreatePagStructureDto {
  odeSessionId: string;
  odePageId: string;
  odeBlockId: string;
  odeParentBlockId?: string | null;
  blockName: string;
  iconName?: string | null;
  odePagStructureSyncOrder: number;
  odePagStructureSyncId?: number | null;
  odeNavStructureSyncId: number;
  properties?: Array<{
    key: string;
    value: string;
    description?: string | null;
    heritable?: boolean;
  }>;
}

/**
 * OdePagStructureSyncService
 * Service for managing page content blocks structure
 *
 * Provides CRUD operations for content blocks within pages
 */
@Injectable()
export class OdePagStructureSyncService {
  constructor(
    @InjectRepository(OdePagStructureSync)
    private readonly pagStructureRepository: Repository<OdePagStructureSync>,
    @InjectRepository(OdePagStructureSyncProperties)
    private readonly pagPropertiesRepository: Repository<OdePagStructureSyncProperties>,
  ) {}

  /**
   * Create a new page structure block with properties
   */
  async create(dto: CreatePagStructureDto): Promise<OdePagStructureSync> {
    const pagStructure = this.pagStructureRepository.create({
      odeSessionId: dto.odeSessionId,
      odePageId: dto.odePageId,
      odeBlockId: dto.odeBlockId,
      odeParentBlockId: dto.odeParentBlockId || null,
      blockName: dto.blockName,
      iconName: dto.iconName || null,
      odePagStructureSyncOrder: dto.odePagStructureSyncOrder,
      odePagStructureSyncId: dto.odePagStructureSyncId || null,
      odeNavStructureSyncId: dto.odeNavStructureSyncId,
      odePagStructureSyncProperties: dto.properties
        ? dto.properties.map((prop) =>
            this.pagPropertiesRepository.create({
              key: prop.key,
              value: prop.value,
              description: prop.description || null,
              heritable: prop.heritable || false,
            }),
          )
        : [],
    });

    return this.pagStructureRepository.save(pagStructure);
  }

  /**
   * Create multiple page structure blocks in bulk (transaction)
   */
  async createBulk(
    dtos: CreatePagStructureDto[],
  ): Promise<OdePagStructureSync[]> {
    const pagStructures = dtos.map((dto) =>
      this.pagStructureRepository.create({
        odeSessionId: dto.odeSessionId,
        odePageId: dto.odePageId,
        odeBlockId: dto.odeBlockId,
        odeParentBlockId: dto.odeParentBlockId || null,
        blockName: dto.blockName,
        iconName: dto.iconName || null,
        odePagStructureSyncOrder: dto.odePagStructureSyncOrder,
        odePagStructureSyncId: dto.odePagStructureSyncId || null,
        odeNavStructureSyncId: dto.odeNavStructureSyncId,
        odePagStructureSyncProperties: dto.properties
          ? dto.properties.map((prop) =>
              this.pagPropertiesRepository.create({
                key: prop.key,
                value: prop.value,
                description: prop.description || null,
                heritable: prop.heritable || false,
              }),
            )
          : [],
      }),
    );

    return this.pagStructureRepository.save(pagStructures);
  }

  /**
   * Find all page structure blocks for a session
   */
  async findBySessionId(odeSessionId: string): Promise<OdePagStructureSync[]> {
    return this.pagStructureRepository.find({
      where: { odeSessionId, isActive: true },
      relations: ['odePagStructureSyncProperties'],
      order: { odePagStructureSyncOrder: 'ASC' },
    });
  }

  /**
   * Find all blocks for a specific page
   */
  async findByPageId(
    odeSessionId: string,
    odePageId: string,
  ): Promise<OdePagStructureSync[]> {
    return this.pagStructureRepository.find({
      where: { odeSessionId, odePageId, isActive: true },
      relations: ['odePagStructureSyncProperties'],
      order: { odePagStructureSyncOrder: 'ASC' },
    });
  }

  /**
   * Find all blocks associated with a navigation structure ID
   */
  async findByNavStructureId(
    odeNavStructureSyncId: number,
  ): Promise<OdePagStructureSync[]> {
    return this.pagStructureRepository.find({
      where: { odeNavStructureSyncId, isActive: true },
      relations: ['odePagStructureSyncProperties'],
      order: { odePagStructureSyncOrder: 'ASC' },
    });
  }

  /**
   * Find a single block by ID
   */
  async findById(id: number): Promise<OdePagStructureSync | null> {
    return this.pagStructureRepository.findOne({
      where: { id, isActive: true },
      relations: ['odePagStructureSyncProperties'],
    });
  }

  /**
   * Find block by block ID
   */
  async findByBlockId(
    odeSessionId: string,
    odeBlockId: string,
  ): Promise<OdePagStructureSync | null> {
    return this.pagStructureRepository.findOne({
      where: { odeSessionId, odeBlockId, isActive: true },
      relations: ['odePagStructureSyncProperties'],
    });
  }

  /**
   * Update block order
   */
  async updateOrder(id: number, newOrder: number): Promise<OdePagStructureSync> {
    const block = await this.pagStructureRepository.findOneByOrFail({ id });
    block.odePagStructureSyncOrder = newOrder;
    return this.pagStructureRepository.save(block);
  }

  /**
   * Update block name
   */
  async updateName(id: number, newName: string): Promise<OdePagStructureSync> {
    const block = await this.pagStructureRepository.findOneByOrFail({ id });
    block.blockName = newName;
    return this.pagStructureRepository.save(block);
  }

  /**
   * Soft delete block (sets isActive = false)
   */
  async softDelete(id: number): Promise<void> {
    await this.pagStructureRepository.update(id, { isActive: false });
  }

  /**
   * Hard delete block and all children (cascade to components)
   */
  async delete(id: number): Promise<void> {
    await this.pagStructureRepository.delete(id);
  }

  /**
   * Delete all page structure blocks for a session
   */
  async deleteBySessionId(odeSessionId: string): Promise<void> {
    await this.pagStructureRepository.delete({ odeSessionId });
  }

  /**
   * Delete all blocks for a specific page
   */
  async deleteByPageId(odeSessionId: string, odePageId: string): Promise<void> {
    await this.pagStructureRepository.delete({ odeSessionId, odePageId });
  }

  /**
   * Count blocks in a session
   */
  async countBySessionId(odeSessionId: string): Promise<number> {
    return this.pagStructureRepository.count({
      where: { odeSessionId, isActive: true },
    });
  }

  /**
   * Count blocks in a specific page
   */
  async countByPageId(odeSessionId: string, odePageId: string): Promise<number> {
    return this.pagStructureRepository.count({
      where: { odeSessionId, odePageId, isActive: true },
    });
  }

  /**
   * Get heritable properties from block (for child components)
   */
  async getHeritableProperties(
    id: number,
  ): Promise<OdePagStructureSyncProperties[]> {
    const block = await this.pagStructureRepository.findOne({
      where: { id, isActive: true },
      relations: ['odePagStructureSyncProperties'],
    });

    if (!block) return [];

    return block.odePagStructureSyncProperties.filter((prop) =>
      prop.isHeritable(),
    );
  }

  /**
   * Mark all structures as "clean" by setting timestamps to a baseline
   * Used after initial import to establish change tracking baseline
   */
  async markAsClean(odeSessionId: string, baselineDate: Date): Promise<void> {
    await this.pagStructureRepository
      .createQueryBuilder()
      .update(OdePagStructureSync)
      .set({
        createdAt: baselineDate,
        updatedAt: baselineDate,
      })
      .where('ode_session_id = :odeSessionId', { odeSessionId })
      .execute();

    // Also update properties
    const pagIds = await this.pagStructureRepository
      .createQueryBuilder('pag')
      .select('pag.id')
      .where('pag.ode_session_id = :odeSessionId', { odeSessionId })
      .getRawMany();

    if (pagIds.length > 0) {
      const ids = pagIds.map((row) => row.id);
      await this.pagPropertiesRepository
        .createQueryBuilder()
        .update(OdePagStructureSyncProperties)
        .set({
          createdAt: baselineDate,
          updatedAt: baselineDate,
        })
        .where('ode_pag_structure_sync_id IN (:...ids)', { ids })
        .execute();
    }
  }
}
