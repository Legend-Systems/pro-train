import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Enable global validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Enable CORS for frontend
    app.enableCors({
        origin: true,
        credentials: true,
    });

    // Setup Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('EXXAM Playground')
        .setDescription(
            `🚀 **EXXAM Playground API** - A comprehensive user management and authentication system

      ## Application Flow & Hierarchy

      ### 🏢 **Organizational Structure**
      The platform follows a hierarchical structure designed for enterprise-scale management:

      **1. Organization Creation**
      - Create organizations as top-level entities
      - Configure organization settings, branding, and policies
      - Set up organization-wide administrators

      **2. Branch Management**
      - Create branches within organizations (departments, locations, divisions)
      - Assign branch managers and configure branch-specific settings
      - Define branch-level access controls and permissions

      **3. User Management & Access Control**
      - Invite users to specific organizations and branches
      - Assign roles and permissions based on organizational hierarchy
      - Users inherit access based on their organization/branch assignment
      - Support for multi-branch access and cross-organizational roles

      **4. Course & Content Management**
      - Create courses at organization or branch level
      - Assign courses to specific branches or make them organization-wide
      - Manage course enrollment based on user's organizational context
      - Track progress and performance within organizational boundaries

      **5. Assessment & Reporting**
      - Conduct tests and quizzes within organizational scope
      - Generate reports segmented by organization and branch
      - Leaderboards and analytics scoped to user's context
      - Performance tracking across the organizational hierarchy

      ### 🔄 **Typical Workflow**
      1. **Setup**: Create Organization → Add Branches → Invite Users
      2. **Content**: Create Courses → Assign to Branches → Enroll Users
      3. **Learning**: Users Access Courses → Take Tests → View Progress
      4. **Analytics**: Generate Reports → Track Performance → Manage Leaderboards

      ## Features
      - **Complete User Management** - Full CRUD operations with profile management
      - **Secure Authentication** - JWT-based authentication with refresh tokens
      - **Email Verification** - Account verification and password reset flows
      - **Password Management** - Secure password changes and reset functionality
      - **Organizational Hierarchy** - Multi-level organizational structure support
      - **Role-Based Access Control** - Granular permissions based on organizational context
      - **Course Management** - Organization and branch-scoped course creation and management
      - **Assessment System** - Tests, quizzes, and progress tracking within organizational boundaries
      - **Analytics & Reporting** - Performance metrics and leaderboards scoped to organizational context
      - **High Performance** - Optimized with database indexing and efficient queries

      ## Security
      - 🔐 **JWT Authentication** with Bearer token support
      - 🛡️ **Input Validation** on all endpoints
      - 🔒 **Password Hashing** using bcrypt with salt rounds
      - 📧 **Email Verification** for account security
      - ⏰ **Token Expiration** and refresh mechanisms
      - 🏢 **Organizational Scoping** - Data isolation per organization/branch
      - 👥 **Role-Based Permissions** - Access control based on organizational hierarchy
      - 🔍 **Data Segregation** - Secure separation of organizational data

      ## Authentication & Session Management
      
      ### Registration Flow
      - Users register via invitation tokens (organization/branch specific)
      - Account creation without immediate authentication (security best practice)
      - Welcome email notification sent
      - Users must sign in separately to receive tokens and session data

      ### Sign In Response
      Upon successful authentication, users receive comprehensive session data:
      - **Authentication Tokens** (access & refresh tokens)
      - **User Profile** (complete user information)
      - **Leaderboard Stats** (performance metrics and rankings)
      - **Organization Context** (organization details if applicable)
      - **Branch Context** (branch details if applicable)

      This rich session data enables immediate context-aware application behavior.

      ## Documentation Standards
      All endpoints include comprehensive examples, detailed parameter descriptions, 
      and complete response schemas for easy integration. The API follows RESTful conventions
      with consistent error handling and response formats across all endpoints.`,
        )
        .setVersion('2.0.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                description: 'Enter JWT token',
                in: 'header',
            },
            'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
        customSiteTitle: 'Orrbit API Documentation',
        customfavIcon: '/favicon.ico',
        customCss: `
      .topbar-wrapper .link {
        content: url('https://orrbit.co.za/logo.png');
        height: 40px;
        width: auto;
      }
      .swagger-ui .topbar { background-color: #1a1a1a; }
    `,
    });

    const port = configService.get<number>('PORT') || 4400;
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(
        `📚 API Documentation available at: http://localhost:${port}/api`,
    );

    await app.listen(port);
}
bootstrap();
