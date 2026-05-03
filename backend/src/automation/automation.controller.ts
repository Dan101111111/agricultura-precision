import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import { AutomationService } from './automation.service';

@Controller('automation/workflows')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('predictions/run')
  async runPredictions(
    @Headers('x-workflow-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
  ) {
    this.automationService.validateSecret(headerSecret ?? querySecret);
    return this.automationService.runPredictionsWorkflow();
  }

  @Post('reports/run')
  async runReports(
    @Headers('x-workflow-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('periodo') periodo?: string,
  ) {
    this.automationService.validateSecret(headerSecret ?? querySecret);
    return this.automationService.runReportsWorkflow(periodo ?? 'semanal');
  }

  @Get('executions')
  async getExecutions(
    @Headers('x-workflow-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('limit') limit?: string,
  ) {
    this.automationService.validateSecret(headerSecret ?? querySecret);
    return this.automationService.getExecutions(limit ? Number(limit) : 20);
  }

  @Post('climate/run-debug')
  async runClimateDebug(
    @Headers('x-workflow-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Body() body?: { userId?: string; loteId?: string },
  ) {
    this.automationService.validateSecret(headerSecret ?? querySecret);
    return this.automationService.runClimateIngestWorkflowDebug(body);
  }
}
