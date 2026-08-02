import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';
import { UserRole } from '../../user/entities/user.entity';

const TITLE_MAX_LENGTH = 120;
const SUBJECT_MAX_LENGTH = 200;
const BODY_MIN_LENGTH = 10;
const BODY_MAX_LENGTH = 10000;

/**
 * Payload for a one-time administrative email broadcast.
 *
 * The broadcast is delivered immediately to every active user whose role
 * appears in `recipientRoles`. There is no scheduling and no repeat send.
 */
export class SendRoleBroadcastDto {
    @ApiProperty({
        description:
            'Headline rendered inside the email banner. Not the subject line.',
        example: 'New fire safety module available',
        maxLength: TITLE_MAX_LENGTH,
    })
    @IsString()
    @IsNotEmpty({ message: 'Title is required' })
    @MaxLength(TITLE_MAX_LENGTH)
    readonly title: string;

    @ApiProperty({
        description: 'Subject line of the email as it appears in the inbox.',
        example: 'Action required: complete your fire safety training',
        maxLength: SUBJECT_MAX_LENGTH,
    })
    @IsString()
    @IsNotEmpty({ message: 'Subject is required' })
    @MaxLength(SUBJECT_MAX_LENGTH)
    readonly subject: string;

    @ApiProperty({
        description:
            'Plain-text message body. Line breaks are preserved and the content is HTML-escaped before rendering.',
        example:
            'A new fire safety module is now live.\n\nPlease complete it before the end of the month.',
        minLength: BODY_MIN_LENGTH,
        maxLength: BODY_MAX_LENGTH,
    })
    @IsString()
    @MinLength(BODY_MIN_LENGTH, {
        message: `Body must be at least ${BODY_MIN_LENGTH} characters`,
    })
    @MaxLength(BODY_MAX_LENGTH)
    readonly body: string;

    @ApiProperty({
        description:
            'Roles that should receive the email. Only users holding one of these roles are contacted.',
        enum: UserRole,
        isArray: true,
        example: [UserRole.USER, UserRole.ADMIN],
    })
    @IsArray()
    @ArrayNotEmpty({ message: 'Select at least one recipient role' })
    @ArrayUnique()
    @IsEnum(UserRole, { each: true, message: 'Invalid recipient role supplied' })
    readonly recipientRoles: UserRole[];
}
