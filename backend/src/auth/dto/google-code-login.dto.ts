import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GoogleCodeLoginDto {
  @ApiProperty({
    description:
      'Authorization code from the Google popup (auth-code flow, redirect_uri "postmessage")',
  })
  @IsString()
  code: string;
}
