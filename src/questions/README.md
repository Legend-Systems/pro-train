# ❓ Questions Management Module

## Overview

The Questions Management Module is the content creation engine of the trainpro platform, providing comprehensive question bank management, multiple question types, content organization, and question analytics. This module handles question creation, validation, categorization, bulk operations, and detailed question performance tracking with enterprise-grade features for educational institutions and corporate training programs.

## 🏗️ Architecture

```
questions/
├── questions.controller.ts     # REST API endpoints for question operations
├── questions.service.ts       # Core business logic and question management
├── questions.module.ts        # Module configuration & dependencies
├── entities/                  # Database entities
│   └── question.entity.ts    # Question entity with relationships
├── dto/                      # Data Transfer Objects
│   ├── create-question.dto.ts    # Question creation validation
│   ├── update-question.dto.ts    # Question modification validation
│   ├── question-filter.dto.ts    # Filtering and search criteria
│   └── question-response.dto.ts  # API response formats
└── questions.controller.spec.ts  # API endpoint tests
└── questions.service.spec.ts     # Service layer tests
```

## 🎯 Core Features

### Question Creation & Management
- **Multiple Question Types** (multiple choice, true/false, short answer, essay, fill-in-blank)
- **Rich Content Support** with text formatting and media integration
- **Point Assignment** with flexible scoring systems
- **Question Ordering** within tests and assessments
- **Content Validation** with comprehensive input sanitization

### Question Types & Formats
- **Multiple Choice** with unlimited options and single/multiple correct answers
- **True/False** for binary decision questions
- **Short Answer** for brief text responses
- **Essay Questions** for long-form written responses
- **Fill-in-the-Blank** for completion-style questions

### Content Organization
- **Test Association** with seamless integration to test entities
- **Question Banks** for reusable content libraries
- **Categorization** with tags and subject classification
- **Difficulty Levels** for progressive learning paths
- **Version Control** for question updates and revisions

### Analytics & Performance
- **Question Analytics** with performance metrics
- **Difficulty Analysis** based on response patterns
- **Response Statistics** with correct/incorrect ratios
- **Time Tracking** for question completion analysis
- **Usage Statistics** across multiple tests and courses

### Multi-Tenancy & Organization
- **Organization-Level Questions** with access control
- **Branch-Specific Content** for departmental customization
- **Question Sharing** across organizational units
- **Content Templates** for standardized question formats
- **Collaborative Editing** with instructor permissions

## 📊 Database Schema

### Question Entity
```typescript
@Entity('questions')
export class Question {
    @PrimaryGeneratedColumn()
    questionId: number;

    @Column()
    @Index()
    testId: number;

    @Column('text')
    questionText: string;

    @Column({
        type: 'enum',
        enum: QuestionType,
    })
    questionType: QuestionType;

    @Column()
    points: number;

    @Column()
    @Index()
    orderIndex: number;

    @Column('text', { nullable: true })
    explanation?: string;

    @Column('text', { nullable: true })
    hint?: string;

    @Column({ default: 'medium' })
    difficulty: string;

    @Column('simple-array', { nullable: true })
    tags?: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Organization)
    orgId: Organization;

    @ManyToOne(() => Branch)
    branchId?: Branch;

    // Relationships
    @ManyToOne(() => Test, { onDelete: 'CASCADE' })
    test: Test;

    @OneToMany(() => QuestionOption, 'question')
    options: QuestionOption[];

    @OneToMany(() => Answer, 'question')
    answers: Answer[];
}
```

### Question Types
```typescript
export enum QuestionType {
    MULTIPLE_CHOICE = 'multiple_choice',
    TRUE_FALSE = 'true_false',
    SHORT_ANSWER = 'short_answer',
    ESSAY = 'essay',
    FILL_IN_BLANK = 'fill_in_blank',
}
```

### Difficulty Levels
```typescript
export enum QuestionDifficulty {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard',
    EXPERT = 'expert',
}
```

## 📚 API Endpoints

### Question Management

