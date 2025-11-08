# CheckOps Examples

Real-world examples of using CheckOps in your applications.

## Table of Contents

1. [Express.js Integration](#expressjs-integration)
2. [Multi-Step Forms](#multi-step-forms)
3. [Survey Application](#survey-application)
4. [Job Application Form](#job-application-form)
5. [Customer Feedback System](#customer-feedback-system)

## Express.js Integration

### Basic Setup

```javascript
import express from 'express';
import CheckOps, { errors } from '@saiqa-tech/checkops';

const app = express();
app.use(express.json());

const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Initialize on startup
await checkops.initialize();

// GET: List all forms
app.get('/api/forms', async (req, res) => {
  try {
    const { isActive, limit, offset } = req.query;

    const forms = await checkops.getAllForms({
      isActive: isActive === 'true',
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    });

    res.json({ forms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Get specific form
app.get('/api/forms/:id', async (req, res) => {
  try {
    const form = await checkops.getForm(req.params.id);
    res.json({ form });
  } catch (error) {
    if (error instanceof errors.NotFoundError) {
      res.status(404).json({ error: 'Form not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// POST: Create form
app.post('/api/forms', async (req, res) => {
  try {
    const { title, description, questions } = req.body;

    const form = await checkops.createForm({
      title,
      description,
      questions,
    });

    res.status(201).json({ form });
  } catch (error) {
    if (error instanceof errors.ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// POST: Submit form
app.post('/api/forms/:id/submit', async (req, res) => {
  try {
    const { submissionData } = req.body;

    const submission = await checkops.createSubmission({
      formId: req.params.id,
      submissionData,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        submittedAt: new Date().toISOString(),
      },
    });

    res.status(201).json({ submission });
  } catch (error) {
    if (error instanceof errors.ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    } else if (error instanceof errors.NotFoundError) {
      res.status(404).json({ error: 'Form not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// GET: Get form submissions
app.get('/api/forms/:id/submissions', async (req, res) => {
  try {
    const { limit, offset } = req.query;

    const submissions = await checkops.getSubmissionsByForm(req.params.id, {
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    });

    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Get form statistics
app.get('/api/forms/:id/stats', async (req, res) => {
  try {
    const stats = await checkops.getSubmissionStats(req.params.id);
    res.json({ stats });
  } catch (error) {
    if (error instanceof errors.NotFoundError) {
      res.status(404).json({ error: 'Form not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await checkops.close();
  process.exit(0);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Multi-Step Forms

### Registration Wizard

```javascript
// Step 1: Personal Information
const step1Form = await checkops.createForm({
  title: 'Registration - Personal Info',
  questions: [
    {
      questionText: 'First Name',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'Last Name',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'Date of Birth',
      questionType: 'date',
      required: true,
    },
  ],
  metadata: { step: 1, totalSteps: 3 },
});

// Step 2: Contact Information
const step2Form = await checkops.createForm({
  title: 'Registration - Contact Info',
  questions: [
    {
      questionText: 'Email',
      questionType: 'email',
      required: true,
    },
    {
      questionText: 'Phone',
      questionType: 'phone',
      required: true,
    },
    {
      questionText: 'Address',
      questionType: 'textarea',
      required: false,
    },
  ],
  metadata: { step: 2, totalSteps: 3 },
});

// Step 3: Preferences
const step3Form = await checkops.createForm({
  title: 'Registration - Preferences',
  questions: [
    {
      questionText: 'Interests',
      questionType: 'multiselect',
      options: ['Sports', 'Music', 'Reading', 'Travel', 'Technology'],
      required: false,
    },
    {
      questionText: 'Newsletter',
      questionType: 'boolean',
      required: false,
    },
  ],
  metadata: { step: 3, totalSteps: 3 },
});

// API endpoint for multi-step submission
app.post('/api/registration/:step', async (req, res) => {
  const step = parseInt(req.params.step);
  const { sessionId, data } = req.body;

  let formId;
  if (step === 1) formId = step1Form.id;
  else if (step === 2) formId = step2Form.id;
  else if (step === 3) formId = step3Form.id;
  else return res.status(400).json({ error: 'Invalid step' });

  try {
    const submission = await checkops.createSubmission({
      formId,
      submissionData: data,
      metadata: {
        sessionId,
        step,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      submissionId: submission.id,
      nextStep: step < 3 ? step + 1 : null,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Survey Application

### Customer Satisfaction Survey

```javascript
async function createSatisfactionSurvey() {
  const form = await checkops.createForm({
    title: 'Customer Satisfaction Survey',
    description: 'Help us improve our service',
    questions: [
      {
        questionText: 'How satisfied are you with our product?',
        questionType: 'rating',
        options: [1, 2, 3, 4, 5],
        required: true,
        metadata: { label: 'satisfaction' },
      },
      {
        questionText: 'How likely are you to recommend us?',
        questionType: 'rating',
        options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        required: true,
        metadata: { label: 'nps', description: 'Net Promoter Score' },
      },
      {
        questionText: 'What do you like most about our product?',
        questionType: 'textarea',
        required: false,
      },
      {
        questionText: 'What could we improve?',
        questionType: 'textarea',
        required: false,
      },
      {
        questionText: 'Which features do you use most?',
        questionType: 'checkbox',
        options: [
          'Dashboard',
          'Reports',
          'Analytics',
          'Integrations',
          'Mobile App',
        ],
        required: false,
      },
    ],
  });

  return form;
}

// Calculate NPS Score
async function calculateNPS(formId) {
  const stats = await checkops.getSubmissionStats(formId);

  const npsQuestion = Object.values(stats.questionStats).find(
    (q) => q.metadata?.label === 'nps'
  );

  if (!npsQuestion) return null;

  const scores = npsQuestion.answerFrequency;
  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  Object.entries(scores).forEach(([score, count]) => {
    const numScore = parseInt(score);
    if (numScore >= 9) promoters += count;
    else if (numScore >= 7) passives += count;
    else detractors += count;
  });

  const total = promoters + passives + detractors;
  const npsScore = ((promoters - detractors) / total) * 100;

  return {
    npsScore: Math.round(npsScore),
    promoters,
    passives,
    detractors,
    totalResponses: total,
  };
}
```

## Job Application Form

```javascript
async function createJobApplicationForm() {
  // Create reusable questions
  const nameQuestion = await checkops.createQuestion({
    questionText: 'Full Name',
    questionType: 'text',
    metadata: { category: 'personal' },
  });

  const emailQuestion = await checkops.createQuestion({
    questionText: 'Email Address',
    questionType: 'email',
    metadata: { category: 'contact' },
  });

  const phoneQuestion = await checkops.createQuestion({
    questionText: 'Phone Number',
    questionType: 'phone',
    metadata: { category: 'contact' },
  });

  // Create job application form
  const form = await checkops.createForm({
    title: 'Software Engineer - Job Application',
    description: 'Join our amazing team!',
    questions: [
      {
        questionId: nameQuestion.id,
        required: true,
      },
      {
        questionId: emailQuestion.id,
        required: true,
      },
      {
        questionId: phoneQuestion.id,
        required: true,
      },
      {
        questionText: 'Years of Experience',
        questionType: 'number',
        required: true,
        validationRules: {
          min: 0,
          max: 50,
        },
      },
      {
        questionText: 'Current Job Title',
        questionType: 'text',
        required: true,
      },
      {
        questionText: 'Programming Languages',
        questionType: 'checkbox',
        options: [
          'JavaScript',
          'Python',
          'Java',
          'C++',
          'Go',
          'Rust',
          'Other',
        ],
        required: true,
      },
      {
        questionText: 'LinkedIn Profile',
        questionType: 'text',
        required: false,
      },
      {
        questionText: 'GitHub Profile',
        questionType: 'text',
        required: false,
      },
      {
        questionText: 'Cover Letter',
        questionType: 'textarea',
        required: true,
        validationRules: {
          minLength: 100,
          maxLength: 5000,
        },
      },
      {
        questionText: 'Earliest Start Date',
        questionType: 'date',
        required: true,
      },
      {
        questionText: 'Expected Salary (USD)',
        questionType: 'number',
        required: false,
      },
    ],
    metadata: {
      jobId: 'JOB-2024-001',
      department: 'Engineering',
      location: 'Remote',
    },
  });

  return form;
}

// API endpoint for job application
app.post('/api/jobs/:jobId/apply', async (req, res) => {
  try {
    const { formId } = req.body;

    const submission = await checkops.createSubmission({
      formId,
      submissionData: req.body.data,
      metadata: {
        applicantIp: req.ip,
        appliedAt: new Date().toISOString(),
        jobId: req.params.jobId,
        source: req.query.source || 'direct',
      },
    });

    // Send confirmation email (pseudo-code)
    await sendEmail({
      to: req.body.data['Email Address'],
      subject: 'Application Received',
      body: `Thank you for applying! Your application ID is ${submission.id}`,
    });

    res.status(201).json({
      success: true,
      applicationId: submission.id,
      message: 'Application submitted successfully',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Customer Feedback System

```javascript
async function createFeedbackSystem() {
  // Create product feedback form
  const productFeedback = await checkops.createForm({
    title: 'Product Feedback',
    questions: [
      {
        questionText: 'Product Name',
        questionType: 'select',
        options: ['Product A', 'Product B', 'Product C'],
        required: true,
      },
      {
        questionText: 'Overall Rating',
        questionType: 'rating',
        options: [1, 2, 3, 4, 5],
        required: true,
      },
      {
        questionText: 'Ease of Use',
        questionType: 'rating',
        options: [1, 2, 3, 4, 5],
        required: true,
      },
      {
        questionText: 'Value for Money',
        questionType: 'rating',
        options: [1, 2, 3, 4, 5],
        required: true,
      },
      {
        questionText: 'What did you like?',
        questionType: 'textarea',
        required: false,
      },
      {
        questionText: 'What needs improvement?',
        questionType: 'textarea',
        required: false,
      },
    ],
  });

  return productFeedback;
}

// Generate feedback report
async function generateFeedbackReport(formId) {
  const stats = await checkops.getSubmissionStats(formId);

  const report = {
    totalResponses: stats.totalSubmissions,
    averageRatings: {},
    topComments: {
      positive: [],
      negative: [],
    },
  };

  // Calculate average ratings
  Object.entries(stats.questionStats).forEach(([questionId, qStats]) => {
    if (qStats.questionType === 'rating') {
      let totalScore = 0;
      let totalCount = 0;

      Object.entries(qStats.answerFrequency).forEach(([score, count]) => {
        totalScore += parseInt(score) * count;
        totalCount += count;
      });

      report.averageRatings[qStats.questionText] = (totalScore / totalCount).toFixed(2);
    }
  });

  return report;
}

// API endpoint for feedback dashboard
app.get('/api/feedback/dashboard', async (req, res) => {
  try {
    const forms = await checkops.getAllForms({
      isActive: true,
    });

    const dashboardData = await Promise.all(
      forms.map(async (form) => {
        const count = await checkops.getSubmissionCount({ formId: form.id });
        const report = await generateFeedbackReport(form.id);

        return {
          formId: form.id,
          formTitle: form.title,
          totalResponses: count,
          averageRatings: report.averageRatings,
        };
      })
    );

    res.json({ dashboardData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Advanced: Form Builder UI

```javascript
// API for dynamic form builder
app.get('/api/question-bank', async (req, res) => {
  try {
    const questions = await checkops.getAllQuestions({
      isActive: true,
      limit: 1000,
    });

    // Group by category
    const grouped = questions.reduce((acc, q) => {
      const category = q.metadata?.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(q);
      return acc;
    }, {});

    res.json({ questions: grouped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save form builder configuration
app.post('/api/form-builder/save', async (req, res) => {
  try {
    const { title, description, selectedQuestions } = req.body;

    const questions = selectedQuestions.map((sq) => ({
      questionId: sq.id,
      required: sq.required || false,
      metadata: sq.metadata || {},
    }));

    const form = await checkops.createForm({
      title,
      description,
      questions,
    });

    res.status(201).json({ form });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```
