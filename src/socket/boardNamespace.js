const Board = require('../models/Board');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

// In-memory store for active sessions (user presence)
// boardId -> Map of userId -> sessionData
const activeSessions = new Map();

/**
 * Initialize board-specific Socket.IO events
 * @param {Object} io - Socket.IO server instance
 */
module.exports = (io) => {
  // Board namespace for all board-related events
  const boardNamespace = io.of('/boards');

  // Authentication middleware for board namespace
  boardNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  boardNamespace.on('connection', (socket) => {
    console.log(`📋 Board socket connected: ${socket.userEmail}`);

    /**
     * Join a board room
     */
    socket.on('board:join', async ({ boardId }, callback) => {
      try {
        // Verify user has access to this board
        const board = await Board.findById(boardId);
        
        if (!board) {
          if (typeof callback === 'function') {
            return callback({ error: 'Board not found' });
          }
          return;
        }

        // Check if user is a member or owner
        const isMember = board.owner.toString() === socket.userId || 
                        board.members.some(m => m.userId.toString() === socket.userId);

        if (!isMember && !board.isPublic) {
          if (typeof callback === 'function') {
            return callback({ error: 'Access denied' });
          }
          return;
        }

        // Join the room
        socket.join(boardId);
        socket.currentBoardId = boardId;

        // Add to active sessions using Map for proper user tracking
        if (!activeSessions.has(boardId)) {
          activeSessions.set(boardId, new Map());
        }

        const sessionData = {
          socketId: socket.id,
          userId: socket.userId,
          email: socket.userEmail,
          cursor: { x: 0, y: 0 },
          color: generateUserColor(socket.userId),
          joinedAt: new Date()
        };

        // Use userId as key to prevent duplicate user entries
        activeSessions.get(boardId).set(socket.userId, sessionData);

        // Get all active participants (unique users)
        const participants = Array.from(activeSessions.get(boardId).values());

        console.log(`✅ ${socket.userEmail} joined board: ${boardId}. Total participants: ${participants.length}`);

        // Notify others that user joined
        socket.to(boardId).emit('user:joined', {
          userId: socket.userId,
          email: socket.userEmail,
          color: sessionData.color,
          timestamp: new Date()
        });

        // Send current board state and participants to the joining user
        console.log(`[Board ${boardId}] Sending board data with ${board.elements?.length || 0} elements to ${socket.userEmail}`);
        // Clean board elements before sending (remove Mongoose fields, ensure required tldraw fields)
        const cleanElements = board.elements.map(el => ({
          id: el.id,
          type: el.type,
          typeName: el.typeName || 'shape',
          x: el.x || 0,
          y: el.y || 0,
          rotation: el.rotation || 0,
          isLocked: el.isLocked || false,
          opacity: el.opacity || 1,
          props: el.props || {},
          meta: el.meta || {},
          parentId: el.parentId || 'page:page',
          index: el.index || 'a1'
        })).filter(el => el.type); // Filter out elements without type

        console.log(`[Board ${boardId}] Sending ${cleanElements.length} cleaned elements (original: ${board.elements.length})`);
        
        if (typeof callback === 'function') {
          callback({ 
            success: true,
            board: {
              ...board.toObject(),
              elements: cleanElements
            },
            participants: participants.map(p => ({
              userId: p.userId,
              email: p.email,
              color: p.color,
              cursor: p.cursor
            }))
          });
        }

        console.log(`✅ ${socket.userEmail} joined board: ${boardId}`);
      } catch (error) {
        console.error('Error joining board:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    /**
     * Leave a board room
     */
    socket.on('board:leave', ({ boardId }) => {
      handleUserLeave(socket, boardId);
    });

    /**
     * Create a new element on the board
     */
    socket.on('element:create', async ({ boardId, element }, callback) => {
      try {
        console.log(`[Board ${boardId}] Creating element:`, element.type, element.id);
        
        const board = await Board.findById(boardId);
        if (!board) {
          console.error(`[Board ${boardId}] Board not found`);
          if (callback && typeof callback === 'function') {
            return callback({ error: 'Board not found' });
          }
          return;
        }

        // Add element with metadata
        const newElement = {
          ...element,
          id: element.id || generateId(),
          createdBy: socket.userId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        board.elements.push(newElement);
        board.updatedAt = new Date();
        await board.save();

        console.log(`[Board ${boardId}] Element saved to DB. Total elements: ${board.elements.length}`);

        // Clean element for tldraw - remove Mongoose fields
        const cleanElement = {
          id: newElement.id,
          type: newElement.type,
          x: newElement.x,
          y: newElement.y,
          rotation: newElement.rotation,
          isLocked: newElement.isLocked,
          opacity: newElement.opacity,
          props: newElement.props,
          meta: newElement.meta,
          parentId: newElement.parentId,
          index: newElement.index,
          typeName: newElement.typeName || 'shape'
        };

        // Broadcast to all users in the room except sender
        socket.to(boardId).emit('element:created', {
          element: cleanElement,
          userId: socket.userId,
          timestamp: new Date()
        });

        console.log(`[Board ${boardId}] Broadcasted element:created to room`);

        if (callback && typeof callback === 'function') {
          callback({ success: true, element: cleanElement });
        }
      } catch (error) {
        console.error(`[Board ${boardId}] Error creating element:`, error);
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    /**
     * Update an existing element
     */
    socket.on('element:update', async ({ boardId, elementId, changes }, callback) => {
      try {
        // Use findOneAndUpdate with upsert for atomic operation
        const board = await Board.findOneAndUpdate(
          { 
            _id: boardId,
            'elements.id': elementId 
          },
          {
            $set: {
              'elements.$.id': elementId,
              ...Object.keys(changes).reduce((acc, key) => {
                acc[`elements.$.${key}`] = changes[key];
                return acc;
              }, {}),
              'elements.$.updatedAt': new Date(),
              updatedAt: new Date()
            }
          },
          { new: true }
        );

        let wasCreated = false;
        let element;

        // If element wasn't found (no update happened), create it
        if (!board) {
          // Element doesn't exist, so add it - use $addToSet pattern to prevent duplicates
          const updatedBoard = await Board.findOneAndUpdate(
            { 
              _id: boardId,
              'elements.id': { $ne: elementId }  // Only push if element doesn't exist
            },
            {
              $push: {
                elements: {
                  id: elementId,
                  ...changes,
                  createdBy: socket.userId,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              },
              $set: { updatedAt: new Date() }
            },
            { new: true }
          );

          if (!updatedBoard) {
            // Either board doesn't exist OR element was already added by another request
            // Try to update it instead
            const retryBoard = await Board.findOneAndUpdate(
              { 
                _id: boardId,
                'elements.id': elementId 
              },
              {
                $set: {
                  ...Object.keys(changes).reduce((acc, key) => {
                    acc[`elements.$.${key}`] = changes[key];
                    return acc;
                  }, {}),
                  'elements.$.updatedAt': new Date(),
                  updatedAt: new Date()
                }
              },
              { new: true }
            );

            if (!retryBoard) {
              console.error(`[Board ${boardId}] Board not found even on retry`);
              if (callback && typeof callback === 'function') {
                return callback({ error: 'Board not found' });
              }
              return;
            }

            element = retryBoard.elements.find(el => el.id === elementId);
            console.log(`[Board ${boardId}] Element already existed, updated on retry: ${elementId}`);
            // Don't broadcast since it was likely already created
            if (typeof callback === 'function') {
              return callback({ success: true });
            }
            return;
          }

          element = updatedBoard.elements.find(el => el.id === elementId);
          wasCreated = true;
          console.log(`[Board ${boardId}] Created new element: ${elementId}`);
        } else {
          element = board.elements.find(el => el.id === elementId);
          console.log(`[Board ${boardId}] Updated existing element: ${elementId}`);
        }

        console.log(`[Board ${boardId}] Element saved to DB. Total elements: ${board ? board.elements.length : 'unknown'}`);

        // Broadcast - if it was created, send full element; otherwise send changes
        if (wasCreated) {
          // Convert Mongoose document to plain object and remove Mongoose-specific fields
          const elementObj = element.toObject ? element.toObject() : element;
          const cleanElement = {
            id: elementObj.id,
            type: elementObj.type,
            typeName: elementObj.typeName || 'shape',
            x: elementObj.x,
            y: elementObj.y,
            rotation: elementObj.rotation,
            isLocked: elementObj.isLocked,
            opacity: elementObj.opacity,
            props: elementObj.props,
            meta: elementObj.meta,
            parentId: elementObj.parentId,
            index: elementObj.index,
            typeName: elementObj.typeName || 'shape'
          };
          
          socket.to(boardId).emit('element:created', {
            element: cleanElement,
            userId: socket.userId,
            timestamp: new Date()
          });
          console.log(`[Board ${boardId}] Broadcasted element:created to room`);
        } else {
          // Get the full element for broadcasting
          const elementObj = element.toObject ? element.toObject() : element;
          
          // For draw shapes, send complete shape data instead of just changes
          const broadcastData = elementObj.type === 'draw' ? {
            elementId,
            changes: {
              x: elementObj.x,
              y: elementObj.y,
              rotation: elementObj.rotation,
              opacity: elementObj.opacity,
              isLocked: elementObj.isLocked,
              props: elementObj.props, // Complete props with all segments
              type: elementObj.type,
              typeName: elementObj.typeName || 'shape',
              parentId: elementObj.parentId,
              index: elementObj.index,
              meta: elementObj.meta
            },
            userId: socket.userId,
            timestamp: new Date()
          } : {
            elementId,
            changes,
            userId: socket.userId,
            timestamp: new Date()
          };
          
          socket.to(boardId).emit('element:updated', broadcastData);
          console.log(`[Board ${boardId}] Broadcasted element:updated to room`);
        }

        if (callback && typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        console.error(`[Board ${boardId}] Error updating element:`, error);
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    /**
     * Delete an element
     */
    socket.on('element:delete', async ({ boardId, elementId }, callback) => {
      try {
        console.log(`[Board ${boardId}] Deleting element:`, elementId);
        
        // Use atomic operation to avoid version conflicts
        const board = await Board.findOneAndUpdate(
          { _id: boardId },
          { 
            $pull: { elements: { id: elementId } },
            $set: { updatedAt: new Date() }
          },
          { new: true }
        );

        if (!board) {
          console.error(`[Board ${boardId}] Board not found`);
          if (typeof callback === 'function') {
            return callback({ error: 'Board not found' });
          }
          return;
        }

        console.log(`[Board ${boardId}] Element deleted from DB atomically. Remaining elements: ${board.elements.length}`);

        // Broadcast to all users in the room except sender
        socket.to(boardId).emit('element:deleted', {
          elementId,
          userId: socket.userId,
          timestamp: new Date()
        });

        console.log(`[Board ${boardId}] Broadcasted element:deleted to room`);

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        console.error(`[Board ${boardId}] Error deleting element:`, error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    /**
     * Update cursor position
     */
    socket.on('cursor:move', ({ boardId, position }) => {
      // Update cursor in active sessions
      const sessions = activeSessions.get(boardId);
      if (sessions && sessions.has(socket.userId)) {
        const session = sessions.get(socket.userId);
        session.cursor = position;
      }

      // Broadcast cursor position to others (no callback needed for performance)
      socket.to(boardId).emit('cursor:moved', {
        userId: socket.userId,
        email: socket.userEmail,
        position,
        timestamp: Date.now()
      });
    });

    /**
     * Batch update multiple elements (for performance)
     * NOTE: Currently not used by frontend, but kept for future optimization
     */
    socket.on('elements:batch-update', async ({ boardId, updates }, callback) => {
      try {
        console.log(`[Board ${boardId}] Batch updating ${updates.length} elements`);
        
        // Use atomic operations for each update to avoid version conflicts
        const updatePromises = updates.map(({ elementId, changes }) => {
          return Board.findOneAndUpdate(
            { _id: boardId, 'elements.id': elementId },
            {
              $set: Object.keys(changes).reduce((acc, key) => {
                acc[`elements.$.${key}`] = changes[key];
                return acc;
              }, { 'elements.$.updatedAt': new Date() })
            },
            { new: true }
          );
        });

        await Promise.all(updatePromises);

        // Update board timestamp
        await Board.findByIdAndUpdate(boardId, { updatedAt: new Date() });

        console.log(`[Board ${boardId}] Batch update completed`);

        // Broadcast to all users
        socket.to(boardId).emit('elements:batch-updated', {
          updates,
          userId: socket.userId,
          timestamp: new Date()
        });

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        console.error(`[Board ${boardId}] Error batch updating elements:`, error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      if (socket.currentBoardId) {
        handleUserLeave(socket, socket.currentBoardId);
      }
    });
  });

  /**
   * Handle user leaving a board
   */
  function handleUserLeave(socket, boardId) {
    socket.leave(boardId);

    // Remove from active sessions using userId as key
    const sessions = activeSessions.get(boardId);
    if (sessions && sessions.has(socket.userId)) {
      sessions.delete(socket.userId);
      console.log(`👋 ${socket.userEmail} left board: ${boardId}. Remaining participants: ${sessions.size}`);

      // Clean up empty session maps
      if (sessions.size === 0) {
        activeSessions.delete(boardId);
        console.log(`🗑️ Removed empty board session: ${boardId}`);
      }
    }

    // Notify others that user left
    socket.to(boardId).emit('user:left', {
      userId: socket.userId,
      email: socket.userEmail,
      timestamp: new Date()
    });
  }

  /**
   * Generate a consistent color for a user based on their ID
   */
  function generateUserColor(userId) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E76F51', '#2A9D8F'
    ];
    
    // Generate consistent index from userId
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Generate unique ID for elements
   */
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  console.log('📋 Board namespace initialized');
};
