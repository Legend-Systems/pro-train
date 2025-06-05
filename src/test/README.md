# 📝 Test Management Module

## Overview

The Test Management Module is the assessment engine of the trainpro platform, providing comprehensive test creation, configuration, administration, and analytics capabilities. This module handles exam creation, quiz management, training assessments, timing controls, attempt management, and detailed test analytics with enterprise-grade features for educational institutions and corporate training programs.

## 🏗️ Architecture

```
test/
├── test.controller.ts          # REST API endpoints for test operations
├── test.service.ts            # Core business logic and test management
├── test.module.ts             # Module configuration & dependencies
├── entities/                  # Database entities
│   └── test.entity.ts        # Test entity with relationships
├── dto/                      # Data Transfer Objects
│   ├── create-test.dto.ts    # Test creation validation
│   ├── update-test.dto.ts    # Test modification validation
│   ├── test-filter.dto.ts    # Filtering and search criteria
│   └── test-response.dto.ts  # API response formats
└── test.controller.spec.ts    # API endpoint tests
└── test.service.spec.ts       # Service layer tests
```

## 🎯 Core Features

### Test Creation & Configuration
- **Multiple Test Types** (exam, quiz, training)
- **Flexible Timing** with optional duration limits
- **Attempt Control** with customizable retry policies
- **Test Activation** and scheduling controls
- **Rich Metadata** with descriptions and instructions
- **Atomic Test Creation** with questions and answer options in single API call
- **Transaction Safety** ensuring complete test creation or rollback
- **Question Types Support** (multiple choice, essay, true/false, short answer, fill-in-blank)

### Test Administration
- **Course Integration** with seamless course association
- **Access Control** with instructor/student permissions
- **Test Status Management** (active/inactive states)
- **Bulk Operations** for efficient administration
- **Version Control** for test updates

### Analytics & Reporting
- **Performance Metrics** with detailed statistics
- **Attempt Tracking** and completion rates
- **Score Analytics** with distribution analysis
- **Time Analysis** for completion patterns
- **Progress Monitoring** across test sessions

### Multi-Tenancy & Organization
- **Organization-Level Tests** with access control
- **Branch-Specific Content** for departmental assessments
- **Role-Based Permissions** for test management
- **Data Isolation** by organizational structure
- **Instructor Assignment** and ownership tracking

## 📊 Database Schema

### Test Entity
```typescript
@Entity('tests')
export class Test {
    @PrimaryGeneratedColumn()
    testId: number;

    @Column()
    @Index()
    courseId: number;

    @Column()
    @Index()
    title: string;

    @Column('text', { nullable: true })
    description?: string;

    @Column({
        type: 'enum',
        enum: TestType,
    })
    testType: TestType;

    @Column({ nullable: true })
    durationMinutes?: number;

    @Column({ default: 1 })
    maxAttempts: number;

    @Column({ default: true })
    @Index()
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
    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    course: Course;

    @OneToMany(() => Question, 'test')
    questions: Question[];

    @OneToMany(() => TestAttempt, 'test')
    testAttempts: TestAttempt[];

    @OneToMany(() => Result, 'test')
    results: Result[];

    @OneToMany(() => TrainingProgress, 'test')
    trainingProgress: TrainingProgress[];
}
```

### Test Types
```typescript
export enum TestType {
    EXAM = 'exam',        // Formal examinations
    QUIZ = 'quiz',        // Quick assessments
    TRAINING = 'training', // Training modules
}
```

## 📚 API Endpoints

### Test Management

