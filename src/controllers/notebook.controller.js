const Notebook = require('../models/Notebook');
const Quiz = require('../models/Quiz');
const MindMap = require('../models/MindMap');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const notificationService = require('../services/notification.service');
const { getIO } = require('../socket');
const { emitNotificationToUser } = require('../socket/notificationNamespace');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads/sources');
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

/**
 * Helper function to extract text content from source
 */
async function extractSourceContent(source) {
  if (source.type === 'text' || source.type === 'notes') {
    return source.content || '';
  } else if (source.type === 'pdf' || source.type === 'document') {
    if (source.filePath) {
      try {
        console.log(`Extracting text from PDF: ${source.filePath}`);
        
        // Read PDF file
        const dataBuffer = await fs.readFile(source.filePath);
        
        // Parse PDF and extract text (with options to suppress warnings)
        const pdfData = await pdfParse(dataBuffer, {
          max: 0, // Extract all pages
          verbosity: 0 // Suppress warnings
        });
        const text = pdfData.text;
        
        console.log(`✓ Extracted ${text.length} characters from PDF: ${source.name}`);
        
        if (!text || text.length < 10) {
          console.warn(`⚠ Very little text extracted from PDF: ${source.name}`);
          return `[PDF Document: ${source.name} - No text content extracted. This might be an image-based PDF that requires OCR.]`;
        }
        
        return text;
      } catch (err) {
        console.error('Failed to extract text from PDF:', err.message);
        // Return a descriptive placeholder instead of failing completely
        return `[PDF Document: ${source.name} - Unable to extract text. Error: ${err.message}. Please try converting the PDF to text or using a different format.]`;
      }
    }
    return `[Document: ${source.name} - No file path]`;
  } else if (source.type === 'website') {
    return `[Website: ${source.url}]`;
  }
  return '';
}

/**
 * Ingest source content into AI engine's RAG system
 */
