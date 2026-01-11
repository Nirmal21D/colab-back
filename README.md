# Appointify Backend

Backend API server for the Appointify Smart Appointment Booking System.

## 🚀 Features

- **RESTful API** built with Express.js
- **MongoDB** for flexible data storage
- **JWT Authentication** with role-based access control
- **Cloudflare R2** integration for file storage
- **Real-time slot generation** and booking validation
- **Comprehensive booking lifecycle** management
- **Rate limiting** and security middleware

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # MongoDB connection
│   │   └── r2.js         # Cloudflare R2 setup
│   ├── controllers/      # Request handlers
│   │   ├── authController.js
│   │   ├── appointmentController.js
│   │   ├── bookingController.js
│   │   ├── scheduleController.js
│   │   └── adminController.js
│   ├── middleware/       # Custom middleware
│   │   ├── auth.js       # Authentication & authorization
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── models/          # MongoDB schemas
│   │   ├── User.js
│   │   ├── Appointment.js
│   │   ├── Schedule.js
│   │   └── Booking.js
│   ├── routes/          # API routes
│   │   ├── authRoutes.js
│   │   ├── appointmentRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── scheduleRoutes.js
│   │   ├── adminRoutes.js
│   │   └── uploadRoutes.js
│   ├── utils/           # Utility functions
│   │   ├── slotGenerator.js
│   │   ├── r2Upload.js
│   │   └── helpers.js
│   └── server.js        # Entry point
├── .env.example         # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your configuration:

```bash
cp .env.example .env
```

Required environment variables:
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `R2_ACCOUNT_ID` - Cloudflare account ID
- `R2_ACCESS_KEY_ID` - Cloudflare R2 access key
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 secret key
- `R2_BUCKET_NAME` - Your R2 bucket name
- `R2_PUBLIC_URL` - Public URL for R2 bucket

### 3. Start MongoDB

Make sure MongoDB is running locally or use MongoDB Atlas.

### 4. Run the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## 📡 API Endpoints

### 🔐 Authentication Routes

Complete guide for frontend integration with examples.

---

#### 1. **Register User (Send OTP)**

**Endpoint:** `POST /api/auth/register`

**Description:** Initiates user registration by sending an OTP to the user's email. Account is NOT created until OTP is verified.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phone": "+1234567890",
  "role": "customer"  // Optional: "customer" | "organizer" | "admin" (default: "customer")
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification code sent successfully. Please check your email.",
  "data": {
    "email": "john@example.com",
    "message": "OTP sent to your email",
    "expiresIn": "10 minutes"
  }
}
```

**Error Responses:**
```json
// User already exists
{
  "success": false,
  "message": "User already exists with this email"
}

// Email sending failed
{
  "success": false,
  "message": "Failed to send verification email. Please try again."
}

// Validation error
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Valid email is required" }
  ]
}
```

---

#### 2. **Verify OTP**

**Endpoint:** `POST /api/auth/verify-otp`

**Description:** Verifies the OTP and creates the user account. Returns JWT token for immediate login.

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Email verified successfully. Account created!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "657a1b2c3d4e5f6g7h8i9j0k",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "emailVerified": true
    }
  }
}
```

**Error Responses:**
```json
// No verification found
{
  "success": false,
  "message": "No verification request found for this email"
}

// OTP expired
{
  "success": false,
  "message": "OTP has expired. Please request a new one."
}

// Invalid OTP
{
  "success": false,
  "message": "Invalid OTP. 4 attempts remaining."
}

// Maximum attempts exceeded
{
  "success": false,
  "message": "Maximum verification attempts exceeded. Please request a new OTP."
}
```

**Frontend Integration:**
```javascript
// Step 1: Register
const register = async (userData) => {
  const response = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.json();
};

// Step 2: Verify OTP
const verifyOTP = async (email, otp) => {
  const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  const data = await response.json();
  
  if (data.success) {
    // Store token in localStorage/cookie
    localStorage.setItem('authToken', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
  }
  
  return data;
};
```

---

#### 3. **Resend OTP**

**Endpoint:** `POST /api/auth/resend-otp`

**Description:** Resends a new OTP to the user's email. Resets attempt counter.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification code resent successfully",
  "data": {
    "email": "john@example.com",
    "message": "New OTP sent to your email",
    "expiresIn": "10 minutes"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "No pending verification found for this email"
}
```

---

#### 4. **Login**

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticates user with email and password. Returns JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "657a1b2c3d4e5f6g7h8i9j0k",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "avatar": null
    }
  }
}
```

**Error Responses:**
```json
// Invalid credentials
{
  "success": false,
  "message": "Invalid credentials"
}

// Account deactivated
{
  "success": false,
  "message": "Your account has been deactivated"
}
```

**Frontend Integration:**
```javascript
const login = async (email, password) => {
  const response = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('authToken', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
  }
  
  return data;
};
```

---

#### 5. **Get Current User Profile**

**Endpoint:** `GET /api/auth/me`

**Description:** Gets the authenticated user's profile information.

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "657a1b2c3d4e5f6g7h8i9j0k",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "role": "customer",
      "avatar": null,
      "emailVerified": true,
      "isActive": true,
      "createdAt": "2025-12-20T08:00:00.000Z"
    }
  }
}
```

**Error Response:**
```json
// No token provided
{
  "success": false,
  "message": "Not authorized to access this route"
}

