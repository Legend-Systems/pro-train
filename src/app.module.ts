import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { User } from './user/entities/user.entity';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configure rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
      {
        name: 'medium',
        ttl: 600000, // 10 minutes
        limit: 50, // 50 requests per 10 minutes
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 100, // 100 requests per hour
      },
    ]),

    // Configure TypeORM with MySQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DATABASE_HOST') || '129.232.204.10',
        port: +(configService.get<number>('DATABASE_PORT') || 3306),
        username: configService.get('DATABASE_USERNAME') || 'loro',
        password: configService.get('DATABASE_PASSWORD') || 'loro',
        database: configService.get('DATABASE_NAME') || 'loro-old',
        entities: [User],
        synchronize: true,
        logging: false,
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),

    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
