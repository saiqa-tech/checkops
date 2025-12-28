# Form Creation Guide

Learn how to create dynamic forms with CheckOps, including all supported question types and advanced configuration options.

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

```javascript
const basicForm = await checkops.createForm({
  title: 'Contact Form',
  description: 'Get in touch with us',
  questions: [
    {
      questionText: 'Full Name',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'Email Address',
      questionType: 'email',
      required: true,
    },
    {
      questionText: 'Message',
      questionType: 'textarea',
      required: true,
    },
  ],
});
```

## Advanced Form with Options

```javascript
const advancedForm = await checkops.createForm({
  title: 'Product Feedback Survey',
  description: 'Help us improve our products',
  questions: [
    {
      questionText: 'Which product did you purchase?',
      questionType: 'select',
      options: [
        { key: 'prod_laptop', label: 'Laptop' },
        { key: 'prod_phone', label: 'Smartphone' },
        { key: 'prod_tablet', label: 'Tablet' },
      ],
      required: true,
    },
    {
      questionText: 'Rate your satisfaction',
      questionType: 'rating',
      options: [1, 2, 3, 4, 5],
      required: true,
    },
    {
      questionText: 'Which features do you use most?',
      questionType: 'multiselect',
      options: [
        'Performance',
        'Battery Life',
        'Camera',
        'Display',
        'Storage',
      ],
      required: false,
    },
    {
      questionText: 'Would you recommend this product?',
      questionType: 'boolean',
      required: true,
    },
  ],
  metadata: {
    category: 'product-feedback',
    version: '1.0',
  },
});
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

### Updating Option Labels
```javascript
// Update label without breaking existing data
await checkops.updateOptionLabel(
  questionId,
  'dept_eng',
  'Engineering & Technology',
  'admin@example.com' // Changed by (optional)
);

// Track label change history
const history = await checkops.getOptionHistory(questionId, 'dept_eng');
```

## Validation Rules

Add validation rules to questions for data integrity:

```javascript
{
  questionText: 'Age',
  questionType: 'number',
  required: true,
  validationRules: {
    min: 18,
    max: 120,
    message: 'Age must be between 18 and 120'
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

### Form Status Management
```javascript
// Deactivate form (stops accepting submissions)
await checkops.deactivateForm(formId);

// Reactivate form
await checkops.activateForm(formId);

// Delete form (permanent)
await checkops.deleteForm(formId);
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

## Common Patterns

### Registration Form
```javascript
const registrationForm = await checkops.createForm({
  title: 'User Registration',
  questions: [
    { questionText: 'First Name', questionType: 'text', required: true },
    { questionText: 'Last Name', questionType: 'text', required: true },
    { questionText: 'Email', questionType: 'email', required: true },
    { questionText: 'Phone', questionType: 'phone', required: false },
    { questionText: 'Date of Birth', questionType: 'date', required: true },
    { 
      questionText: 'How did you hear about us?',
      questionType: 'select',
      options: ['Search Engine', 'Social Media', 'Friend', 'Advertisement'],
      required: false
    },
  ],
});
```

### Event Feedback Form
```javascript
const eventForm = await checkops.createForm({
  title: 'Event Feedback',
  questions: [
    { questionText: 'Event Rating', questionType: 'rating', options: [1,2,3,4,5], required: true },
    { questionText: 'Favorite Sessions', questionType: 'multiselect', options: sessions, required: false },
    { questionText: 'Additional Comments', questionType: 'textarea', required: false },
    { questionText: 'Would you attend again?', questionType: 'boolean', required: true },
  ],
});
```