// Invalid/expired token
{
  "success": false,
  "message": "Token is invalid or expired"
}
```

**Frontend Integration:**
```javascript
const getProfile = async () => {
  const token = localStorage.getItem('authToken');
  
  const response = await fetch('http://localhost:5000/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

---

#### 6. **Update Profile**

**Endpoint:** `PUT /api/auth/profile`

**Description:** Updates the authenticated user's profile.

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Updated",
  "phone": "+9876543210",
  "organizerProfile": {  // Only for organizers
    "businessName": "John's Services",
    "description": "Professional consultation services",
    "website": "https://example.com",
    "address": "123 Main St, City, Country"
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "657a1b2c3d4e5f6g7h8i9j0k",
      "name": "John Updated",
      "email": "john@example.com",
      "phone": "+9876543210",
      "role": "customer"
    }
  }
}
```

**Frontend Integration:**
```javascript
const updateProfile = async (updates) => {
  const token = localStorage.getItem('authToken');
  
  const response = await fetch('http://localhost:5000/api/auth/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return response.json();
};
```

---

### 🔄 Complete Authentication Flow

```javascript
// 1. Registration Flow
const handleRegister = async (formData) => {
  try {
    // Send registration request
    const registerResponse = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const registerData = await registerResponse.json();
    
    if (registerData.success) {
      // Show OTP input form
      setShowOTPForm(true);
      setUserEmail(formData.email);
    }
  } catch (error) {
    console.error('Registration failed:', error);
  }
};

// 2. OTP Verification
const handleVerifyOTP = async (otp) => {
  try {
    const verifyResponse = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, otp })
    });
    const verifyData = await verifyResponse.json();
    
    if (verifyData.success) {
      // Store token and redirect to dashboard
      localStorage.setItem('authToken', verifyData.data.token);
      localStorage.setItem('user', JSON.stringify(verifyData.data.user));
      navigate('/dashboard');
    }
  } catch (error) {
    console.error('Verification failed:', error);
  }
};

// 3. Login Flow
const handleLogin = async (email, password) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      navigate('/dashboard');
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// 4. Protected Route Check
const checkAuth = async () => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    navigate('/login');
    return;
  }
  
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    if (!data.success) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/login');
    }
  } catch (error) {
    navigate('/login');
  }
};

// 5. Logout
const handleLogout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  navigate('/login');
};
```

---

### 📝 Important Notes for Frontend Developers

1. **Token Storage:** Store JWT token in `localStorage` or secure HTTP-only cookies
2. **Token Expiry:** Tokens expire in 7 days (configurable in backend)
3. **OTP Expiry:** OTP codes expire in 10 minutes
4. **OTP Attempts:** Maximum 5 attempts per OTP, then must request new one
5. **Email Verification:** Account is only created after OTP verification
6. **Protected Routes:** Always include `Authorization: Bearer <token>` header
7. **Error Handling:** Check `success` field in response before accessing `data`
8. **Role-Based Access:** Check `user.role` for feature access control

---

### 🛡️ Authorization Headers

For all protected routes, include:
```javascript
headers: {
  'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
  'Content-Type': 'application/json'
}
```

### Appointments (Organizer)
- `POST /api/appointments` - Create appointment
- `GET /api/appointments` - Get organizer's appointments
- `GET /api/appointments/:id` - Get single appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment
- `PATCH /api/appointments/:id/publish` - Toggle publish status

### Appointments (Public)
- `GET /api/appointments/slug/:slug` - Get appointment by slug
- `GET /api/appointments/:id/slots` - Get available slots

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/my-bookings` - Get customer bookings
- `GET /api/bookings/organizer` - Get organizer bookings
- `GET /api/bookings/:id` - Get single booking
- `PATCH /api/bookings/:id/cancel` - Cancel booking
- `PATCH /api/bookings/:id/status` - Update booking status

### Schedules
- `GET /api/schedules/:appointmentId` - Get schedule
- `PUT /api/schedules/:appointmentId/working-hours` - Update working hours
- `POST /api/schedules/:appointmentId/overrides` - Add date override
- `DELETE /api/schedules/:appointmentId/overrides/:date` - Remove override

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user by ID
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `PATCH /api/admin/users/:id/toggle-active` - Toggle user status
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/bookings` - Get all bookings

### File Upload
- `POST /api/upload` - Upload file to R2
- `DELETE /api/upload` - Delete file from R2

## 🔐 User Roles

- **Customer** - Book appointments, view booking history
- **Organizer** - Create appointments, manage schedules, handle bookings
- **Admin** - System-level management, user management, analytics

## 🗄️ Database Models

### User
- Authentication and profile data
- Role-based access (customer, organizer, admin)
- Organizer-specific business profile

### Appointment
- Title, description, duration, capacity
- Assignment configuration (user/resource/auto)
- Booking rules and constraints
- Publication status

### Schedule
- Weekly working hours
- Date-specific overrides
- Timezone configuration

### Booking
- Customer and appointment details
- Time slot allocation
- Status management (pending, confirmed, cancelled, completed, no-show)
- Payment integration support

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based authorization
- Request rate limiting
- Helmet.js security headers
- CORS configuration
- Input validation

## 📦 Key Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **@aws-sdk/client-s3** - Cloudflare R2 (S3-compatible)
- **date-fns** - Date manipulation
- **helmet** - Security middleware
- **express-rate-limit** - Rate limiting
- **multer** - File upload handling

## 🧪 Testing

```bash
npm test
```

## 📝 License

ISC

## 👥 Contributing

This is a project built for the Appointify Smart Appointment Booking System.
