const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Environment validation function
const validateEnvironment = () => {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ CRITICAL ERROR: Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n📝 Please create a .env file based on .env.example and set all required variables.');
    console.error('\n⚠️  SECURITY WARNING: Never use default values for JWT secrets in production!\n');
    process.exit(1);
  }

  // Security warnings for production
  if (process.env.NODE_ENV === 'production') {
    // Check JWT secret strength
    if (process.env.JWT_ACCESS_SECRET.length < 32) {
      console.warn('⚠️  WARNING: JWT_ACCESS_SECRET should be at least 32 characters long for production!');
    }
    if (process.env.JWT_REFRESH_SECRET.length < 32) {
      console.warn('⚠️  WARNING: JWT_REFRESH_SECRET should be at least 32 characters long for production!');
    }

    // Check for default/example values
    const dangerousValues = ['your-super-secret', 'change-this', 'example', 'test'];
    const accessSecretLower = process.env.JWT_ACCESS_SECRET.toLowerCase();
    const refreshSecretLower = process.env.JWT_REFRESH_SECRET.toLowerCase();
    
    if (dangerousValues.some(val => accessSecretLower.includes(val) || refreshSecretLower.includes(val))) {
      console.error('❌ CRITICAL: JWT secrets appear to be using example/default values in production!');
      console.error('   Generate secure secrets using: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      process.exit(1);
    }

    // Check CORS configuration
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
      console.error('❌ CRITICAL: CORS_ORIGIN must be explicitly set in production (no wildcards)!');
      process.exit(1);
    }
  }

  console.log('✅ Environment validation passed');
};

// Run validation
validateEnvironment();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodb: {
    uri: process.env.MONGODB_URI,
    options: {},
  },
  cors: {
    origin: true, // Allow all origins dynamically
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    fromName: process.env.EMAIL_FROM_NAME || 'Collabry',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};

module.exports = config;
