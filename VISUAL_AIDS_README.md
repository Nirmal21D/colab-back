# Visual Learning Aids Module

A comprehensive backend system for managing educational content including flashcards, mind maps, quizzes, and AI-generated learning materials.

## 📦 Module Structure

```
backend/src/
├── models/
│   ├── FlashcardSet.js      # Flashcard set schema
│   ├── Flashcard.js          # Individual flashcard schema
│   ├── MindMap.js            # Mind map schema with versioning
│   ├── Quiz.js               # Quiz schema with questions
│   ├── QuizAttempt.js        # Quiz attempt tracking
│   └── Subject.js            # Subject/course schema
├── controllers/
│   ├── flashcard.controller.js   # Flashcard operations
│   ├── mindmap.controller.js     # Mind map operations
│   ├── quiz.controller.js        # Quiz operations
│   └── generate.controller.js    # AI generation operations
├── services/
│   ├── flashcard.service.js  # Business logic for flashcards
│   ├── mindmap.service.js    # Business logic for mind maps
│   ├── quiz.service.js       # Business logic for quizzes
│   └── ai.service.js         # AI integration interface
├── routes/
│   └── visualAids.routes.js  # All Visual Aids routes
└── middleware/
    └── validation.middleware.js  # Input validation rules
```

## ✨ Features

### Flashcards
- ✅ Create and manage flashcard sets
- ✅ Add/edit/delete individual cards
- ✅ Organize by subject
- ✅ Track study progress (times reviewed, confidence level)
- ✅ Shuffle cards for study sessions
- ✅ Support for explanations and multiple choice options
- ✅ Private/shared visibility

### Mind Maps
- ✅ Create visual mind maps with nodes and edges
- ✅ Version control (immutable past versions)
- ✅ Multiple node types (root, concept, example, note)
- ✅ Customizable layouts and styling
- ✅ Archive old versions
- ✅ Subject-based organization

### Quizzes
- ✅ Create quizzes with multiple choice questions
- ✅ Generate quizzes from flashcard sets
- ✅ Time limits and passing scores
- ✅ Track attempts and scores
- ✅ Detailed statistics per question
- ✅ Shuffle questions and options
- ✅ Retry functionality

### AI Generation
- ✅ Generate flashcards from text
- ✅ Generate mind maps from topics
- ✅ Generate quiz questions
- ✅ Enhance existing content
- ✅ Abstract AI interface (easily pluggable)

### Authorization
- ✅ User-specific content isolation
- ✅ Shared content visibility
- ✅ Admin moderation capabilities
- ✅ JWT-based authentication

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install express-validator
```

### 2. Register Routes

```javascript
// In your app.js or server.js
const visualAidsRoutes = require('./src/routes/visualAids.routes');

app.use('/api/visual-aids', visualAidsRoutes);
```

### 3. Environment Setup

```env
MONGODB_URI=mongodb://localhost:27017/collabry
JWT_SECRET=your-secret-key
AI_ENGINE_URL=http://localhost:8000
NODE_ENV=development
```

### 4. Create Your First Subject

```javascript
POST /api/subjects
{
  "name": "Computer Science",
  "code": "CS101",
  "description": "Introduction to CS",
  "color": "#6366f1"
}
```

### 5. Create Flashcards

```javascript
POST /api/visual-aids/flashcards/sets
{
  "title": "Data Structures",
  "subject": "507f1f77bcf86cd799439011",
  "description": "Key concepts"
}

POST /api/visual-aids/flashcards/sets/:setId/cards
{
  "question": "What is a linked list?",
  "answer": "A linear data structure...",
  "difficulty": "medium"
}
```

## 📖 API Documentation

See [VISUAL_AIDS_API.md](./VISUAL_AIDS_API.md) for complete API reference.

## 🔧 Integration Guide

See [VISUAL_AIDS_INTEGRATION.md](./VISUAL_AIDS_INTEGRATION.md) for detailed integration instructions.

## 🏗️ Architecture

### Clean Layered Architecture

```
Routes → Controllers → Services → Models
  ↓          ↓            ↓         ↓
HTTP    Validation   Business   Database
Layer     Layer      Logic      Layer
```

### Design Principles

1. **Single Responsibility**: Each service handles one domain
2. **Dependency Injection**: Services are loosely coupled
3. **DRY**: Reusable validation and error handling
4. **Scalable**: Easy to add new features
5. **Testable**: Business logic separated from HTTP layer

## 🤖 AI Integration

### Abstract Interface

The AI service provides an abstract interface that can be easily replaced:

```javascript
// Current: Mock implementation
await aiService.generateFlashcards({ text, subject, count });