#### `POST /tests` 🔒 Creator/Admin
**Create New Test (with Optional Questions)**
```typescript
// Basic Request - Test Only (Questions Added Later)
{
  "courseId": 1,
  "title": "Chapter 1 Quiz",
  "description": "Basic quiz covering chapter 1 material.",
  "testType": "quiz",
  "durationMinutes": 30,
  "maxAttempts": 2
}

// Complete Request - Test with Questions and Options
{
  "courseId": 1,
  "title": "Final Exam - Computer Science Fundamentals",
  "description": "Comprehensive final examination covering all course material. Time limit: 3 hours.",
  "testType": "exam",
  "durationMinutes": 180,
  "maxAttempts": 1,
  "questions": [
    {
      "questionText": "What is the time complexity of binary search algorithm?",
      "questionType": "multiple_choice",
      "points": 5,
      "orderIndex": 1,
      "explanation": "Binary search divides the search space in half with each comparison, making it very efficient",
      "hint": "Think about how the algorithm reduces the problem size with each step",
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
    },
    {
      "questionText": "Explain the concept of recursion in programming and provide an example.",
      "questionType": "essay",
      "points": 10,
      "orderIndex": 2,
      "explanation": "Recursion is a programming technique where a function calls itself to solve smaller instances of the same problem",
      "hint": "Consider base cases and recursive cases in your explanation",
      "difficulty": "hard",
      "tags": ["recursion", "programming concepts", "functions"]
    },
    {
      "questionText": "Is Python a compiled language?",
      "questionType": "true_false",
      "points": 2,
      "orderIndex": 3,
      "explanation": "Python is an interpreted language, not compiled. It converts source code to bytecode at runtime",
      "hint": "Think about how Python code is executed",
      "difficulty": "easy",
      "tags": ["python", "programming languages", "compilation"],
      "options": [
        {
          "optionText": "True",
          "isCorrect": false,
          "orderIndex": 1
        },
        {
          "optionText": "False",
          "isCorrect": true,
          "orderIndex": 2
        }
      ]
    }
  ]
}

// Response - StandardResponse Format
{
  "success": true,
  "message": "Test created successfully",
  "data": {
    "testId": 123,
    "courseId": 1,
    "title": "Final Exam - Computer Science Fundamentals",
    "description": "Comprehensive final examination covering all course material...",
    "testType": "exam",
    "durationMinutes": 180,
    "maxAttempts": 1,
    "isActive": true,
    "createdAt": "2025-01-15T10:35:00Z",
    "updatedAt": "2025-01-15T10:35:00Z",
    "course": {
      "courseId": 1,
      "title": "Computer Science Fundamentals",
      "description": "Introduction to computer science concepts"
    },
    "questionCount": 3,
    "attemptCount": 0
  }
}
```

#### **Complete Test Creation Examples** 📚

The test creation endpoint supports creating comprehensive tests with questions and answer options in a single API call. Below are detailed examples for different test scenarios:

##### **Example 1: Programming Quiz with Mixed Question Types**
```json
POST /tests
{
  "courseId": 1,
  "title": "Programming Fundamentals Quiz",
  "description": "Assessment covering basic programming concepts including algorithms, data structures, and language fundamentals.",
  "testType": "quiz",
  "durationMinutes": 60,
  "maxAttempts": 2,
  "questions": [
    {
      "questionText": "What is the time complexity of binary search algorithm?",
      "questionType": "multiple_choice",
      "points": 5,
      "orderIndex": 1,
      "explanation": "Binary search divides the search space in half with each comparison, making it very efficient",
      "hint": "Think about how the algorithm reduces the problem size with each step",
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
    },
    {
      "questionText": "Explain the concept of recursion in programming and provide an example.",
      "questionType": "essay",
      "points": 10,
      "orderIndex": 2,
      "explanation": "Recursion is a programming technique where a function calls itself to solve smaller instances of the same problem",
      "hint": "Consider base cases and recursive cases in your explanation",
      "difficulty": "hard",
      "tags": ["recursion", "programming concepts", "functions"]
    },
    {
      "questionText": "Is Python a compiled language?",
      "questionType": "true_false",
      "points": 2,
      "orderIndex": 3,
      "explanation": "Python is an interpreted language, not compiled. It converts source code to bytecode at runtime",
      "hint": "Think about how Python code is executed",
      "difficulty": "easy",
      "tags": ["python", "programming languages", "compilation"],
      "options": [
        {
          "optionText": "True",
          "isCorrect": false,
          "orderIndex": 1
        },
        {
          "optionText": "False",
          "isCorrect": true,
          "orderIndex": 2
        }
      ]
    }
  ]
}
```

