import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsEmail,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';
import { ReportScheduleFrequency } from '../entities/report-schedule.entity';
import { ReportRunStatus } from '../entities/report-run.entity';

/** Supported report type keys included in a schedule. */
export const ADMIN_REPORT_TYPE_VALUES = [
    'overview',
    'performers',
    'training-hours',
    'pass-fail',
    'key-areas',
    'leaderboard',
] as const;
export class CreateReportScheduleDto {
    @ApiProperty({ example: 'Weekly training performance digest' })
    @IsString()
    @MinLength(3)
    @MaxLength(160)
    name: string;

    @ApiProperty({
        type: [String],
        example: ['overview', 'performers', 'key-areas'],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    reportTypes: string[];

    @ApiPropertyOptional({ type: Object })
    @IsOptional()
    @IsObject()
    filters?: Record<string, unknown>;

    @ApiProperty({ enum: ReportScheduleFrequency })
    @IsEnum(ReportScheduleFrequency)
    frequency: ReportScheduleFrequency;

    @ApiPropertyOptional({ description: '0=Sunday … 6=Saturday for weekly' })
    @ValidateIf(o => o.frequency === ReportScheduleFrequency.WEEKLY)
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek?: number;

    @ApiPropertyOptional({ description: '1–28 for monthly' })
    @ValidateIf(o => o.frequency === ReportScheduleFrequency.MONTHLY)
    @IsInt()
    @Min(1)
    @Max(28)
    dayOfMonth?: number;

    @ApiProperty({ example: '08:00' })
    @IsString()
    @Matches(/^\d{2}:\d{2}$/, { message: 'timeUtc must be HH:mm' })
    timeUtc: string;

    @ApiPropertyOptional({ default: 'UTC' })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    timezone?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    recipientUserIds?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    recipientEmails?: string[];

    @ApiPropertyOptional({ type: [String], example: ['admin', 'owner'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    recipientRoles?: string[];

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    includeCsv?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    includePdf?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    includeMotivationalLeaderboard?: boolean;

    @ApiPropertyOptional({
        default: true,
        description: 'Inactive schedules do not send emails',
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateReportScheduleDto extends PartialType(
    CreateReportScheduleDto,
) {}

export class SetReportScheduleActiveDto {
    @ApiProperty({
        description:
            'Set false to deactivate — cron will skip and no emails are sent',
    })
    @IsBoolean()
    isActive: boolean;
}

export class GenerateAdminReportDto {
    @ApiPropertyOptional({ type: Object })
    @IsOptional()
    @IsObject()
    filters?: Record<string, unknown>;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    reportTypes?: string[];

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    includeCsv?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    includePdf?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    sendEmail?: boolean;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    recipientEmails?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    recipientUserIds?: string[];

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    includeMotivationalLeaderboard?: boolean;
}

export class ReportScheduleResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    orgId: string;

    @ApiProperty()
    createdByUserId: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ type: [String] })
    reportTypes: string[];

    @ApiPropertyOptional()
    filters?: Record<string, unknown> | null;

    @ApiProperty({ enum: ReportScheduleFrequency })
    frequency: ReportScheduleFrequency;

    @ApiPropertyOptional()
    dayOfWeek?: number | null;

    @ApiPropertyOptional()
    dayOfMonth?: number | null;

    @ApiProperty()
    timeUtc: string;

    @ApiProperty()
    timezone: string;

    @ApiPropertyOptional({ type: [String] })
    recipientUserIds?: string[] | null;

    @ApiPropertyOptional({ type: [String] })
    recipientEmails?: string[] | null;

    @ApiPropertyOptional({ type: [String] })
    recipientRoles?: string[] | null;

    @ApiProperty()
    includeCsv: boolean;

    @ApiProperty()
    includePdf: boolean;

    @ApiProperty()
    includeMotivationalLeaderboard: boolean;

    @ApiProperty()
    isActive: boolean;

    @ApiPropertyOptional()
    lastRunAt?: Date | null;

    @ApiPropertyOptional()
    nextRunAt?: Date | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class ReportRunResponseDto {
    @ApiProperty()
    id: string;

    @ApiPropertyOptional()
    scheduleId?: string | null;

    @ApiProperty()
    orgId: string;

    @ApiProperty({ enum: ReportRunStatus })
    status: ReportRunStatus;

    @ApiProperty()
    startedAt: Date;

    @ApiPropertyOptional()
    finishedAt?: Date | null;

    @ApiPropertyOptional()
    errorMessage?: string | null;

    @ApiProperty()
    recipientCount: number;

    @ApiPropertyOptional()
    csvRowCount?: number | null;

    @ApiPropertyOptional()
    metadata?: Record<string, unknown> | null;
}

export class GenerateAdminReportResultDto {
    @ApiProperty()
    run: ReportRunResponseDto;

    @ApiPropertyOptional({
        description: 'CSV content when includeCsv was true (preview/download)',
    })
    csv?: string;

    @ApiPropertyOptional({
        description: 'Whether a PDF was generated for this run',
    })
    pdfGenerated?: boolean;

    @ApiPropertyOptional()
    overview?: unknown;

    @ApiProperty()
    emailsQueued: number;
}