async function ingestSourceToRAG(notebook, source, authToken) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`RAG INGESTION: ${source.name}`);
    console.log(`${'='.repeat(70)}`);
    
    // Extract content from source
    const content = await extractSourceContent(source);
    
    console.log(`Extracted content length: ${content.length} characters`);
    
    // Skip if extraction failed or content is an error message
    if (!content || content.length < 10) {
      console.log('⚠ Skipping RAG ingest - no content or too short');
      return;
    }
    
    // Skip if content is an error placeholder
    if (content.startsWith('[PDF Document:') && content.includes('Unable to extract')) {
      console.log('⚠ Skipping RAG ingest - PDF extraction failed');
      return;
    }

    // Send to AI engine's ingest endpoint
    console.log(`Sending to AI engine: ${AI_ENGINE_URL}/ai/upload`);
    
    const response = await axios.post(
      `${AI_ENGINE_URL}/ai/upload`,
      {
        content: content,
        filename: source.name,
        metadata: {
          notebook_id: notebook._id.toString(),
          source_id: source._id.toString(),
          session_id: notebook.aiSessionId,
          source_type: source.type,
          url: source.url
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log(`✓ RAG ingestion request sent!`);
    console.log(`  Task ID: ${response.data.task_id}`);
    console.log(`  Initial Status: ${response.data.status}`);
    
    // Poll task status until completed
    const taskId = response.data.task_id;
    let status = response.data.status;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    
    while (status === 'processing' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
      
      try {
        const statusResponse = await axios.get(
          `${AI_ENGINE_URL}/ai/upload/status/${taskId}`,
          {
            headers: { 'Authorization': `Bearer ${authToken}` },
            timeout: 5000
          }
        );
        status = statusResponse.data.status;
        console.log(`  Polling (${attempts}s): ${status}`);
        
        // If task is unknown (server restarted), assume it completed
        if (status === 'unknown') {
          console.log(`  ℹ Task status unknown (server may have restarted), assuming completed`);
          status = 'completed';
          break;
        }
      } catch (pollErr) {
        console.warn(`  Warning: Failed to poll task status:`, pollErr.message);
        // If it's a 403 or 404, assume the task completed
        if (pollErr.response && (pollErr.response.status === 403 || pollErr.response.status === 404)) {
          console.log(`  ℹ Task not found (${pollErr.response.status}), assuming completed`);
          status = 'completed';
        }
        break; // Continue anyway if polling fails
      }
    }
    
    if (status === 'completed') {
      console.log(`✅ RAG ingestion completed successfully!`);
    } else if (status === 'failed') {
      console.error(`❌ RAG ingestion failed!`);
    } else {
      console.warn(`⚠ RAG ingestion timeout (still ${status})`);
    }
    console.log(`${'='.repeat(70)}\n`);
  } catch (err) {
    console.error(`\n${'='.repeat(70)}`);
    console.error('❌ RAG INGESTION FAILED');
    console.error(`Error: ${err.message}`);
    if (err.response) {
      console.error(`Response status: ${err.response.status}`);
      console.error(`Response data:`, err.response.data);
    }
    console.error(`${'='.repeat(70)}\n`);
    // Don't throw - this is async and shouldn't block source addition
  }
}


/**
 * @desc    Get all notebooks for current user
 * @route   GET /api/notebook/notebooks
 * @access  Private
 */
exports.getNotebooks = asyncHandler(async (req, res) => {
  const notebooks = await Notebook.find({ 
    userId: req.user._id,
    isArchived: false 
  })
    .sort({ lastAccessed: -1 })
    .select('-sources.content'); // Don't send full content in list

  res.json({
    success: true,
    count: notebooks.length,
    data: notebooks
  });
});

/**
 * @desc    Get single notebook by ID
 * @route   GET /api/notebook/notebooks/:id
 * @access  Private
 */
exports.getNotebook = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  // Create AI session if missing (for notebooks created before AI engine was running)
  if (!notebook.aiSessionId) {
    const token = req.headers.authorization;
    try {
      const aiResponse = await axios.post(
        `${AI_ENGINE_URL}/ai/sessions`,
        { title: notebook.title || 'Notebook Session' },
        { headers: { Authorization: token } }
      );
      notebook.aiSessionId = aiResponse.data.id;
      console.log(`✓ Created AI session for notebook: ${notebook._id}`);
    } catch (error) {
      console.error('Failed to create AI session:', error.message);
      // Continue without AI session
    }
  }

  // Update last accessed
  notebook.lastAccessed = new Date();
  await notebook.save();

  res.json({
    success: true,
    data: notebook
  });
});

/**
 * @desc    Create new notebook
 * @route   POST /api/notebook/notebooks
 * @access  Private
 */
exports.createNotebook = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  // Create AI session for this notebook
  const token = req.headers.authorization;
  let aiSessionId = null;

  try {
    const aiResponse = await axios.post(
      `${AI_ENGINE_URL}/ai/sessions`,
      { title: title || 'New Notebook Session' },
      { headers: { Authorization: token } }
    );
    aiSessionId = aiResponse.data.id;
  } catch (error) {
    console.error('Failed to create AI session:', error.message);
    // Continue without AI session - can be created later
  }

  const notebook = await Notebook.create({
    userId: req.user._id,
    title: title || 'Untitled Notebook',
    description,
    aiSessionId
  });

  res.status(201).json({
    success: true,
    data: notebook
  });
});

/**
 * @desc    Update notebook
 * @route   PUT /api/notebook/notebooks/:id
 * @access  Private
 */
exports.updateNotebook = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  if (title) notebook.title = title;
  if (description !== undefined) notebook.description = description;

  await notebook.save();

  res.json({
    success: true,
    data: notebook
  });
});

/**
 * @desc    Delete notebook
 * @route   DELETE /api/notebook/notebooks/:id
 * @access  Private
 */
