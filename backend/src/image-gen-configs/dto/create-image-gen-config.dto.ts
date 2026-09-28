import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateImageGenConfigDto {
  @ApiProperty({ example: 'flux-dev-standard' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'fal-ai/flux/dev', required: false })
  @IsOptional()
  @IsString()
  // fal.subscribe lee el id como owner/app: sin `fal-ai/` responde 404.
  @Matches(/^fal-ai\/[\w.-]+(\/[\w.-]+)*$/, {
    message: 'model debe ser un id de fal.ai, p. ej. fal-ai/nano-banana/edit',
  })
  model?: string;

  @ApiProperty({ example: { steps: 30, cfg_scale: 7 }, required: false })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
