import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateVisionConfigDto {
  @ApiProperty({ example: 'watercolor-gemini-flash' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'google/gemini-2.5-flash', required: false })
  @IsOptional()
  @IsString()
  // Va como `model` a fal `openrouter/router/vision`: debe ser un modelo de
  // OpenRouter, no la ruta del endpoint ni un modelo de fal (OpenRouter da 400).
  @Matches(/^(?!openrouter\/router\b|fal-ai\/)[\w.-]+\/[\w.:-]+$/, {
    message:
      'visionModel debe ser un modelo de OpenRouter, p. ej. google/gemini-2.5-flash',
  })
  visionModel?: string;

  @ApiProperty({ example: 0.7, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  visionTemperature?: number;

  @ApiProperty({
    description:
      'System prompt enviado al VLM. Si es null, se usa el default de DEFAULT_VISION_SYSTEM_PROMPT en el servicio.',
    required: false,
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiProperty({
    example: 400,
    description:
      'Límite de tokens de salida del VLM. Si es null, se usa el default (400) en el servicio.',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