#### `POST /questions` 🔒 Creator/Admin
**Create New Question**
```typescript
// Request - Multiple Choice
{
  "testId": 15,
  "questionText": "What is the time complexity of binary search algorithm?",
  "questionType": "multiple_choice",
  "points": 5,
  "orderIndex": 1,
  "explanation": "Binary search divides the search space in half with each comparison",
  "difficulty": "medium",
  "tags": ["algorithms", "complexity", "search"],
  "options": [
    {
      "optionText": "O(log n)",
      "isCorrect": true,
      "orderIndex": 1
    },
    {
      "optionText": "O(n)",
      "isCorrect": false,
      "orderIndex": 2
    },
    {
      "optionText": "O(n²)",
      "isCorrect": false,
      "orderIndex": 3
    },
    {
      "optionText": "O(1)",
      "isCorrect": false,
      "orderIndex": 4
    }
  ]
}

// Response
{
  "success": true,
  "data": {
    "questionId": 45,
    "testId": 15,
    "questionText": "What is the time complexity of binary search algorithm?",
    "questionType": "multiple_choice",
    "points": 5,
    "orderIndex": 1,
    "explanation": "Binary search divides the search space in half...",
    "difficulty": "medium",
    "tags": ["algorithms", "complexity", "search"],
    "createdAt": "2025-01-15T10:30:00Z",
    "test": {
      "testId": 15,
      "title": "Data Structures Quiz",
      "course": { "title": "Computer Science Fundamentals" }
    },
    "options": [
      {
        "optionId": 180,
        "optionText": "O(log n)",
        "isCorrect": true,
        "orderIndex": 1
      }
    ]
  },
  "message": "Question created successfully"
}
```

#### `GET /questions` 🔒 Protected
**List Questions with Filtering**
```typescript
// Query Parameters
?page=1&limit=20&testId=15&questionType=multiple_choice&difficulty=medium&search=algorithm

// Response
{
  "success": true,
  "data": {
    "questions": [
      {
        "questionId": 45,
        "testId": 15,
        "questionText": "What is the time complexity of binary search algorithm?",
        "questionType": "multiple_choice",
        "points": 5,
        "difficulty": "medium",
        "orderIndex": 1,
        "tags": ["algorithms", "complexity"],
        "optionCount": 4,
        "correctAnswerRate": 73.5,
        "averageResponseTime": "45 seconds",
        "test": {
          "title": "Data Structures Quiz",
          "course": { "title": "Computer Science Fundamentals" }
        },
        "createdAt": "2025-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 8,
      "totalQuestions": 156,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalQuestions": 156,
      "questionsByType": {
        "multiple_choice": 89,
        "true_false": 32,
        "short_answer": 20,
        "essay": 10,
        "fill_in_blank": 5
      },
      "questionsByDifficulty": {
        "easy": 45,
        "medium": 67,
        "hard": 35,
        "expert": 9
      },
      "averagePoints": 4.2
    }
  }
}
```

#### `GET /questions/test/:testId` 🔒 Protected
**Get Questions by Test**
```typescript
// Response
{
  "success": true,
  "data": {
    "questions": [
      {
        "questionId": 45,
        "questionText": "What is the time complexity of binary search?",
        "questionType": "multiple_choice",
        "points": 5,
        "orderIndex": 1,
        "difficulty": "medium",
        "options": [
          {
            "optionId": 180,
            "optionText": "O(log n)",
            "orderIndex": 1
          }
        ],
        "statistics": {
          "totalResponses": 125,
          "correctResponses": 92,
          "correctRate": 73.6,
          "averageTime": "45 seconds"
        }
      }
    ],
    "testInfo": {
      "testId": 15,
      "title": "Data Structures Quiz",
      "totalQuestions": 25,
      "totalPoints": 100,
      "estimatedDuration": "45 minutes"
    }
  }
}
```

#### `GET /questions/:id` 🔒 Protected
**Get Question Details**
```typescript
// Response
{
  "success": true,
  "data": {
    "question": {
      "questionId": 45,
      "testId": 15,
      "questionText": "What is the time complexity of binary search algorithm?",
      "questionType": "multiple_choice",
      "points": 5,
      "orderIndex": 1,
      "explanation": "Binary search divides the search space in half with each comparison, resulting in logarithmic time complexity.",
      "hint": "Think about how the search space is reduced with each step",
      "difficulty": "medium",
      "tags": ["algorithms", "complexity", "search"],
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    },
    "test": {
      "testId": 15,
      "title": "Data Structures Quiz",
      "course": {
        "courseId": 1,
        "title": "Computer Science Fundamentals",
        "creator": { "firstName": "Dr. John", "lastName": "Smith" }
      }
    },
    "options": [
      {
        "optionId": 180,
        "optionText": "O(log n)",
        "isCorrect": true,
        "orderIndex": 1,
        "explanation": "Correct! Binary search reduces the problem size by half each time."
      },
      {
        "optionId": 181,
        "optionText": "O(n)",
        "isCorrect": false,
        "orderIndex": 2,
        "explanation": "This would be linear search, not binary search."
      }
    ],
    "statistics": {
      "totalAttempts": 125,
      "correctAttempts": 92,
      "correctRate": 73.6,
      "averageResponseTime": "45 seconds",
      "difficultyRating": 3.2,
      "commonMistakes": [
        {
          "incorrectOption": "O(n)",
          "frequency": 18,
          "percentage": 14.4
        }
      ]
    }
  }
}
```

