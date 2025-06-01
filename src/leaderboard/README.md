# 🏆 Leaderboard & Competition Rankings Module

## Overview

The Leaderboard & Competition Rankings Module provides comprehensive gamification and competitive learning features for the trainpro platform, enabling educational institutions to foster engagement through rankings, achievements, and social learning dynamics. This module implements real-time leaderboards, performance analytics, achievement systems, and provides enterprise-grade features for competitive learning environments with multi-tenant support.

## 🏗️ Architecture

```
leaderboard/
├── leaderboard.controller.ts        # REST API endpoints for leaderboard operations
├── leaderboard.service.ts          # Core business logic and ranking calculations
├── leaderboard.module.ts           # Module configuration & dependencies
├── entities/                       # Database entities
│   └── leaderboard.entity.ts      # Leaderboard entity with user relationships
├── dto/                           # Data Transfer Objects
│   ├── leaderboard-response.dto.ts # Leaderboard response formats
│   └── leaderboard-query.dto.ts   # Query and filter validation
├── leaderboard.controller.spec.ts # API endpoint tests
└── leaderboard.service.spec.ts    # Service layer tests
```

## 🎯 Core Features

### Competitive Rankings
- **Real-time Leaderboards** with live ranking updates and calculations
- **Course-based Competition** with subject-specific performance tracking
- **Multi-dimensional Rankings** supporting various scoring methodologies
- **Rank Change Tracking** with improvement indicators and trends
- **Achievement Levels** with progressive skill recognition systems

### Gamification Elements
- **Performance Badges** recognizing various learning milestones
- **Achievement Systems** with customizable goals and rewards
- **Progress Visualization** with charts, graphs, and progress indicators
- **Social Learning Features** enabling peer comparison and motivation
- **Competition Periods** with time-bound challenges and tournaments

### Analytics & Insights
- **Performance Analytics** with detailed statistical analysis
- **Engagement Metrics** tracking participation and improvement patterns
- **Competitive Intelligence** providing insights into learning effectiveness
- **Trend Analysis** identifying patterns in student performance
- **Comparative Analytics** benchmarking individual against group performance

### Multi-Tenancy & Organization
- **Organization-Scoped Rankings** with isolated leaderboards per tenant
- **Branch-Level Competition** supporting distributed competitive environments
- **Cross-Branch Championships** enabling inter-branch competitions
- **Custom Achievement Systems** with organization-specific recognition
- **Flexible Ranking Algorithms** adaptable to different educational contexts

## 📊 Database Schema

### Leaderboard Entity
```typescript
@Entity('leaderboards')
export class Leaderboard {
    @PrimaryGeneratedColumn()
    leaderboardId: number;

    @Column()
    @Index()
    courseId: number;

    @Column('uuid')
    @Index()
    userId: string;

    @Column()
    @Index()
    rank: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    averageScore: number;

    @Column()
    testsCompleted: number;

    @Column()
    totalPoints: number;

    @Column({ type: 'timestamp', default: () => 'NOW()' })
    lastUpdated: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relationships
    @ManyToOne(() => Course)
    course: Course;

    @ManyToOne(() => User)
    user: User;

    @ManyToOne(() => Organization)
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    branchId?: Branch;
}
```

## 📚 API Endpoints

### Leaderboard Management

#### `GET /leaderboards/course/:courseId` 🔒 Protected
**Get Course Leaderboard**
```typescript
// Query Parameters
?page=1&limit=20

// Response
{
  "success": true,
  "message": "Leaderboard retrieved successfully",
  "data": {
    "entries": [
      {
        "leaderboardId": 1,
        "userId": "user-123",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@university.edu",
        "avatar": "https://example.com/avatars/johndoe.jpg",
        "totalScore": 450,
        "rank": 1,
        "previousRank": 3,
        "rankChange": 2,
        "testsCompleted": 8,
        "averageScore": 92.5,
        "totalPoints": 740,
        "achievementLevel": "expert",
        "badges": ["top_performer", "consistent_learner", "quiz_master"],
        "streakDays": 15,
        "lastActive": "2025-01-20T16:45:00Z"
      },
      {
        "leaderboardId": 2,
        "userId": "user-456",
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane.smith@university.edu",
        "totalScore": 420,
        "rank": 2,
        "previousRank": 2,
        "rankChange": 0,
        "testsCompleted": 7,
        "averageScore": 88.2,
        "totalPoints": 618,
        "achievementLevel": "advanced",
        "badges": ["quick_learner", "high_achiever"],
        "streakDays": 8,
        "lastActive": "2025-01-20T14:20:00Z"
      }
    ],
    "metadata": {
      "courseId": 1,
      "courseTitle": "Web Development Bootcamp",
      "totalParticipants": 150,
      "activeParticipants": 120,
      "averageScore": 75.2,
      "topScore": 92.5,
      "medianScore": 74.8,
      "competitionPeriod": {
        "startDate": "2025-01-01T00:00:00Z",
        "endDate": "2025-03-31T23:59:59Z",
        "daysRemaining": 45
      },
      "lastUpdated": "2025-01-20T17:00:00Z"
    },
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    },
    "analytics": {
      "improvementRate": 12.5,
      "participationRate": 80.0,
      "averageTestsPerUser": 6.4,
      "topPerformersLastWeek": 25
    }
  }
}
```

