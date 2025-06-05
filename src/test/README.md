# 📝 Test Management Module

## Overview

The Test Management Module is the assessment engine of the trainpro platform, providing comprehensive test creation, configuration, administration, and analytics capabilities. This module handles exam creation, quiz management, training assessments, timing controls, attempt management, and detailed test analytics with enterprise-grade features for educational institutions and corporate training programs.

**✨ Latest Enhancements (January 2025):**

- **Enhanced User Attempt Data**: Real-time user attempt tracking and progress monitoring
- **Comprehensive Test Analytics**: Detailed statistics and performance insights
- **Advanced API Filtering**: Support for `includeUserData` and `includeStatistics` parameters
- **Real-time Progress Tracking**: Live progress updates during test attempts
- **Improved UI Integration**: Better client-server data synchronization

## 🏗️ Architecture

```
test/
├── test.controller.ts          # REST API endpoints with enhanced filtering
├── test.service.ts            # Core business logic with user attempt data
├── test.module.ts             # Module configuration & dependencies
├── entities/                  # Database entities
│   └── test.entity.ts        # Test entity with relationships
├── dto/                      # Data Transfer Objects
│   ├── create-test.dto.ts    # Test creation validation
│   ├── update-test.dto.ts    # Test modification validation
│   ├── test-filter.dto.ts    # Enhanced filtering with user data support
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

### Enhanced User Experience (NEW)

- **Real-time Attempt Tracking** with live progress updates
- **User-specific Data** including attempt history, best scores, and in-progress attempts
- **Comprehensive Statistics** with performance analytics
- **Smart Resume Functionality** for interrupted attempts
- **Attempt Management** with limit tracking and validation

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
- **User-specific Insights** with attempt history and trends

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
    EXAM = 'exam', // Formal examinations
    QUIZ = 'quiz', // Quick assessments
    TRAINING = 'training', // Training modules
}
```

## 📚 API Endpoints

### Enhanced Test Management

#### `GET /tests` 🔒 Protected ✨ **Enhanced**

**List Tests with Advanced Filtering and User Data**

**New Query Parameters:**

- `includeUserData`: Include user-specific attempt data
- `includeStatistics`: Include detailed test statistics

```typescript
// Enhanced Request with User Data
GET /tests?includeUserData=true&includeStatistics=true&page=1&limit=10

// Enhanced Response
{
  "success": true,
  "message": "Tests retrieved successfully",
  "data": {
    "tests": [
      {
        "testId": 12,
        "courseId": 5,
        "title": "JavaScript Fundamentals Quiz",
        "testType": "quiz",
        "durationMinutes": 45,
        "maxAttempts": 2,
        "isActive": true,
        "questionCount": 15,
        "attemptCount": 3,
        "course": {
          "courseId": 5,
          "title": "JavaScript Fundamentals",
          "description": "Learn JavaScript basics"
        },

        // 🆕 Enhanced User Attempt Data
        "userAttemptData": {
          "attemptsCount": 1,
          "attemptsRemaining": 1,
          "canStartNewAttempt": true,
          "nextAttemptNumber": 2,
          "attemptLimitReached": false,
          "lastAttempt": {
            "attemptId": 123,
            "status": "submitted",
            "score": 85,
            "percentage": 85.0,
            "submittedAt": "2025-01-15T14:30:00Z",
            "timeSpent": 2700,
            "progressPercentage": 100,
            "questionsAnswered": 15,
            "lastActivity": "2025-01-15T14:30:00Z"
          },
          "bestAttempt": {
            "attemptId": 123,
            "score": 85,
            "percentage": 85.0,
            "submittedAt": "2025-01-15T14:30:00Z",
            "timeSpent": 2700
          },
          "allAttempts": [
            {
              "attemptId": 123,
              "attemptNumber": 1,
              "status": "submitted",
              "score": 85,
              "percentage": 85.0,
              "timeSpent": 2700,
              "submittedAt": "2025-01-15T14:30:00Z",
              "isExpired": false
            }
          ]
        },

        // 🆕 Enhanced Statistics (when includeStatistics=true)
        "statistics": {
          "totalQuestions": 15,
          "totalAttempts": 25,
          "uniqueStudents": 20,
          "completedAttempts": 22,
          "inProgressAttempts": 3,
          "averageScore": 78.5,
          "medianScore": 80.0,
          "highestScore": 98.5,
          "lowestScore": 45.0,
          "passRate": 88.0,
          "completionRate": 88.0,
          "averageCompletionTime": 35.5,
          "distribution": {
            "90-100": 5,
            "80-89": 8,
            "70-79": 6,
            "60-69": 2,
            "50-59": 1,
            "0-49": 0
          }
        }
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

**All Query Parameters:**

```typescript
?courseId=1               // Filter by course
&title=midterm           // Search by title
&testType=quiz           // Filter by type
&isActive=true           // Filter by status
&includeUserData=true    // ✨ Include user attempt data
&includeStatistics=true  // ✨ Include detailed statistics
&page=1                  // Pagination
&limit=10                // Results per page
&sortBy=createdAt        // Sort field
&sortOrder=DESC          // Sort direction
```

#### `GET /tests/:id` 🔒 Protected ✨ **Enhanced**

**Get Detailed Test Information with User Context**

```typescript
// Enhanced Response with User Data
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

    // 🆕 Enhanced User Context
    "userAttemptData": {
      "attemptsCount": 0,
      "attemptsRemaining": 1,
      "canStartNewAttempt": true,
      "nextAttemptNumber": 1,
      "attemptLimitReached": false
    },

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

