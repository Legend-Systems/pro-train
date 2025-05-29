# 🚀 Server - NestJS Authentication & User Management API

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

<p align="center">A robust, secure, and scalable authentication and user management API built with NestJS, TypeScript, and MySQL.</p>

<p align="center">
  <a href="https://nodejs.org/" target="_blank"><img src="https://img.shields.io/badge/Node.js-18%2B-green.svg" alt="Node.js Version" /></a>
  <a href="https://nestjs.com/" target="_blank"><img src="https://img.shields.io/badge/NestJS-10%2B-red.svg" alt="NestJS Version" /></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/TypeScript-5%2B-blue.svg" alt="TypeScript Version" /></a>
  <a href="https://www.mysql.com/" target="_blank"><img src="https://img.shields.io/badge/MySQL-8%2B-orange.svg" alt="MySQL Version" /></a>
</p>

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [API Endpoints](#-api-endpoints)
- [Environment Configuration](#-environment-configuration)
- [Database Schema](#-database-schema)
- [Security Features](#-security-features)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)

---

## ✨ Features

### 🔐 **Authentication & Authorization**
- JWT-based authentication with refresh tokens
- Password reset via email (token-based)
- Email verification system
- Rate limiting and throttling
- Secure password hashing with bcrypt

### 👤 **User Management**
- Complete user profile management
- Password change functionality
- Account creation and deletion
- Role-based access control (BRANDON, OWNER, ADMIN, USER)

### 🛡️ **Security**
- Database connection pooling with retry logic
- Input validation and sanitization
- API documentation with Swagger/OpenAPI
- Health check endpoints
- Comprehensive error handling

### 📊 **Monitoring & Reliability**
- Database connection health monitoring
- Automatic retry logic for failed operations
- Structured logging with context
- Connection pool management

---

## 🏗️ Architecture

### **Module Structure**

```
server/src/
├── 🔐 auth/                          # Authentication Module
│   ├── dto/
│   │   ├── forgot-password.dto.ts     # Email-based password reset
│   │   └── reset-password.dto.ts      # Token-based password reset
│   ├── guards/
│   │   └── jwt-auth.guard.ts          # JWT authentication guard
│   ├── interfaces/
│   │   └── authenticated-request.interface.ts
│   ├── validators/
│   │   └── password.validator.ts      # Custom password validation
│   ├── auth.controller.ts             # Auth endpoints
│   ├── auth.service.ts                # Auth business logic
│   ├── auth.module.ts                 # Auth module configuration
│   ├── jwt.strategy.ts                # JWT passport strategy
│   └── token-manager.service.ts       # JWT token management
│
├── 👤 user/                          # User Management Module
│   ├── dto/
│   │   ├── create-user.dto.ts         # User registration
│   │   ├── update-user.dto.ts         # Profile updates
│   │   ├── change-password.dto.ts     # Password change
│   │   ├── sign-in.dto.ts             # User login
│   │   └── session-response.dto.ts    # Auth session responses
│   ├── entities/
│   │   └── user.entity.ts             # User database entity
│   ├── user.controller.ts             # User endpoints
│   ├── user.service.ts                # User business logic
│   └── user.module.ts                 # User module configuration
│
├── app.controller.ts                  # Health check endpoints
├── app.service.ts                     # App-level services
├── app.module.ts                      # Root application module
└── main.ts                           # Application bootstrap
```

### **Authentication Flow Architecture**

#### **🚪 Unauthenticated Operations** (`/auth`)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Access   │ -> │  Auth Controller │ -> │  Auth Service   │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Sign Up       │    │ • Input Validation│   │ • Password Hash │
│ • Sign In       │    │ • Rate Limiting   │   │ • JWT Generation│
│ • Forgot Pwd    │    │ • Throttling      │   │ • Email Sending │
│ • Reset Pwd     │    │ • Documentation   │   │ • Token Mgmt    │
│ • Refresh Token │    │ • Error Handling  │   │ • User Lookup   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

#### **🔒 Authenticated Operations** (`/user`)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Authenticated   │ -> │  User Controller │ -> │  User Service   │
│     User        │    │                  │    │                 │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Get Profile   │    │ • JWT Guard      │   │ • Profile Mgmt  │
│ • Update Profile│ -> │ • Authorization  │ -> │ • Password Ops  │
│ • Change Pwd    │    │ • Input Valid.   │   │ • Database Ops  │
│ • Delete Account│    │ • Error Handling │   │ • Data Validation│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ 
- MySQL 8+
- Yarn or npm

### **Installation**

```bash
# Clone the repository
git clone <repository-url>
cd server

# Install dependencies
yarn install

# Copy environment file
cp .env.example .env

# Configure your database and JWT settings in .env
# See Environment Configuration section below
```

### **Database Setup**

```bash
# Ensure MySQL is running
# Create database (if not exists)
mysql -u root -p -e "CREATE DATABASE loro_old;"

# TypeORM will auto-create tables (synchronize: true)
```

### **Development Server**

```bash
# Start in development mode with hot reload
yarn start:dev

# Start in production mode
yarn start:prod

# Check health
curl http://localhost:3000/health
```

---

## 🌐 API Endpoints

### **🔐 Authentication Endpoints** (`/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/signup` | Register new user account | ❌ |
| `POST` | `/auth/signin` | User login authentication | ❌ |
| `POST` | `/auth/refresh` | Refresh JWT access token | ❌ |
| `POST` | `/auth/forgot-password` | Request password reset email | ❌ |
| `POST` | `/auth/reset-password` | Reset password with token | ❌ |
| `POST` | `/auth/verify-email` | Verify email address | ❌ |
| `POST` | `/auth/resend-verification` | Resend verification email | ❌ |

### **👤 User Management Endpoints** (`/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/user/profile` | Get user profile | ✅ JWT |
| `PUT` | `/user/profile` | Update user profile | ✅ JWT |
| `PUT` | `/user/change-password` | Change user password | ✅ JWT |

### **🏥 System Endpoints**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/` | API welcome message | ❌ |
| `GET` | `/health` | Database health check | ❌ |

### **📚 API Documentation**

- **Swagger UI**: `http://localhost:3000/api`
- **OpenAPI JSON**: `http://localhost:3000/api-json`

---

## ⚙️ Environment Configuration

Create a `.env` file in the server root:

```bash
# Database Configuration
DATABASE_HOST=129.232.204.10
DATABASE_PORT=3306
DATABASE_USERNAME=loro
DATABASE_PASSWORD=loro
DATABASE_NAME=loro-old

# Database Connection Pool Settings
DB_CONNECTION_LIMIT=20
DB_ACQUIRE_TIMEOUT=30000
DB_TIMEOUT=30000
DB_IDLE_TIMEOUT=30000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-at-least-32-characters
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Application Settings
NODE_ENV=production
PORT=3000

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=10
```

---

## 🛡️ Security Features

### **Password Security**
- Bcrypt hashing with 12 salt rounds
- Strong password requirements (8+ chars, mixed case, numbers, symbols)
- Password history prevention
- Current password verification for changes

### **JWT Security**
- Short-lived access tokens (1 hour)
- Long-lived refresh tokens (7 days)
- Token rotation on refresh
- Secure token storage and validation

### **API Security**
- Rate limiting (10 requests/minute default)
- Input validation and sanitization
- SQL injection prevention via TypeORM
- CORS configuration
- Request throttling by endpoint

### **Database Security**
- Connection pooling with timeouts
- Automatic retry logic for failed connections
- Health monitoring
- Prepared statements via TypeORM

---

## 🔧 Development

### **Available Scripts**

```bash
# Development
yarn start:dev          # Hot reload development server
yarn start:debug        # Debug mode with inspector

# Building
yarn build              # Compile TypeScript to JavaScript
yarn start:prod         # Run production build

# Testing
yarn test               # Unit tests
yarn test:e2e           # End-to-end tests
yarn test:cov           # Test coverage report

# Code Quality
yarn lint               # ESLint checking
yarn format             # Prettier formatting
```

### **Code Style & Formatting**

This project uses Prettier with 4-space indentation:

```json
{
    "semi": true,
    "trailingComma": "all",
    "singleQuote": true,
    "printWidth": 80,
    "tabWidth": 4,
    "useTabs": false
}
```

---

## 🧪 Testing

### **Unit Tests**
```bash
yarn test               # Run all unit tests
yarn test:watch         # Watch mode for development
yarn test:cov           # Generate coverage report
```

### **E2E Tests**
```bash
yarn test:e2e           # Run end-to-end tests
```

### **Manual Testing**

Use the Swagger UI at `http://localhost:3000/api` for interactive testing, or:

```bash
# Health check
curl http://localhost:3000/health

# Sign up
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Sign in
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

---

## 🚀 Deployment

### **Production Build**

```bash
# Build the application
yarn build

# Start production server
yarn start:prod
```

### **Environment Setup**

1. Set `NODE_ENV=production`
2. Configure production database credentials
3. Use strong JWT secrets (32+ characters)
4. Set appropriate rate limiting values
5. Configure proper CORS origins

### **Database Migration**

```bash
# TypeORM migrations (when needed)
yarn typeorm migration:generate -n MigrationName
yarn typeorm migration:run
```

### **Health Monitoring**

Monitor these endpoints in production:
- `GET /health` - Database connectivity
- Application logs for connection errors
- Database connection pool metrics

---

## 📚 Additional Resources

- **Architecture Documentation**: See `ARCHITECTURE.md` for detailed module separation
- **NestJS Documentation**: [https://docs.nestjs.com](https://docs.nestjs.com)
- **TypeORM Documentation**: [https://typeorm.io](https://typeorm.io)
- **JWT Best Practices**: [https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

---

## 📄 License

This project is [MIT licensed](LICENSE).

---

**Built with ❤️ using NestJS, TypeScript, and MySQL**