#### `PUT /questions/:id` 🔒 Creator/Admin
**Update Question**
```typescript
// Request
{
  "questionText": "Updated: What is the time complexity of binary search?",
  "points": 10,
  "explanation": "Updated explanation with more detail",
  "difficulty": "hard",
  "tags": ["algorithms", "complexity", "search", "updated"]
}

// Response
{
  "success": true,
  "data": {
    "question": { /* Updated question details */ }
  },
  "message": "Question updated successfully"
}
```

### Question Operations

#### `POST /questions/:id/duplicate` 🔒 Creator/Admin
**Duplicate Question**
```typescript
// Request
{
  "targetTestId": 20,
  "newOrderIndex": 5
}

// Response
{
  "success": true,
  "data": {
    "originalQuestion": { /* Original question */ },
    "duplicatedQuestion": { /* New question copy */ }
  },
  "message": "Question duplicated successfully"
}
```

#### `PATCH /questions/reorder` 🔒 Creator/Admin
**Reorder Questions**
```typescript
// Request
{
  "testId": 15,
  "questionOrders": [
    { "questionId": 45, "orderIndex": 1 },
    { "questionId": 46, "orderIndex": 2 },
    { "questionId": 47, "orderIndex": 3 }
  ]
}

// Response
{
  "success": true,
  "data": {
    "updatedQuestions": [ /* Reordered questions */ ]
  },
  "message": "Questions reordered successfully"
}
```

#### `POST /questions/bulk-create` 🔒 Creator/Admin
**Bulk Create Questions**
```typescript
// Request
{
  "testId": 15,
  "questions": [
    {
      "questionText": "Question 1 text",
      "questionType": "multiple_choice",
      "points": 5,
      "options": [ /* options */ ]
    },
    {
      "questionText": "Question 2 text",
      "questionType": "true_false",
      "points": 3
    }
  ]
}

// Response
{
  "success": true,
  "data": {
    "createdQuestions": [ /* Array of created questions */ ],
    "summary": {
      "totalCreated": 2,
      "successCount": 2,
      "errorCount": 0
    }
  },
  "message": "2 questions created successfully"
}
```

### Question Analytics

#### `GET /questions/:id/analytics` 🔒 Creator/Admin
**Get Question Analytics**
```typescript
// Response
{
  "success": true,
  "data": {
    "questionInfo": {
      "questionId": 45,
      "questionText": "What is the time complexity...",
      "questionType": "multiple_choice",
      "points": 5,
      "difficulty": "medium"
    },
    "performanceMetrics": {
      "totalAttempts": 125,
      "correctAttempts": 92,
      "correctRate": 73.6,
      "averageResponseTime": "45 seconds",
      "difficultyIndex": 0.736,
      "discriminationIndex": 0.42
    },
    "responseDistribution": [
      {
        "optionId": 180,
        "optionText": "O(log n)",
        "responseCount": 92,
        "percentage": 73.6,
        "isCorrect": true
      },
      {
        "optionId": 181,
        "optionText": "O(n)",
        "responseCount": 18,
        "percentage": 14.4,
        "isCorrect": false
      }
    ],
    "timeAnalysis": {
      "averageTime": "45 seconds",
      "medianTime": "42 seconds",
      "fastestTime": "15 seconds",
      "slowestTime": "120 seconds",
      "timeDistribution": {
        "0-30s": 25,
        "31-60s": 75,
        "61-90s": 20,
        "90s+": 5
      }
    },
    "learningIndicators": {
      "needsReview": false,
      "isEffective": true,
      "suggestedDifficulty": "medium",
      "qualityScore": 8.2
    }
  }
}
```