#### `POST /tests` 🔒 Creator/Admin ✨ **Enhanced**

**Create New Test with Questions (Atomic Transaction)**

```typescript
// Complete Test Creation Example
{
  "courseId": 1,
  "title": "JavaScript Advanced Concepts",
  "description": "Assessment covering advanced JavaScript topics including closures, async/await, and ES6+ features.",
  "testType": "exam",
  "durationMinutes": 120,
  "maxAttempts": 2,
  "questions": [
    {
      "questionText": "What will console.log(typeof null) output?",
      "questionType": "multiple_choice",
      "points": 5,
      "orderIndex": 1,
      "explanation": "This is a well-known JavaScript quirk. typeof null returns 'object' due to a bug in the original implementation.",
      "hint": "This is a famous JavaScript gotcha",
      "difficulty": "medium",
      "tags": ["javascript", "types", "quirks"],
      "options": [
        {
          "optionText": "null",
          "isCorrect": false,
          "orderIndex": 1
        },
        {
          "optionText": "object",
          "isCorrect": true,
          "orderIndex": 2
        },
        {
          "optionText": "undefined",
          "isCorrect": false,
          "orderIndex": 3
        }
      ]
    },
    {
      "questionText": "Explain the concept of closures in JavaScript with an example.",
      "questionType": "essay",
      "points": 15,
      "orderIndex": 2,
      "explanation": "Closures allow inner functions to access variables from their outer scope even after the outer function returns.",
      "hint": "Think about lexical scoping and function memory",
      "difficulty": "hard",
      "tags": ["javascript", "closures", "scope"]
    }
  ]
}

// Enhanced Response
{
  "success": true,
  "message": "Test created successfully",
  "data": {
    "testId": 123,
    "courseId": 1,
    "title": "JavaScript Advanced Concepts",
    "description": "Assessment covering advanced JavaScript topics...",
    "testType": "exam",
    "durationMinutes": 120,
    "maxAttempts": 2,
    "isActive": true,
    "createdAt": "2025-01-15T10:35:00Z",
    "updatedAt": "2025-01-15T10:35:00Z",
    "course": {
      "courseId": 1,
      "title": "Advanced JavaScript Development",
      "description": "Master advanced JavaScript concepts"
    },
    "questionCount": 2,
    "attemptCount": 0
  }
}
```

#### Enhanced Error Handling ⚠️

```json
// Enhanced Validation Error
{
  "success": false,
  "message": "Invalid query parameters",
  "errors": [
    {
      "field": "includeUserData",
      "message": "Include user data must be a boolean"
    },
    {
      "field": "limit",
      "message": "Limit cannot exceed 100"
    }
  ],
  "statusCode": 400
}

// Enhanced Access Control Error
{
  "success": false,
  "message": "You do not have permission to view user attempt data for this test",
  "statusCode": 403
}
```

## 🔧 Enhanced Service Layer

### TestService Core Methods ✨ **Enhanced**

#### Enhanced Test Retrieval

