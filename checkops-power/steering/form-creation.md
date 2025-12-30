# Form Creation Guide

This comprehensive guide covers everything you need to know about creating dynamic forms with CheckOps, from basic forms to complex multi-step workflows with Express.js integration.

## Form Structure

Every CheckOps form consists of:
- **title**: Form name (required)
- **description**: Form description (optional)
- **questions**: Array of question objects (required)
- **metadata**: Additional form data (optional)

## Supported Question Types

CheckOps supports a wide variety of question types for different use cases:

### Text Input Types
- `text` - Single-line text input
- `textarea` - Multi-line text input
- `email` - Email input with validation
- `phone` - Phone number input
- `number` - Numeric input

### Date and Time Types
- `date` - Date picker
- `time` - Time picker
- `datetime` - Date and time picker

### Selection Types
- `select` - Single-choice dropdown
- `multiselect` - Multiple-choice dropdown
- `radio` - Radio button group
- `checkbox` - Checkbox group
- `boolean` - Yes/No toggle

### Special Types
- `rating` - Star rating or numeric rating
- `file` - File upload (metadata only)

## Basic Form Creation

### Simple Contact Form

```javascript
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function createContactForm() {
  await checkops.initialize();

  const contactForm = {
    title: 'Contact Us',
    description: 'Get in touch with our team',
    questions: [
      {
        questionText: 'Full Name',
        questionType: 'text',
        required: true
      },
      {
        questionText: 'Email Address',
        questionType: 'email',
        required: true
      },
      {
        questionText: 'Phone Number',
        questionType: 'phone',
        required: false
      },
      {
        questionText: 'Subject',
        questionType: 'select',
        required: true,
        options: [
          'General Inquiry',
          'Support Request',
          'Sales Question',
          'Partnership',
          'Bug Report',
          'Feature Request'
        ]
      },
      {
        questionText: 'Message',
        questionType: 'textarea',
        required: true
      }
    ],
    metadata: {
      category: 'contact',
      department: 'customer-service',
      priority: 'normal'
    }
  };

  try {
    const form = await checkops.createForm(contactForm);
    console.log('Contact form created:', form.id);
    return form;
  } catch (error) {
    console.error('Error creating contact form:', error.message);
    throw error;
  } finally {
    await checkops.close();
  }
}
```

## Advanced Form Examples

### Customer Feedback Survey

```javascript
async function createFeedbackSurvey() {
  const surveyForm = {
    title: 'Customer Satisfaction Survey',
    description: 'Help us improve our services',
    questions: [
      {
        questionText: 'Your Name (Optional)',
        questionType: 'text',
        required: false
      },
      {
        questionText: 'Customer ID',
        questionType: 'text',
        required: false
      },
      {
        questionText: 'Overall Satisfaction',
        questionType: 'rating',
        required: true,
        options: ['1', '2', '3', '4', '5']
      },
      {
        questionText: 'Which aspects were most important?',
        questionType: 'multiselect',
        required: false,
        options: [
          'Product Quality',
          'Customer Service',
          'Pricing',
          'Delivery Speed',
          'User Experience',
          'Technical Support'
        ]
      },
      {
        questionText: 'How likely are you to recommend us?',
        questionType: 'rating',
        required: true,
        options: ['1', '2', '3', '4', '5']
      },
      {
        questionText: 'What could we improve?',
        questionType: 'textarea',
        required: false
      },
      {
        questionText: 'Would you purchase from us again?',
        questionType: 'boolean',
        required: true
      }
    ],
    metadata: {
      type: 'feedback',
      version: '2.0',
      department: 'customer-success'
    }
  };

  const form = await checkops.createForm(surveyForm);
  return form;
}
```

### Event Registration Form

```javascript
async function createEventRegistration() {
  const registrationForm = {
    title: 'Tech Conference 2024 Registration',
    description: 'Register for our annual technology conference',
    questions: [
      {
        questionText: 'Full Name',
        questionType: 'text',
        required: true
      },
      {
        questionText: 'Email Address',
        questionType: 'email',
        required: true
      },
      {
        questionText: 'Job Title',
        questionType: 'text',
        required: true
      },
      {
        questionText: 'Company',
        questionType: 'text',
        required: true
      },
      {
        questionText: 'Industry',
        questionType: 'select',
        required: true,
        options: [
          'Technology',
          'Healthcare',
          'Finance',
          'Education',
          'Government',
          'Non-profit',
          'Other'
        ]
      },
      {
        questionText: 'Experience Level',
        questionType: 'radio',
        required: true,
        options: [
          'Beginner (0-2 years)',
          'Intermediate (3-5 years)',
          'Advanced (6-10 years)',
          'Expert (10+ years)'
        ]
      },
      {
        questionText: 'Sessions of Interest',
        questionType: 'multiselect',
        required: false,
        options: [
          'AI & Machine Learning',
          'Cloud Computing',
          'Cybersecurity',
          'DevOps',
          'Mobile Development',
          'Web Development',
          'Data Science',
          'Blockchain'
        ]
      },
      {
        questionText: 'Dietary Restrictions',
        questionType: 'multiselect',
        required: false,
        options: [
          'Vegetarian',
          'Vegan',
          'Gluten-Free',
          'Dairy-Free',
          'Nut Allergy',
          'None'
        ]
      },
      {
        questionText: 'Special Accommodations Needed',
        questionType: 'textarea',
        required: false
      },
      {
        questionText: 'How did you hear about this event?',
        questionType: 'select',
        required: false,
        options: [
          'Company Website',
          'Social Media',
          'Email Newsletter',
          'Colleague Referral',
          'Search Engine',
          'Advertisement',
          'Previous Event'
        ]
      }
    ],
    metadata: {
      event: 'tech-conference-2024',
      capacity: 500,
      earlyBird: true
    }
  };

  const form = await checkops.createForm(registrationForm);
  return form;
}
```

