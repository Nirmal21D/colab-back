const axios = require('axios');

const AI_ENGINE_BASE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

class AIService {
  constructor() {
    this.client = axios.create({
      baseURL: AI_ENGINE_BASE_URL,
      timeout: 60000, // 60 seconds for AI operations
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Forward request to AI engine with user's JWT token
   */
  async forwardToAI(endpoint, data, userToken) {
    try {
      const response = await this.client.post(endpoint, data, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('AI Engine Error:', error.message);
      throw new Error(
        error.response?.data?.error || 'AI Engine request failed'
      );
    }
  }

  /**
   * Chat with AI
   */
  async chat(message, userId, conversationId, userToken) {
    return this.forwardToAI(
      '/api/chat',
      {
        message,
        user_id: userId,
        conversation_id: conversationId,
      },
      userToken
    );
  }

  /**
   * Streaming chat with AI
   */
  async chatStream(message, userId, conversationId, userToken) {
    return this.forwardToAI(
      '/api/chat/stream',
      {
        message,
        user_id: userId,
        conversation_id: conversationId,
      },
      userToken
    );
  }

  /**
   * Summarize text
   */
  async summarize(text, userId, userToken) {
    return this.forwardToAI(
      '/api/summarize',
      {
        text,
        user_id: userId,
      },
      userToken
    );
  }

  /**
   * Generate Q&A from text
   */
  async generateQA(text, userId, userToken) {
    return this.forwardToAI(
      '/api/qa/generate',
      {
        text,
        user_id: userId,
      },
      userToken
    );
  }

  /**
   * Generate quizzes from text using AI engine with optional RAG
   */
  async generateQuiz(content, options = {}, userToken) {
    try {
      console.log('Calling AI engine /ai/qa/generate with:', {
        textLength: content.length,
        count: options.count,
        difficulty: options.difficulty,
        useRag: options.useRag
      });

      const response = await this.client.post('/ai/qa/generate', {
        text: content,
        num_questions: options.count || 10,
        difficulty: options.difficulty || 'medium',
        include_options: true, // Always generate multiple choice
        use_rag: options.useRag !== undefined ? options.useRag : false, // Disable RAG by default for now
        topic: options.topic || null // Optional topic for RAG filtering
      }, {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      });
      
      console.log('AI engine response:', {
        status: response.status,
        hasData: !!response.data,
        questionsCount: response.data?.questions?.length || 0
      });

      // Transform AI engine response to quiz format
      const questions = response.data.questions || [];
      
      if (questions.length === 0) {
        console.error('No questions returned from AI engine. Response:', response.data);
        throw new Error('AI engine returned no questions');
      }

      console.log('Sample question from AI engine:', JSON.stringify(questions[0], null, 2));

      return questions.map((q, idx) => {
        // Clean options - remove empty strings and trim
        let validOptions = (q.options || [])
          .map(opt => typeof opt === 'string' ? opt.trim() : String(opt).trim())
          .filter(opt => opt && opt !== '');
        
        // Get answer, default to first option if empty
        let answer = q.answer && q.answer.trim() ? q.answer.trim() : '';
        
        // If answer is empty but we have options, use first option
        if (!answer && validOptions.length > 0) {
          answer = validOptions[0];
          console.warn(`Question ${idx + 1}: Empty answer, using first option: "${answer}"`);
        }
        
        // If still no valid options, create defaults
        if (validOptions.length === 0) {
          validOptions = [answer || 'Option 1', 'Option 2', 'Option 3', 'Option 4'];
          console.warn(`Question ${idx + 1}: No valid options, created defaults`);
        }
        
        // Ensure answer is in options
        if (!validOptions.includes(answer) && answer) {
          validOptions[0] = answer;
        }
        
        // Ensure we have at least the answer
        if (!answer) {
          answer = validOptions[0] || 'No answer provided';
          console.error(`Question ${idx + 1}: Still no answer after processing, using: "${answer}"`);
        }
        
        const transformed = {
          question: q.question || 'Question not provided',
          options: validOptions,
          correctAnswer: answer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || options.difficulty || 'medium',
          points: 10
        };
        
        if (idx === 0) {
          console.log('Transformed first question:', JSON.stringify(transformed, null, 2));
        }
        
        return transformed;
      });
    } catch (error) {
      console.error('AI generateQuiz error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to generate quiz from AI engine');
    }
  }

  /**
   * Generate quiz from uploaded file using AI engine
   */
  async generateQuizFromFile(file, options = {}, userToken) {
    try {
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Append file buffer
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
      
      // Append other form fields
      formData.append('num_questions', options.count || 5);
      formData.append('difficulty', options.difficulty || 'medium');
      formData.append('include_options', 'true');
      
      console.log('Calling AI engine /ai/qa/generate/file with:', {
        fileName: file.originalname,
        fileSize: file.size,
        count: options.count,
        difficulty: options.difficulty
      });

      const response = await this.client.post('/ai/qa/generate/file', formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${userToken}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      
      console.log('AI engine file response:', {
        status: response.status,
        hasData: !!response.data,
        questionsCount: response.data?.questions?.length || 0
      });

      // Transform AI engine response to quiz format
      const questions = response.data.questions || [];
      
      if (questions.length === 0) {
        console.error('No questions returned from AI engine. Response:', response.data);
        throw new Error('AI engine returned no questions');
      }

      console.log('Sample question from AI engine (file):', JSON.stringify(questions[0], null, 2));

      return questions.map((q, idx) => {
        // Clean options - remove empty strings and trim
        let validOptions = (q.options || [])
          .map(opt => typeof opt === 'string' ? opt.trim() : String(opt).trim())
          .filter(opt => opt && opt !== '');
        
        // Get answer, default to first option if empty
        let answer = q.answer && q.answer.trim() ? q.answer.trim() : '';
        
        // If answer is empty but we have options, use first option
        if (!answer && validOptions.length > 0) {
          answer = validOptions[0];
          console.warn(`Question ${idx + 1}: Empty answer, using first option: "${answer}"`);
        }
        
        // If still no valid options, create defaults
        if (validOptions.length === 0) {
          validOptions = [answer || 'Option 1', 'Option 2', 'Option 3', 'Option 4'];
          console.warn(`Question ${idx + 1}: No valid options, created defaults`);
        }
        
        // Ensure answer is in options
        if (!validOptions.includes(answer) && answer) {
          validOptions[0] = answer;
        }
        
        // Ensure we have at least the answer
        if (!answer) {
          answer = validOptions[0] || 'No answer provided';
          console.error(`Question ${idx + 1}: Still no answer after processing, using: "${answer}"`);
        }
        
        const transformed = {
          question: q.question || 'Question not provided',
          options: validOptions,
          correctAnswer: answer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || options.difficulty || 'medium',
          points: 10
        };
        
        if (idx === 0) {
          console.log('Transformed first question (file):', JSON.stringify(transformed, null, 2));
        }
        
        return transformed;
      });
    } catch (error) {
      console.error('AI generateQuizFromFile error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to generate quiz from file');
    }
  }

  /**
   * Generate mind map from topic using AI engine
   */
  async generateMindMap(topic, options = {}, userToken) {
    try {
      // For now, return a simple structure
      // TODO: Call ai-engine when mind map generation endpoint is ready
      const mapTopic = topic || 'Concept';
      return {
        nodes: [
          {
            id: 'root',
            label: mapTopic,
            type: 'root',
            position: { x: 0, y: 0 }
          },
          {
            id: 'node1',
            label: 'Branch 1',
            type: 'branch',
            position: { x: -200, y: 100 }
          },
          {
            id: 'node2',
            label: 'Branch 2',
            type: 'branch',
            position: { x: 200, y: 100 }
          }
        ],
        edges: [
          { id: 'edge1', from: 'root', to: 'node1' },
          { id: 'edge2', from: 'root', to: 'node2' }
        ]
      };
    } catch (error) {
      console.error('AI generateMindMap error:', error.message);
      throw new Error('Failed to generate mind map from AI engine');
    }
  }

  /**
   * Ingest document for RAG
   */
  async ingestDocument(content, metadata, userId, userToken) {
    return this.forwardToAI(
      '/api/ingest',
      {
        content,
        metadata,
        user_id: userId,
      },
      userToken
    );
  }

  /**
   * Health check for AI engine
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      return {
        status: 'error',
        message: 'AI Engine is not available',
      };
    }
  }
}

module.exports = new AIService();
