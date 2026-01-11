const express = require('express');
const router = express.Router();
const multer = require('multer');
const notebookController = require('../controllers/notebook.controller');
const { protect } = require('../middlewares/auth.middleware');

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ============================================================================
// NOTEBOOK MANAGEMENT
// ============================================================================

router.get('/notebooks', protect, notebookController.getNotebooks);
router.post('/notebooks', protect, notebookController.createNotebook);
router.get('/notebooks/:id', protect, notebookController.getNotebook);
router.put('/notebooks/:id', protect, notebookController.updateNotebook);
router.delete('/notebooks/:id', protect, notebookController.deleteNotebook);

// ============================================================================
// SOURCE MANAGEMENT
// ============================================================================

router.post('/notebooks/:id/sources', protect, upload.single('file'), notebookController.addSource);
router.delete('/notebooks/:id/sources/:sourceId', protect, notebookController.removeSource);
router.patch('/notebooks/:id/sources/:sourceId', protect, notebookController.toggleSource);
router.get('/notebooks/:id/sources/:sourceId/content', protect, notebookController.getSourceContent);

// ============================================================================
// ARTIFACT LINKING
// ============================================================================

router.post('/notebooks/:id/artifacts', protect, notebookController.linkArtifact);
router.delete('/notebooks/:id/artifacts/:artifactId', protect, notebookController.unlinkArtifact);

// ============================================================================
// CONTEXT RETRIEVAL (for AI chat)
// ============================================================================

router.get('/notebooks/:id/context', protect, notebookController.getNotebookContext);

module.exports = router;