##### **Example 2: Formal Exam with Advanced Questions**
```json
POST /tests
{
  "courseId": 2,
  "title": "Data Structures & Algorithms Final Exam",
  "description": "Comprehensive final examination covering advanced data structures, algorithm design, and complexity analysis. This is a timed exam with limited attempts.",
  "testType": "exam",
  "durationMinutes": 180,
  "maxAttempts": 1,
  "questions": [
    {
      "questionText": "Compare and contrast the time complexities of different sorting algorithms (quicksort, mergesort, heapsort) and explain when you would use each.",
      "questionType": "essay",
      "points": 20,
      "orderIndex": 1,
      "explanation": "Students should demonstrate understanding of O(n log n) average case complexities, worst-case scenarios, and practical considerations like stability and in-place sorting",
      "hint": "Consider best-case, average-case, and worst-case scenarios for each algorithm",
      "difficulty": "expert",
      "tags": ["sorting", "algorithms", "complexity", "comparison"]
    },
    {
      "questionText": "Which data structure provides the most efficient insertion and deletion operations for maintaining a sorted collection?",
      "questionType": "multiple_choice",
      "points": 8,
      "orderIndex": 2,
      "explanation": "Balanced binary search trees like AVL or Red-Black trees provide O(log n) insertion, deletion, and search operations while maintaining sorted order",
      "hint": "Think about data structures that maintain order automatically",
      "difficulty": "hard",
      "tags": ["data structures", "trees", "efficiency"],
      "options": [
        {
          "optionText": "Array (sorted)",
          "isCorrect": false,
          "orderIndex": 1
        },
        {
          "optionText": "Linked List (sorted)",
          "isCorrect": false,
          "orderIndex": 2
        },
        {
          "optionText": "Balanced Binary Search Tree",
          "isCorrect": true,
          "orderIndex": 3
        },
        {
          "optionText": "Hash Table",
          "isCorrect": false,
          "orderIndex": 4
        }
      ]
    }
  ]
}
```

##### **Example 3: Training Module with Practice Questions**
```json
POST /tests
{
  "courseId": 3,
  "title": "JavaScript Fundamentals Practice",
  "description": "Practice module for JavaScript basics. No time limit, multiple attempts allowed for learning.",
  "testType": "training",
  "maxAttempts": 5,
  "questions": [
    {
      "questionText": "What will console.log(typeof null) output?",
      "questionType": "multiple_choice",
      "points": 3,
      "orderIndex": 1,
      "explanation": "This is a well-known JavaScript quirk. typeof null returns 'object' due to a bug in the original JavaScript implementation that was kept for backward compatibility",
      "hint": "This is a famous JavaScript gotcha that trips up many developers",
      "difficulty": "medium",
      "tags": ["javascript", "types", "quirks"],
      "options": [
        {
          "optionText": "null",
          "isCorrect": false,
          "orderIndex": 1
        },
        {
          "optionText": "undefined",
          "isCorrect": false,
          "orderIndex": 2
        },
        {
          "optionText": "object",
          "isCorrect": true,
          "orderIndex": 3
        },
        {
          "optionText": "string",
          "isCorrect": false,
          "orderIndex": 4
        }
      ]
    },
    {
      "questionText": "Closures in JavaScript allow inner functions to access variables from their outer scope even after the outer function has returned.",
      "questionType": "true_false",
      "points": 2,
      "orderIndex": 2,
      "explanation": "This statement is true. Closures are a fundamental concept in JavaScript that allows functions to 'remember' their lexical scope",
      "hint": "Think about what happens to variables when functions finish executing",
      "difficulty": "easy",
      "tags": ["javascript", "closures", "scope"],
      "options": [
        {
          "optionText": "True",
          "isCorrect": true,
          "orderIndex": 1
        },
        {
          "optionText": "False",
          "isCorrect": false,
          "orderIndex": 2
        }
      ]
    }
  ]
}
```

#### **Best Practices for Test Creation** 💡

1. **Question Ordering**: Use sequential `orderIndex` values (1, 2, 3...) for proper question ordering
2. **Option Ordering**: Use sequential `orderIndex` values for answer options to ensure consistent display
3. **Point Values**: Assign appropriate point values based on question difficulty and importance
4. **Explanations**: Always provide clear explanations for educational value
5. **Hints**: Use hints to guide students without giving away answers
6. **Tags**: Use consistent tagging for better question categorization and analytics
7. **Difficulty Levels**: Use appropriate difficulty levels (easy, medium, hard, expert) for grading curves
8. **Question Types**: Choose appropriate question types based on learning objectives:
   - `multiple_choice`: For factual knowledge and concept understanding
   - `true_false`: For simple concept validation
   - `essay`: For complex analysis and critical thinking
   - `short_answer`: For brief explanations
   - `fill_in_blank`: For specific knowledge testing

#### **Error Handling** ⚠️

The API provides comprehensive error handling with detailed error messages:

