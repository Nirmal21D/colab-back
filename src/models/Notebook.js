const mongoose = require('mongoose');

const SourceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pdf', 'text', 'website', 'notes'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  filePath: String, // For uploaded files (local storage)
  url: String, // For websites
  content: String, // For text/notes
  size: Number, // File size in bytes
  selected: {
    type: Boolean,
    default: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
});

const ArtifactSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['quiz', 'mindmap', 'flashcards'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'artifacts.type' // Dynamic reference
  },
  title: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const NotebookSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'Untitled Notebook',
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  
  // Sources stored locally
  sources: [SourceSchema],
  
  // AI Chat Session ID from AI Engine
  aiSessionId: {
    type: String,
    index: true
  },
  
  // Generated artifacts (references to Quiz/MindMap collections)
  artifacts: [ArtifactSchema],
  
  // Metadata
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
NotebookSchema.index({ userId: 1, createdAt: -1 });
NotebookSchema.index({ userId: 1, lastAccessed: -1 });

// Update lastAccessed on any modification
NotebookSchema.pre('save', function() {
  this.lastAccessed = new Date();
});

// Virtual for source count
NotebookSchema.virtual('sourceCount').get(function() {
  return this.sources.length;
});

// Virtual for artifact count  
NotebookSchema.virtual('artifactCount').get(function() {
  return this.artifacts.length;
});

module.exports = mongoose.model('Notebook', NotebookSchema);
