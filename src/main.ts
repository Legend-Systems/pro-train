import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Enable CORS for client application
    app.enableCors({
        origin: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'https://client.trainpro.co.za',
            'https://www.trainpro.co.za',
            'https://trainpro.co.za',
            'https://pro-train.vercel.app',
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'Access-Control-Allow-Credentials',
        ],
        credentials: true, // Allow cookies and auth headers
        optionsSuccessStatus: 200, // Some legacy browsers choke on 204
    });

    // Security: Use helmet for security headers
    app.use(
        helmet({
            contentSecurityPolicy: false, // Disable CSP for Swagger UI
            xPoweredBy: false, // Disable x-powered-by header
        }),
    );

    // Enable global validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Setup Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('trainpro api playground')
        .setDescription(
            `🚀 **trainpro api playground** - Interactive Learning Management & Assessment Platform

      ## 🔄 **Recommended Testing Scenarios**

      ### **Scenario 1: Organization Admin Setup**
      1. Create organization (\`POST /org\`)
      2. Add multiple branches (\`POST /branch\`)
      3. Invite users to different branches (\`POST /auth/send-invitation\`)
      4. Create courses assigned to specific branches (\`POST /courses\`)

      ### **Scenario 2: Content Creator Workflow**
      1. Sign in as admin/creator
      2. Create a comprehensive course (\`POST /courses\`)
      3. Upload course materials (\`POST /course-materials\`)
      4. Design multi-question test (\`POST /tests\`, \`POST /questions\`)
      5. Activate for learners

      ### **Scenario 3: Learner Experience**
      1. Register using invitation token (\`POST /auth/signup\`)
      2. Sign in and view session data (\`POST /auth/signin\`)
      3. Browse available courses (\`GET /courses\`)
      4. Take assessment (\`POST /test-attempts\`, \`POST /answers\`)
      5. View results and leaderboard position

      ### **Scenario 4: Analytics & Reporting**
      1. Generate user performance reports (\`GET /reports\`)
      2. View course completion statistics
      3. Analyze organizational learning metrics
      4. Track progress across different branches

      ---

      ## 🔐 **Authentication Flow**

      ### **For New Users:**
      1. **Register**: \`POST /auth/signup\` (with optional invitation token)
      2. **Sign In**: \`POST /auth/signin\` to get tokens and session data
      3. **Explore**: Use Bearer token for all subsequent requests

      ### **Session Data Includes:**
      - **JWT Tokens** (access & refresh)
      - **User Profile** (with avatar variants)
      - **Performance Stats** (scores, rankings, achievements)
      - **Organization Context** (company/branch information)
      - **Available Courses** and test permissions

      ---

      ## 📱 **Key Features to Test**

      ✅ **Multi-tenant Organization Structure** - Test hierarchical data isolation  
      ✅ **Role-based Access Control** - Test different user permission levels  
      ✅ **Rich File Management** - Upload images with automatic variant generation  
      ✅ **Comprehensive Assessment System** - Multiple question types and auto-grading  
      ✅ **Real-time Leaderboards** - Gamification with rankings and achievements  
      ✅ **Email Integration** - Automated notifications and invitations  
      ✅ **Progress Tracking** - Detailed learning analytics and completion monitoring  
      ✅ **Responsive API Design** - Consistent error handling and response formats  

      ---

      ## 💡 **Testing Tips**

      - **Start with Authentication**: Always sign in first to test protected endpoints
      - **Use Real Data**: Test with realistic names, emails, and content for better results
      - **Test Edge Cases**: Try invalid inputs to see comprehensive error handling
      - **Check Relationships**: Notice how entities link together (org → branch → user → course)
      - **Explore Filters**: Many endpoints support filtering, pagination, and search
      - **Test File Uploads**: Use actual image files to see automatic processing
      - **Monitor Responses**: Notice the rich, consistent response structures

      All endpoints include detailed request/response examples and comprehensive error messages 
      to make testing and integration as smooth as possible.`,
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
        customSiteTitle: 'trainpro API Documentation',
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
bootstrap().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
});
