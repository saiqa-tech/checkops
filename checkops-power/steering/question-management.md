# Question Management Guide

Learn how to create, manage, and reuse questions across multiple forms with CheckOps' centralized question bank.

## Question Bank Concept

CheckOps provides a centralized question bank that allows you to:
- Create reusable questions once, use them in multiple forms
- Maintain consistency across different forms
- Update question options globally
- Track option label changes over time

## Creating Reusable Questions

### Basic Question Creation

```javascript
const nameQuestion = await checkops.createQuestion({
  questionText: 'What is your full name?',
  questionType: 'text',
  metadata: {
    category: 'personal-info',
    reusable: true,
  },
});

const emailQuestion = await checkops.createQuestion({
  questionText: 'Email Address',
  questionType: 'email',
  validationRules: {
    required: true,
    format: 'email',
  },
});
```

### Questions with Options

```javascript
const priorityQuestion = await checkops.createQuestion({
  questionText: 'Priority Level',
  questionType: 'select',
  options: [
    { key: 'priority_high', label: 'High Priority' },
    { key: 'priority_medium', label: 'Medium Priority' },
    { key: 'priority_low', label: 'Low Priority' },
  ],
  metadata: {
    category: 'workflow',
    description: 'Standard priority levels for task management',
  },
});

const departmentQuestion = await checkops.createQuestion({
  questionText: 'Department',
  questionType: 'select',
  options: [
    { key: 'dept_engineering', label: 'Engineering' },
    { key: 'dept_sales', label: 'Sales' },
    { key: 'dept_marketing', label: 'Marketing' },
    { key: 'dept_hr', label: 'Human Resources' },
  ],
});
```

## Using Questions in Forms

### Reference Existing Questions

```javascript
// Get questions from the bank
const existingQuestions = await checkops.getQuestions([
  nameQuestion.id,
  emailQuestion.id,
  priorityQuestion.id,
]);

// Create form using existing questions
const form = await checkops.createForm({
  title: 'Support Ticket Form',
  description: 'Submit a support request',
  questions: existingQuestions.map(q => ({
    questionId: q.id, // Reference existing question
    required: true,
  })),
});
```

### Mix New and Existing Questions

```javascript
const mixedForm = await checkops.createForm({
  title: 'Employee Onboarding',
  questions: [
    // Use existing questions
    { questionId: nameQuestion.id, required: true },
    { questionId: emailQuestion.id, required: true },
    { questionId: departmentQuestion.id, required: true },
    
    // Add form-specific questions
    {
      questionText: 'Start Date',
      questionType: 'date',
      required: true,
    },
    {
      questionText: 'Emergency Contact',
      questionType: 'text',
      required: true,
    },
  ],
});
```

## Question Management Operations

### Retrieving Questions

```javascript
// Get specific question
const question = await checkops.getQuestion(questionId);

// Get multiple questions
const questions = await checkops.getQuestions([id1, id2, id3]);

// Get all questions with filtering
const allQuestions = await checkops.getAllQuestions({
  limit: 50,
  offset: 0,
  questionType: 'select', // Filter by type
  includeInactive: false,
});

// Search questions by metadata
const categoryQuestions = await checkops.getAllQuestions({
  metadata: { category: 'personal-info' },
});
```

### Updating Questions

```javascript
// Update question text and metadata
const updatedQuestion = await checkops.updateQuestion(questionId, {
  questionText: 'What is your complete full name?',
  metadata: {
    category: 'personal-info',
    updated: new Date().toISOString(),
  },
});

// Note: Options should be updated using updateOptionLabel for data integrity
```

### Question Status Management

```javascript
// Deactivate question (prevents use in new forms)
await checkops.deactivateQuestion(questionId);

// Reactivate question
await checkops.activateQuestion(questionId);

// Delete question (permanent - use with caution)
await checkops.deleteQuestion(questionId);
```

## Option Label Management

### Updating Option Labels

```javascript
// Update a single option label
await checkops.updateOptionLabel(
  departmentQuestion.id,
  'dept_engineering',
  'Engineering & Technology',
  'admin@company.com' // Who made the change
);

// Update multiple labels
const updates = [
  { key: 'dept_hr', newLabel: 'People & Culture' },
  { key: 'dept_marketing', newLabel: 'Marketing & Communications' },
];

for (const update of updates) {
  await checkops.updateOptionLabel(
    departmentQuestion.id,
    update.key,
    update.newLabel,
    'admin@company.com'
  );
}
```

