# Collabry Backend

Production-ready Node.js + Express backend for Collabry with complete authentication system.

## Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing

## Prerequisites

- Node.js 16+ and npm
- MongoDB (local or Atlas)

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your MongoDB URI and JWT secrets
```

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/collabry
CORS_ORIGIN=*

# JWT Secrets (CHANGE THESE!)
JWT_ACCESS_SECRET=your-super-secret-access-token-key
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Running the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# Create admin user (one-time setup)
npm run create-admin
```

## Project Structure

```
/src
  /config          - Configuration files (db, env)
  /models          - Mongoose models (User)
  /routes          - Express routes (auth, user, admin)
  /controllers     - Route controllers
  /services        - Business logic layer (auth service)
  /middlewares     - Custom middleware (auth, role, error)
  /utils           - Utility functions (JWT, AppError, asyncHandler)
  /validators      - Input validation
  app.js           - Express app setup
  server.js        - Server entry point
```

## API Endpoints

### Admin Setup
First, create an admin user:
```bash
npm run create-admin
```

### Public Routes

#### Health Check
- `GET /health` - Server health check
- `GET /` - API welcome message

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

### Protected Routes (Auth Required)

#### User Routes
- `GET /api/users/me` - Get current user profile

#### Admin Routes (Admin Only)
- `GET /api/admin/dashboard` - Get admin dashboard

## Authentication

The API uses JWT-based authentication with access and refresh tokens:

### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Protected Request
```bash
GET /api/users/me
Authorization: Bearer <access_token>
```

## Security Features

✅ JWT access & refresh tokens  
✅ Password hashing with bcrypt  
✅ Role-based authorization  
✅ Protected routes middleware  
✅ Environment-based configuration  
✅ Centralized error handling  
✅ Request validation  
✅ CORS enabled  

## User Model

- `name`: String (required, 2-50 chars)
- `email`: String (required, unique, validated)
- `password`: String (required, hashed, min 6 chars)
- `role`: Enum ['user', 'admin'] (default: 'user')
- `isActive`: Boolean (default: true)
- `timestamps`: createdAt, updatedAt

## Error Handling

The application includes centralized error handling middleware that:
- Catches all errors across the application
- Formats error responses consistently
- Logs errors in development mode
- Handles Mongoose-specific errors
- Removes stack traces in production

## License

ISC
