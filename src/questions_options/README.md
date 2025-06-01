# 🔢 Question Options Management Module

## Overview

The Question Options Management Module is the answer choice engine of the trainpro platform, providing comprehensive management of multiple choice options, true/false selections, and other structured answer formats. This module handles option creation, validation, ordering, correctness tracking, and detailed option analytics with enterprise-grade features for educational institutions and corporate training programs.

## 🏗️ Architecture

```
questions_options/
├── questions_options.controller.ts  # REST API endpoints for option operations
├── questions_options.service.ts    # Core business logic and option management
├── questions_options.module.ts     # Module configuration & dependencies
├── entities/                       # Database entities
│   └── question_option.entity.ts  # Option entity with relationships
├── dto/                           # Data Transfer Objects
│   ├── create-question-option.dto.ts  # Option creation validation
│   ├── update-question-option.dto.ts  # Option modification validation
│   └── option-response.dto.ts        # API response formats
└── questions_options.controller.spec.ts # API endpoint tests
└── questions_options.service.spec.ts    # Service layer tests
```

## 🎯 Core Features

### Option Management
- **Multiple Choice Options** with unlimited answer choices
- **True/False Options** for binary decision questions
- **Correct Answer Marking** with single or multiple correct options
- **Option Ordering** with flexible positioning within questions
- **Rich Content Support** with text formatting and media integration

### Content Organization
- **Question Association** with seamless integration to question entities
- **Option Validation** ensuring correctness and completeness
- **Bulk Operations** for efficient option management
- **Option Templates** for standardized answer formats
- **Version Control** for option updates and revisions

### Analytics & Performance
- **Response Analytics** with selection frequency tracking
- **Correctness Statistics** with detailed performance metrics
- **Distractor Analysis** for incorrect option effectiveness
- **Time Tracking** for option selection patterns
- **Learning Insights** based on option choice patterns

### Multi-Tenancy & Organization
- **Organization-Level Options** with access control
- **Branch-Specific Content** for departmental customization
- **Content Sharing** across organizational units
- **Quality Control** with validation and approval workflows
- **Collaborative Editing** with instructor permissions

## 📊 Database Schema

### Question Option Entity
```typescript
@Entity('question_options')
export class QuestionOption {
    @PrimaryGeneratedColumn()
    optionId: number;

    @Column()
    @Index()
    questionId: number;

    @Column('text')
    optionText: string;

    @Column({ default: false })
    isCorrect: boolean;

    @Column()
    @Index()
    orderIndex: number;

    @Column('text', { nullable: true })
    explanation?: string;

    @Column('text', { nullable: true })
    feedback?: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Organization)
    orgId: Organization;

    @ManyToOne(() => Branch)
    branchId?: Branch;

    // Relationships
    @ManyToOne(() => Question, { onDelete: 'CASCADE' })
    question: Question;

    @OneToMany(() => Answer, 'selectedOption')
    selectedAnswers: Answer[];
}
```

## 📚 API Endpoints

### Option Management

#### `POST /question-options` 🔒 Creator/Admin
**Create New Option**
```typescript
// Request
{
  "questionId": 45,
  "optionText": "O(log n)",
  "isCorrect": true,
  "orderIndex": 1,
  "explanation": "Correct! Binary search reduces the problem size by half each time.",
  "feedback": "Great choice! This demonstrates understanding of logarithmic complexity."
}

// Response
{
  "success": true,
  "data": {
    "optionId": 180,
    "questionId": 45,
    "optionText": "O(log n)",
    "isCorrect": true,
    "orderIndex": 1,
    "explanation": "Correct! Binary search reduces the problem size by half each time.",
    "feedback": "Great choice! This demonstrates understanding of logarithmic complexity.",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "question": {
      "questionId": 45,
      "questionText": "What is the time complexity of binary search algorithm?",
      "test": { "title": "Data Structures Quiz" }
    }
  },
  "message": "Option created successfully"
}
```

#### `GET /question-options` 🔒 Protected
**List Options with Filtering**
```typescript
// Query Parameters
?page=1&limit=20&questionId=45&isCorrect=true&search=complexity

// Response
{
  "success": true,
  "data": {
    "options": [
      {
        "optionId": 180,
        "questionId": 45,
        "optionText": "O(log n)",
        "isCorrect": true,
        "orderIndex": 1,
        "selectionCount": 92,
        "selectionRate": 73.6,
        "question": {
          "questionText": "What is the time complexity of binary search?",
          "questionType": "multiple_choice"
        },
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 4,
      "totalOptions": 78,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalOptions": 78,
      "correctOptions": 19,
      "incorrectOptions": 59,
      "averageSelectionRate": 25.2
    }
  }
}
```

