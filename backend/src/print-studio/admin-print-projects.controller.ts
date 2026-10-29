import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrintConfigDto } from '../products/dto/print-config.dto';
import { EnhanceDto } from './dto/enhance.dto';
import {
  CreatePrintProjectDto,
  LinkPrintProjectDto,
  SetGenerationSourceDto,
  UpdatePrintProjectDto,
} from './dto/print-project.dto';
import { PrintProjectsService } from './print-projects.service';
import { PrintProjectEnhancementService } from './print-project-enhancement.service';

// Cloudinary (plan gratuito) rechaza imágenes de más de 10 MB. Validamos aquí
// para devolver un mensaje claro en vez de un 500 genérico.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@ApiTags('admin-print-projects')
@ApiBearerAuth()
@Controller('admin/print-projects')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminPrintProjectsController {
  constructor(
    private readonly projects: PrintProjectsService,
    private readonly enhancement: PrintProjectEnhancementService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List print projects (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('q') q?: string,
  ) {
    return this.projects.list({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      q: q?.trim() || undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a print project, optionally linked' })
  create(@Body() dto: CreatePrintProjectDto, @CurrentUser() user?: JwtPayload) {
    return this.projects.create(dto, user?.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a print project' })
  get(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a print project' })
  rename(@Param('id') id: string, @Body() dto: UpdatePrintProjectDto) {
    return this.projects.rename(id, dto.title);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a print project and its own assets' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  @Post(':id/source')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload the source image of a print project' })
  uploadSource(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/'))
      throw new BadRequestException('File must be an image');
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      throw new BadRequestException(
        `La imagen pesa ${mb} MB y supera el máximo de 10 MB. ` +
          `Súbela como JPEG o reduce su tamaño antes de subirla.`,
      );
    }
    return this.projects.uploadSource(id, file, user?.sub);
  }

  @Put(':id/source/generation')
  @ApiOperation({ summary: 'Use a generation as the source image' })
  setGenerationSource(
    @Param('id') id: string,
    @Body() dto: SetGenerationSourceDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.projects.setGenerationSource(id, dto.generationId, user?.sub);
  }

  @Put(':id/link')
  @ApiOperation({ summary: 'Link the project to an order item' })
  link(
    @Param('id') id: string,
    @Body() dto: LinkPrintProjectDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.projects.link(id, dto.orderItemId, user?.sub);
  }

  @Delete(':id/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink the project (the item keeps its image)' })
  unlink(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.projects.unlink(id, user?.sub);
  }

  @Get(':id/enhance-info')
  @ApiOperation({
    summary: 'Print-readiness info (source, pixel dims, print size, DPI)',
  })
  getEnhanceInfo(@Param('id') id: string) {
    return this.enhancement.getEnhanceInfo(id);
  }

  @Put(':id/print-config')
  @ApiOperation({
    summary: 'Set the print size (overrides the linked variant printConfig)',
  })
  setPrintConfig(
    @Param('id') id: string,
    @Body() cfg: PrintConfigDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.enhancement.setPrintConfig(id, cfg, user?.sub);
  }

  @Delete(':id/print-config')
  @ApiOperation({
    summary: 'Drop the project print size and fall back to the variant/title',
  })
  clearPrintConfig(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.enhancement.setPrintConfig(id, null, user?.sub);
  }

  @Post(':id/enhance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Build and save the print master' })
  enhance(
    @Param('id') id: string,
    @Body() options: EnhanceDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.enhancement.applyEnhance(id, options, user?.sub);
  }

  @Post(':id/enhance/revert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Drop the master and the upscaled base' })
  revert(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.enhancement.revertEnhance(id, user?.sub);
  }
}