// Future: Real AI implementation
// Just update the ai.service.js file
```

### Connecting Your AI Engine

Replace mock implementations in `services/ai.service.js`:

```javascript
async generateFlashcards({ text, subject, count, difficulty }) {
  const response = await axios.post(`${this.aiEngineURL}/ai/qa/generate`, {
    text,
    num_questions: count,
    difficulty
  });
  
  return response.data.questions.map(q => ({
    question: q.question,
    answer: q.answer,
    difficulty: q.difficulty,
    explanation: q.explanation
  }));
}
```

## 📊 Data Models

### Flashcard Set
```javascript
{
  title: String,
  subject: ObjectId,
  createdBy: ObjectId,
  sourceType: "manual" | "ai" | "study_buddy",
  visibility: "private" | "shared",
  cardCount: Number,
  tags: [String]
}
```

### Flashcard
```javascript
{
  setId: ObjectId,
  question: String,
  answer: String,
  difficulty: "easy" | "medium" | "hard",
  order: Number,
  timesReviewed: Number,
  confidence: Number (0-5)
}
```

### Mind Map
```javascript
{
  title: String,
  topic: String,
  subject: ObjectId,
  nodes: [{ id, label, type, position }],
  edges: [{ id, from, to, relation }],
  version: Number,
  parentVersion: ObjectId
}
```

### Quiz
```javascript
{
  title: String,
  subject: ObjectId,
  questions: [{
    question: String,
    options: [String],
    correctAnswer: String,
    points: Number
  }],
  timeLimit: Number,
  passingScore: Number
}
```

## 🔐 Security

- **JWT Authentication**: All routes protected
- **Authorization Checks**: Users can only access their content
- **Input Validation**: Express-validator on all inputs
- **MongoDB Injection Prevention**: Mongoose schema validation
- **XSS Prevention**: Input sanitization
- **Rate Limiting**: Recommended for AI endpoints

## 📈 Performance

- **Indexed Fields**: Optimized queries
- **Pagination**: Large result sets paginated
- **Lean Queries**: Minimal data transfer
- **Caching**: Recommended for frequent reads
- **Connection Pooling**: MongoDB connection management

## 🧪 Testing

### Manual Testing

```bash
# Install httpie or use curl
http POST localhost:3000/api/visual-aids/flashcards/sets \
  Authorization:"Bearer $TOKEN" \
  title="Test Set" \
  subject="507f1f77bcf86cd799439011"
```

### Automated Testing (Coming Soon)

```bash
npm test
```

## 🔮 Future Enhancements

### Planned Features

1. **Collaborative Learning**
   - Share sets with specific users
   - Real-time collaborative editing
   - Comments and annotations

2. **Advanced Analytics**
   - Learning curves and progress tracking
   - Spaced repetition algorithms
   - Difficulty adjustment based on performance

3. **Enhanced AI**
   - Contextual question generation
   - Adaptive difficulty
   - Multi-language support

4. **Visual Encyclopedia**
   - Interconnected knowledge base
   - Visual learning pathways
   - Community contributions

5. **Import/Export**
   - Export to Anki, Quizlet formats
   - Import from various sources
   - Bulk operations

6. **Gamification**
   - Achievement badges
   - Leaderboards
   - Study streaks

## 🤝 Contributing

### Code Style

- Use camelCase for variables
- Use PascalCase for classes
- Use async/await over promises
- Add JSDoc comments for functions
- Handle errors gracefully

### Adding New Features

1. Create model in `models/`
2. Create service in `services/`
3. Create controller in `controllers/`
4. Add routes in `routes/`
5. Add validation middleware
6. Update documentation

## 🐛 Troubleshooting

### Common Issues

**Issue**: Validation errors
```javascript
// Solution: Check required fields match schema
{
  "success": false,
  "errors": [
    { "field": "subject", "message": "Subject ID is required" }
  ]
}
```

**Issue**: Unauthorized access
```javascript
// Solution: Ensure JWT token is valid
Authorization: Bearer your-valid-jwt-token
```

**Issue**: Cannot find subject
```javascript
// Solution: Create subject first
POST /api/subjects
```

## 📞 Support

For issues or questions:
- Check API documentation
- Review integration guide
- Check model schemas
- Review error messages

## 📝 License

Part of Collabry - Collaborative Study Platform

## 🎯 Roadmap

- [x] Flashcards CRUD
- [x] Mind Maps with versioning
- [x] Quiz generation from flashcards
- [x] AI generation interface
- [x] Study tracking
- [ ] Real-time collaboration
- [ ] Advanced analytics
- [ ] Visual Encyclopedia
- [ ] Mobile app API support
- [ ] Third-party integrations

---

**Built with ❤️ for better learning experiences**
