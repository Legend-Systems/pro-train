/**
 * Phase 5 knowledge-test stems for each Digital Skills module.
 *
 * These are real exam questions, not self-ratings. Three per skill, equal weight.
 * Do not add skills that are not in DIGITAL_SKILL_CATALOGUE.
 */

export interface DigitalSkillsKnowledgeOption {
    readonly text: string;
    readonly isCorrect: boolean;
}

export interface DigitalSkillsKnowledgeQuestion {
    readonly questionText: string;
    readonly options: readonly DigitalSkillsKnowledgeOption[];
}

export const DIGITAL_SKILLS_KNOWLEDGE_QUESTIONS: Readonly<
    Record<string, readonly DigitalSkillsKnowledgeQuestion[]>
> = {
    'using-windows': [
        {
            questionText: 'Which key combination opens the Start menu search so you can launch an app by name?',
            options: [
                { text: 'Ctrl + Alt + Delete', isCorrect: false },
                { text: 'Windows key, then type the app name', isCorrect: true },
                { text: 'Alt + F4', isCorrect: false },
                { text: 'Ctrl + Shift + Esc only', isCorrect: false },
            ],
        },
        {
            questionText: 'What should you do before shutting down a shared work PC at the end of the day?',
            options: [
                { text: 'Unplug the monitor only', isCorrect: false },
                { text: 'Save open files and close your apps', isCorrect: true },
                { text: 'Hold the power button for 10 seconds immediately', isCorrect: false },
                { text: 'Delete the Downloads folder', isCorrect: false },
            ],
        },
        {
            questionText: 'The Windows taskbar is mainly used to:',
            options: [
                { text: 'Format the hard drive', isCorrect: false },
                { text: 'Switch between open apps and pin frequent ones', isCorrect: true },
                { text: 'Change the company VAT number', isCorrect: false },
                { text: 'Reset your Windows password', isCorrect: false },
            ],
        },
    ],
    'creating-organizing-folders': [
        {
            questionText: 'What is the safest way to keep sales files easy to find later?',
            options: [
                { text: 'Save everything on the Desktop with random names', isCorrect: false },
                { text: 'Use a clear folder structure such as Year / Customer / Document type', isCorrect: true },
                { text: 'Keep one folder called New and put every file in it', isCorrect: false },
                { text: 'Email every file to yourself instead of storing it', isCorrect: false },
            ],
        },
        {
            questionText: 'In File Explorer, how do you create a new folder?',
            options: [
                { text: 'Right-click empty space → New → Folder', isCorrect: true },
                { text: 'Press Ctrl + P', isCorrect: false },
                { text: 'Open Task Manager', isCorrect: false },
                { text: 'Restart the computer', isCorrect: false },
            ],
        },
        {
            questionText: 'Why should folder names avoid special characters like / \\ : * ?',
            options: [
                { text: 'They make files print in colour', isCorrect: false },
                { text: 'Windows does not allow those characters in names', isCorrect: true },
                { text: 'They increase file size', isCorrect: false },
                { text: 'They automatically share the folder with customers', isCorrect: false },
            ],
        },
    ],
    'finding-files': [
        {
            questionText: 'What is the fastest way to find a file when you remember part of its name?',
            options: [
                { text: 'Open every folder manually', isCorrect: false },
                { text: 'Use the File Explorer search box', isCorrect: true },
                { text: 'Reinstall Windows', isCorrect: false },
                { text: 'Empty the Recycle Bin', isCorrect: false },
            ],
        },
        {
            questionText: 'If you last used a Word document yesterday, where can you often reopen it quickly?',
            options: [
                { text: 'Windows Recycle Bin', isCorrect: false },
                { text: 'Word’s Recent list or File Explorer Quick Access', isCorrect: true },
                { text: 'Device Manager', isCorrect: false },
                { text: 'The BIOS menu', isCorrect: false },
            ],
        },
        {
            questionText: 'A file extension such as .xlsx tells you:',
            options: [
                { text: 'Who created the company', isCorrect: false },
                { text: 'The file type and which app usually opens it', isCorrect: true },
                { text: 'The file is always a virus', isCorrect: false },
                { text: 'The file cannot be emailed', isCorrect: false },
            ],
        },
    ],
    'downloading-uploading-files': [
        {
            questionText: 'After you download a quotation PDF from email, where does Windows usually put it?',
            options: [
                { text: 'The Recycle Bin', isCorrect: false },
                { text: 'The Downloads folder, unless you chose another location', isCorrect: true },
                { text: 'C:\\Windows\\System32', isCorrect: false },
                { text: 'The printer queue', isCorrect: false },
            ],
        },
        {
            questionText: 'What should you check before uploading a customer file to a shared drive or CRM?',
            options: [
                { text: 'That it is the correct, final file and not a draft with errors', isCorrect: true },
                { text: 'That the file name contains your password', isCorrect: false },
                { text: 'That you deleted the original from your PC first', isCorrect: false },
                { text: 'That the file is larger than 2 GB', isCorrect: false },
            ],
        },
        {
            questionText: 'A download is taking a long time. What is a sensible first check?',
            options: [
                { text: 'Format the hard drive', isCorrect: false },
                { text: 'Check your internet connection and the download progress', isCorrect: true },
                { text: 'Create a new Windows user', isCorrect: false },
                { text: 'Disable the keyboard', isCorrect: false },
            ],
        },
    ],
    'copying-moving-renaming-files': [
        {
            questionText: 'What is the difference between Copy and Cut in File Explorer?',
            options: [
                { text: 'Copy leaves the original; Cut moves it', isCorrect: true },
                { text: 'They do the same thing', isCorrect: false },
                { text: 'Cut always deletes the file permanently', isCorrect: false },
                { text: 'Copy only works on images', isCorrect: false },
            ],
        },
        {
            questionText: 'Which shortcut duplicates a selected file?',
            options: [
                { text: 'Ctrl + C then Ctrl + V', isCorrect: true },
                { text: 'Alt + F4', isCorrect: false },
                { text: 'Ctrl + Z twice', isCorrect: false },
                { text: 'Windows + L', isCorrect: false },
            ],
        },
        {
            questionText: 'Why should you rename a file like "Quote_Acme_2026-10-15.pdf" instead of "final2(1).pdf"?',
            options: [
                { text: 'Longer names always upload faster', isCorrect: false },
                { text: 'Clear names make the file findable for you and colleagues', isCorrect: true },
                { text: 'Windows rejects short names', isCorrect: false },
                { text: 'PDFs cannot be renamed', isCorrect: false },
            ],
        },
    ],
    'excel-overall': [
        {
            questionText: 'In Excel, a cell is:',
            options: [
                { text: 'The intersection of a column and a row, such as B3', isCorrect: true },
                { text: 'The entire workbook file', isCorrect: false },
                { text: 'Only a printed page', isCorrect: false },
                { text: 'The formula bar title', isCorrect: false },
            ],
        },
        {
            questionText: 'What is a worksheet in Excel?',
            options: [
                { text: 'A single tab/grid inside a workbook', isCorrect: true },
                { text: 'A Windows user account', isCorrect: false },
                { text: 'An Outlook calendar', isCorrect: false },
                { text: 'A PDF stamp', isCorrect: false },
            ],
        },
        {
            questionText: 'You need to keep a working copy before changing prices. What should you do first?',
            options: [
                { text: 'Delete the original file', isCorrect: false },
                { text: 'Save a copy or use Save As with a new name', isCorrect: true },
                { text: 'Close Excel without saving', isCorrect: false },
                { text: 'Change the Windows theme', isCorrect: false },
            ],
        },
    ],
    'excel-entering-information': [
        {
            questionText: 'To confirm a value in the current Excel cell you typically press:',
            options: [
                { text: 'Enter or Tab', isCorrect: true },
                { text: 'Esc only, then shut down', isCorrect: false },
                { text: 'Ctrl + Alt + Delete', isCorrect: false },
                { text: 'F1', isCorrect: false },
            ],
        },
        {
            questionText: 'What happens if you type 15/10 in a cell formatted as Date?',
            options: [
                { text: 'Excel may treat it as a date, not a division', isCorrect: true },
                { text: 'Excel always stores it as text "15/10"', isCorrect: false },
                { text: 'Excel deletes the row', isCorrect: false },
                { text: 'Excel emails the workbook', isCorrect: false },
            ],
        },
        {
            questionText: 'You typed a number into the wrong cell. The quickest fix is usually:',
            options: [
                { text: 'Ctrl + Z to undo, or select the cell and type the correct value', isCorrect: true },
                { text: 'Reinstall Office', isCorrect: false },
                { text: 'Create a new Windows folder', isCorrect: false },
                { text: 'Change the file extension to .docx', isCorrect: false },
            ],
        },
    ],
    'excel-creating-spreadsheets': [
        {
            questionText: 'A simple sales tracker should usually start with:',
            options: [
                { text: 'A header row of column names such as Date, Customer, Amount', isCorrect: true },
                { text: 'Merged cells in every row', isCorrect: false },
                { text: 'One screenshot pasted 50 times', isCorrect: false },
                { text: 'Passwords in column A', isCorrect: false },
            ],
        },
        {
            questionText: 'Why keep one type of information per column?',
            options: [
                { text: 'It allows sorting, filtering, and formulas to work correctly', isCorrect: true },
                { text: 'Excel cannot store more than one column', isCorrect: false },
                { text: 'It prevents saving the file', isCorrect: false },
                { text: 'It is required only for printing', isCorrect: false },
            ],
        },
        {
            questionText: 'What should you avoid when building a list you will filter later?',
            options: [
                { text: 'Blank header cells and extra blank rows inside the list', isCorrect: true },
                { text: 'A title in the header row', isCorrect: false },
                { text: 'Using more than two columns', isCorrect: false },
                { text: 'Saving as .xlsx', isCorrect: false },
            ],
        },
    ],
    'excel-basic-formulas': [
        {
            questionText: 'Which formula adds cells B2 to B10?',
            options: [
                { text: '=SUM(B2:B10)', isCorrect: true },
                { text: '=ADD(B2-B10)', isCorrect: false },
                { text: '=TOTAL B2 B10', isCorrect: false },
                { text: '=B2&&B10', isCorrect: false },
            ],
        },
        {
            questionText: 'Excel formulas must start with:',
            options: [
                { text: 'An equals sign =', isCorrect: true },
                { text: 'A hash #', isCorrect: false },
                { text: 'The word FORMULA', isCorrect: false },
                { text: 'A space', isCorrect: false },
            ],
        },
        {
            questionText: 'If =C2*1.15 is in D2, it most likely calculates:',
            options: [
                { text: 'C2 plus 15 percent', isCorrect: true },
                { text: 'C2 minus 15', isCorrect: false },
                { text: 'The current date', isCorrect: false },
                { text: 'A page break', isCorrect: false },
            ],
        },
    ],
    'excel-sorting-filtering': [
        {
            questionText: 'What does AutoFilter (the filter arrows on headers) let you do?',
            options: [
                { text: 'Show only rows that match chosen values', isCorrect: true },
                { text: 'Delete the workbook permanently', isCorrect: false },
                { text: 'Change Windows display language', isCorrect: false },
                { text: 'Convert the file to a video', isCorrect: false },
            ],
        },
        {
            questionText: 'Before sorting a customer list you should:',
            options: [
                { text: 'Select the whole data range including headers, or click inside the table', isCorrect: true },
                { text: 'Hide Excel completely', isCorrect: false },
                { text: 'Rename the Windows user', isCorrect: false },
                { text: 'Print the file first, always', isCorrect: false },
            ],
        },
        {
            questionText: 'If a filter is on and some rows seem “missing”, you should first:',
            options: [
                { text: 'Clear the filter to show all rows again', isCorrect: true },
                { text: 'Reinstall Excel', isCorrect: false },
                { text: 'Delete the worksheet', isCorrect: false },
                { text: 'Change the file to .exe', isCorrect: false },
            ],
        },
    ],
    'word-overall': [
        {
            questionText: 'Microsoft Word is primarily used to:',
            options: [
                { text: 'Create and edit text documents such as letters and quotes', isCorrect: true },
                { text: 'Edit videos', isCorrect: false },
                { text: 'Manage Windows user accounts', isCorrect: false },
                { text: 'Scan the network for printers only', isCorrect: false },
            ],
        },
        {
            questionText: 'Ctrl + S in Word:',
            options: [
                { text: 'Saves the current document', isCorrect: true },
                { text: 'Sends the document to every contact', isCorrect: false },
                { text: 'Splits the window into four', isCorrect: false },
                { text: 'Deletes the last page', isCorrect: false },
            ],
        },
        {
            questionText: 'If Word asks you to recover a document after a crash, you should:',
            options: [
                { text: 'Review the recovered file and save it if it is the latest work', isCorrect: true },
                { text: 'Always click Don’t Save', isCorrect: false },
                { text: 'Format the hard drive', isCorrect: false },
                { text: 'Ignore it and create a new blank file with the same name over it', isCorrect: false },
            ],
        },
    ],
    'word-creating-editing': [
        {
            questionText: 'To replace a customer name throughout a letter, the safest tool is:',
            options: [
                { text: 'Find and Replace (Ctrl + H)', isCorrect: true },
                { text: 'Restart Word after each change', isCorrect: false },
                { text: 'Print Preview only', isCorrect: false },
                { text: 'The Windows Recycle Bin', isCorrect: false },
            ],
        },
        {
            questionText: 'You can move a paragraph by:',
            options: [
                { text: 'Selecting it, then Cut and Paste where it belongs', isCorrect: true },
                { text: 'Changing the file extension to .xlsx', isCorrect: false },
                { text: 'Pressing Caps Lock', isCorrect: false },
                { text: 'Closing Word without saving', isCorrect: false },
            ],
        },
        {
            questionText: 'Why use Track Changes on a shared contract draft?',
            options: [
                { text: 'Colleagues can see what was edited before it is accepted', isCorrect: true },
                { text: 'It emails the file automatically every minute', isCorrect: false },
                { text: 'It converts the file to Excel', isCorrect: false },
                { text: 'It hides all text from the author', isCorrect: false },
            ],
        },
    ],
    'word-formatting': [
        {
            questionText: 'Which action applies bold to selected text?',
            options: [
                { text: 'Ctrl + B', isCorrect: true },
                { text: 'Ctrl + P', isCorrect: false },
                { text: 'Alt + Tab', isCorrect: false },
                { text: 'F12 only', isCorrect: false },
            ],
        },
        {
            questionText: 'Styles (Heading 1, Normal) are useful because they:',
            options: [
                { text: 'Keep headings consistent and make the document easier to update', isCorrect: true },
                { text: 'Delete unused fonts from Windows', isCorrect: false },
                { text: 'Prevent saving as PDF', isCorrect: false },
                { text: 'Lock the file to one computer', isCorrect: false },
            ],
        },
        {
            questionText: 'Before sending a customer letter you should check:',
            options: [
                { text: 'Spelling, spacing, and that the company details look professional', isCorrect: true },
                { text: 'That Comic Sans is used on every line', isCorrect: false },
                { text: 'That Track Changes comments include internal prices', isCorrect: false },
                { text: 'That the file is unsaved', isCorrect: false },
            ],
        },
    ],
    'word-tables': [
        {
            questionText: 'How do you insert a table in Word?',
            options: [
                { text: 'Insert → Table and choose the rows and columns', isCorrect: true },
                { text: 'File → Account', isCorrect: false },
                { text: 'View → Zoom only', isCorrect: false },
                { text: 'Mailings → Envelopes only', isCorrect: false },
            ],
        },
        {
            questionText: 'A quotation table should usually include:',
            options: [
                { text: 'Item, quantity, unit price, and line total', isCorrect: true },
                { text: 'Your Windows password', isCorrect: false },
                { text: 'Only a screenshot of Excel with no numbers', isCorrect: false },
                { text: 'A blank page with no headers', isCorrect: false },
            ],
        },
        {
            questionText: 'If a Word table overflows the page, a good first fix is:',
            options: [
                { text: 'Adjust column widths or reduce font size slightly', isCorrect: true },
                { text: 'Change the file type to .mp4', isCorrect: false },
                { text: 'Delete the company letterhead permanently', isCorrect: false },
                { text: 'Turn off the monitor', isCorrect: false },
            ],
        },
    ],
    'word-save-pdf': [
        {
            questionText: 'How do you save a Word document as a PDF?',
            options: [
                { text: 'File → Save As (or Export) and choose PDF', isCorrect: true },
                { text: 'Rename the file from .docx to .pdf in File Explorer only', isCorrect: false },
                { text: 'Print the screen and scan it', isCorrect: false },
                { text: 'Email it to yourself as .txt', isCorrect: false },
            ],
        },
        {
            questionText: 'Why send customers a PDF instead of a .docx quote?',
            options: [
                { text: 'The layout stays stable and is harder to accidentally edit', isCorrect: true },
                { text: 'PDFs cannot be attached to email', isCorrect: false },
                { text: 'Word cannot open PDFs ever', isCorrect: false },
                { text: 'PDFs are always smaller than 1 KB', isCorrect: false },
            ],
        },
        {
            questionText: 'After exporting a PDF you should:',
            options: [
                { text: 'Open it and check that prices and pages look correct', isCorrect: true },
                { text: 'Delete the Word original immediately', isCorrect: false },
                { text: 'Change the PDF extension to .exe', isCorrect: false },
                { text: 'Upload it without looking', isCorrect: false },
            ],
        },
    ],
    'outlook-overall': [
        {
            questionText: 'Microsoft Outlook is used for:',
            options: [
                { text: 'Email, calendar, and often contacts/tasks', isCorrect: true },
                { text: 'Editing Excel formulas only', isCorrect: false },
                { text: 'Formatting C: drive', isCorrect: false },
                { text: 'Designing company logos', isCorrect: false },
            ],
        },
        {
            questionText: 'The Inbox is:',
            options: [
                { text: 'The folder where new incoming mail usually arrives', isCorrect: true },
                { text: 'Deleted items only', isCorrect: false },
                { text: 'Sent items only', isCorrect: false },
                { text: 'The Windows Recycle Bin', isCorrect: false },
            ],
        },
        {
            questionText: 'If Outlook is “Working Offline”, mail will:',
            options: [
                { text: 'Not send or receive until you go online again', isCorrect: true },
                { text: 'Automatically print every message', isCorrect: false },
                { text: 'Delete the mailbox', isCorrect: false },
                { text: 'Convert all mail to Excel', isCorrect: false },
            ],
        },
    ],
    'outlook-professional-emails': [
        {
            questionText: 'A professional sales email should include:',
            options: [
                { text: 'A clear subject, greeting, purpose, and sign-off', isCorrect: true },
                { text: 'Only emojis and no subject', isCorrect: false },
                { text: 'ALL CAPS in every sentence', isCorrect: false },
                { text: 'Your password in the first line', isCorrect: false },
            ],
        },
        {
            questionText: 'When should you use Reply All?',
            options: [
                { text: 'When every recipient truly needs the reply', isCorrect: true },
                { text: 'For every email, always', isCorrect: false },
                { text: 'Never, even on group threads about a deal', isCorrect: false },
                { text: 'Only for spam', isCorrect: false },
            ],
        },
        {
            questionText: 'Before sending a quote to a customer, you should:',
            options: [
                { text: 'Check the To/Cc addresses and that the attachment is correct', isCorrect: true },
                { text: 'Bcc the entire company address book', isCorrect: false },
                { text: 'Leave the subject blank', isCorrect: false },
                { text: 'Attach every file in Downloads', isCorrect: false },
            ],
        },
    ],
    'outlook-attachments': [
        {
            questionText: 'How do you attach a file in a new Outlook email?',
            options: [
                { text: 'Attach File / paperclip and select the file', isCorrect: true },
                { text: 'Type the file path in the subject only', isCorrect: false },
                { text: 'Drag the monitor cable', isCorrect: false },
                { text: 'Press Caps Lock three times', isCorrect: false },
            ],
        },
        {
            questionText: 'A customer says they cannot open your attachment. A common cause is:',
            options: [
                { text: 'You forgot to attach the file, or sent the wrong format', isCorrect: true },
                { text: 'Outlook cannot send PDFs at all', isCorrect: false },
                { text: 'The email had a subject line', isCorrect: false },
                { text: 'You used a greeting', isCorrect: false },
            ],
        },
        {
            questionText: 'Large attachments sometimes fail. A practical alternative is:',
            options: [
                { text: 'Share a company-approved link or compress/split the files', isCorrect: true },
                { text: 'Paste the file into the subject line', isCorrect: false },
                { text: 'Rename it to .exe', isCorrect: false },
                { text: 'Send it 20 times', isCorrect: false },
            ],
        },
    ],
    'outlook-search': [
        {
            questionText: 'To find last month’s email from a supplier, you should:',
            options: [
                { text: 'Use Outlook Search with the name or a keyword', isCorrect: true },
                { text: 'Delete the Inbox and start again', isCorrect: false },
                { text: 'Reinstall Windows', isCorrect: false },
                { text: 'Open Excel', isCorrect: false },
            ],
        },
        {
            questionText: 'Search “hasattachments:yes” helps you find:',
            options: [
                { text: 'Emails that include files', isCorrect: true },
                { text: 'Emails with no subject', isCorrect: false },
                { text: 'Calendar-only items', isCorrect: false },
                { text: 'Deleted Windows files', isCorrect: false },
            ],
        },
        {
            questionText: 'If search shows no results, a useful next step is:',
            options: [
                { text: 'Broaden the keyword or search All Mailboxes / Subfolders', isCorrect: true },
                { text: 'Format the mailbox PST immediately', isCorrect: false },
                { text: 'Change your Windows password', isCorrect: false },
                { text: 'Turn off the computer permanently', isCorrect: false },
            ],
        },
    ],
    'outlook-folders': [
        {
            questionText: 'Why move customer mail into folders?',
            options: [
                { text: 'It keeps the Inbox manageable and deals easier to find', isCorrect: true },
                { text: 'Folders delete mail after one hour', isCorrect: false },
                { text: 'Outlook requires exactly 100 folders', isCorrect: false },
                { text: 'It prevents sending mail', isCorrect: false },
            ],
        },
        {
            questionText: 'A Rules / inbox rule can:',
            options: [
                { text: 'Automatically file mail from a sender into a folder', isCorrect: true },
                { text: 'Install new fonts', isCorrect: false },
                { text: 'Change Excel formulas', isCorrect: false },
                { text: 'Reset Windows', isCorrect: false },
            ],
        },
        {
            questionText: 'Moving mail to a folder does NOT:',
            options: [
                { text: 'Delete it from the server forever in normal use — it just files it', isCorrect: true },
                { text: 'Help you organise work', isCorrect: false },
                { text: 'Keep the message content', isCorrect: false },
                { text: 'Let you search it later', isCorrect: false },
            ],
        },
    ],
    'outlook-calendar': [
        {
            questionText: 'To book a meeting with a colleague in Outlook Calendar you typically:',
            options: [
                { text: 'Create a meeting, add attendees, and send the invite', isCorrect: true },
                { text: 'Create a mail merge in Word', isCorrect: false },
                { text: 'Rename a folder in File Explorer', isCorrect: false },
                { text: 'Change the Excel ribbon', isCorrect: false },
            ],
        },
        {
            questionText: 'What should a meeting invite include?',
            options: [
                { text: 'Date, time, purpose, and location or Teams link', isCorrect: true },
                { text: 'Only the word “Hi”', isCorrect: false },
                { text: 'Your banking PIN', isCorrect: false },
                { text: 'A 4-hour slot with no agenda by default', isCorrect: false },
            ],
        },
        {
            questionText: 'If a meeting is moved, you should:',
            options: [
                { text: 'Update the existing invite so everyone’s calendar changes', isCorrect: true },
                { text: 'Create a second meeting and leave the old one', isCorrect: false },
                { text: 'Delete your calendar permanently', isCorrect: false },
                { text: 'Ignore the change', isCorrect: false },
            ],
        },
    ],
    'teams-meetings': [
        {
            questionText: 'Before a Teams sales call you should:',
            options: [
                { text: 'Test audio/video and have the agenda or quote ready', isCorrect: true },
                { text: 'Leave the camera covered and join 20 minutes late', isCorrect: false },
                { text: 'Share your entire desktop with personal folders open', isCorrect: false },
                { text: 'Disable the internet', isCorrect: false },
            ],
        },
        {
            questionText: 'Mute is important because:',
            options: [
                { text: 'It stops background noise when you are not speaking', isCorrect: true },
                { text: 'It ends the meeting for everyone', isCorrect: false },
                { text: 'It records the call in Excel', isCorrect: false },
                { text: 'It deletes the chat', isCorrect: false },
            ],
        },
        {
            questionText: 'When sharing your screen, you should:',
            options: [
                { text: 'Share only the needed window and hide confidential files', isCorrect: true },
                { text: 'Share the desktop with email and passwords visible', isCorrect: false },
                { text: 'Share and then walk away', isCorrect: false },
                { text: 'Never confirm you are sharing', isCorrect: false },
            ],
        },
    ],
    'pdf-documents': [
        {
            questionText: 'A PDF is useful for quotations because:',
            options: [
                { text: 'It keeps layout consistent on most devices', isCorrect: true },
                { text: 'It cannot be attached to email', isCorrect: false },
                { text: 'It always includes live Excel formulas', isCorrect: false },
                { text: 'It replaces the need for a subject line', isCorrect: false },
            ],
        },
        {
            questionText: 'To read a PDF you typically use:',
            options: [
                { text: 'A PDF reader or the browser’s PDF viewer', isCorrect: true },
                { text: 'Device Manager', isCorrect: false },
                { text: 'Task Scheduler only', isCorrect: false },
                { text: 'The BIOS', isCorrect: false },
            ],
        },
        {
            questionText: 'If a customer cannot sign a scanned PDF, a practical option is:',
            options: [
                { text: 'Use an approved e-sign process or ask them to print, sign, and scan', isCorrect: true },
                { text: 'Change the extension to .mp3', isCorrect: false },
                { text: 'Send a blank email', isCorrect: false },
                { text: 'Delete the quote', isCorrect: false },
            ],
        },
    ],
    'internet-browser': [
        {
            questionText: 'The address bar is where you:',
            options: [
                { text: 'Type or paste a website URL', isCorrect: true },
                { text: 'Change Windows power settings', isCorrect: false },
                { text: 'Format a USB drive', isCorrect: false },
                { text: 'Open Device Manager', isCorrect: false },
            ],
        },
        {
            questionText: 'A padlock next to https:// usually means:',
            options: [
                { text: 'The connection to that site is encrypted — still check it is the real site', isCorrect: true },
                { text: 'The site cannot contain any scam', isCorrect: false },
                { text: 'Your PC is offline', isCorrect: false },
                { text: 'Downloads are disabled', isCorrect: false },
            ],
        },
        {
            questionText: 'Ctrl + T in a browser typically:',
            options: [
                { text: 'Opens a new tab', isCorrect: true },
                { text: 'Deletes your Windows user', isCorrect: false },
                { text: 'Prints the BIOS', isCorrect: false },
                { text: 'Closes the computer', isCorrect: false },
            ],
        },
    ],
    crm: [
        {
            questionText: 'A CRM is mainly used to:',
            options: [
                { text: 'Record customers, deals, and follow-ups in one place', isCorrect: true },
                { text: 'Edit photos', isCorrect: false },
                { text: 'Defragment the hard drive', isCorrect: false },
                { text: 'Reset Outlook passwords', isCorrect: false },
            ],
        },
        {
            questionText: 'After a customer call you should:',
            options: [
                { text: 'Log the outcome and next step in the CRM the same day', isCorrect: true },
                { text: 'Keep notes only on a sticky note at home', isCorrect: false },
                { text: 'Delete the contact if they did not buy immediately', isCorrect: false },
                { text: 'Email the whole company the private notes', isCorrect: false },
            ],
        },
        {
            questionText: 'Why must CRM data be accurate?',
            options: [
                { text: 'Colleagues and reports rely on it to follow up correctly', isCorrect: true },
                { text: 'The CRM cannot store text', isCorrect: false },
                { text: 'Incorrect data makes Windows faster', isCorrect: false },
                { text: 'It is only used once a year', isCorrect: false },
            ],
        },
    ],
    supaapp: [
        {
            questionText: 'SupaApp in this academy is treated as:',
            options: [
                { text: 'A sales/operations app you must use according to company process', isCorrect: true },
                { text: 'A Windows screensaver', isCorrect: false },
                { text: 'A replacement for electricity', isCorrect: false },
                { text: 'An email virus', isCorrect: false },
            ],
        },
        {
            questionText: 'If SupaApp will not load, a sensible first step is:',
            options: [
                { text: 'Check internet, retry, then follow the company IT/support process', isCorrect: true },
                { text: 'Share your password in a public chat', isCorrect: false },
                { text: 'Uninstall Windows', isCorrect: false },
                { text: 'Create fake customer records', isCorrect: false },
            ],
        },
        {
            questionText: 'When capturing a deal in SupaApp you should:',
            options: [
                { text: 'Enter the real customer and product details, not placeholders', isCorrect: true },
                { text: 'Use another salesperson’s login', isCorrect: false },
                { text: 'Skip required fields if you are busy', isCorrect: false },
                { text: 'Duplicate the same deal ten times for luck', isCorrect: false },
            ],
        },
    ],
    'whatsapp-business': [
        {
            questionText: 'WhatsApp Business should be used for customers in a way that is:',
            options: [
                { text: 'Professional, polite, and aligned with company policy', isCorrect: true },
                { text: 'The same as posting in a private family group', isCorrect: false },
                { text: 'A place to share other customers’ prices publicly', isCorrect: false },
                { text: 'Optional to ignore written quotes', isCorrect: false },
            ],
        },
        {
            questionText: 'Before sending a quote on WhatsApp you should:',
            options: [
                { text: 'Confirm you have the correct chat and the correct file', isCorrect: true },
                { text: 'Send it to every unsaved number in your phone', isCorrect: false },
                { text: 'Remove the company name from the PDF', isCorrect: false },
                { text: 'Use a personal joke instead of the price', isCorrect: false },
            ],
        },
        {
            questionText: 'Customer documents received on WhatsApp should be:',
            options: [
                { text: 'Saved to the official company folder/CRM, not left only in chat', isCorrect: true },
                { text: 'Forwarded to friends', isCorrect: false },
                { text: 'Deleted immediately without recording the deal', isCorrect: false },
                { text: 'Edited to change the customer’s ID', isCorrect: false },
            ],
        },
    ],
    'ai-chatgpt': [
        {
            questionText: 'When using ChatGPT or similar AI at work you must not paste:',
            options: [
                { text: 'Confidential customer data, passwords, or unpublished prices', isCorrect: true },
                { text: 'A public product brochure already on the website', isCorrect: false },
                { text: 'A grammar question about a generic sentence', isCorrect: false },
                { text: 'A request to outline a training topic', isCorrect: false },
            ],
        },
        {
            questionText: 'AI-generated text should be:',
            options: [
                { text: 'Checked for accuracy before you send it to a customer', isCorrect: true },
                { text: 'Copied blindly into a signed quote', isCorrect: false },
                { text: 'Used as a legal contract without review', isCorrect: false },
                { text: 'Assumed always up to date on your stock', isCorrect: false },
            ],
        },
        {
            questionText: 'A good use of AI for sales support is:',
            options: [
                { text: 'Drafting a polite follow-up that you then personalise', isCorrect: true },
                { text: 'Inventing a customer VAT number', isCorrect: false },
                { text: 'Bypassing CRM required fields', isCorrect: false },
                { text: 'Resetting a colleague’s password', isCorrect: false },
            ],
        },
    ],
    'creating-quotations': [
        {
            questionText: 'A complete quotation should include:',
            options: [
                { text: 'Customer name, items, prices, validity, and your company details', isCorrect: true },
                { text: 'Only a verbal number in a chat', isCorrect: false },
                { text: 'A photo of your lunch', isCorrect: false },
                { text: 'Another customer’s confidential discount', isCorrect: false },
            ],
        },
        {
            questionText: 'Before issuing a quote you should confirm:',
            options: [
                { text: 'The correct product, quantity, and approved price list', isCorrect: true },
                { text: 'That the customer’s ID number is posted in a group', isCorrect: false },
                { text: 'A random price from memory', isCorrect: false },
                { text: 'That Excel is uninstalled', isCorrect: false },
            ],
        },
        {
            questionText: 'If you make a pricing error on a sent quote you should:',
            options: [
                { text: 'Issue a corrected quote and tell the customer promptly', isCorrect: true },
                { text: 'Hope they do not notice', isCorrect: false },
                { text: 'Change only your local file and stay silent', isCorrect: false },
                { text: 'Blame the printer', isCorrect: false },
            ],
        },
    ],
    'attaching-quotations': [
        {
            questionText: 'The correct file to attach is:',
            options: [
                { text: 'The final PDF (or approved format) for that customer and date', isCorrect: true },
                { text: 'An old quote for a different customer', isCorrect: false },
                { text: 'Your personal tax return', isCorrect: false },
                { text: 'A blank template with no prices', isCorrect: false },
            ],
        },
        {
            questionText: 'In the email body you should:',
            options: [
                { text: 'Briefly say what is attached and the next step', isCorrect: true },
                { text: 'Leave it empty so they guess', isCorrect: false },
                { text: 'Paste your Windows password', isCorrect: false },
                { text: 'Attach the file twice under different names without saying so', isCorrect: false },
            ],
        },
        {
            questionText: 'After sending, a good habit is:',
            options: [
                { text: 'File the quote and log it in CRM / SupaApp as required', isCorrect: true },
                { text: 'Delete all copies immediately', isCorrect: false },
                { text: 'Forward it to a personal Gmail “just in case” against policy', isCorrect: false },
                { text: 'Change the quote number silently', isCorrect: false },
            ],
        },
    ],
    'cybersecurity-phishing': [
        {
            questionText: 'A phishing email often tries to:',
            options: [
                { text: 'Trick you into clicking a fake link or sharing a password', isCorrect: true },
                { text: 'Update Excel automatically', isCorrect: false },
                { text: 'Book a Teams meeting you requested', isCorrect: false },
                { text: 'Save your file to the correct folder', isCorrect: false },
            ],
        },
        {
            questionText: 'You get an urgent email asking you to pay a supplier to a new bank account. You should:',
            options: [
                { text: 'Verify via a known official channel before paying', isCorrect: true },
                { text: 'Pay immediately so you are not late', isCorrect: false },
                { text: 'Reply with your OTP', isCorrect: false },
                { text: 'Forward it to all customers', isCorrect: false },
            ],
        },
        {
            questionText: 'A strong work password should be:',
            options: [
                { text: 'Long, unique, and not shared or written on a monitor', isCorrect: true },
                { text: 'Password123 used everywhere', isCorrect: false },
                { text: 'Your ID number', isCorrect: false },
                { text: 'Told to anyone who phones and asks', isCorrect: false },
            ],
        },
    ],
};