```json
// Validation Error Example
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "questions[0].options",
      "message": "At least one option must be marked as correct"
    },
    {
      "field": "courseId",
      "message": "Course ID must be a valid number"
    }
  ]
}

// Course Access Error
{
  "success": false,
  "message": "You do not have permission to create tests for this course",
  "statusCode": 403
}

// Database Error
{
  "success": false,
  "message": "Transaction failed - test creation rolled back",
  "statusCode": 500
}
```

#### **Atomic Transaction Behavior** 🔒

The test creation endpoint uses database transactions to ensure data consistency:

- **All-or-Nothing**: Either the entire test (including all questions and options) is created successfully, or nothing is created
- **Automatic Rollback**: If any part of the creation fails, all changes are automatically rolled back
- **Data Integrity**: Ensures referential integrity between test, questions, and options
- **Error Recovery**: Clear error messages help identify and fix issues before retry

```json
// Example: If question validation fails, entire test creation is rolled back
{
  "success": false,
  "message": "Test creation failed - rolled back all changes",
  "error": "Question 2: At least one option must be marked as correct",
  "statusCode": 400
}
```

#### `GET /tests` 🔒 Protected
**List Tests with Filtering**
```typescript
// Query Parameters
?page=1&limit=20&courseId=5&testType=quiz&isActive=true&search=midterm

// Response
{
  "success": true,
  "data": {
    "tests": [
      {
        "testId": 12,
        "courseId": 5,
        "title": "Midterm Quiz - JavaScript",
        "testType": "quiz",
        "durationMinutes": 45,
        "maxAttempts": 2,
        "isActive": true,
        "questionCount": 15,
        "avgScore": 87.5,
        "completionRate": 92.3,
        "course": {
          "title": "JavaScript Fundamentals",
          "creator": { "firstName": "Jane", "lastName": "Smith" }
        },
        "createdAt": "2025-01-10T14:20:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalTests": 45,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalActiveTests": 38,
      "totalInactiveTests": 7,
      "testsByType": {
        "exam": 12,
        "quiz": 25,
        "training": 8
      }
    }
  }
}
```

#### `GET /tests/course/:courseId` 🔒 Protected
**Get Tests by Course**
```typescript
// Response
{
  "success": true,
  "data": {
    "tests": [
      {
        "testId": 8,
        "title": "Chapter 1 Quiz",
        "testType": "quiz",
        "durationMinutes": 30,
        "isActive": true,
        "questionCount": 10,
        "statistics": {
          "totalAttempts": 125,
          "avgScore": 82.4,
          "completionRate": 89.6,
          "averageTime": "22 minutes"
        }
      }
    ],
    "courseInfo": {
      "courseId": 5,
      "title": "JavaScript Fundamentals",
      "totalTests": 6,
      "activeTests": 5
    }
  }
}
```

#### `GET /tests/:id` 🔒 Protected
**Get Test Details**
```typescript
// Response
{
  "success": true,
  "data": {
    "test": {
      "testId": 15,
      "courseId": 1,
      "title": "Final Exam - Computer Science",
      "description": "Comprehensive final examination...",
      "testType": "exam",
      "durationMinutes": 180,
      "maxAttempts": 1,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    },
    "course": {
      "courseId": 1,
      "title": "Computer Science Fundamentals",
      "creator": {
        "firstName": "Dr. John",
        "lastName": "Smith",
        "email": "john.smith@university.edu"
      }
    },
    "questions": [
      {
        "questionId": 45,
        "questionText": "What is the time complexity of binary search?",
        "questionType": "multiple_choice",
        "points": 5,
        "orderIndex": 1,
        "options": [
          {
            "optionId": 180,
            "optionText": "O(log n)",
            "orderIndex": 1
          },
          {
            "optionId": 181,
            "optionText": "O(n)",
            "orderIndex": 2
          }
        ]
      }
    ],
    "statistics": {
      "totalQuestions": 25,
      "totalPoints": 100,
      "totalAttempts": 87,
      "completedAttempts": 82,
      "averageScore": 78.5,
      "scoreDistribution": {
        "A": 15,
        "B": 32,
        "C": 25,
        "D": 8,
        "F": 2
      },
      "averageCompletionTime": "145 minutes"
    }
  }
}
```

