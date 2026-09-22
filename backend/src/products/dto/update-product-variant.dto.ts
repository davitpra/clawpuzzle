import { PrintConfigDto } from './print-config.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class UpdateProductVariantDto {
  @ApiPropertyOptional({ description: 'Format UUID to assign' })
  @IsUUID()
  @IsOptional()
  formatId?: string;

  @ApiPropertyOptional({
    description: 'Activate or deactivate the variant link',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Especificación de impresión de esta variante',
    type: PrintConfigDto,
  })
  @ValidateNested()
  @Type(() => PrintConfigDto)
  @IsOptional()
  printConfig?: PrintConfigDto;
}
