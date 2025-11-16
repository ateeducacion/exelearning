import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PagesController],
})
export class PagesModule {}