#### `GET /question-options/question/:questionId` 🔒 Protected
**Get Options by Question**
```typescript
// Response
{
  "success": true,
  "data": {
    "options": [
      {
        "optionId": 180,
        "optionText": "O(log n)",
        "isCorrect": true,
        "orderIndex": 1,
        "explanation": "Correct! Binary search reduces the problem size by half each time.",
        "statistics": {
          "selectionCount": 92,
          "selectionRate": 73.6,
          "isDistractor": false,
          "effectiveness": 0.85
        }
      },
      {
        "optionId": 181,
        "optionText": "O(n)",
        "isCorrect": false,
        "orderIndex": 2,
        "explanation": "This would be linear search, not binary search.",
        "statistics": {
          "selectionCount": 18,
          "selectionRate": 14.4,
          "isDistractor": true,
          "effectiveness": 0.42
        }
      }
    ],
    "questionInfo": {
      "questionId": 45,
      "questionText": "What is the time complexity of binary search algorithm?",
      "questionType": "multiple_choice",
      "totalResponses": 125
    }
  }
}
```

#### `GET /question-options/:id` 🔒 Protected
**Get Option Details**
```typescript
// Response
{
  "success": true,
  "data": {
    "option": {
      "optionId": 180,
      "questionId": 45,
      "optionText": "O(log n)",
      "isCorrect": true,
      "orderIndex": 1,
      "explanation": "Correct! Binary search reduces the problem size by half each time.",
      "feedback": "Great choice! This demonstrates understanding of logarithmic complexity.",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    "question": {
      "questionId": 45,
      "questionText": "What is the time complexity of binary search algorithm?",
      "questionType": "multiple_choice",
      "test": {
        "testId": 15,
        "title": "Data Structures Quiz",
        "course": { "title": "Computer Science Fundamentals" }
      }
    },
    "statistics": {
      "selectionCount": 92,
      "selectionRate": 73.6,
      "correctSelections": 92,
      "incorrectSelections": 0,
      "averageResponseTime": "12 seconds",
      "confidenceLevel": 8.2,
      "learningImpact": 0.78
    }
  }
}
```

#### `PUT /question-options/:id` 🔒 Creator/Admin
**Update Option**
```typescript
// Request
{
  "optionText": "Updated: O(log n) - Logarithmic complexity",
  "explanation": "Updated explanation with more detail about logarithmic time complexity",
  "feedback": "Updated feedback with additional context",
  "orderIndex": 2
}

// Response
{
  "success": true,
  "data": {
    "option": { /* Updated option details */ }
  },
  "message": "Option updated successfully"
}
```

### Option Operations

#### `POST /question-options/bulk-create` 🔒 Creator/Admin
**Bulk Create Options**
```typescript
// Request
{
  "questionId": 45,
  "options": [
    {
      "optionText": "O(log n)",
      "isCorrect": true,
      "orderIndex": 1,
      "explanation": "Correct answer explanation"
    },
    {
      "optionText": "O(n)",
      "isCorrect": false,
      "orderIndex": 2,
      "explanation": "Incorrect answer explanation"
    },
    {
      "optionText": "O(n²)",
      "isCorrect": false,
      "orderIndex": 3
    }
  ]
}

// Response
{
  "success": true,
  "data": {
    "createdOptions": [ /* Array of created options */ ],
    "summary": {
      "totalCreated": 3,
      "correctOptions": 1,
      "incorrectOptions": 2,
      "successCount": 3,
      "errorCount": 0
    }
  },
  "message": "3 options created successfully"
}
```

#### `PATCH /question-options/reorder` 🔒 Creator/Admin
**Reorder Options**
```typescript
// Request
{
  "questionId": 45,
  "optionOrders": [
    { "optionId": 182, "orderIndex": 1 },
    { "optionId": 180, "orderIndex": 2 },
    { "optionId": 181, "orderIndex": 3 }
  ]
}

// Response
{
  "success": true,
  "data": {
    "updatedOptions": [ /* Reordered options */ ]
  },
  "message": "Options reordered successfully"
}
```

#### `POST /question-options/:id/duplicate` 🔒 Creator/Admin
**Duplicate Option**
```typescript
// Request
{
  "targetQuestionId": 50,
  "newOrderIndex": 3
}

// Response
{
  "success": true,
  "data": {
    "originalOption": { /* Original option */ },
    "duplicatedOption": { /* New option copy */ }
  },
  "message": "Option duplicated successfully"
}
```

### Option Analytics