#### `PUT /tests/:id` 🔒 Creator/Admin
**Update Test**
```typescript
// Request
{
  "title": "Updated Final Exam Title",
  "description": "Updated description with new instructions",
  "durationMinutes": 200,
  "maxAttempts": 2
}

// Response
{
  "success": true,
  "data": {
    "test": { /* Updated test details */ }
  },
  "message": "Test updated successfully"
}
```

### Test Status Management

#### `PATCH /tests/:id/activate` 🔒 Creator/Admin
**Activate Test**
```typescript
// Response
{
  "success": true,
  "data": {
    "test": {
      "testId": 15,
      "isActive": true,
      "updatedAt": "2025-01-15T12:45:00Z"
    }
  },
  "message": "Test activated successfully"
}
```

#### `PATCH /tests/:id/deactivate` 🔒 Creator/Admin
**Deactivate Test**
```typescript
// Response
{
  "success": true,
  "data": {
    "test": {
      "testId": 15,
      "isActive": false,
      "updatedAt": "2025-01-15T12:45:00Z"
    }
  },
  "message": "Test deactivated successfully"
}
```

### Test Analytics

#### `GET /tests/:id/statistics` 🔒 Creator/Admin
**Get Test Statistics**
```typescript
// Response
{
  "success": true,
  "data": {
    "overview": {
      "testId": 15,
      "totalAttempts": 156,
      "completedAttempts": 142,
      "inProgressAttempts": 14,
      "completionRate": 91.0,
      "averageScore": 82.7,
      "highestScore": 98.5,
      "lowestScore": 45.0
    },
    "scoreDistribution": {
      "90-100": 28,
      "80-89": 45,
      "70-79": 38,
      "60-69": 22,
      "0-59": 9
    },
    "timeAnalysis": {
      "averageCompletionTime": "142 minutes",
      "fastestCompletion": "85 minutes",
      "slowestCompletion": "178 minutes",
      "timeDistribution": {
        "0-60": 5,
        "61-120": 38,
        "121-180": 95,
        "181-240": 4
      }
    },
    "questionAnalysis": [
      {
        "questionId": 45,
        "questionText": "What is the time complexity...",
        "correctRate": 87.3,
        "averageTime": "2.5 minutes",
        "difficulty": "medium"
      }
    ],
    "topPerformers": [
      {
        "user": {
          "firstName": "Alice",
          "lastName": "Johnson"
        },
        "score": 98.5,
        "completionTime": "132 minutes",
        "completedAt": "2025-01-12T15:30:00Z"
      }
    ]
  }
}
```

#### `GET /tests/:id/config` 🔒 Creator/Admin
**Get Test Configuration**
```typescript
// Response
{
  "success": true,
  "data": {
    "test": {
      "testId": 15,
      "title": "Final Exam - Computer Science",
      "testType": "exam",
      "durationMinutes": 180,
      "maxAttempts": 1,
      "isActive": true
    },
    "questions": {
      "total": 25,
      "byType": {
        "multiple_choice": 15,
        "true_false": 5,
        "short_answer": 3,
        "essay": 2
      },
      "totalPoints": 100
    },
    "settings": {
      "allowReview": true,
      "randomizeQuestions": false,
      "showCorrectAnswers": false,
      "immediateResults": false
    }
  }
}
```

### Test Operations

#### `DELETE /tests/:id` 🔒 Creator/Admin
**Delete Test**
```typescript
// Response
{
  "success": true,
  "message": "Test deleted successfully"
}
```

## 🔧 Service Layer

### TestService Core Methods

#### Test CRUD Operations
```typescript
// Create test
async create(createTestDto: CreateTestDto, scope: OrgBranchScope): Promise<Test>

// Find test by ID
async findOne(id: number, scope: OrgBranchScope): Promise<Test | null>

// Update test
async update(id: number, updateTestDto: UpdateTestDto, scope: OrgBranchScope): Promise<Test>

// Delete test
async remove(id: number, scope: OrgBranchScope): Promise<void>

// Find tests with filtering
async findAll(filters: TestFilterDto, scope: OrgBranchScope): Promise<PaginatedTests>
```

#### Test Management Operations
```typescript
// Find tests by course
async findByCourse(courseId: number, scope: OrgBranchScope): Promise<Test[]>

// Activate/deactivate test
async activate(id: number, scope: OrgBranchScope): Promise<Test>
async deactivate(id: number, scope: OrgBranchScope): Promise<Test>

// Bulk operations
async bulkActivate(testIds: number[], scope: OrgBranchScope): Promise<Test[]>
async bulkDeactivate(testIds: number[], scope: OrgBranchScope): Promise<Test[]>

// Clone test
async cloneTest(testId: number, targetCourseId: number, scope: OrgBranchScope): Promise<Test>
```

