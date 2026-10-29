import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePrintProjectDto {
  @ApiPropertyOptional({ example: 'Max acuarela' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Línea de pedido a vincular' })
  @IsString()
  @IsOptional()
  orderItemId?: string;
}

export class UpdatePrintProjectDto {
  @ApiProperty({ example: 'Max acuarela' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}

export class LinkPrintProjectDto {
  @ApiProperty({ description: 'Línea de pedido a vincular' })
  @IsString()
  @IsNotEmpty()
  orderItemId: string;
}

export class SetGenerationSourceDto {
  @ApiProperty({ description: 'Generación a usar como imagen de origen' })
  @IsString()
  @IsNotEmpty()
  generationId: string;
}