#### `GET /question-options/:id/analytics` 🔒 Creator/Admin
**Get Option Analytics**
```typescript
// Response
{
  "success": true,
  "data": {
    "optionInfo": {
      "optionId": 180,
      "optionText": "O(log n)",
      "isCorrect": true,
      "orderIndex": 1
    },
    "selectionMetrics": {
      "totalSelections": 92,
      "selectionRate": 73.6,
      "correctSelections": 92,
      "incorrectSelections": 0,
      "averageResponseTime": "12 seconds"
    },
    "comparisonMetrics": {
      "relativePopularity": 0.736,
      "distractorEffectiveness": 0.0,
      "discriminationIndex": 0.65,
      "optionQuality": 9.2
    },
    "temporalAnalysis": {
      "selectionTrend": [
        { "date": "2024-01-10", "selections": 15 },
        { "date": "2024-01-11", "selections": 23 },
        { "date": "2024-01-12", "selections": 18 }
      ],
      "timeDistribution": {
        "0-5s": 12,
        "6-15s": 58,
        "16-30s": 20,
        "30s+": 2
      }
    },
    "learningIndicators": {
      "isEffectiveCorrect": true,
      "isEffectiveDistractor": false,
      "needsRevision": false,
      "qualityScore": 9.2
    }
  }
}
```

#### `GET /question-options/analytics/summary` 🔒 Creator/Admin
**Get Options Analytics Summary**
```typescript
// Query Parameters
?questionId=45&timeframe=30days

// Response
{
  "success": true,
  "data": {
    "overview": {
      "totalOptions": 4,
      "correctOptions": 1,
      "incorrectOptions": 3,
      "totalSelections": 125,
      "averageSelectionRate": 25.0
    },
    "optionPerformance": [
      {
        "optionId": 180,
        "optionText": "O(log n)",
        "isCorrect": true,
        "selectionRate": 73.6,
        "effectiveness": 0.92,
        "qualityScore": 9.2
      },
      {
        "optionId": 181,
        "optionText": "O(n)",
        "isCorrect": false,
        "selectionRate": 14.4,
        "effectiveness": 0.42,
        "qualityScore": 6.8
      }
    ],
    "distractorAnalysis": {
      "effectiveDistractors": 2,
      "ineffectiveDistractors": 1,
      "averageDistractorRate": 8.8,
      "recommendedActions": [
        "Consider revising option 183 - too few selections",
        "Option 181 is an effective distractor"
      ]
    },
    "qualityMetrics": {
      "overallQuality": 8.1,
      "discriminationIndex": 0.58,
      "optionBalance": 0.72,
      "contentValidity": 0.89
    }
  }
}
```

### Option Operations

#### `DELETE /question-options/:id` 🔒 Creator/Admin
**Delete Option**
```typescript
// Response
{
  "success": true,
  "message": "Option deleted successfully"
}
```

## 🔧 Service Layer

### QuestionOptionsService Core Methods

#### Option CRUD Operations
```typescript
// Create option
async create(createOptionDto: CreateQuestionOptionDto, scope: OrgBranchScope): Promise<QuestionOption>

// Find option by ID
async findOne(id: number, scope: OrgBranchScope): Promise<QuestionOption | null>

// Update option
async update(id: number, updateOptionDto: UpdateQuestionOptionDto, scope: OrgBranchScope): Promise<QuestionOption>

// Delete option
async remove(id: number, scope: OrgBranchScope): Promise<void>

// Find options with filtering
async findAll(filters: OptionFilterDto, scope: OrgBranchScope): Promise<PaginatedOptions>
```

#### Option Management Operations
```typescript
// Find options by question
async findByQuestion(questionId: number, scope: OrgBranchScope): Promise<QuestionOption[]>

// Bulk create options
async bulkCreate(questionId: number, options: CreateQuestionOptionDto[], scope: OrgBranchScope): Promise<QuestionOption[]>

// Reorder options
async reorderOptions(questionId: number, optionOrders: OptionOrder[], scope: OrgBranchScope): Promise<QuestionOption[]>

// Duplicate option
async duplicate(optionId: number, targetQuestionId: number, scope: OrgBranchScope): Promise<QuestionOption>

// Clone options to different question
async cloneToQuestion(sourceQuestionId: number, targetQuestionId: number, scope: OrgBranchScope): Promise<QuestionOption[]>
```

#### Analytics & Statistics
```typescript
// Get option analytics
async getOptionAnalytics(optionId: number, scope: OrgBranchScope): Promise<OptionAnalytics>

// Get options summary
async getOptionsSummary(questionId: number, scope: OrgBranchScope): Promise<OptionsSummary>

// Calculate distractor effectiveness
async calculateDistractorEffectiveness(optionId: number): Promise<DistractorMetrics>

// Generate option performance report
async generatePerformanceReport(optionIds: number[]): Promise<OptionPerformanceReport>
```

