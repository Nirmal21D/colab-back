# Visual Learning Aids API Documentation

## Overview
The Visual Learning Aids module provides comprehensive endpoints for managing flashcards, mind maps, quizzes, and AI-generated learning content.

## Base URL
```
/api/visual-aids
```

## Authentication
All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Flashcards

### Create Flashcard Set
**POST** `/flashcards/sets`

Create a new flashcard set.

**Request Body:**
```json
{
  "title": "Physics Formulas",
  "description": "Key formulas for final exam",
  "subject": "507f1f77bcf86cd799439011",
  "sourceType": "manual",
  "visibility": "private",
  "tags": ["physics", "formulas", "exam"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Physics Formulas",
    "cardCount": 0,
    ...
  }
}
```

### Get All Flashcard Sets
**GET** `/flashcards/sets?subjectId=xxx&visibility=private`

Get all flashcard sets for the authenticated user.

### Get Flashcard Set by ID
**GET** `/flashcards/sets/:id`

Get a specific flashcard set with all its cards.

### Update Flashcard Set
**PUT** `/flashcards/sets/:id`

Update flashcard set metadata.

### Delete Flashcard Set
**DELETE** `/flashcards/sets/:id`

Delete a flashcard set and all its cards.

### Add Card(s) to Set
**POST** `/flashcards/sets/:id/cards`

Add one or multiple cards to a set.

**Single Card:**
```json
{
  "question": "What is Newton's First Law?",
  "answer": "An object at rest stays at rest...",
  "difficulty": "medium",
  "tags": ["physics", "newton"],
  "explanation": "Also known as the law of inertia"
}
```

**Multiple Cards:**
```json
[
  {
    "question": "Question 1",
    "answer": "Answer 1",
    "difficulty": "easy"
  },
  {
    "question": "Question 2",
    "answer": "Answer 2",
    "difficulty": "hard"
  }
]
```

### Update Card
**PUT** `/flashcards/cards/:id`

Update a specific flashcard.

### Delete Card
**DELETE** `/flashcards/cards/:id`

Delete a specific flashcard.

### Shuffle Cards
**POST** `/flashcards/sets/:id/shuffle`