exports.deleteNotebook = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  // Delete all source files
  for (const source of notebook.sources) {
    if (source.filePath) {
      try {
        await fs.unlink(source.filePath);
      } catch (error) {
        console.error(`Failed to delete file: ${source.filePath}`, error.message);
      }
    }
  }

  // Delete AI session
  if (notebook.aiSessionId) {
    const token = req.headers.authorization;
    try {
      // Delete session from AI engine (includes MongoDB cleanup)
      await axios.delete(
        `${AI_ENGINE_URL}/ai/sessions/${notebook.aiSessionId}`,
        { headers: { Authorization: token } }
      );
      
      // Delete all documents from FAISS for this session
      await axios.delete(
        `${AI_ENGINE_URL}/ai/documents/session/${notebook.aiSessionId}`,
        { headers: { Authorization: token } }
      );
      
      console.log(`✓ Deleted AI session and FAISS documents for: ${notebook.aiSessionId}`);
    } catch (error) {
      console.error('Failed to delete AI session/documents:', error.message);
    }
  }

  await notebook.deleteOne();

  res.json({
    success: true,
    message: 'Notebook deleted successfully'
  });
});

/**
 * @desc    Add source to notebook
 * @route   POST /api/notebook/notebooks/:id/sources
 * @access  Private
 */
exports.addSource = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  const { type, name, url, content } = req.body;
  const file = req.file;

  const source = {
    type,
    name: name || file?.originalname || 'Untitled Source',
    selected: true,
    dateAdded: new Date()
  };

  // Handle different source types
  if (type === 'pdf' || type === 'document') {
    if (!file) {
      throw new AppError('File is required for PDF/document sources', 400);
    }
    
    // Save file to local storage
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    await fs.writeFile(filePath, file.buffer);
    
    source.filePath = filePath;
    source.size = file.size;
  } else if (type === 'website') {
    if (!url) {
      throw new AppError('URL is required for website sources', 400);
    }
    source.url = url;
  } else if (type === 'text' || type === 'notes') {
    if (!content) {
      throw new AppError('Content is required for text/notes sources', 400);
    }
    source.content = content;
    source.size = content.length;
  } else {
    throw new AppError('Invalid source type', 400);
  }

  notebook.sources.push(source);
  await notebook.save();

  // Return the newly added source
  const addedSource = notebook.sources[notebook.sources.length - 1];

  // Extract JWT token from request
  const authToken = req.headers.authorization?.split(' ')[1];

  // Ingest source into AI engine's RAG system (WAIT for completion)
  if (authToken && notebook.aiSessionId) {
    try {
      await ingestSourceToRAG(notebook, addedSource, authToken);
      console.log('✅ RAG ingestion completed before response');

      // Send notification about document processing completion
      try {
        const notification = await notificationService.notifyDocumentProcessed(
          notebook.userId,
          notebook,
          addedSource
        );

        const io = getIO();
        emitNotificationToUser(io, notebook.userId, notification);
      } catch (err) {
        console.error('Failed to send document notification:', err);
      }
    } catch (err) {
      console.error('❌ RAG ingestion failed:', err.message);
      // Continue anyway, return the source even if ingestion fails
    }
  }

  res.status(201).json({
    success: true,
    data: addedSource
  });
});

/**
 * @desc    Remove source from notebook
 * @route   DELETE /api/notebook/notebooks/:id/sources/:sourceId
 * @access  Private
 */
exports.removeSource = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  const source = notebook.sources.id(req.params.sourceId);
  
  if (!source) {
    throw new AppError('Source not found', 404);
  }

  // Delete file if exists
  if (source.filePath) {
    try {
      await fs.unlink(source.filePath);
      console.log(`✓ Deleted file: ${source.filePath}`);
    } catch (error) {
      console.error(`Failed to delete file: ${source.filePath}`, error.message);
    }
  }

  // Delete from FAISS index
  if (notebook.aiSessionId) {
    const token = req.headers.authorization;
    try {
      await axios.delete(
        `${AI_ENGINE_URL}/ai/documents/source/${source._id}`,
        { headers: { Authorization: token } }
      );
      console.log(`✓ Deleted FAISS documents for source: ${source._id}`);
    } catch (error) {
      console.error('Failed to delete source from FAISS:', error.message);
    }
  }

  source.deleteOne();
  await notebook.save();

  res.json({
    success: true,
    message: 'Source removed successfully'
  });
});

