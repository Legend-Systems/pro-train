import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for validating invitation tokens
 * Used to verify invitation token authenticity and retrieve invitation details
 */
export class ValidateInvitationDto {
    @ApiProperty({
        description: 'Invitation token received via email invitation link',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5ld3VzZXJAZXhhbXBsZS5jb20iLCJ0eXBlIjoiaW52aXRhdGlvbiIsImlhdCI6MTcwNTMxNzAwMCwiZXhwIjoxNzA1OTIxODAwfQ.signature',
        type: String,
        title: 'Invitation Token',
        minLength: 10,
        format: 'jwt',
    })
    @IsString({ message: 'Invitation token is required' })
    @MinLength(10, { message: 'Invalid invitation token format' })
    token: string;
}
