import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeNavStructureSync } from '../../../entities/ode-nav-structure-sync.entity';
import { OdeNavStructureSyncProperties } from '../../../entities/ode-nav-structure-sync-properties.entity';

export interface CreateNavStructureDto {
  odeSessionId: string;
  odePageId: string;
  pageName: string;
  odeNavStructureSyncOrder: number;
  odeParentPageId?: string | null;
  odeNavStructureSyncId?: number | null;
  properties?: Array<{
    key: string;
    value: string;
    description?: string | null;
  }>;
}

export interface NavStructureTreeNode {
  id: number;
  odePageId: string;
  pageName: string;
  order: number;
  isIndex: boolean;
  title: string | null;
  properties: OdeNavStructureSyncProperties[];
  children: NavStructureTreeNode[];
}

/**
 * OdeNavStructureSyncService
 * Service for managing navigation structure (page hierarchy)
 *
 * Provides CRUD operations and tree building for navigation pages
 */
@Injectable()
export class OdeNavStructureSyncService {
  constructor(
    @InjectRepository(OdeNavStructureSync)
    private readonly navStructureRepository: Repository<OdeNavStructureSync>,
    @InjectRepository(OdeNavStructureSyncProperties)
    private readonly navPropertiesRepository: Repository<OdeNavStructureSyncProperties>,
  ) {}

  /**
   * Create a new navigation structure node with properties
   */
  async create(dto: CreateNavStructureDto): Promise<OdeNavStructureSync> {
    const navStructure = this.navStructureRepository.create({
      odeSessionId: dto.odeSessionId,
      odePageId: dto.odePageId,
      pageName: dto.pageName,
      odeNavStructureSyncOrder: dto.odeNavStructureSyncOrder,
      odeParentPageId: dto.odeParentPageId || null,
      odeNavStructureSyncId: dto.odeNavStructureSyncId || null,
      odeNavStructureSyncProperties: dto.properties
        ? dto.properties.map((prop) =>
            this.navPropertiesRepository.create({
              key: prop.key,
              value: prop.value,
              description: prop.description || null,
            }),
          )
        : [],
    });

    return this.navStructureRepository.save(navStructure);
  }

  /**
   * Create multiple navigation nodes in bulk (transaction)
   */
  async createBulk(
    dtos: CreateNavStructureDto[],
  ): Promise<OdeNavStructureSync[]> {
    const navStructures = dtos.map((dto) =>
      this.navStructureRepository.create({
        odeSessionId: dto.odeSessionId,
        odePageId: dto.odePageId,
        pageName: dto.pageName,
        odeNavStructureSyncOrder: dto.odeNavStructureSyncOrder,
        odeParentPageId: dto.odeParentPageId || null,
        odeNavStructureSyncId: dto.odeNavStructureSyncId || null,
        odeNavStructureSyncProperties: dto.properties
          ? dto.properties.map((prop) =>
              this.navPropertiesRepository.create({
                key: prop.key,
                value: prop.value,
                description: prop.description || null,
              }),
            )
          : [],
      }),
    );

    return this.navStructureRepository.save(navStructures);
  }

  /**
   * Find all navigation nodes for a session
   */
  async findBySessionId(odeSessionId: string): Promise<OdeNavStructureSync[]> {
    return this.navStructureRepository.find({
      where: { odeSessionId, isActive: true },
      relations: ['odeNavStructureSyncProperties'],
      order: { odeNavStructureSyncOrder: 'ASC' },
    });
  }

  /**
   * Find a single navigation node by ID
   */
  async findById(id: number): Promise<OdeNavStructureSync | null> {
    return this.navStructureRepository.findOne({
      where: { id, isActive: true },
      relations: ['odeNavStructureSyncProperties'],
    });
  }

  /**
   * Find navigation node by page ID
   */
  async findByPageId(
    odeSessionId: string,
    odePageId: string,
  ): Promise<OdeNavStructureSync | null> {
    return this.navStructureRepository.findOne({
      where: { odeSessionId, odePageId, isActive: true },
      relations: ['odeNavStructureSyncProperties'],
    });
  }

