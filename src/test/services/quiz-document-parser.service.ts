import {
    Injectable,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import * as mammoth from 'mammoth';
import {
    parseQuizCsv,
    parseQuizText,
    type ParsedQuizDocument,
} from '../utils/quiz-document-parser';

const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CSV_MIME_TYPES = new Set([
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
]);

/**
 * Extracts structured quiz content from uploaded admin documents (.docx / .csv / .txt).
 */
@Injectable()
export class QuizDocumentParserService {
    private readonly logger = new Logger(QuizDocumentParserService.name);

    async parseUploadedFile(file: Express.Multer.File): Promise<ParsedQuizDocument> {
        if (!file?.buffer?.length) {
            throw new BadRequestException('Uploaded file is empty');
        }

        const extension = this.resolveExtension(file);
        this.logger.log(
            `Parsing quiz document "${file.originalname}" (${extension || 'unknown'}, ${file.size} bytes)`,
        );

        if (extension === 'csv' || this.isCsvMime(file.mimetype)) {
            const text = file.buffer.toString('utf8');
            return this.ensureQuestions(parseQuizCsv(text), file.originalname);
        }

        if (extension === 'txt' || file.mimetype === 'text/plain') {
            const text = file.buffer.toString('utf8');
            return this.ensureQuestions(parseQuizText(text), file.originalname);
        }

        if (extension === 'docx' || file.mimetype === DOCX_MIME) {
            const text = await this.extractDocxText(file.buffer);
            return this.ensureQuestions(parseQuizText(text), file.originalname);
        }

        throw new BadRequestException(
            'Unsupported file type. Upload a .docx, .csv, or .txt quiz document.',
        );
    }

    private async extractDocxText(buffer: Buffer): Promise<string> {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value ?? '';
        } catch (error) {
            this.logger.error('Failed to extract text from DOCX', error);
            throw new BadRequestException(
                'Could not read the Word document. Ensure it is a valid .docx file.',
            );
        }
    }

    private ensureQuestions(
        parsed: ParsedQuizDocument,
        originalName: string,
    ): ParsedQuizDocument {
        if (!parsed.questions.length) {
            throw new BadRequestException(
                `No questions were found in "${originalName}". Check that the file matches the ProTrain quiz template.`,
            );
        }

        if (!parsed.title || parsed.title === 'Imported Test') {
            const baseName = originalName.replace(/\.[^.]+$/, '').trim();
            if (baseName) {
                parsed.title = baseName;
            }
        }

        return parsed;
    }

    private resolveExtension(file: Express.Multer.File): string {
        const fromName = file.originalname?.split('.').pop()?.toLowerCase() ?? '';
        return fromName;
    }

    private isCsvMime(mime: string | undefined): boolean {
        if (!mime) return false;
        return CSV_MIME_TYPES.has(mime.toLowerCase());
    }
}
