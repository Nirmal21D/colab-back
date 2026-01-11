const mongoose = require('mongoose');

// Flexible schema for tldraw elements - store as-is
const boardElementSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  // Store the entire tldraw shape as flexible JSON
  type: String,
  x: Number,
  y: Number,
  rotation: Number,
  isLocked: Boolean,
  opacity: Number,
  meta: mongoose.Schema.Types.Mixed,
  props: mongoose.Schema.Types.Mixed,
  parentId: String,
  index: String,
  typeName: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true, strict: false }); // Allow additional fields

const boardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Board title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'editor'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  elements: [boardElementSchema],
  isPublic: {
    type: Boolean,
    default: false
  },
  settings: {
    backgroundColor: {
      type: String,
      default: '#FFFFFF'
    },
    gridEnabled: {
      type: Boolean,
      default: true
    },
    gridSize: {
      type: Number,
      default: 20
    },
    snapToGrid: {
      type: Boolean,
      default: false
    },
    canvasWidth: {
      type: Number,
      default: 5000
    },
    canvasHeight: {
      type: Number,
      default: 5000
    }
  },
  thumbnail: {
    type: String // URL to thumbnail image
  },
  tags: [{
    type: String,
    trim: true
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
boardSchema.index({ owner: 1, createdAt: -1 });
boardSchema.index({ 'members.userId': 1 });
boardSchema.index({ isPublic: 1, isArchived: 1 });
boardSchema.index({ lastActivity: -1 });
boardSchema.index({ tags: 1 });

// Virtual for element count
boardSchema.virtual('elementCount').get(function() {
  return this.elements?.length || 0;
});

// Virtual for member count
boardSchema.virtual('memberCount').get(function() {
  return (this.members?.length || 0) + 1; // +1 for owner
});

// Update lastActivity on any change
boardSchema.pre('save', function() {
  this.lastActivity = new Date();
});

// Method to check if user has access
boardSchema.methods.hasAccess = function(userId) {
  const userIdStr = userId.toString();
  
  if (this.owner.toString() === userIdStr) {
    return true;
  }
  
  if (this.isPublic) {
    return true;
  }
  
  return this.members.some(m => m.userId.toString() === userIdStr);
};

// Method to get user role
boardSchema.methods.getUserRole = function(userId) {
  const userIdStr = userId.toString();
  
  if (this.owner.toString() === userIdStr) {
    return 'owner';
  }
  
  const member = this.members.find(m => m.userId.toString() === userIdStr);
  return member ? member.role : null;
};

// Method to check if user can edit
boardSchema.methods.canEdit = function(userId) {
  const role = this.getUserRole(userId);
  return role === 'owner' || role === 'editor';
};

const Board = mongoose.model('Board', boardSchema);

module.exports = Board;
