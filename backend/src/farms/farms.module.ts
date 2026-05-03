import { Module } from '@nestjs/common';
import { FarmsService } from './farms.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