#### `GET /leaderboards/course/:courseId/user` 🔒 Protected
**Get Current User's Rank**
```typescript
// Response
{
  "success": true,
  "message": "User rank retrieved successfully",
  "data": {
    "userRank": {
      "leaderboardId": 45,
      "userId": "current-user-id",
      "rank": 15,
      "previousRank": 18,
      "rankChange": 3,
      "percentile": 85.5,
      "averageScore": 78.5,
      "testsCompleted": 6,
      "totalPoints": 471,
      "achievementLevel": "intermediate",
      "nextLevelProgress": 67.5,
      "badges": ["consistent_learner", "improvement_star"],
      "streakDays": 5
    },
    "context": {
      "totalParticipants": 150,
      "courseTitle": "Web Development Bootcamp",
      "userPosition": "Top 15%",
      "scoreGapToNext": 12.3,
      "scoreGapToTop": 45.8
    },
    "recommendations": {
      "suggestedActions": [
        "Complete remaining practice tests",
        "Review weak areas in JavaScript",
        "Participate in study groups"
      ],
      "nextMilestone": {
        "achievement": "Top 10% Performer",
        "pointsNeeded": 65,
        "estimatedTimeframe": "2-3 weeks"
      }
    },
    "recentActivity": {
      "lastTestScore": 85.5,
      "rankChangeLastWeek": 5,
      "testsCompletedThisWeek": 2,
      "pointsEarnedThisWeek": 85
    }
  }
}
```

#### `POST /leaderboards/course/:courseId/refresh` 🔒 Protected
**Refresh Course Leaderboard**
```typescript
// Response
{
  "success": true,
  "message": "Leaderboard refreshed successfully",
  "data": {
    "refreshInfo": {
      "courseId": 1,
      "refreshedAt": "2025-01-20T17:30:00Z",
      "entriesUpdated": 150,
      "rankChanges": 42,
      "newEntries": 3,
      "processingTime": "1.2 seconds"
    },
    "summary": {
      "biggestGainer": {
        "userId": "user-789",
        "firstName": "Mike",
        "lastName": "Johnson",
        "rankImprovement": 15,
        "scoreImprovement": 23.5
      },
      "newTopPerformer": null,
      "achievementsUnlocked": 8,
      "participationIncrease": 2.5
    },
    "nextScheduledRefresh": "2025-01-20T18:00:00Z"
  }
}
```

### Leaderboard Analytics

#### `GET /leaderboards/course/:courseId/analytics` 🔒 Protected
**Get Leaderboard Analytics**
```typescript
// Response
{
  "success": true,
  "message": "Leaderboard analytics retrieved successfully",
  "data": {
    "participationAnalytics": {
      "totalEnrolled": 200,
      "activeParticipants": 150,
      "participationRate": 75.0,
      "averageTestsCompleted": 6.4,
      "completionRate": 68.2
    },
    "performanceDistribution": {
      "ranges": [
        { "range": "90-100%", "count": 15, "percentage": 10.0 },
        { "range": "80-89%", "count": 35, "percentage": 23.3 },
        { "range": "70-79%", "count": 45, "percentage": 30.0 },
        { "range": "60-69%", "count": 35, "percentage": 23.3 },
        { "range": "50-59%", "count": 15, "percentage": 10.0 },
        { "range": "Below 50%", "count": 5, "percentage": 3.3 }
      ],
      "averageScore": 75.2,
      "medianScore": 74.8,
      "standardDeviation": 12.5
    },
    "engagementMetrics": {
      "dailyActiveUsers": 85,
      "weeklyActiveUsers": 120,
      "averageSessionLength": "45 minutes",
      "peakActivity": {
        "day": "Tuesday",
        "hour": "19:00",
        "userCount": 65
      }
    },
    "trends": {
      "scoreImprovement": {
        "weekOverWeek": 5.2,
        "monthOverMonth": 12.8,
        "overallTrend": "improving"
      },
      "participation": {
        "weekOverWeek": 2.5,
        "monthOverMonth": 8.1,
        "overallTrend": "stable"
      }
    },
    "topPerformers": {
      "thisWeek": [
        {
          "userId": "user-123",
          "firstName": "John",
          "lastName": "Doe",
          "scoreIncrease": 15.5,
          "testsCompleted": 3
        }
      ],
      "thisMonth": [
        {
          "userId": "user-456",
          "firstName": "Jane",
          "lastName": "Smith",
          "scoreIncrease": 28.2,
          "testsCompleted": 8
        }
      ]
    }
  }
}
```

