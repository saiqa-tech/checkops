# Getting Started with CheckOps

This comprehensive guide walks you through setting up CheckOps in your Node.js project from scratch, including database setup, configuration, and your first working examples.

## Prerequisites

Before you begin, ensure you have:
- Node.js 24+ installed
- PostgreSQL 18+ running and accessible
- npm or yarn package manager
- Basic knowledge of JavaScript/Node.js
- Database credentials ready

## Step 1: Project Setup

Create a new Node.js project or navigate to your existing project:

```bash
mkdir my-checkops-project
cd my-checkops-project
npm init -y
```

## Step 2: Install Dependencies

Install CheckOps and required dependencies:

```bash
# Core dependencies
npm install @saiqa-tech/checkops pg dotenv

# For Express.js integration (optional)
npm install express cors helmet express-rate-limit express-validator
```

## Step 3: Environment Configuration

Create a `.env` file in your project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=checkops_db
DB_USER=checkops_user
DB_PASSWORD=your_secure_password

# Optional Configuration
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Application Settings
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Security (change in production)
JWT_SECRET=your-jwt-secret-change-in-production
ENCRYPTION_KEY=your-encryption-key-change-in-production
CORS_ORIGIN=*
```

## Step 4: Database Setup

### Option A: Using existing database

If you have an existing PostgreSQL database, ensure your user has the necessary permissions:

```sql
-- Connect as superuser
GRANT CREATE ON DATABASE your_database TO your_user;
GRANT ALL ON SCHEMA public TO your_user;
```

### Option B: Create new database

Create a dedicated database for CheckOps:

```sql
-- Connect as postgres superuser
CREATE DATABASE checkops_db;
CREATE USER checkops_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE checkops_db TO checkops_user;

-- Connect to the new database
\c checkops_db;
GRANT ALL ON SCHEMA public TO checkops_user;
GRANT CREATE ON SCHEMA public TO checkops_user;
```

## Step 5: Setup and Test Script

Create a setup script (`setup-checkops.js`) to test your configuration:

```javascript
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupCheckOps() {
  console.log('🚀 Setting up CheckOps...\n');
  
  // Create CheckOps instance
  const checkops = new CheckOps({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Test connection and initialize
    console.log('🔌 Testing database connection...');
    await checkops.initialize();
    console.log('✅ Database connection successful');
    console.log('✅ CheckOps tables created/verified');

    // Create a test form
    console.log('\n📝 Creating test form...');
    const testForm = {
      title: 'Welcome Survey',
      description: 'A simple test form to verify CheckOps setup',
      questions: [
        {
          questionText: 'What is your name?',
          questionType: 'text',
          required: true
        },
        {
          questionText: 'What is your email?',
          questionType: 'email',
          required: true
        },
        {
          questionText: 'How did you hear about us?',
          questionType: 'select',
          required: false,
          options: [
            'Search Engine',
            'Social Media',
            'Friend Referral',
            'Advertisement',
            'Other'
          ]
        }
      ]
    };

    const form = await checkops.createForm(testForm);
    console.log(`✅ Test form created with ID: ${form.id}`);

    // Create a test submission
    console.log('\n📤 Creating test submission...');
    const testSubmission = {
      formId: form.id,
      answers: [
        {
          questionId: form.questions[0].id,
          value: 'John Doe'
        },
        {
          questionId: form.questions[1].id,
          value: 'john.doe@example.com'
        },
        {
          questionId: form.questions[2].id,
          value: 'Search Engine'
        }
      ],
      metadata: {
        source: 'setup-test',
        timestamp: new Date().toISOString()
      }
    };

    const submission = await checkops.createSubmission(testSubmission);
    console.log(`✅ Test submission created with ID: ${submission.id}`);

    // Get submission statistics
    console.log('\n📊 Getting form statistics...');
    const stats = await checkops.getSubmissionStats(form.id);
    console.log(`📈 Total submissions: ${stats.totalSubmissions || 0}`);

    console.log('\n🎉 CheckOps setup completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   1. Review the form-creation steering guide');
    console.log('   2. Check out question-management for advanced features');
    console.log('   3. See production-deployment for going live');

    return true;

  } catch (error) {
    console.error('\n❌ CheckOps setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Verify PostgreSQL is running');
    console.log('   2. Check database credentials in .env file');
    console.log('   3. Ensure database exists and user has permissions');
    console.log('   4. Check network connectivity to database');
    
    return false;
  } finally {
    await checkops.close();
  }
}

// Run setup
setupCheckOps().then(success => {
  process.exit(success ? 0 : 1);
});
```

Run the setup script:

```bash
node setup-checkops.js
```

## Step 6: Basic Usage Examples

### Simple Contact Form Example

Create a basic usage example (`contact-form-example.js`):

```javascript
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

async function contactFormExample() {
  const checkops = new CheckOps({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await checkops.initialize();

    // Create a contact form
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

    const form = await checkops.createForm(contactForm);
    console.log('Contact form created:', form.id);

    // Simulate form submission
    const submission = {
      formId: form.id,
      answers: [
        { questionId: form.questions[0].id, value: 'Jane Smith' },
        { questionId: form.questions[1].id, value: 'jane@example.com' },
        { questionId: form.questions[2].id, value: 'General Inquiry' },
        { questionId: form.questions[3].id, value: 'Hello! I would like to learn more about your services.' }
      ],
      metadata: {
        source: 'website',
        userAgent: 'Mozilla/5.0 (Example)',
        ipAddress: '192.168.1.100'
      }
    };

    const result = await checkops.createSubmission(submission);
    console.log('Submission created:', result.id);

    // Retrieve the form
    const retrievedForm = await checkops.getForm(form.id);
    console.log('Retrieved form:', retrievedForm.title);

    // Get statistics
    const stats = await checkops.getSubmissionStats(form.id);
    console.log('Form statistics:', stats);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await checkops.close();
  }
}

contactFormExample();
```

### Survey Form with Multiple Question Types

```javascript
async function surveyFormExample() {
  const checkops = new CheckOps({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await checkops.initialize();

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
          questionText: 'Overall Satisfaction',
          questionType: 'rating',
          required: true,
          options: ['1', '2', '3', '4', '5']
        },
        {
          questionText: 'Which services have you used?',
          questionType: 'multiselect',
          required: false,
          options: [
            'Customer Support',
            'Technical Support',
            'Sales',
            'Billing',
            'Training'
          ]
        },
        {
          questionText: 'Would you recommend us to others?',
          questionType: 'boolean',
          required: true
        },
        {
          questionText: 'Additional Comments',
          questionType: 'textarea',
          required: false
        }
      ]
    };

    const form = await checkops.createForm(surveyForm);
    console.log('Survey form created:', form.id);

    // Example submission
    const submission = {
      formId: form.id,
      answers: [
        { questionId: form.questions[0].id, value: 'Anonymous User' },
        { questionId: form.questions[1].id, value: '5' },
        { questionId: form.questions[2].id, value: ['Customer Support', 'Technical Support'] },
        { questionId: form.questions[3].id, value: true },
        { questionId: form.questions[4].id, value: 'Great service, very helpful team!' }
      ]
    };

    const result = await checkops.createSubmission(submission);
    console.log('Survey submission created:', result.id);

  } catch (error) {
    console.error('Survey error:', error.message);
  } finally {
    await checkops.close();
  }
}
```

## Step 7: Package.json Scripts

Add helpful scripts to your `package.json`:

```json
{
  "scripts": {
    "setup": "node setup-checkops.js",
    "example:contact": "node contact-form-example.js",
    "dev": "node server.js",
    "start": "NODE_ENV=production node server.js"
  }
}
```

## Common Issues and Solutions

### Database Connection Issues

**Problem**: `Connection refused` or `Authentication failed`
**Solution**: 
- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env` file
- Ensure database exists
- Verify user permissions