#### `GET /questions/analytics/summary` 🔒 Creator/Admin
**Get Question Bank Analytics**
```typescript
// Query Parameters
?testId=15&timeframe=30days&includeInactive=false

// Response
{
  "success": true,
  "data": {
    "overview": {
      "totalQuestions": 25,
      "totalAttempts": 3125,
      "averageCorrectRate": 78.4,
      "averageResponseTime": "52 seconds",
      "qualityScore": 7.8
    },
    "typeDistribution": {
      "multiple_choice": { "count": 15, "avgCorrectRate": 76.2 },
      "true_false": { "count": 5, "avgCorrectRate": 85.4 },
      "short_answer": { "count": 3, "avgCorrectRate": 72.1 },
      "essay": { "count": 2, "avgCorrectRate": 88.5 }
    },
    "difficultyAnalysis": {
      "easy": { "count": 8, "avgCorrectRate": 89.2, "avgTime": "35s" },
      "medium": { "count": 12, "avgCorrectRate": 73.8, "avgTime": "58s" },
      "hard": { "count": 5, "avgCorrectRate": 61.4, "avgTime": "78s" }
    },
    "topPerformingQuestions": [
      {
        "questionId": 52,
        "questionText": "What is a variable in programming?",
        "correctRate": 94.2,
        "discriminationIndex": 0.65,
        "qualityScore": 9.1
      }
    ],
    "questionsCeedingReview": [
      {
        "questionId": 48,
        "questionText": "Explain polymorphism in OOP",
        "correctRate": 42.1,
        "issues": ["Low correct rate", "Poor discrimination"],
        "suggestions": ["Revise wording", "Add more options"]
      }
    ]
  }
}
```

### Question Search & Discovery

#### `GET /questions/search` 🔒 Protected
**Advanced Question Search**
```typescript
// Query Parameters
?q=algorithm&type=multiple_choice&difficulty=medium&tags=complexity&minPoints=3

// Response
{
  "success": true,
  "data": {
    "questions": [ /* Matching questions */ ],
    "facets": {
      "types": [
        { "type": "multiple_choice", "count": 45 },
        { "type": "true_false", "count": 23 }
      ],
      "difficulties": [
        { "difficulty": "easy", "count": 32 },
        { "difficulty": "medium", "count": 28 }
      ],
      "tags": [
        { "tag": "algorithms", "count": 67 },
        { "tag": "complexity", "count": 23 }
      ],
      "pointRanges": [
        { "range": "1-3", "count": 15 },
        { "range": "4-6", "count": 35 }
      ]
    },
    "suggestions": [
      "binary search algorithm",
      "sorting algorithms",
      "graph algorithms"
    ]
  }
}
```

### Question Operations

#### `DELETE /questions/:id` 🔒 Creator/Admin
**Delete Question**
```typescript
// Response
{
  "success": true,
  "message": "Question deleted successfully"
}
```

## 🔧 Service Layer

### QuestionsService Core Methods

#### Question CRUD Operations
```typescript
// Create question
async create(createQuestionDto: CreateQuestionDto, scope: OrgBranchScope): Promise<Question>

// Find question by ID
async findOne(id: number, scope: OrgBranchScope): Promise<Question | null>

// Update question
async update(id: number, updateQuestionDto: UpdateQuestionDto, scope: OrgBranchScope): Promise<Question>

// Delete question
async remove(id: number, scope: OrgBranchScope): Promise<void>

// Find questions with filtering
async findAll(filters: QuestionFilterDto, scope: OrgBranchScope): Promise<PaginatedQuestions>
```

#### Question Management Operations
```typescript
// Find questions by test
async findByTest(testId: number, scope: OrgBranchScope): Promise<Question[]>

// Duplicate question
async duplicate(questionId: number, targetTestId: number, scope: OrgBranchScope): Promise<Question>

// Reorder questions
async reorderQuestions(testId: number, questionOrders: QuestionOrder[], scope: OrgBranchScope): Promise<Question[]>

// Bulk create questions
async bulkCreate(testId: number, questions: CreateQuestionDto[], scope: OrgBranchScope): Promise<Question[]>

// Clone questions to different test
async cloneToTest(sourceTestId: number, targetTestId: number, scope: OrgBranchScope): Promise<Question[]>
```

#### Analytics & Statistics
```typescript
// Get question analytics
async getQuestionAnalytics(questionId: number, scope: OrgBranchScope): Promise<QuestionAnalytics>

// Get question bank summary
async getQuestionBankSummary(testId: number, scope: OrgBranchScope): Promise<QuestionBankSummary>

// Calculate question difficulty
async calculateQuestionDifficulty(questionId: number): Promise<DifficultyMetrics>

// Generate question performance report
async generatePerformanceReport(questionIds: number[]): Promise<PerformanceReport>
```

