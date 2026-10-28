import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_CROP_ZOOM } from '../print-crop.util';

/** Encuadre del recorte al formato (ver print-crop.util.ts). */
export class PrintCropDto {
  @ApiProperty({ description: 'Centro horizontal (fracción 0–1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @ApiProperty({ description: 'Centro vertical (fracción 0–1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;

  @ApiProperty({
    description: 'Acercamiento sobre "cubrir" (1 = el recorte más grande)',
    minimum: 1,
    maximum: MAX_CROP_ZOOM,
  })
  @IsNumber()
  @Min(1)
  @Max(MAX_CROP_ZOOM)
  zoom: number;
}

/**
 * Options for the image-enhancement pipeline applied to an order item's print
 * image before it goes to print. The pipeline runs a real AI upscale via fal.ai
 * (optional) plus crop/bleed with sharp, storing the result as a flat file.
 */
export class EnhanceDto {
  @ApiProperty({
    description:
      'fal.ai upscale factor (float, 1–8). When provided it takes priority ' +
      'over targetDpi and upscale. Still subject to the 30 MP output safety cap.',
    minimum: 1,
    maximum: 8,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8)
  upscaleFactor?: number;

  @ApiProperty({
    description:
      'AI upscale factor (0 = no upscale, run fal.ai when 2 or 4). ' +
      'Ignored when upscaleFactor or targetDpi is provided.',
    enum: [0, 2, 4],
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 2, 4])
  upscale?: 0 | 2 | 4;

  @ApiProperty({
    description:
      'Target print DPI. When provided, the backend auto-calculates the fal.ai ' +
      'upscale factor needed to reach this resolution at the product print size. ' +
      'Takes precedence over upscale.',
    minimum: 72,
    maximum: 600,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(72)
  @Max(600)
  targetDpi?: number;

  @ApiProperty({
    description:
      'Crop the image to the exact print aspect ratio, framed by `crop` ' +
      '(centered when omitted).',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  fitToFormat?: boolean;

  @ApiProperty({
    description:
      'Framing for fitToFormat: crop centre and zoom. Stored on the item so ' +
      'later saves keep it.',
    type: PrintCropDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PrintCropDto)
  crop?: PrintCropDto;

  @ApiProperty({
    description:
      'Output format. Defaults to jpeg. Use png for lossless output.',
    enum: ['jpeg', 'png'],
    required: false,
    default: 'jpeg',
  })
  @IsOptional()
  @IsString()
  @IsIn(['jpeg', 'png'])
  format?: 'jpeg' | 'png';

  @ApiProperty({
    description:
      'Extend the image by 3 mm on each side (sangre para el troquelado). ' +
      'How the band is filled is set by bleedMode.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  bleed?: boolean;

  @ApiProperty({
    description:
      'Hex colour used for the bleed extension (#rrggbb). Only effective when bleed=true and bleedMode=solid.',
    pattern: '^#[0-9a-fA-F]{6}$',
    required: false,
    default: '#ffffff',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6})$/)
  bleedColor?: string;

  @ApiProperty({
    description:
      'How the bleed band is filled: extend repeats the edge pixels, mirror ' +
      'reflects the strip next to the cut line, solid uses bleedColor.',
    enum: ['extend', 'mirror', 'solid'],
    required: false,
    default: 'solid',
  })
  @IsOptional()
  @IsIn(['extend', 'mirror', 'solid'])
  bleedMode?: 'extend' | 'mirror' | 'solid';
}
