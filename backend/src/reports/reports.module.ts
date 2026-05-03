import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SensorsModule } from '../sensors/sensors.module';

@Module({
  imports: [PrismaModule, SensorsModule],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
