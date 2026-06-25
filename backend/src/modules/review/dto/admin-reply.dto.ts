import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminReplyDto {
  @ApiProperty({
    example: 'Thanks for the feedback! Glad it fit well.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reply!: string;
}
