import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  EntryDto,
  CarryoverDto,
  CopyTagDto,
  OrderTagsDto,
  MonthQuery,
  ProfileDto,
  TagDto,
  UpdateEntryDto,
} from '../models/finance.dto';
import { FinanceService } from '../services/finance.service';
@ApiTags('Finance')
@Controller()
export class FinanceController {
  constructor(private readonly service: FinanceService) {}
  @Get('dashboard')
  @ApiOperation({ summary: 'Monthly entries, totals, ordered categories and six-month history' })
  dashboard(@Query() q: MonthQuery) {
    return this.service.dashboard(q.month);
  }
  @Put('carryover')
  @ApiOperation({ summary: 'Enable or disable a live opening balance for the selected month' })
  carryover(@Query() q: MonthQuery, @Body() dto: CarryoverDto) {
    return this.service.setCarryover(q.month, dto.enabled);
  }
  @Post('entries') createEntry(@Body() dto: EntryDto) {
    return this.service.createEntry(dto);
  }
  @Patch('entries/:id') updateEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.service.updateEntry(id, dto);
  }
  @Delete('entries/:id') deleteEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteEntry(id);
  }
  @Delete('recurrences/:id')
  @ApiOperation({ summary: 'Stop a series from the selected month; previous months remain' })
  stop(@Param('id', ParseUUIDPipe) id: string, @Query() q: MonthQuery) {
    return this.service.stopRecurrence(id, q.month);
  }
  @Post('tags') createTag(@Body() dto: TagDto) {
    return this.service.saveTag(dto);
  }
  @Put('tags/order') orderTags(@Body() dto: OrderTagsDto) {
    return this.service.orderTags(dto);
  }
  @Post('tags/:id/copy') copyTag(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CopyTagDto) {
    return this.service.copyTag(id, dto.kind);
  }
  @Put('tags/:id') updateTag(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TagDto) {
    return this.service.saveTag(dto, id);
  }
  @Delete('tags/:id') deleteTag(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteTag(id);
  }
  @Put('profile') profile(@Body() dto: ProfileDto) {
    return this.service.saveProfile(dto);
  }
}