### Permission Errors

**Problem**: `Permission denied` when creating tables
**Solution**:
```sql
GRANT CREATE ON DATABASE your_database TO your_user;
GRANT ALL ON SCHEMA public TO your_user;
```

### Node.js Version Issues

**Problem**: Syntax errors or import issues
**Solution**: Ensure you're using Node.js 24+ with ES modules support

### Environment Variable Issues

**Problem**: `undefined` values for database config
**Solution**: 
- Verify `.env` file exists in project root
- Check `dotenv.config()` is called before using variables
- Ensure no spaces around `=` in `.env` file

## Question Types Reference

CheckOps supports these question types:

- **text**: Single line text input
- **textarea**: Multi-line text input
- **email**: Email address with validation
- **phone**: Phone number input
- **number**: Numeric input
- **date**: Date picker
- **time**: Time picker
- **datetime**: Date and time picker
- **select**: Single selection dropdown
- **multiselect**: Multiple selection
- **radio**: Radio button group
- **checkbox**: Checkbox group
- **boolean**: Yes/No toggle
- **rating**: Star rating (1-5)
- **file**: File upload

## Next Steps

Once you have CheckOps running:

1. **Form Creation**: Learn advanced form building techniques
2. **Question Management**: Explore reusable question patterns
3. **Express Integration**: Build REST APIs with CheckOps
4. **Production Deployment**: Prepare for production use
5. **Error Handling**: Implement robust error handling

## Verification Checklist

- [ ] Node.js 24+ installed
- [ ] PostgreSQL 18+ running
- [ ] Dependencies installed
- [ ] `.env` file configured
- [ ] Database created with proper permissions
- [ ] Setup script runs successfully
- [ ] Test form and submission created
- [ ] Basic examples work

Congratulations! You now have CheckOps running in your project. Explore the other steering guides for advanced features and production deployment.