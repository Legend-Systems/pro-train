/**
 * Digital Skills baseline assessment (courseId 50).
 *
 * Catalogue and bands come from `digital-skills-setup.md` / `new-feature.md`.
 * Do not add skills here that are not in that list.
 */

/** Existing BitGroup Digital Skills course — do not create another. */
export const DIGITAL_SKILLS_COURSE_ID = 50;

export const DIGITAL_SKILLS_TEST_TITLE = 'Digital Skills Self-Assessment';

export const DIGITAL_SKILLS_TEST_DESCRIPTION =
    'Please rate your current ability honestly. This survey is not an exam. Its purpose is to identify the appropriate training level for each employee.';

/** Max points per skill question. ((level − 1) / 5) × 5 = 0, 1, 2, 3, 4, 5. */
export const DIGITAL_SKILLS_QUESTION_POINTS = 5;

export const DIGITAL_SKILLS_MAX_ATTEMPTS = 5;

export interface DigitalSkillDefinition {
    readonly key: string;
    readonly title: string;
    readonly group: string;
}

export const DIGITAL_SKILL_CATALOGUE: readonly DigitalSkillDefinition[] = [
    { key: 'using-windows', title: 'Using Windows', group: 'Core computer skills' },
    {
        key: 'creating-organizing-folders',
        title: 'Creating & organizing folders',
        group: 'Core computer skills',
    },
    {
        key: 'finding-files',
        title: 'Finding files on the computer',
        group: 'Core computer skills',
    },
    {
        key: 'downloading-uploading-files',
        title: 'Downloading & uploading files',
        group: 'Core computer skills',
    },
    {
        key: 'copying-moving-renaming-files',
        title: 'Copying, moving & renaming files',
        group: 'Core computer skills',
    },
    {
        key: 'excel-overall',
        title: 'Microsoft Excel – Overall',
        group: 'Microsoft Excel',
    },
    {
        key: 'excel-entering-information',
        title: 'Entering information in Excel',
        group: 'Microsoft Excel',
    },
    {
        key: 'excel-creating-spreadsheets',
        title: 'Creating spreadsheets',
        group: 'Microsoft Excel',
    },
    {
        key: 'excel-basic-formulas',
        title: 'Using basic formulas',
        group: 'Microsoft Excel',
    },
    {
        key: 'excel-sorting-filtering',
        title: 'Sorting & filtering information',
        group: 'Microsoft Excel',
    },
    {
        key: 'word-overall',
        title: 'Microsoft Word – Overall',
        group: 'Microsoft Word',
    },
    {
        key: 'word-creating-editing',
        title: 'Creating/editing documents',
        group: 'Microsoft Word',
    },
    {
        key: 'word-formatting',
        title: 'Formatting documents',
        group: 'Microsoft Word',
    },
    { key: 'word-tables', title: 'Creating tables', group: 'Microsoft Word' },
    {
        key: 'word-save-pdf',
        title: 'Saving Word documents as PDF',
        group: 'Microsoft Word',
    },
    {
        key: 'outlook-overall',
        title: 'Microsoft Outlook – Overall',
        group: 'Microsoft Outlook',
    },
    {
        key: 'outlook-professional-emails',
        title: 'Sending professional emails',
        group: 'Microsoft Outlook',
    },
    {
        key: 'outlook-attachments',
        title: 'Adding attachments',
        group: 'Microsoft Outlook',
    },
    {
        key: 'outlook-search',
        title: 'Searching for previous emails',
        group: 'Microsoft Outlook',
    },
    {
        key: 'outlook-folders',
        title: 'Organizing emails into folders',
        group: 'Microsoft Outlook',
    },
    {
        key: 'outlook-calendar',
        title: 'Using Outlook Calendar',
        group: 'Microsoft Outlook',
    },
    {
        key: 'teams-meetings',
        title: 'Teams / online meetings',
        group: 'Sales-practical skills',
    },
    {
        key: 'pdf-documents',
        title: 'PDF documents',
        group: 'Sales-practical skills',
    },
    {
        key: 'internet-browser',
        title: 'Internet / browser use',
        group: 'Sales-practical skills',
    },
    { key: 'crm', title: 'CRM', group: 'Sales-practical skills' },
    { key: 'supaapp', title: 'SupaApp', group: 'Sales-practical skills' },
    {
        key: 'whatsapp-business',
        title: 'WhatsApp Business',
        group: 'Sales-practical skills',
    },
    { key: 'ai-chatgpt', title: 'AI / ChatGPT', group: 'Sales-practical skills' },
    {
        key: 'creating-quotations',
        title: 'Creating quotations',
        group: 'Sales-practical skills',
    },
    {
        key: 'attaching-quotations',
        title: 'Attaching quotations to emails',
        group: 'Sales-practical skills',
    },
    {
        key: 'cybersecurity-phishing',
        title: 'Basic cybersecurity / phishing awareness',
        group: 'Sales-practical skills',
    },
] as const;