#### Analytics & Statistics
```typescript
// Get test statistics
async getTestStatistics(testId: number, scope: OrgBranchScope): Promise<TestStatistics>

// Get test configuration
async getTestConfig(testId: number, scope: OrgBranchScope): Promise<TestConfig>

// Generate performance reports
async generatePerformanceReport(testId: number, scope: OrgBranchScope): Promise<PerformanceReport>

// Get completion analytics
async getCompletionAnalytics(testId: number, period: string): Promise<CompletionAnalytics>
```

### Test Validation & Business Logic

#### Test Creation Validation
```typescript
// Validate test data
async validateTestData(createTestDto: CreateTestDto): Promise<void>

// Check course ownership
async validateCourseOwnership(courseId: number, userId: string): Promise<boolean>

// Validate test constraints
async validateTestConstraints(testData: CreateTestDto): Promise<ValidationResult>
```

#### Test Access Control
```typescript
// Check test access permissions
async canAccessTest(testId: number, userId: string): Promise<boolean>

// Check modification permissions
async canModifyTest(testId: number, userId: string): Promise<boolean>

// Get accessible tests
async getAccessibleTests(userId: string, filters: TestFilterDto): Promise<Test[]>
```

## 🔄 Integration Points

### Course Module Integration
```typescript
// Validate course exists and user has access
async validateCourseAccess(courseId: number, userId: string): Promise<Course>

// Get course tests
async getCourseTests(courseId: number): Promise<Test[]>

// Update course test count
async updateCourseTestCount(courseId: number): Promise<void>
```

### Question Module Integration
```typescript
// Get test questions with options
async getTestQuestions(testId: number): Promise<Question[]>

// Validate question assignment
async validateQuestionAssignment(testId: number, questionIds: number[]): Promise<boolean>

// Calculate total test points
async calculateTestPoints(testId: number): Promise<number>
```

### Test Attempt Integration
```typescript
// Check if user can start test
async canStartTest(testId: number, userId: string): Promise<StartTestValidation>

// Track test attempt creation
async onTestAttemptCreated(testId: number, userId: string, attemptId: string): Promise<void>

// Update test statistics on completion
async updateTestStats(testId: number, attemptData: AttemptData): Promise<void>
```

## 🔒 Access Control & Permissions

### Test Permissions
```typescript
export enum TestPermission {
    VIEW = 'test:view',
    CREATE = 'test:create',
    EDIT = 'test:edit',
    DELETE = 'test:delete',
    ACTIVATE = 'test:activate',
    VIEW_STATISTICS = 'test:view_statistics',
    TAKE_TEST = 'test:take',
}
```

### Permission Guards
```typescript
@UseGuards(JwtAuthGuard, TestOwnershipGuard)
async updateTest(@Param('id') testId: number, @Body() updateDto: UpdateTestDto) {
    // Test update logic
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions(TestPermission.VIEW_STATISTICS)
async getTestStatistics(@Param('id') testId: number) {
    // Statistics logic
}
```

### Data Scoping
```typescript
// Automatic scoping based on organization/branch
async findAccessibleTests(scope: OrgBranchScope): Promise<Test[]> {
    return this.testRepository.find({
        where: [
            { orgId: { id: scope.orgId } },
            { branchId: { id: scope.branchId } }
        ],
        relations: ['course', 'questions']
    });
}
```

## 📊 Performance Optimizations

### Database Indexes
```sql
-- Test performance indexes
CREATE INDEX IDX_TEST_COURSE_ACTIVE ON tests(courseId, isActive);
CREATE INDEX IDX_TEST_TYPE ON tests(testType);
CREATE INDEX IDX_TEST_DURATION ON tests(durationMinutes);
CREATE INDEX IDX_TEST_CREATED ON tests(createdAt);
CREATE INDEX IDX_TEST_ORG ON tests(orgId);

-- Compound indexes for common queries
CREATE INDEX IDX_TEST_COURSE_TYPE ON tests(courseId, testType);
CREATE INDEX IDX_TEST_ACTIVE_TYPE ON tests(isActive, testType);
```