## 🔧 Service Layer

### LeaderboardService Core Methods

#### Leaderboard Operations
```typescript
// Get course leaderboard
async getCourseLeaderboard(courseId: number, scope: OrgBranchScope, options?: LeaderboardOptions): Promise<LeaderboardEntry[]>

// Get user rank in course
async getUserRank(courseId: number, userId: string, scope: OrgBranchScope): Promise<UserRank | null>

// Refresh leaderboard rankings
async refreshLeaderboard(courseId: number, scope: OrgBranchScope): Promise<RefreshResult>

// Update user ranking
async updateUserRanking(userId: string, courseId: number): Promise<LeaderboardEntry>
```

#### Ranking Calculations
```typescript
// Calculate user score
async calculateUserScore(userId: string, courseId: number): Promise<ScoreCalculation>

// Determine rank position
async calculateRankPosition(userId: string, courseId: number): Promise<number>

// Update all rankings for course
async recalculateAllRankings(courseId: number): Promise<RankingUpdate[]>

// Get rank changes
async getRankChanges(courseId: number, timePeriod: TimePeriod): Promise<RankChange[]>
```

#### Achievement Management
```typescript
// Check for new achievements
async checkAchievements(userId: string, courseId: number): Promise<Achievement[]>

// Award achievement
async awardAchievement(userId: string, achievementId: string): Promise<UserAchievement>

// Get user achievements
async getUserAchievements(userId: string, courseId?: number): Promise<UserAchievement[]>

// Get achievement progress
async getAchievementProgress(userId: string, achievementId: string): Promise<AchievementProgress>
```

#### Analytics & Reporting
```typescript
// Get leaderboard analytics
async getLeaderboardAnalytics(courseId: number): Promise<LeaderboardAnalytics>

// Generate performance report
async generatePerformanceReport(courseId: number, timePeriod: TimePeriod): Promise<PerformanceReport>

// Track engagement metrics
async trackEngagementMetrics(courseId: number): Promise<EngagementMetrics>

// Get competition insights
async getCompetitionInsights(courseId: number): Promise<CompetitionInsights>
```

## 🔄 Integration Points

### Results Module Integration
```typescript
// Update rankings when test completed
async onTestCompleted(testResult: TestResult): Promise<void>

// Process bulk test results
async processBulkResults(results: TestResult[]): Promise<void>

// Handle result modifications
async onResultModified(testResult: TestResult): Promise<void>
```

### User Module Integration
```typescript
// Get user profile for leaderboard
async getUserLeaderboardProfile(userId: string): Promise<UserProfile>

// Track user activity
async trackUserActivity(userId: string, activity: ActivityType): Promise<void>

// Get user engagement data
async getUserEngagementData(userId: string): Promise<EngagementData>
```

### Course Module Integration
```typescript
// Initialize course leaderboard
async initializeCourseLeaderboard(courseId: number): Promise<void>

// Get course settings for rankings
async getCourseRankingSettings(courseId: number): Promise<RankingSettings>

// Handle course enrollment
async onUserEnrolled(userId: string, courseId: number): Promise<void>
```

## 🔒 Access Control & Permissions

### Leaderboard Permissions
```typescript
export enum LeaderboardPermission {
    VIEW = 'leaderboard:view',
    VIEW_ALL = 'leaderboard:view_all',
    REFRESH = 'leaderboard:refresh',
    MANAGE = 'leaderboard:manage',
    VIEW_ANALYTICS = 'leaderboard:view_analytics',
}
```

