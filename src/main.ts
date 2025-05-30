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

      ## Features
      - **Complete User Management** - Full CRUD operations with profile management
      - **Secure Authentication** - JWT-based authentication with refresh tokens
      - **Email Verification** - Account verification and password reset flows
      - **Password Management** - Secure password changes and reset functionality
      - **High Performance** - Optimized with database indexing and efficient queries

      ## Security
      - 🔐 **JWT Authentication** with Bearer token support
      - 🛡️ **Input Validation** on all endpoints
      - 🔒 **Password Hashing** using bcrypt with salt rounds
      - 📧 **Email Verification** for account security
      - ⏰ **Token Expiration** and refresh mechanisms

      ## Documentation Standards
      All endpoints include comprehensive examples, detailed parameter descriptions, 
      and complete response schemas for easy integration.`,
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