### Caching Strategy
```typescript
// Cache keys
TEST_CACHE_PREFIX = 'test:'
TEST_LIST_CACHE_PREFIX = 'test_list:'
TEST_STATS_CACHE_PREFIX = 'test_stats:'

// Cache operations
async getCachedTest(testId: number): Promise<Test | null>
async cacheTest(test: Test): Promise<void>
async invalidateTestCache(testId: number): Promise<void>
async cacheTestStatistics(testId: number, stats: TestStatistics): Promise<void>
```

### Query Optimizations
```typescript
// Efficient test loading with relations
const tests = await this.testRepository
    .createQueryBuilder('test')
    .leftJoinAndSelect('test.course', 'course')
    .leftJoinAndSelect('course.creator', 'creator')
    .leftJoin('test.questions', 'questions')
    .addSelect('COUNT(questions.questionId)', 'questionCount')
    .where('test.isActive = :active', { active: true })
    .groupBy('test.testId')
    .orderBy('test.createdAt', 'DESC')
    .getMany();
```

## 🧪 Testing Strategy

### Unit Tests
- **Service Method Testing**: All CRUD operations and business logic
- **Validation Testing**: Test creation and update validation
- **Permission Testing**: Access control and authorization
- **Business Logic Testing**: Test constraints and rules

### Integration Tests
- **API Endpoint Testing**: All controller endpoints
- **Database Integration**: Entity relationships and constraints
- **Course Integration**: Test-course relationship validation
- **Question Integration**: Test-question associations

### Performance Tests
- **Load Testing**: High-volume test operations
- **Statistics Performance**: Analytics generation speed
- **Query Performance**: Database query optimization
- **Concurrent Access**: Multiple user test management

## 🔗 Dependencies

### Internal Dependencies
- **CourseModule**: Course validation and association
- **UserModule**: User authentication and permissions
- **QuestionModule**: Question management and validation
- **TestAttemptModule**: Test taking and completion tracking
- **ResultModule**: Score calculation and analytics
- **OrganizationModule**: Multi-tenant organization support
- **BranchModule**: Departmental structure support

### External Dependencies
- **TypeORM**: Database ORM and query building
- **class-validator**: Input validation and sanitization
- **class-transformer**: Data transformation and serialization
- **@nestjs/swagger**: API documentation generation

## 🚀 Usage Examples

### Basic Test Operations
```typescript
// Create new test
const test = await testService.create({
    courseId: 1,
    title: "Midterm Exam - JavaScript",
    description: "Comprehensive midterm covering chapters 1-6",
    testType: TestType.EXAM,
    durationMinutes: 120,
    maxAttempts: 1
}, scope);

// Find test with details
const testDetails = await testService.findOne(testId, scope);

// Update test
const updatedTest = await testService.update(testId, {
    title: "Updated Exam Title",
    durationMinutes: 150
}, scope);

// Activate test
await testService.activate(testId, scope);
```

### Test Analytics
```typescript
// Get test statistics
const stats = await testService.getTestStatistics(testId, scope);

// Generate performance report
const report = await testService.generatePerformanceReport(testId, scope);

// Get completion analytics
const analytics = await testService.getCompletionAnalytics(testId, 'monthly');
```

### Bulk Operations
```typescript
// Bulk activate tests
const activatedTests = await testService.bulkActivate([1, 2, 3], scope);

// Clone test to different course
const clonedTest = await testService.cloneTest(sourceTestId, targetCourseId, scope);
```

## 🔮 Future Enhancements

### Planned Features
1. **Advanced Test Scheduling**: Time-based test availability
2. **Adaptive Testing**: AI-powered question difficulty adjustment
3. **Proctoring Integration**: Online exam monitoring capabilities
4. **Question Pools**: Random question selection from question banks
5. **Advanced Analytics**: Predictive performance modeling

### Scalability Improvements
- **Test Template System**: Reusable test configurations
- **Question Bank Integration**: Centralized question management
- **Real-time Monitoring**: Live test taking analytics
- **Advanced Reporting**: Custom report generation

### Security Enhancements
- **Test Security**: Anti-cheating measures and validation
- **Access Logging**: Comprehensive audit trails
- **Question Encryption**: Secure question storage and transmission
- **Time Validation**: Server-side timing enforcement

---

This Test module provides comprehensive assessment management with enterprise-grade features including flexible test configuration, detailed analytics, multi-tenancy support, and performance optimizations, serving as the foundation for all assessment activities in the trainpro platform. 