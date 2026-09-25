import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class SetLaunchProductDto {
  @ApiProperty({
    description:
      'ID del producto único del lanzamiento, válido para cualquier estilo activo. null para desasignar.',
    nullable: true,
    required: false,
    example: '3f2a…',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  productId: string | null;
}
