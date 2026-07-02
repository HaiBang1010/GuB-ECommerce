import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// A single chat message body. Shared by the customer send + admin reply endpoints.
export class SendMessageDto {
  @ApiProperty({
    example: 'Hi, is this available in size 42?',
    maxLength: 2000,
    description: 'Message text.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
}
