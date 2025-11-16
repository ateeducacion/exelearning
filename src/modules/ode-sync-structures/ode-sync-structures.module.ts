import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdeNavStructureSync } from '../../entities/ode-nav-structure-sync.entity';
import { OdeNavStructureSyncProperties } from '../../entities/ode-nav-structure-sync-properties.entity';
import { OdePagStructureSync } from '../../entities/ode-pag-structure-sync.entity';
import { OdePagStructureSyncProperties } from '../../entities/ode-pag-structure-sync-properties.entity';
import { OdeComponentsSync } from '../../entities/ode-components-sync.entity';
import { OdeComponentsSyncProperties } from '../../entities/ode-components-sync-properties.entity';

/**
 * OdeSyncStructuresModule
 * Manages hierarchical navigation and page content structure entities
 *
 * This module groups together:
 * - OdeNavStructureSync: Navigation pages hierarchy
 * - OdeNavStructureSyncProperties: Page-level configuration
 * - OdePagStructureSync: Content blocks within pages
 * - OdePagStructureSyncProperties: Block-level configuration
 * - OdeComponentsSync: iDevice components within blocks
 * - OdeComponentsSyncProperties: Component-level configuration
 *
 * These entities form a cohesive system for managing the complete
 * hierarchical structure of educational content (Nav → Pages → Blocks → Components).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OdeNavStructureSync,
      OdeNavStructureSyncProperties,
      OdePagStructureSync,
      OdePagStructureSyncProperties,
      OdeComponentsSync,
      OdeComponentsSyncProperties,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class OdeSyncStructuresModule {}