/**
 * @desc    Toggle source selection
 * @route   PATCH /api/notebook/notebooks/:id/sources/:sourceId
 * @access  Private
 */
exports.toggleSource = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  const source = notebook.sources.id(req.params.sourceId);
  
  if (!source) {
    throw new AppError('Source not found', 404);
  }

  source.selected = !source.selected;
  await notebook.save();

  res.json({
    success: true,
    data: source
  });
});

/**
 * @desc    Get source content (for chat context)
 * @route   GET /api/notebook/notebooks/:id/sources/:sourceId/content
 * @access  Private
 */
exports.getSourceContent = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  const source = notebook.sources.id(req.params.sourceId);
  
  if (!source) {
    throw new AppError('Source not found', 404);
  }

  let content = '';

  if (source.filePath) {
    // Read file content
    content = await fs.readFile(source.filePath, 'utf-8');
  } else if (source.content) {
    content = source.content;
  } else if (source.url) {
    content = `Website: ${source.url}`;
  }

  res.json({
    success: true,
    data: {
      id: source._id,
      name: source.name,
      type: source.type,
      content
    }
  });
});

/**
 * @desc    Link artifact to notebook
 * @route   POST /api/notebook/notebooks/:id/artifacts
 * @access  Private
 */
exports.linkArtifact = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  const { type, referenceId, title } = req.body;

  // Validate artifact exists
  if (type === 'quiz') {
    // Quiz model stores owner in `createdBy`
    const quiz = await Quiz.findOne({ _id: referenceId, createdBy: req.user._id });
    if (!quiz) throw new AppError('Quiz not found', 404);
  } else if (type === 'mindmap') {
    // MindMap model stores owner in `createdBy`
    const mindmap = await MindMap.findOne({ _id: referenceId, createdBy: req.user._id });
    if (!mindmap) throw new AppError('Mind map not found', 404);
  }

  // Check if already linked
  const existing = notebook.artifacts.find(
    a => a.type === type && a.referenceId.toString() === referenceId
  );

  if (existing) {
    return res.json({
      success: true,
      message: 'Artifact already linked',
      data: existing
    });
  }

  notebook.artifacts.push({
    type,
    referenceId,
    title: title || `${type.charAt(0).toUpperCase() + type.slice(1)}`
  });

  await notebook.save();

  const addedArtifact = notebook.artifacts[notebook.artifacts.length - 1];

  res.status(201).json({
    success: true,
    data: addedArtifact
  });
});

/**
 * @desc    Unlink artifact from notebook
 * @route   DELETE /api/notebook/notebooks/:id/artifacts/:artifactId
 * @access  Private
 */
exports.unlinkArtifact = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  const artifact = notebook.artifacts.id(req.params.artifactId);
  
  if (!artifact) {
    throw new AppError('Artifact not found', 404);
  }

  artifact.deleteOne();
  await notebook.save();

  res.json({
    success: true,
    message: 'Artifact unlinked successfully'
  });
});

/**
 * @desc    Get selected sources content for chat context
 * @route   GET /api/notebook/notebooks/:id/context
 * @access  Private
 */
exports.getNotebookContext = asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!notebook) {
    throw new AppError('Notebook not found', 404);
  }

  const selectedSources = notebook.sources.filter(s => s.selected);
  const context = [];

  for (const source of selectedSources) {
    let content = '';

    if (source.filePath) {
      try {
        content = await fs.readFile(source.filePath, 'utf-8');
      } catch (error) {
        content = `[Error reading file: ${source.name}]`;
      }
    } else if (source.content) {
      content = source.content;
    } else if (source.url) {
      content = `Website: ${source.url}`;
    }

    context.push({
      id: source._id,
      name: source.name,
      type: source.type,
      content: content.substring(0, 10000) // Limit to prevent huge payloads
    });
  }

  res.json({
    success: true,
    data: {
      notebookId: notebook._id,
      aiSessionId: notebook.aiSessionId,
      sources: context
    }
  });
});

module.exports = exports;