### Data Scoping
```typescript
// Automatic scoping based on organization/branch
async findUserAccessibleLeaderboards(userId: string, scope: OrgBranchScope): Promise<Leaderboard[]> {
    return this.leaderboardRepository.find({
        where: [
            { 
                orgId: { id: scope.orgId },
                course: { isActive: true }
            },
            { 
                branchId: { id: scope.branchId },
                course: { isActive: true }
            }
        ],
        relations: ['course', 'user']
    });
}
```

## 📊 Performance Optimizations

### Database Indexes
```sql
-- Leaderboard performance indexes
CREATE INDEX IDX_LEADERBOARD_COURSE ON leaderboards(courseId);
CREATE INDEX IDX_LEADERBOARD_USER ON leaderboards(userId);
CREATE INDEX IDX_LEADERBOARD_RANK ON leaderboards(courseId, rank);
CREATE INDEX IDX_LEADERBOARD_SCORE ON leaderboards(courseId, averageScore DESC);

-- Compound indexes for common queries
CREATE INDEX IDX_LEADERBOARD_COURSE_USER ON leaderboards(courseId, userId);
CREATE INDEX IDX_LEADERBOARD_UPDATED ON leaderboards(courseId, lastUpdated DESC);
```

### Caching Strategy
```typescript
// Cache keys
LEADERBOARD_CACHE_PREFIX = 'leaderboard:'
USER_RANK_CACHE_PREFIX = 'user_rank:'
LEADERBOARD_ANALYTICS_CACHE_PREFIX = 'leaderboard_analytics:'

// Cache operations
async getCachedLeaderboard(courseId: number): Promise<LeaderboardEntry[] | null>
async cacheLeaderboard(courseId: number, entries: LeaderboardEntry[]): Promise<void>
async invalidateLeaderboardCache(courseId: number): Promise<void>
```

## 🧪 Testing Strategy

### Unit Tests
- **Ranking Algorithm Testing**: Score calculations and rank assignments
- **Achievement Logic Testing**: Achievement triggers and progress tracking
- **Performance Testing**: Large dataset ranking calculations
- **Cache Testing**: Cache consistency and invalidation

### Integration Tests
- **API Endpoint Testing**: All controller endpoints
- **Real-time Updates**: Live ranking updates and notifications
- **Cross-Module Integration**: Results and user module interactions
- **Gamification Testing**: Achievement and badge systems

## 🔗 Dependencies

### Internal Dependencies
- **ResultsModule**: Test results and score data
- **UserModule**: User profiles and engagement tracking
- **CourseModule**: Course information and enrollment data
- **AuthModule**: Authentication and authorization
- **OrganizationModule**: Multi-tenant organization support

### External Dependencies
- **TypeORM**: Database ORM and query building
- **class-validator**: Input validation and sanitization
- **class-transformer**: Data transformation and serialization
- **@nestjs/swagger**: API documentation generation

## 🚀 Usage Examples

### Basic Leaderboard Operations
```typescript
// Get course leaderboard
const leaderboard = await leaderboardService.getCourseLeaderboard(1, scope, {
    page: 1,
    limit: 20
});

// Get user rank
const userRank = await leaderboardService.getUserRank(1, userId, scope);

// Refresh rankings
await leaderboardService.refreshLeaderboard(1, scope);
```

### Achievement Management
```typescript
// Check for new achievements
const achievements = await leaderboardService.checkAchievements(userId, courseId);

// Get user achievements
const userAchievements = await leaderboardService.getUserAchievements(userId);

// Track achievement progress
const progress = await leaderboardService.getAchievementProgress(userId, achievementId);
```

## 🔮 Future Enhancements

### Planned Features
1. **Real-time Leaderboards**: WebSocket-based live ranking updates
2. **Tournament System**: Organized competitions with brackets and rounds
3. **Team Competitions**: Group-based leaderboards and challenges
4. **Advanced Analytics**: AI-powered performance predictions
5. **Custom Achievement Builder**: User-defined achievement systems

### Scalability Improvements
- **Distributed Rankings**: Sharded leaderboard calculations
- **Event Sourcing**: Event-driven ranking updates
- **Machine Learning**: Predictive analytics and personalized challenges
- **Global Leaderboards**: Cross-organization competitions

---

This Leaderboard module provides comprehensive gamification and competitive learning features with enterprise-grade performance, real-time rankings, achievement systems, and detailed analytics for effective student engagement and motivation. 