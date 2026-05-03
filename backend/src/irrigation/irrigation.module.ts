import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IrrigationService } from './irrigation.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [IrrigationService],
  exports: [IrrigationService],
})
export class IrrigationModule {}
