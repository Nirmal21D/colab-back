# Visual Learning Aids - Integration Guide

## Quick Start

### 1. Install Dependencies

Make sure you have these dependencies in your `package.json`:

```bash
npm install express-validator
```

### 2. Register Routes in Main App

In your main `app.js` or `server.js`, add:

```javascript
const visualAidsRoutes = require('./src/routes/visualAids.routes');

// ... other middleware ...

// Register Visual Aids routes
app.use('/api/visual-aids', visualAidsRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});
```

### 3. Ensure Auth Middleware Exists

The module expects an auth middleware at `src/middleware/auth.middleware.js`:

```javascript
// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};
```

### 4. Create Subject Management Routes (if not exists)

Since quizzes are organized by subjects, you'll need subject routes:

```javascript
// src/routes/subject.routes.js
const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const { protect } = require('../middleware/auth.middleware');

// Create subject
router.post('/', protect, async (req, res) => {
  try {
    const subject = await Subject.create({
      ...req.body,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get user's subjects
router.get('/', protect, async (req, res) => {
  try {
    const subjects = await Subject.find({
      createdBy: req.user.id,
      isActive: true
    }).sort({ name: 1 });
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;

// Register in app.js:
// app.use('/api/subjects', require('./src/routes/subject.routes'));
```

### 5. Environment Variables

Ensure these are in your `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/collabry
JWT_SECRET=your-secret-key
NODE_ENV=development
```

---

## AI Service Integration

### Connecting to Your AI Engine

Replace the mock AI service with real implementations:

```javascript
// src/services/ai.service.js

const axios = require('axios');

class AIService {
  constructor() {
    this.aiEngineURL = process.env.AI_ENGINE_URL || 'http://localhost:8000';
  }

  async generateFlashcards({ text, subject, count, difficulty }) {
    try {
      // Call your AI engine
      const response = await axios.post(`${this.aiEngineURL}/ai/qa/generate`, {
        text,
        num_questions: count,
        difficulty,
        include_options: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.getAIToken()}`
        }
      });

      // Transform AI response to flashcard format
      return response.data.questions.map(q => ({
        question: q.question,
        answer: q.answer,
        difficulty: q.difficulty || difficulty,
        explanation: q.explanation,
        tags: [subject]
      }));
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error('Failed to generate flashcards');
    }
  }

  async generateMindMap({ text, topic, maxNodes }) {
    try {
      const response = await axios.post(`${this.aiEngineURL}/ai/mindmap/generate`, {
        text,
        topic,
        max_nodes: maxNodes
      }, {
        headers: {
          'Authorization': `Bearer ${this.getAIToken()}`
        }
      });

      return response.data.mindmap;
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error('Failed to generate mind map');
    }
  }

  async generateQuiz({ text, subject, count, difficulty, multipleChoice }) {
    try {
      const response = await axios.post(`${this.aiEngineURL}/ai/qa/generate`, {
        text,
        num_questions: count,
        difficulty,
        include_options: multipleChoice
      }, {
        headers: {
          'Authorization': `Bearer ${this.getAIToken()}`
        }
      });

      return response.data.questions.map(q => ({
        question: q.question,
        options: q.options || [],
        correctAnswer: q.answer,
        explanation: q.explanation,
        difficulty: q.difficulty || difficulty,
        points: 1
      }));
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error('Failed to generate quiz');
    }
  }

  getAIToken() {
    // Return JWT token for AI engine authentication
    return process.env.AI_ENGINE_TOKEN || '';
  }
}

module.exports = new AIService();
```

---

## Study Buddy Integration

### Connecting Study Buddy Conversations

```javascript
// In your Study Buddy service, add:

async generateLearningAids(conversationId, type) {
  const conversation = await this.getConversation(conversationId);
  const content = conversation.messages.map(m => m.content).join('\n');

  switch(type) {
    case 'flashcards':
      return axios.post('/api/visual-aids/generate/flashcards', {
        text: content,
        subject: conversation.subject,
        subjectId: conversation.subjectId,
        count: 10,
        saveToSet: true,
        setTitle: `Study Buddy: ${conversation.title}`
      });

    case 'mindmap':
      return axios.post('/api/visual-aids/generate/mindmap', {
        text: content,
        topic: conversation.title,
        subjectId: conversation.subjectId,
        save: true
      });

    case 'quiz':
      return axios.post('/api/visual-aids/generate/quiz', {
        text: content,
        subject: conversation.subject,
        subjectId: conversation.subjectId,
        count: 10,
        save: true,
        title: `Quiz: ${conversation.title}`
      });
  }
}
```

---

## Testing the API

### Using cURL

```bash
# Get auth token first
TOKEN="your-jwt-token"

# Create a flashcard set
curl -X POST http://localhost:3000/api/visual-aids/flashcards/sets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Set",
    "subject": "507f1f77bcf86cd799439011",
    "description": "My first set"
  }'

# Get all sets
curl http://localhost:3000/api/visual-aids/flashcards/sets \
  -H "Authorization: Bearer $TOKEN"

# Add a card
curl -X POST http://localhost:3000/api/visual-aids/flashcards/sets/SET_ID/cards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is 2+2?",
    "answer": "4",
    "difficulty": "easy"
  }'
```

### Using Postman

1. Import the collection (create a Postman collection with all routes)
2. Set up environment variables:
   - `base_url`: `http://localhost:3000`
   - `token`: Your JWT token
3. Test each endpoint

---

## Database Indexes

Make sure to create indexes for performance:

```javascript
// Run this once to ensure indexes
const mongoose = require('mongoose');
const FlashcardSet = require('./models/FlashcardSet');
const Flashcard = require('./models/Flashcard');
const MindMap = require('./models/MindMap');
const Quiz = require('./models/Quiz');

async function ensureIndexes() {
  await FlashcardSet.syncIndexes();
  await Flashcard.syncIndexes();
  await MindMap.syncIndexes();
  await Quiz.syncIndexes();
  console.log('Indexes created successfully');
}
```

---

## Monitoring & Logging

Add request logging:

```javascript
// src/middleware/logger.middleware.js
const logger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
};

// In app.js
app.use('/api/visual-aids', logger, visualAidsRoutes);
```

---

## Next Steps

1. **Implement proper AI integration** - Replace mock AI service with real calls
2. **Add rate limiting** - Prevent abuse of AI generation endpoints
3. **Add caching** - Cache frequently accessed content
4. **Add real-time updates** - Use Socket.IO for collaborative features
5. **Add analytics** - Track usage patterns and popular content
6. **Add search** - Implement full-text search across content
7. **Add export/import** - Allow users to export their learning aids

---

## Troubleshooting

### Common Issues

**Issue**: "protect is not a function"
- **Solution**: Ensure auth middleware is properly exported with `exports.protect`

**Issue**: Validation errors
- **Solution**: Check that express-validator is installed and imported

**Issue**: MongoDB connection errors
- **Solution**: Verify MONGODB_URI in .env and MongoDB is running

**Issue**: "Subject not found" errors
- **Solution**: Create subjects first using the subject routes

---

## Support

For issues or questions, refer to:
- API Documentation: `VISUAL_AIDS_API.md`
- Architecture: Check folder structure and code comments
- MongoDB Models: See `src/models/` for data structures