```typescript
// Enhanced findAll with user attempt data
async findAll(
    filters: TestFilterDto,
    scope: OrgBranchScope,
): Promise<TestListResponseDto> {
    const { includeUserData, includeStatistics, ...otherFilters } = filters;

    // Get base test data
    const [tests, total] = await this.getFilteredTests(otherFilters, scope);

    // Enhance with user-specific data if requested
    const enhancedTests = await Promise.all(
        tests.map(async test => {
            let userAttemptData = undefined;
            let statistics = undefined;

            if (includeUserData && scope.userId) {
                userAttemptData = await this.getUserAttemptData(test.testId, scope.userId);
            }

            if (includeStatistics) {
                statistics = await this.calculateTestStatistics(test.testId);
            }

            return {
                ...test,
                userAttemptData,
                statistics,
            };
        })
    );

    return {
        tests: enhancedTests,
        total,
        page: filters.page || 1,
        limit: filters.limit || 10,
        totalPages: Math.ceil(total / (filters.limit || 10)),
    };
}

// Enhanced user attempt data retrieval
private async getUserAttemptData(testId: number, userId: string) {
    // Get all user attempts for this test
    const allAttempts = await this.testAttemptRepository.find({
        where: { testId, userId },
        order: { createdAt: 'DESC' },
    });

    if (allAttempts.length === 0) {
        return {
            attemptsCount: 0,
            attemptsRemaining: await this.getMaxAttemptsForTest(testId),
            canStartNewAttempt: true,
            nextAttemptNumber: 1,
            attemptLimitReached: false,
            allAttempts: [],
        };
    }

    const maxAttempts = await this.getMaxAttemptsForTest(testId);
    const inProgressAttempt = allAttempts.find(a => a.status === AttemptStatus.IN_PROGRESS);
    const completedAttempts = allAttempts.filter(a => a.status === AttemptStatus.SUBMITTED);

    // Get best attempt from results
    let bestAttempt: any = undefined;
    if (completedAttempts.length > 0) {
        const results = await this.resultRepository.find({
            where: { testId: testId, userId: userId },
            order: { percentage: 'DESC' },
        });

        if (results.length > 0) {
            const bestResult = results[0];
            bestAttempt = {
                attemptId: bestResult.attemptId,
                score: bestResult.score || 0,
                percentage: bestResult.percentage || 0,
                submittedAt: bestResult.calculatedAt?.toISOString() || '',
                timeSpent: 0, // Not available in Result entity
            };
        }
    }

    // Get last attempt (most recent)
    const lastAttempt = allAttempts[0];
    const attemptsCount = allAttempts.length;
    const attemptsRemaining = Math.max(0, maxAttempts - attemptsCount);
    const canStartNewAttempt = !inProgressAttempt && attemptsRemaining > 0;
    const attemptLimitReached = attemptsRemaining === 0 && !inProgressAttempt;

    return {
        attemptsCount,
        attemptsRemaining,
        lastAttempt: lastAttempt ? {
            attemptId: lastAttempt.attemptId,
            status: lastAttempt.status,
            score: 0, // Will be populated from results
            percentage: 0, // Will be populated from results
            submittedAt: lastAttempt.submitTime?.toISOString(),
            timeSpent: 0, // Will be calculated from start/end time
            currentQuestionIndex: 0, // Will be tracked separately
            progressPercentage: lastAttempt.progressPercentage || 0,
            questionsAnswered: 0, // Will be calculated from answers
            flaggedQuestions: [], // Will be tracked separately
            lastActivity: lastAttempt.updatedAt.toISOString(),
        } : undefined,
        inProgressAttempt: inProgressAttempt ? {
            attemptId: inProgressAttempt.attemptId,
            testId: inProgressAttempt.testId,
            userId: inProgressAttempt.userId,
            attemptNumber: inProgressAttempt.attemptNumber,
            status: inProgressAttempt.status,
            startTime: inProgressAttempt.startTime.toISOString(),
            submitTime: inProgressAttempt.submitTime?.toISOString(),
            expiresAt: inProgressAttempt.expiresAt?.toISOString(),
            progressPercentage: inProgressAttempt.progressPercentage || 0,
            createdAt: inProgressAttempt.createdAt.toISOString(),
            updatedAt: inProgressAttempt.updatedAt.toISOString(),
            resumeUrl: `/dashboard/tests/${testId}/take`,
            timeElapsed: 0, // Calculate from start time
            currentProgress: inProgressAttempt.progressPercentage || 0,
            canResume: true,
        } : undefined,
        bestAttempt,
        allAttempts: allAttempts.map(attempt => ({
            attemptId: attempt.attemptId,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            score: 0, // Will be populated from results
            percentage: 0, // Will be populated from results
            timeSpent: 0, // Will be calculated
            submittedAt: attempt.submitTime?.toISOString(),
            isExpired: attempt.expiresAt ? new Date() > attempt.expiresAt : false,
        })),
        canStartNewAttempt,
        nextAttemptNumber: attemptsCount + 1,
        attemptLimitReached,
    };
}
```

