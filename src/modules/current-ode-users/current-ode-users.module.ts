import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentOdeUsers } from '../../entities/current-ode-users.entity';
import { CurrentOdeUsersService } from './current-ode-users.service';

/**
 * CurrentOdeUsersModule
 * Manages active user sessions in ODE projects
 */
@Module({
  imports: [TypeOrmModule.forFeature([CurrentOdeUsers])],
  providers: [CurrentOdeUsersService],
  exports: [CurrentOdeUsersService, TypeOrmModule],
})
export class CurrentOdeUsersModule {}
