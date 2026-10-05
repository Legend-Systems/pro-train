import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { AssistanceWhatsappStatus } from './entities/assistance-request.entity';

/** Values placed into the approved `protrain_assistance_request` template. */
export interface WatiAssistanceMessage {
    readonly learnerLabel: string;
    readonly courseTitle: string;
    readonly contextSummary: string;
    readonly requestedAt: string;
    readonly message: string;
}

interface WatiConfig {
    readonly endpoint: string;
    readonly accessToken: string;
    readonly templateName: string;
    readonly whatsappNumber: string;
}

interface WatiTemplateResponse {
    readonly result?: boolean;
    readonly info?: string;
}

const WATI_TIMEOUT_MS = 10_000;
const WATI_RETRY_DELAY_MS = 2_000;
const DEFAULT_TEMPLATE_NAME = 'protrain_assistance_request';

/**
 * Sends the assistance WhatsApp template through Wati.
 * Missing endpoint or token skips the call. A failed send does not throw.
 */
@Injectable()
export class WatiAssistanceClient {
    private readonly logger = new Logger(WatiAssistanceClient.name);

    constructor(private readonly configService: ConfigService) {}

    /**
     * Posts the template message to the support number.
     * Retries once after two seconds on timeout or a 5xx response.
     */
    async send(message: WatiAssistanceMessage): Promise<AssistanceWhatsappStatus> {
        const config = this.readConfig();
        if (!config) {
            this.logger.log(
                'Wati endpoint or access token is empty. Skipping WhatsApp.',
            );
            return AssistanceWhatsappStatus.SKIPPED;
        }

        const url = `${config.endpoint}/api/v1/sendTemplateMessage`;
        const body = {
            template_name: config.templateName,
            broadcast_name: config.templateName,
            parameters: [
                { name: '1', value: message.learnerLabel },
                { name: '2', value: message.courseTitle },
                { name: '3', value: message.contextSummary },
                { name: '4', value: message.requestedAt },
                { name: '5', value: message.message },
            ],
        };

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const response = await axios.post<WatiTemplateResponse>(url, body, {
                    timeout: WATI_TIMEOUT_MS,
                    params: { whatsappNumber: config.whatsappNumber },
                    headers: {
                        Authorization: `Bearer ${config.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.status === 200 && response.data?.result === true) {
                    return AssistanceWhatsappStatus.SENT;
                }

                this.logger.error(
                    `Wati send failed status=${response.status} info=${this.readInfo(response.data)}`,
                );
                return AssistanceWhatsappStatus.FAILED;
            } catch (error) {
                const detail = this.describeError(error);
                if (attempt === 1 && this.shouldRetry(error)) {
                    this.logger.warn(
                        `Wati send will retry once after timeout or 5xx. ${detail}`,
                    );
                    await this.delay(WATI_RETRY_DELAY_MS);
                    continue;
                }

                this.logger.error(`Wati send failed. ${detail}`);
                return AssistanceWhatsappStatus.FAILED;
            }
        }

        return AssistanceWhatsappStatus.FAILED;
    }

    private readConfig(): WatiConfig | null {
        const endpoint = this.configService
            .get<string>('WATI_API_ENDPOINT')
            ?.trim()
            .replace(/\/$/, '');
        const accessToken = this.configService
            .get<string>('WATI_ACCESS_TOKEN')
            ?.trim();
        const whatsappNumber = this.configService
            .get<string>('ASSISTANCE_WHATSAPP_NUMBER')
            ?.replace(/\D/g, '');
        const templateName =
            this.configService.get<string>('WATI_ASSISTANCE_TEMPLATE')?.trim() ||
            DEFAULT_TEMPLATE_NAME;

        if (!endpoint || !accessToken || !whatsappNumber) {
            return null;
        }

        return { endpoint, accessToken, templateName, whatsappNumber };
    }

    private shouldRetry(error: unknown): boolean {
        if (!axios.isAxiosError(error)) {
            return false;
        }
        if (error.code === 'ECONNABORTED') {
            return true;
        }
        const status = error.response?.status;
        return status !== undefined && status >= 500;
    }

    private describeError(error: unknown): string {
        if (!axios.isAxiosError(error)) {
            return error instanceof Error ? error.message : 'unknown error';
        }
        const axiosError = error as AxiosError<WatiTemplateResponse>;
        const status = axiosError.response?.status ?? 'none';
        const info = this.readInfo(axiosError.response?.data);
        return `status=${status} code=${axiosError.code ?? 'none'} info=${info}`;
    }

    private readInfo(data: WatiTemplateResponse | undefined): string {
        if (!data || typeof data.info !== 'string') {
            return '';
        }
        return data.info.replace(/bearer\s+\S+/gi, 'bearer [redacted]');
    }

    private delay(milliseconds: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }
}