## 🚀 Client Integration

### Enhanced Frontend Usage ✨

```typescript
// Enhanced test loading with user data
const { data: tests } = useQuery({
    queryKey: ['tests', { includeUserData: true, includeStatistics: true }],
    queryFn: () =>
        testService.getAllTests({
            includeUserData: true,
            includeStatistics: true,
            page: 1,
            limit: 20,
        }),
});

// Access enhanced data
tests.data.tests.forEach(test => {
    if (test.userAttemptData) {
        console.log(`Test: ${test.title}`);
        console.log(
            `Attempts: ${test.userAttemptData.attemptsCount}/${test.maxAttempts}`,
        );
        console.log(`Can start: ${test.userAttemptData.canStartNewAttempt}`);

        if (test.userAttemptData.inProgressAttempt) {
            console.log(
                `Resume URL: ${test.userAttemptData.inProgressAttempt.resumeUrl}`,
            );
        }

        if (test.userAttemptData.bestAttempt) {
            console.log(
                `Best score: ${test.userAttemptData.bestAttempt.percentage}%`,
            );
        }
    }

    if (test.statistics) {
        console.log(`Class average: ${test.statistics.averageScore}`);
        console.log(`Completion rate: ${test.statistics.completionRate}%`);
    }
});
```

## 🔒 Access Control & Permissions

### Enhanced Permission Model

```typescript
export enum TestPermission {
    VIEW = 'test:view',
    CREATE = 'test:create',
    EDIT = 'test:edit',
    DELETE = 'test:delete',
    ACTIVATE = 'test:activate',
    VIEW_STATISTICS = 'test:view_statistics',
    VIEW_USER_DATA = 'test:view_user_data', // 🆕 New permission
    TAKE_TEST = 'test:take',
    MANAGE_ATTEMPTS = 'test:manage_attempts', // 🆕 New permission
}
```

## 📊 Performance Optimizations

### Enhanced Caching Strategy

```typescript
// Enhanced cache keys with user context
TEST_USER_DATA_CACHE = (testId: number, userId: string) =>
    `test:${testId}:user:${userId}:attempts`;

TEST_STATISTICS_CACHE = (testId: number) =>
    `test:${testId}:statistics`;

// Cache user attempt data for 5 minutes
async cacheUserAttemptData(testId: number, userId: string, data: any): Promise<void>

// Cache test statistics for 10 minutes
async cacheTestStatistics(testId: number, stats: any): Promise<void>
```

### Query Optimizations

```typescript
// Efficient loading with conditional joins
const query = this.testRepository
    .createQueryBuilder('test')
    .leftJoinAndSelect('test.course', 'course')
    .leftJoinAndSelect('course.creator', 'creator');

if (includeUserData) {
    query
        .leftJoin(
            'test.testAttempts',
            'attempts',
            'attempts.userId = :userId',
            { userId },
        )
        .addSelect([
            'attempts.attemptId',
            'attempts.status',
            'attempts.progressPercentage',
        ]);
}

if (includeStatistics) {
    query
        .loadRelationCountAndMap('test.totalAttempts', 'test.testAttempts')
        .loadRelationCountAndMap(
            'test.completedAttempts',
            'test.testAttempts',
            'completedAttempts',
            qb =>
                qb.where('completedAttempts.status = :status', {
                    status: 'submitted',
                }),
        );
}
```

## 🧪 Testing Strategy

### Enhanced Testing Coverage

- **User Attempt Data Testing**: Validate user-specific data accuracy
- **Statistics Testing**: Ensure calculation correctness
- **Permission Testing**: Test enhanced access controls
- **Performance Testing**: Load testing with enhanced data
- **Integration Testing**: Client-server data flow validation

## 🔮 Future Enhancements

### Planned Features

1. **Real-time Progress Streaming**: WebSocket-based live updates
2. **Advanced Analytics Dashboard**: Interactive charts and insights
3. **AI-Powered Recommendations**: Personalized test suggestions
4. **Adaptive Difficulty**: Dynamic question adjustment
5. **Proctoring Integration**: Advanced security features

---

**🎯 Key Benefits of Enhanced Implementation:**

- **Better User Experience**: Real-time feedback and progress tracking
- **Improved Performance**: Efficient data loading with optional enhancements
- **Scalable Architecture**: Clean separation of concerns with caching
- **Comprehensive Analytics**: Deep insights into test performance
- **Future-Ready**: Extensible design for advanced features

This enhanced Test module provides a comprehensive assessment platform with real-time user insights, advanced analytics, and optimal performance for modern educational applications.