export interface DigitalSkillLevelDefinition {
    readonly level: 1 | 2 | 3 | 4 | 5 | 6;
    readonly label: string;
    readonly meaning: string;
}

export const DIGITAL_SKILL_LEVELS: readonly DigitalSkillLevelDefinition[] = [
    {
        level: 1,
        label: 'No Knowledge',
        meaning: "I don't know how to do this at all",
    },
    {
        level: 2,
        label: 'Very Basic',
        meaning: 'I have seen/used it but need help',
    },
    {
        level: 3,
        label: 'Basic',
        meaning: 'I can perform simple tasks by myself',
    },
    {
        level: 4,
        label: 'Intermediate',
        meaning: 'I am comfortable with most normal tasks',
    },
    {
        level: 5,
        label: 'Good',
        meaning: 'I can work independently and efficiently',
    },
    {
        level: 6,
        label: 'Advanced',
        meaning: 'I am highly confident and can teach/help others',
    },
] as const;

export type DigitalSkillsClassification =
    | 'Urgent Training'
    | 'Beginner'
    | 'Basic'
    | 'Competent'
    | 'Strong'
    | 'Advanced';

/** Ratings that auto-flag a skill as a weak area. */
export const DIGITAL_SKILLS_WEAK_LEVELS: readonly number[] = [1, 2];

export const DIGITAL_SKILLS_MODULE_TITLE_PREFIX = 'Digital Skills Module — ';

export const DIGITAL_SKILLS_CHECK_TITLE_PREFIX = 'Digital Skills Check — ';

export const DIGITAL_SKILLS_KNOWLEDGE_TEST_DURATION_MINUTES = 15;

export const DIGITAL_SKILLS_KNOWLEDGE_MAX_ATTEMPTS = 5;

export const DIGITAL_SKILLS_KNOWLEDGE_WINDOW_DAYS = 28;

/** Course-material title for one skill module. */
export function digitalSkillsModuleTitle(skillTitle: string): string {
    return `${DIGITAL_SKILLS_MODULE_TITLE_PREFIX}${skillTitle}`;
}

/** Knowledge-test title for one skill module. */
export function digitalSkillsCheckTitle(skillTitle: string): string {
    return `${DIGITAL_SKILLS_CHECK_TITLE_PREFIX}${skillTitle}`;
}

/** True when the test is the course-50 baseline survey (31 skill ratings). */
export function isDigitalSkillsSelfAssessment(
    title: string | null | undefined,
): boolean {
    return title === DIGITAL_SKILLS_TEST_TITLE;
}

/** True when the test is a Digital Skills follow-up exam, not the survey. */
export function isDigitalSkillsKnowledgeTest(title: string | null | undefined): boolean {
    return Boolean(title?.startsWith(DIGITAL_SKILLS_CHECK_TITLE_PREFIX));
}

/**
 * Upcoming-exams banners may show the self-assessment only.
 * Remedial checks stay on the personal booking modal.
 */
export function isUpcomingDigitalSkillsExamAllowed(
    courseId: number | null | undefined,
    title: string | null | undefined,
): boolean {
    if (courseId !== DIGITAL_SKILLS_COURSE_ID && !isDigitalSkillsKnowledgeTest(title)) {
        return true;
    }
    return title === DIGITAL_SKILLS_TEST_TITLE;
}

/** Marker stored on auto-created test invitations so retries can find them. */
export const DIGITAL_SKILLS_BOOKING_NOTE =
    'Digital Skills remedial booking.';

/** Next-day due time in South Africa (17:00 SAST). */
export const DIGITAL_SKILLS_BOOKING_TIME_ZONE = 'Africa/Johannesburg';