### Option Validation & Business Logic

#### Option Creation Validation
```typescript
// Validate option data
async validateOptionData(createOptionDto: CreateQuestionOptionDto): Promise<void>

// Validate option correctness
async validateOptionCorrectness(questionId: number, options: QuestionOption[]): Promise<ValidationResult>

// Check question ownership
async validateQuestionOwnership(questionId: number, userId: string): Promise<boolean>

// Validate option constraints
async validateOptionConstraints(optionData: CreateQuestionOptionDto): Promise<ValidationResult>
```

#### Option Content Management
```typescript
// Format option text
async formatOptionText(text: string): Promise<string>

// Sanitize option content
async sanitizeOptionContent(content: string): Promise<string>

// Validate option order
async validateOptionOrder(questionId: number, orderIndex: number): Promise<boolean>

// Generate option preview
async generateOptionPreview(optionId: number): Promise<OptionPreview>
```

## 🔄 Integration Points

### Question Module Integration
```typescript
// Validate question exists and user has access
async validateQuestionAccess(questionId: number, userId: string): Promise<Question>

// Update question option count
async updateQuestionOptionCount(questionId: number): Promise<void>

// Validate question type compatibility
async validateQuestionTypeCompatibility(questionId: number, optionType: string): Promise<boolean>

// Get question option statistics
async getQuestionOptionStats(questionId: number): Promise<QuestionOptionStats>
```

### Answer Module Integration
```typescript
// Track option selections
async trackOptionSelection(optionId: number, userId: string, timestamp: Date): Promise<void>

// Calculate option performance
async calculateOptionPerformance(optionId: number): Promise<OptionPerformance>

// Update option statistics
async updateOptionStats(optionId: number, selectionData: SelectionData): Promise<void>

// Get selection patterns
async getSelectionPatterns(optionId: number): Promise<SelectionPattern[]>
```

## 🔒 Access Control & Permissions

### Option Permissions
```typescript
export enum OptionPermission {
    VIEW = 'option:view',
    CREATE = 'option:create',
    EDIT = 'option:edit',
    DELETE = 'option:delete',
    REORDER = 'option:reorder',
    VIEW_ANALYTICS = 'option:view_analytics',
    BULK_OPERATIONS = 'option:bulk_operations',
}
```

## 📊 Performance Optimizations

### Database Indexes
```sql
-- Option performance indexes
CREATE INDEX IDX_OPTION_QUESTION ON question_options(questionId);
CREATE INDEX IDX_OPTION_ORDER ON question_options(questionId, orderIndex);
CREATE INDEX IDX_OPTION_CORRECT ON question_options(isCorrect);
CREATE INDEX IDX_OPTION_ACTIVE ON question_options(isActive);
CREATE INDEX IDX_OPTION_CREATED ON question_options(createdAt);

-- Text search indexes
CREATE FULLTEXT INDEX IDX_OPTION_SEARCH ON question_options(optionText);
```

### Caching Strategy
```typescript
// Cache keys
OPTION_CACHE_PREFIX = 'option:'
OPTION_LIST_CACHE_PREFIX = 'option_list:'
OPTION_ANALYTICS_CACHE_PREFIX = 'option_analytics:'

// Cache operations
async getCachedOption(optionId: number): Promise<QuestionOption | null>
async cacheOption(option: QuestionOption): Promise<void>
async invalidateOptionCache(optionId: number): Promise<void>
```

## 🚀 Usage Examples

### Basic Option Operations
```typescript
// Create multiple choice options
const options = await questionOptionsService.bulkCreate(questionId, [
    { optionText: "O(log n)", isCorrect: true, orderIndex: 1 },
    { optionText: "O(n)", isCorrect: false, orderIndex: 2 },
    { optionText: "O(n²)", isCorrect: false, orderIndex: 3 }
], scope);

// Get option analytics
const analytics = await questionOptionsService.getOptionAnalytics(optionId, scope);

// Reorder options
await questionOptionsService.reorderOptions(questionId, [
    { optionId: 1, orderIndex: 3 },
    { optionId: 2, orderIndex: 1 }
], scope);
```

## 🔮 Future Enhancements

### Planned Features
1. **Rich Media Options**: Image and video answer choices
2. **Dynamic Options**: Context-aware option generation
3. **Option Templates**: Reusable option patterns
4. **Advanced Analytics**: Machine learning option effectiveness
5. **Collaborative Editing**: Multi-author option creation

---

This Question Options module provides comprehensive answer choice management with enterprise-grade features including detailed analytics, performance tracking, and optimization tools for effective assessment design. 