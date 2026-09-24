import { PrintConfigDto } from './print-config.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class LinkVariantDto {
  @ApiProperty({ example: '12345678901234' })
  @IsString()
  @IsNotEmpty()
  shopifyVariantId: string;

  @ApiProperty({ example: '8x10' })
  @IsString()
  @IsNotEmpty()
  shopifyVariantTitle: string;

  @ApiProperty({ description: 'Format UUID to assign' })
  @IsUUID()
  formatId: string;

  @ApiPropertyOptional({
    description:
      'Especificación de impresión de esta variante (tamaño en cm, sangre, DPI mínimo)',
    type: PrintConfigDto,
  })
  @ValidateNested()
  @Type(() => PrintConfigDto)
  @IsOptional()
  printConfig?: PrintConfigDto;
}