## Express.js Integration

### Basic Express Server with CheckOps

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize CheckOps
const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Initialize CheckOps on startup
let checkopsInitialized = false;
checkops.initialize().then(() => {
  checkopsInitialized = true;
  console.log('✅ CheckOps initialized');
}).catch(error => {
  console.error('❌ CheckOps initialization failed:', error);
});

// Routes
app.get('/api/health', async (req, res) => {
  try {
    if (!checkopsInitialized) {
      return res.status(503).json({ status: 'unhealthy', error: 'CheckOps not initialized' });
    }
    
    await checkops.getAllForms({ limit: 1 });
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Create form endpoint
app.post('/api/forms',
  [
    body('title').trim().isLength({ min: 1, max: 200 }).escape(),
    body('description').optional().trim().isLength({ max: 1000 }).escape(),
    body('questions').isArray({ min: 1 }),
    body('questions.*.questionText').trim().isLength({ min: 1, max: 500 }).escape(),
    body('questions.*.questionType').isIn([
      'text', 'textarea', 'email', 'phone', 'number',
      'date', 'time', 'datetime', 'select', 'multiselect',
      'radio', 'checkbox', 'boolean', 'rating', 'file'
    ]),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const form = await checkops.createForm(req.body);
      res.status(201).json({ success: true, data: form });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get form endpoint
app.get('/api/forms/:formId',
  param('formId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const form = await checkops.getForm(req.params.formId);
      res.json({ success: true, data: form });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ success: false, error: 'Form not found' });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  }
);

// Create submission endpoint
app.post('/api/forms/:formId/submissions',
  [
    param('formId').isUUID(),
    body('answers').isArray({ min: 1 }),
    body('answers.*.questionId').isUUID(),
    body('answers.*.value').notEmpty(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const submissionData = {
        ...req.body,
        formId: req.params.formId
      };
      
      const submission = await checkops.createSubmission(submissionData);
      res.status(201).json({ success: true, data: submission });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CheckOps server running on port ${PORT}`);
});
```

### Form Templates

Create reusable form templates:

```javascript
class FormTemplates {
  static contactForm() {
    return {
      title: 'Contact Us',
      description: 'Get in touch with our team',
      questions: [
        {
          questionText: 'Full Name',
          questionType: 'text',
          required: true
        },
        {
          questionText: 'Email Address',
          questionType: 'email',
          required: true
        },
        {
          questionText: 'Subject',
          questionType: 'select',
          required: true,
          options: [
            'General Inquiry',
            'Support Request',
            'Sales Question',
            'Partnership',
            'Other'
          ]
        },
        {
          questionText: 'Message',
          questionType: 'textarea',
          required: true
        }
      ]
    };
  }

  static feedbackSurvey() {
    return {
      title: 'Feedback Survey',
      description: 'Help us improve our services',
      questions: [
        {
          questionText: 'Name (Optional)',
          questionType: 'text',
          required: false
        },
        {
          questionText: 'Email (Optional)',
          questionType: 'email',
          required: false
        },
        {
          questionText: 'Overall Satisfaction',
          questionType: 'rating',
          required: true,
          options: ['1', '2', '3', '4', '5']
        },
        {
          questionText: 'Comments',
          questionType: 'textarea',
          required: false
        }
      ]
    };
  }

  static newsletterSignup() {
    return {
      title: 'Newsletter Signup',
      description: 'Stay updated with our latest news',
      questions: [
        {
          questionText: 'Email Address',
          questionType: 'email',
          required: true
        },
        {
          questionText: 'First Name',
          questionType: 'text',
          required: true
        },
        {
          questionText: 'Interests',
          questionType: 'multiselect',
          required: false,
          options: [
            'Technology News',
            'Product Updates',
            'Industry Insights',
            'Events & Webinars',
            'Special Offers'
          ]
        }
      ]
    };
  }
}

// Usage
const contactForm = await checkops.createForm(FormTemplates.contactForm());
```

## Option Key-Value System

CheckOps uses a stable option key-value system to prevent data corruption when option labels change:

### Simple Options (Auto-Generated Keys)
```javascript
{
  questionText: 'Select Priority',
  questionType: 'select',
  options: ['High', 'Medium', 'Low'] // Keys auto-generated
}
```

### Structured Options (Custom Keys)
```javascript
{
  questionText: 'Select Department',
  questionType: 'select',
  options: [
    { key: 'dept_eng', label: 'Engineering' },
    { key: 'dept_sales', label: 'Sales' },
    { key: 'dept_hr', label: 'Human Resources' }
  ]
}
```

## Form Validation and Best Practices

### Input Validation

```javascript
// Validate form data before creation
function validateFormData(formData) {
  const errors = [];
  
  if (!formData.title || formData.title.trim().length === 0) {
    errors.push('Form title is required');
  }
  
  if (formData.title && formData.title.length > 200) {
    errors.push('Form title must be less than 200 characters');
  }
  
  if (!Array.isArray(formData.questions) || formData.questions.length === 0) {
    errors.push('At least one question is required');
  }
  
  formData.questions?.forEach((question, index) => {
    if (!question.questionText || question.questionText.trim().length === 0) {
      errors.push(`Question ${index + 1}: Question text is required`);
    }
    
    if (!question.questionType) {
      errors.push(`Question ${index + 1}: Question type is required`);
    }
    
    const validTypes = [
      'text', 'textarea', 'email', 'phone', 'number',
      'date', 'time', 'datetime', 'select', 'multiselect',
      'radio', 'checkbox', 'boolean', 'rating', 'file'
    ];
    
    if (question.questionType && !validTypes.includes(question.questionType)) {
      errors.push(`Question ${index + 1}: Invalid question type '${question.questionType}'`);
    }
    
    if (['select', 'multiselect', 'radio', 'checkbox'].includes(question.questionType)) {
      if (!Array.isArray(question.options) || question.options.length === 0) {
        errors.push(`Question ${index + 1}: Options are required for ${question.questionType} questions`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Usage
const validation = validateFormData(formData);
if (!validation.valid) {
  console.error('Form validation failed:', validation.errors);
  return;
}
```

### Error Handling

```javascript
async function createFormWithErrorHandling(formData) {
  try {
    // Validate form data
    const validation = validateFormData(formData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Create form
    const form = await checkops.createForm(formData);
    console.log('Form created successfully:', form.id);
    return form;
    
  } catch (error) {
    console.error('Form creation failed:', error.message);
    
    // Handle specific error types
    if (error.message.includes('duplicate')) {
      console.log('A form with this title already exists');
    } else if (error.message.includes('connection')) {
      console.log('Database connection issue - please try again');
    } else if (error.message.includes('validation')) {
      console.log('Form data validation failed - please check your input');
    }
    
    throw error;
  }
}
```

## Form Management

### Retrieving Forms
```javascript
// Get specific form
const form = await checkops.getForm(formId);

// Get all forms with pagination
const forms = await checkops.getAllForms({
  limit: 10,
  offset: 0,
  includeInactive: false
});

// Get form count
const count = await checkops.getFormCount();
```

### Updating Forms
```javascript
const updatedForm = await checkops.updateForm(formId, {
  title: 'Updated Form Title',
  description: 'New description',
  // Note: questions cannot be updated directly
});
```

## Performance Considerations

### Batch Form Creation

```javascript
async function createMultipleForms(formsData) {
  const results = [];
  
  for (const formData of formsData) {
    try {
      const form = await checkops.createForm(formData);
      results.push({ success: true, form });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }
  
  return results;
}
```

### Form Caching

```javascript
class FormCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }
  
  set(formId, form) {
    this.cache.set(formId, {
      form,
      timestamp: Date.now()
    });
  }
  
  get(formId) {
    const cached = this.cache.get(formId);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(formId);
      return null;
    }
    
    return cached.form;
  }
  
  clear() {
    this.cache.clear();
  }
}

const formCache = new FormCache();

async function getCachedForm(formId) {
  let form = formCache.get(formId);
  
  if (!form) {
    form = await checkops.getForm(formId);
    formCache.set(formId, form);
  }
  
  return form;
}
```

## Best Practices

### 1. Question Design
- Use clear, concise question text
- Provide helpful descriptions for complex questions
- Choose appropriate question types for data collection needs
- Use structured options with custom keys for important selections

### 2. Form Structure
- Group related questions logically
- Use required fields judiciously
- Provide clear form titles and descriptions
- Include metadata for categorization and versioning

### 3. Option Management
- Use meaningful option keys that won't change
- Plan for future label updates
- Document option key meanings
- Track changes with the changedBy parameter

### 4. Performance
- Limit the number of questions per form for better UX
- Use pagination when displaying multiple forms
- Consider form complexity for mobile users
- Implement caching for frequently accessed forms

## Next Steps

- Learn about [Question Management](./question-management.md) for reusable questions
- Explore [Error Handling](./error-handling.md) best practices
- Review [Production Deployment](./production-deployment.md) for scaling
- Check out advanced submission handling patterns