Get cards in random order (doesn't modify database).

### Track Card Study
**PUT** `/flashcards/cards/:id/track`

Update study tracking for a card.

```json
{
  "confidence": 4
}
```

---

## Mind Maps

### Create Mind Map
**POST** `/mindmaps`

Create a new mind map.

**Request Body:**
```json
{
  "title": "Machine Learning Overview",
  "topic": "ML Fundamentals",
  "subject": "507f1f77bcf86cd799439011",
  "sourceType": "manual",
  "visibility": "private",
  "nodes": [
    {
      "id": "root",
      "label": "Machine Learning",
      "type": "root",
      "position": { "x": 0, "y": 0 }
    },
    {
      "id": "node-1",
      "label": "Supervised Learning",
      "type": "concept",
      "position": { "x": -200, "y": 100 }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "root",
      "to": "node-1",
      "relation": "includes"
    }
  ]
}
```

### Get All Mind Maps
**GET** `/mindmaps?subjectId=xxx&includeArchived=false`

Get all mind maps for the authenticated user.

### Get Mind Map by ID
**GET** `/mindmaps/:id`

Get a specific mind map.

### Update Mind Map
**PUT** `/mindmaps/:id?createVersion=false`

Update a mind map. Set `createVersion=true` to create a new version.

### Delete Mind Map
**DELETE** `/mindmaps/:id`

Delete a mind map.

### Create New Version
**POST** `/mindmaps/:id/version`

Create a new version of a mind map (archives old version).

### Get Version History
**GET** `/mindmaps/:id/versions`

Get all versions of a mind map.

### Archive Mind Map
**POST** `/mindmaps/:id/archive`

Archive a mind map.

---

## Quizzes

### Create Quiz
**POST** `/quizzes`

Create a new quiz.

**Request Body:**
```json
{
  "title": "Chapter 5 Quiz",
  "description": "Test on chemical reactions",
  "subject": "507f1f77bcf86cd799439011",
  "visibility": "private",
  "timeLimit": 30,
  "passingScore": 70,
  "questions": [
    {
      "question": "What is H2O?",
      "options": ["Water", "Hydrogen", "Oxygen", "Carbon"],
      "correctAnswer": "Water",
      "explanation": "H2O is the chemical formula for water",
      "difficulty": "easy",
      "points": 1
    }
  ],
  "settings": {
    "shuffleQuestions": true,
    "shuffleOptions": true,
    "showCorrectAnswers": true,
    "allowRetake": true
  }
}
```

### Get All Quizzes
**GET** `/quizzes?subjectId=xxx`

Get all quizzes for the authenticated user.

### Get Quiz by ID
**GET** `/quizzes/:id?includeAnswers=true`

Get a specific quiz. Set `includeAnswers=false` when taking quiz.

### Update Quiz
**PUT** `/quizzes/:id`

Update a quiz.

### Delete Quiz
**DELETE** `/quizzes/:id`

Delete a quiz and all attempts.

### Create Quiz from Flashcards
**POST** `/quizzes/from-flashcards/:setId`

Generate a quiz from a flashcard set.

```json
{
  "title": "Quiz from Physics Set",
  "description": "Auto-generated",
  "visibility": "private",
  "timeLimit": 20,
  "passingScore": 75
}
```

### Submit Quiz Attempt
**POST** `/quizzes/:id/attempts`

Submit answers for a quiz.

```json
{
  "answers": [
    {
      "questionId": "...",
      "answer": "Water",
      "timeSpent": 15
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "pointsEarned": 17,
    "totalPoints": 20,
    "passed": true,
    "timeSpent": 450,
    "answers": [...]
  }
}
```

### Get User Attempts
**GET** `/quizzes/attempts?quizId=xxx`

Get all attempts for a user (optionally filtered by quiz).

### Get Quiz Statistics
**GET** `/quizzes/:id/statistics`

Get detailed statistics for a quiz (only creator or admin).

---

## AI Generation

### Generate Flashcards
**POST** `/generate/flashcards`

Generate flashcards using AI.

```json
{
  "text": "Long text content to generate flashcards from...",
  "subject": "Chemistry",
  "subjectId": "507f1f77bcf86cd799439011",
  "count": 10,
  "difficulty": "medium",
  "saveToSet": true,
  "setTitle": "AI-Generated Chemistry Cards"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "set": {...},
    "cards": [...]
  }
}
```

### Generate Mind Map
**POST** `/generate/mindmap`

Generate a mind map using AI.

```json
{
  "text": "Optional source text...",
  "topic": "Neural Networks",
  "subjectId": "507f1f77bcf86cd799439011",
  "maxNodes": 20,
  "save": true
}
```

### Generate Quiz
**POST** `/generate/quiz`

Generate quiz questions using AI.

```json
{
  "text": "Source text for questions...",
  "subject": "Biology",
  "subjectId": "507f1f77bcf86cd799439011",
  "count": 10,
  "difficulty": "hard",
  "multipleChoice": true,
  "save": true,
  "title": "AI-Generated Biology Quiz"
}
```

### Enhance Flashcards
**POST** `/generate/enhance-flashcards/:setId`

Use AI to enhance existing flashcards.

---

## Visual Encyclopedia (Placeholder)

### Get Topics
**GET** `/encyclopedia/topics`

Returns placeholder response for future Visual Encyclopedia feature.

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Authorization Rules

1. **Private Content**: Users can only access their own private flashcards, mind maps, and quizzes.
2. **Shared Content**: All users can view content marked as "shared".
3. **Admin Access**: Admins can view and moderate all content.
4. **Modification**: Only creators (or admins) can modify/delete content.

---

## Data Models

### Flashcard Set
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  subject: ObjectId (ref: Subject),
  createdBy: ObjectId (ref: User),
  sourceType: "manual" | "ai" | "study_buddy",
  visibility: "private" | "shared",
  cardCount: Number,
  tags: [String],
  lastStudied: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Flashcard
```javascript
{
  _id: ObjectId,
  setId: ObjectId (ref: FlashcardSet),
  question: String,
  answer: String,
  difficulty: "easy" | "medium" | "hard",
  tags: [String],
  order: Number,
  explanation: String,
  options: [String],
  timesReviewed: Number,
  lastReviewed: Date,
  confidence: Number (0-5),
  createdAt: Date,
  updatedAt: Date
}
```

### Mind Map
```javascript
{
  _id: ObjectId,
  title: String,
  topic: String,
  subject: ObjectId (ref: Subject),
  createdBy: ObjectId (ref: User),
  sourceType: "manual" | "ai" | "study_buddy",
  visibility: "private" | "shared",
  nodes: [{ id, label, type, position, style, data }],
  edges: [{ id, from, to, relation, style }],
  version: Number,
  parentVersion: ObjectId (ref: MindMap),
  isArchived: Boolean,
  tags: [String],
  metadata: { layout, zoom, center },
  createdAt: Date,
  updatedAt: Date
}
```

### Quiz
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  subject: ObjectId (ref: Subject),
  linkedSetId: ObjectId (ref: FlashcardSet),
  questions: [{
    question: String,
    options: [String],
    correctAnswer: String,
    explanation: String,
    difficulty: "easy" | "medium" | "hard",
    points: Number,
    order: Number
  }],
  createdBy: ObjectId (ref: User),
  sourceType: "manual" | "ai" | "study_buddy" | "flashcards",
  visibility: "private" | "shared",
  timeLimit: Number (minutes),
  passingScore: Number (0-100),
  settings: {
    shuffleQuestions: Boolean,
    shuffleOptions: Boolean,
    showCorrectAnswers: Boolean,
    allowRetake: Boolean
  },
  tags: [String],
  totalAttempts: Number,
  averageScore: Number,
  createdAt: Date,
  updatedAt: Date
}
```