### Question Validation & Business Logic

#### Question Creation Validation
```typescript
// Validate question data
async validateQuestionData(createQuestionDto: CreateQuestionDto): Promise<void>

// Validate question options
async validateQuestionOptions(questionType: QuestionType, options: QuestionOption[]): Promise<void>

// Check test ownership
async validateTestOwnership(testId: number, userId: string): Promise<boolean>

// Validate question constraints
async validateQuestionConstraints(questionData: CreateQuestionDto): Promise<ValidationResult>
```

#### Question Content Management
```typescript
// Format question text
async formatQuestionText(text: string): Promise<string>

// Sanitize question content
async sanitizeQuestionContent(content: string): Promise<string>

// Validate question tags
async validateQuestionTags(tags: string[]): Promise<string[]>

// Generate question preview
async generateQuestionPreview(questionId: number): Promise<QuestionPreview>
```

## 🔄 Integration Points

### Test Module Integration
```typescript
// Validate test exists and user has access
async validateTestAccess(testId: number, userId: string): Promise<Test>

// Update test question count
async updateTestQuestionCount(testId: number): Promise<void>

// Calculate test total points
async calculateTestTotalPoints(testId: number): Promise<number>

// Get test question statistics
async getTestQuestionStats(testId: number): Promise<TestQuestionStats>
```

### Question Options Integration
```typescript
// Create question options
async createQuestionOptions(questionId: number, options: CreateQuestionOptionDto[]): Promise<QuestionOption[]>

// Update question options
async updateQuestionOptions(questionId: number, options: UpdateQuestionOptionDto[]): Promise<QuestionOption[]>

// Validate option correctness
async validateOptionCorrectness(options: QuestionOption[]): Promise<boolean>
```

### Answer Module Integration
```typescript
// Track question responses
async trackQuestionResponse(questionId: number, userId: string, response: string): Promise<void>

// Calculate question performance
async calculateQuestionPerformance(questionId: number): Promise<QuestionPerformance>

// Update question statistics
async updateQuestionStats(questionId: number, answerData: AnswerData): Promise<void>
```

## 🔒 Access Control & Permissions

### Question Permissions
```typescript
export enum QuestionPermission {
    VIEW = 'question:view',
    CREATE = 'question:create',
    EDIT = 'question:edit',
    DELETE = 'question:delete',
    DUPLICATE = 'question:duplicate',
    VIEW_ANALYTICS = 'question:view_analytics',
    BULK_OPERATIONS = 'question:bulk_operations',
}
```

### Permission Guards
```typescript
@UseGuards(JwtAuthGuard, QuestionOwnershipGuard)
async updateQuestion(@Param('id') questionId: number, @Body() updateDto: UpdateQuestionDto) {
    // Question update logic
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions(QuestionPermission.VIEW_ANALYTICS)
async getQuestionAnalytics(@Param('id') questionId: number) {
    // Analytics logic
}
```

### Data Scoping
```typescript
// Automatic scoping based on organization/branch
async findAccessibleQuestions(scope: OrgBranchScope): Promise<Question[]> {
    return this.questionRepository.find({
        where: [
            { orgId: { id: scope.orgId } },
            { branchId: { id: scope.branchId } }
        ],
        relations: ['test', 'options']
    });
}
```

## 📊 Performance Optimizations

### Database Indexes
```sql
-- Question performance indexes
CREATE INDEX IDX_QUESTION_TEST ON questions(testId);
CREATE INDEX IDX_QUESTION_ORDER ON questions(testId, orderIndex);
CREATE INDEX IDX_QUESTION_TYPE ON questions(questionType);
CREATE INDEX IDX_QUESTION_DIFFICULTY ON questions(difficulty);
CREATE INDEX IDX_QUESTION_POINTS ON questions(points);
CREATE INDEX IDX_QUESTION_CREATED ON questions(createdAt);

-- Text search indexes
CREATE FULLTEXT INDEX IDX_QUESTION_SEARCH ON questions(questionText);
CREATE INDEX IDX_QUESTION_TAGS ON questions(tags);
```

### Caching Strategy
```typescript
// Cache keys
QUESTION_CACHE_PREFIX = 'question:'
QUESTION_LIST_CACHE_PREFIX = 'question_list:'
QUESTION_ANALYTICS_CACHE_PREFIX = 'question_analytics:'

// Cache operations
async getCachedQuestion(questionId: number): Promise<Question | null>
async cacheQuestion(question: Question): Promise<void>
async invalidateQuestionCache(questionId: number): Promise<void>
async cacheQuestionAnalytics(questionId: number, analytics: QuestionAnalytics): Promise<void>
```