  /**
   * Build hierarchical tree structure from flat navigation records
   */
  async buildTree(odeSessionId: string): Promise<NavStructureTreeNode[]> {
    const allNodes = await this.findBySessionId(odeSessionId);
    const nodeMap = new Map<number, NavStructureTreeNode>();
    const rootNodes: NavStructureTreeNode[] = [];

    // Convert to tree nodes
    for (const node of allNodes) {
      const treeNode: NavStructureTreeNode = {
        id: node.id,
        odePageId: node.odePageId,
        pageName: node.pageName,
        order: node.odeNavStructureSyncOrder,
        isIndex: node.isIndex(),
        title: node.getTitle(),
        properties: node.odeNavStructureSyncProperties,
        children: [],
      };
      nodeMap.set(node.id, treeNode);
    }

    // Build parent-child relationships
    for (const node of allNodes) {
      const treeNode = nodeMap.get(node.id);
      if (!treeNode) continue;

      if (node.odeNavStructureSyncId === null) {
        // Root node
        rootNodes.push(treeNode);
      } else {
        // Child node - find parent
        const parentNode = nodeMap.get(node.odeNavStructureSyncId);
        if (parentNode) {
          parentNode.children.push(treeNode);
        }
      }
    }

    // Sort children by order
    const sortChildren = (nodes: NavStructureTreeNode[]) => {
      nodes.sort((a, b) => a.order - b.order);
      nodes.forEach((node) => sortChildren(node.children));
    };
    sortChildren(rootNodes);

    return rootNodes;
  }

  /**
   * Update navigation node order
   */
  async updateOrder(
    id: number,
    newOrder: number,
  ): Promise<OdeNavStructureSync> {
    const node = await this.navStructureRepository.findOneByOrFail({ id });
    node.odeNavStructureSyncOrder = newOrder;
    return this.navStructureRepository.save(node);
  }

  /**
   * Update navigation node name
   */
  async updateName(id: number, newName: string): Promise<OdeNavStructureSync> {
    const node = await this.navStructureRepository.findOneByOrFail({ id });
    node.pageName = newName;
    return this.navStructureRepository.save(node);
  }

  /**
   * Soft delete navigation node (sets isActive = false)
   */
  async softDelete(id: number): Promise<void> {
    await this.navStructureRepository.update(id, { isActive: false });
  }

  /**
   * Hard delete navigation node and all children (cascade)
   */
  async delete(id: number): Promise<void> {
    await this.navStructureRepository.delete(id);
  }

  /**
   * Delete all navigation nodes for a session
   */
  async deleteBySessionId(odeSessionId: string): Promise<void> {
    await this.navStructureRepository.delete({ odeSessionId });
  }

  /**
   * Count navigation nodes in a session
   */
  async countBySessionId(odeSessionId: string): Promise<number> {
    return this.navStructureRepository.count({
      where: { odeSessionId, isActive: true },
    });
  }

  /**
   * Mark all structures as "clean" by setting timestamps to a baseline
   * Used after initial import to establish change tracking baseline
   */
  async markAsClean(odeSessionId: string, baselineDate: Date): Promise<void> {
    await this.navStructureRepository
      .createQueryBuilder()
      .update(OdeNavStructureSync)
      .set({
        createdAt: baselineDate,
        updatedAt: baselineDate,
      })
      .where('ode_session_id = :odeSessionId', { odeSessionId })
      .execute();

    // Also update properties
    const navIds = await this.navStructureRepository
      .createQueryBuilder('nav')
      .select('nav.id')
      .where('nav.ode_session_id = :odeSessionId', { odeSessionId })
      .getRawMany();

    if (navIds.length > 0) {
      const ids = navIds.map((row) => row.id);
      await this.navPropertiesRepository
        .createQueryBuilder()
        .update(OdeNavStructureSyncProperties)
        .set({
          createdAt: baselineDate,
          updatedAt: baselineDate,
        })
        .where('ode_nav_structure_sync_id IN (:...ids)', { ids })
        .execute();
    }
  }
}
