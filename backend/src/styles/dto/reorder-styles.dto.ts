import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReorderStylesDto {
  @ApiProperty({
    description:
      'Ids de estilos en el orden deseado (el índice es su sortOrder)',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  ids: string[];
}
