# Collabry Authentication API - Testing Guide

## Base URL
```
http://localhost:3000
```

---

## 1. Health Check

### GET /health
Check if server is running

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2026-01-05T...",
  "uptime": 123.456
}
```

---

## 2. Authentication Endpoints

### POST /api/auth/register
Register a new user

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### POST /api/auth/login
Login existing user

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

### POST /api/auth/refresh
Refresh access token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token-here"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token"
  }
}
```

---

### POST /api/auth/logout
Logout user (placeholder)

```bash
curl -X POST http://localhost:3000/api/auth/logout
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## 3. Protected Routes (Authentication Required)

### GET /api/users/me
Get current user profile

```bash
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Not authorized, no token provided"
}
```

---

## 4. Admin Routes (Admin Role Required)

### GET /api/admin/dashboard
Access admin dashboard

```bash
curl http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Welcome to admin dashboard",
  "data": {
    "admin": "Admin Name",
    "stats": {
      "totalUsers": 0,
      "activeUsers": 0
    }
  }
}
```

**Error (403) - Non-admin user:**
```json
{
  "success": false,
  "error": "Role 'user' is not authorized to access this resource"
}
```

---

## Testing Flow

### 1. Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"test123"}'
```

### 2. Save the Tokens
Copy the `accessToken` from the response.

### 3. Access Protected Route
```bash
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Create Admin User (via MongoDB)
To test admin routes, manually update a user's role in MongoDB:
```javascript
db.users.updateOne(
  { email: "test@example.com" },
  { $set: { role: "admin" } }
)
```

### 5. Test Admin Route
Login again to get new token with admin role, then:
```bash
curl http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN"
```

---

## Common Error Codes

- **400** - Bad Request (validation error)
- **401** - Unauthorized (invalid/missing token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found (resource doesn't exist)
- **500** - Internal Server Error

---

## Token Expiration

- **Access Token**: 15 minutes (configurable in `.env`)
- **Refresh Token**: 7 days (configurable in `.env`)

When access token expires, use refresh token to get new tokens via `/api/auth/refresh`.

---

## Security Notes

1. **Never commit** `.env` file with real secrets
2. **Change JWT secrets** in production
3. **Use HTTPS** in production
4. **Implement rate limiting** for auth endpoints
5. **Add token blacklist** for logout functionality
6. Password is automatically hashed with bcrypt (salt rounds: 10)