### Query Optimizations
```typescript
// Efficient question loading with options
const questions = await this.questionRepository
    .createQueryBuilder('question')
    .leftJoinAndSelect('question.options', 'options')
    .leftJoinAndSelect('question.test', 'test')
    .leftJoinAndSelect('test.course', 'course')
    .where('question.testId = :testId', { testId })
    .orderBy('question.orderIndex', 'ASC')
    .addOrderBy('options.orderIndex', 'ASC')
    .getMany();
```

## 🧪 Testing Strategy

### Unit Tests
- **Service Method Testing**: All CRUD operations and business logic
- **Validation Testing**: Question creation and content validation
- **Analytics Testing**: Performance metrics calculation
- **Content Processing**: Text formatting and sanitization

### Integration Tests
- **API Endpoint Testing**: All controller endpoints
- **Database Integration**: Entity relationships and constraints
- **Test Integration**: Question-test relationship validation
- **Option Integration**: Question-option associations

### Performance Tests
- **Load Testing**: High-volume question operations
- **Search Performance**: Question search and filtering
- **Analytics Performance**: Statistics generation
- **Bulk Operations**: Large-scale question management

## 🔗 Dependencies

### Internal Dependencies
- **TestModule**: Test validation and association
- **UserModule**: User authentication and permissions
- **QuestionOptionsModule**: Answer options management
- **AnswerModule**: Response tracking and analytics
- **OrganizationModule**: Multi-tenant organization support
- **BranchModule**: Departmental structure support

### External Dependencies
- **TypeORM**: Database ORM and query building
- **class-validator**: Input validation and sanitization
- **class-transformer**: Data transformation and serialization
- **@nestjs/swagger**: API documentation generation

## 🚀 Usage Examples

### Basic Question Operations
```typescript
// Create multiple choice question
const question = await questionsService.create({
    testId: 15,
    questionText: "What is the time complexity of binary search?",
    questionType: QuestionType.MULTIPLE_CHOICE,
    points: 5,
    orderIndex: 1,
    difficulty: "medium",
    tags: ["algorithms", "complexity"],
    options: [
        { optionText: "O(log n)", isCorrect: true, orderIndex: 1 },
        { optionText: "O(n)", isCorrect: false, orderIndex: 2 }
    ]
}, scope);

// Find question with options
const questionDetails = await questionsService.findOne(questionId, scope);

// Update question
const updatedQuestion = await questionsService.update(questionId, {
    questionText: "Updated question text",
    points: 10
}, scope);
```

### Question Analytics
```typescript
// Get question analytics
const analytics = await questionsService.getQuestionAnalytics(questionId, scope);

// Get question bank summary
const summary = await questionsService.getQuestionBankSummary(testId, scope);

// Calculate difficulty metrics
const difficulty = await questionsService.calculateQuestionDifficulty(questionId);
```

### Bulk Operations
```typescript
// Bulk create questions
const questions = await questionsService.bulkCreate(testId, [
    { questionText: "Question 1", questionType: "multiple_choice", points: 5 },
    { questionText: "Question 2", questionType: "true_false", points: 3 }
], scope);

// Reorder questions
await questionsService.reorderQuestions(testId, [
    { questionId: 1, orderIndex: 1 },
    { questionId: 2, orderIndex: 2 }
], scope);
```

## 🔮 Future Enhancements

### Planned Features
1. **AI-Powered Question Generation**: Automated question creation from content
2. **Adaptive Difficulty**: Dynamic difficulty adjustment based on performance
3. **Question Templates**: Reusable question formats and structures
4. **Collaborative Editing**: Real-time question editing with multiple authors
5. **Advanced Analytics**: Machine learning-based question quality assessment

### Scalability Improvements
- **Question Bank System**: Centralized question repository
- **Content Versioning**: Version control for question content
- **Real-time Collaboration**: Live editing and commenting
- **Advanced Search**: Natural language question search

### Content Enhancements
- **Rich Media Support**: Images, videos, and interactive content
- **Mathematical Notation**: LaTeX and MathML support
- **Code Questions**: Syntax highlighting and execution
- **Multimedia Questions**: Audio and video-based questions

---

This Questions module provides comprehensive question management with enterprise-grade features including multiple question types, detailed analytics, content validation, and performance optimizations, serving as the foundation for all assessment content in the trainpro platform. 