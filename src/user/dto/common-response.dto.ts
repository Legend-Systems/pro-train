import { ApiProperty } from '@nestjs/swagger';

export class StandardApiResponse<T = any> {
  @ApiProperty({
    description: 'Indicates if the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Human-readable message about the operation result',
    example: 'Operation completed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Response data payload',
    required: false,
  })
  data?: T;

  @ApiProperty({
    description: 'Additional metadata about the response',
    required: false,
  })
  meta?: {
    timestamp?: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
