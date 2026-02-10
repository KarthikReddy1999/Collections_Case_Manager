import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AddActionDto } from '../dto/add-action.dto';
import { AssignCaseDto } from '../dto/assign-case.dto';
import { CreateCaseDto } from '../dto/create-case.dto';
import { ListCasesDto } from '../dto/list-cases.dto';
import { CasesService } from './cases.service';

@ApiTags('cases')
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a delinquency case' })
  createCase(@Body() body: CreateCaseDto) {
    return this.casesService.createCase(body);
  }

  @Get()
  @ApiOperation({ summary: 'List cases with filters + pagination' })
  listCases(@Query() query: ListCasesDto) {
    return this.casesService.listCases(query);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  getKpis() {
    return this.casesService.getKpis();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case details' })
  getCase(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.getCaseById(id);
  }

  @Post(':id/actions')
  @ApiOperation({ summary: 'Add action log to a case' })
  addAction(@Param('id', ParseIntPipe) id: number, @Body() body: AddActionDto) {
    return this.casesService.addAction(id, body);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Run rules-based assignment with optional optimistic lock and decision audit' })
  assignCase(@Param('id', ParseIntPipe) id: number, @Body() body: AssignCaseDto) {
    return this.casesService.assignCase(id, body ?? {});
  }

  @Get(':id/notice.pdf')
  @ApiOperation({ summary: 'Generate payment reminder PDF notice' })
  async getNoticePdf(@Param('id', ParseIntPipe) id: number, @Res() response: Response) {
    const pdf = await this.casesService.generateNoticePdf(id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename=case-${id}-notice.pdf`);
    response.send(pdf);
  }
}
