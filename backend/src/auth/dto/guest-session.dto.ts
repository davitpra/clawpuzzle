import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GuestSessionDto {
  @ApiProperty({
    description: 'Token del widget de Cloudflare Turnstile',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