### Tracking Option History

```javascript
// Get history for specific option
const optionHistory = await checkops.getOptionHistory(
  departmentQuestion.id,
  'dept_engineering'
);

console.log('Label changes:', optionHistory);
// Output: Array of changes with timestamps and who made them

// Get all option history for a question
const allHistory = await checkops.getOptionHistory(departmentQuestion.id);
```

## Question Categories and Organization

### Organizing by Category

```javascript
// Personal Information Questions
const personalQuestions = [
  {
    questionText: 'First Name',
    questionType: 'text',
    metadata: { category: 'personal', subcategory: 'name' },
  },
  {
    questionText: 'Last Name',
    questionType: 'text',
    metadata: { category: 'personal', subcategory: 'name' },
  },
  {
    questionText: 'Date of Birth',
    questionType: 'date',
    metadata: { category: 'personal', subcategory: 'demographics' },
  },
];

// Contact Information Questions
const contactQuestions = [
  {
    questionText: 'Email Address',
    questionType: 'email',
    metadata: { category: 'contact', subcategory: 'digital' },
  },
  {
    questionText: 'Phone Number',
    questionType: 'phone',
    metadata: { category: 'contact', subcategory: 'digital' },
  },
];

// Create questions in batch
for (const question of [...personalQuestions, ...contactQuestions]) {
  await checkops.createQuestion(question);
}
```

### Retrieving by Category

```javascript
// Get questions by category
const personalQuestions = await checkops.getAllQuestions({
  metadata: { category: 'personal' },
});

const contactQuestions = await checkops.getAllQuestions({
  metadata: { category: 'contact' },
});
```

## Best Practices

### 1. Question Design
- Use clear, unambiguous question text
- Choose appropriate question types for the data you need
- Include helpful metadata for organization and searchability
- Design questions to be reusable across different contexts

### 2. Option Key Strategy
- Use descriptive, stable keys that won't need to change
- Follow a consistent naming convention (e.g., `category_value`)
- Document the meaning of option keys
- Plan for future expansion when designing key structures

### 3. Label Management
- Update labels through the proper API to maintain data integrity
- Always specify who made the change for audit purposes
- Review option history before making significant changes
- Communicate label changes to form users when necessary

### 4. Organization
- Use consistent metadata categories across questions
- Group related questions logically
- Maintain a question library documentation
- Regular cleanup of unused or outdated questions

## Common Question Templates

### Rating Questions
```javascript
const satisfactionRating = await checkops.createQuestion({
  questionText: 'How satisfied are you with our service?',
  questionType: 'rating',
  options: [1, 2, 3, 4, 5],
  metadata: {
    category: 'feedback',
    type: 'satisfaction',
    scale: '1-5',
  },
});
```

### Multi-Select Categories
```javascript
const interestsQuestion = await checkops.createQuestion({
  questionText: 'What are your areas of interest?',
  questionType: 'multiselect',
  options: [
    { key: 'tech_web', label: 'Web Development' },
    { key: 'tech_mobile', label: 'Mobile Development' },
    { key: 'tech_data', label: 'Data Science' },
    { key: 'tech_ai', label: 'Artificial Intelligence' },
    { key: 'tech_cloud', label: 'Cloud Computing' },
  ],
  metadata: {
    category: 'preferences',
    type: 'technology-interests',
  },
});
```

### Conditional Questions
```javascript
// Base question
const hasExperienceQuestion = await checkops.createQuestion({
  questionText: 'Do you have previous experience in this field?',
  questionType: 'boolean',
  metadata: { category: 'experience', conditional: 'base' },
});

// Follow-up question (handled in application logic)
const experienceYearsQuestion = await checkops.createQuestion({
  questionText: 'How many years of experience do you have?',
  questionType: 'select',
  options: [
    { key: 'exp_1', label: '1-2 years' },
    { key: 'exp_3', label: '3-5 years' },
    { key: 'exp_6', label: '6-10 years' },
    { key: 'exp_10plus', label: '10+ years' },
  ],
  metadata: { 
    category: 'experience', 
    conditional: 'follow-up',
    dependsOn: hasExperienceQuestion.id,
  },
});
```