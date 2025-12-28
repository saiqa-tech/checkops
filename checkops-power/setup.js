#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';
import readline from 'readline';

class CheckOpsSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async setup() {
    console.log('🚀 CheckOps Power Setup');
    console.log('========================\n');

    try {
      // Check if we're in a Node.js project
      if (!fs.existsSync('package.json')) {
        console.log('❌ No package.json found. Please run this in a Node.js project directory.');
        process.exit(1);
      }

      // Install CheckOps dependencies
      console.log('📦 Installing CheckOps dependencies...');
      await this.installDependencies();

      // Gather database configuration
      console.log('\n🔧 Database Configuration');
      const dbConfig = await this.gatherDatabaseConfig();

      // Create environment file
      console.log('\n📝 Creating environment configuration...');
      await this.createEnvFile(dbConfig);

      // Create initialization code
      console.log('\n💻 Generating initialization code...');
      await this.createInitializationCode(dbConfig);

      // Run database migration
      console.log('\n🗄️  Setting up database...');
      await this.runMigration(dbConfig);

      // Create sample code
      console.log('\n📋 Creating sample code...');
      await this.createSampleCode();

      // Create wrapper examples
      console.log('\n📚 Creating wrapper library examples...');
      await this.createWrapperExamples();

      console.log('\n✅ CheckOps setup completed successfully!');
      console.log('\nGenerated files:');
      console.log('📄 Configuration:');
      console.log('   - .env (database configuration)');
      console.log('   - checkops-init.js (basic initialization)');
      console.log('   - checkops-examples.js (basic usage examples)');
      console.log('📚 Wrapper Library:');
      console.log('   - checkops-wrapper-example.js (wrapper usage)');
      console.log('   - checkops-express-example.js (Express integration)');
      console.log('\nNext steps:');
      console.log('1. Test basic connection: node checkops-init.js');
      console.log('2. Run basic examples: node checkops-examples.js');
      console.log('3. Try wrapper features: node checkops-wrapper-example.js');
      console.log('4. Start Express server: node checkops-express-example.js');
      console.log('5. Explore advanced examples: npm run example:basic');
      console.log('6. Check steering guides in ./steering/ for detailed workflows');

    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  async installDependencies() {
    try {
      console.log('Installing @saiqa-tech/checkops and pg...');
      execSync('npm install @saiqa-tech/checkops pg dotenv', { stdio: 'inherit' });
      console.log('✅ Dependencies installed successfully');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }

  async gatherDatabaseConfig() {
    console.log('Please provide your PostgreSQL database configuration:');

    const host = await this.question('Database host (localhost): ') || 'localhost';
    const port = await this.question('Database port (5432): ') || '5432';
    const database = await this.question('Database name: ');
    const user = await this.question('Database user: ');
    const password = await this.question('Database password: ');

    if (!database || !user || !password) {
      throw new Error('Database name, user, and password are required');
    }

    return { host, port, database, user, password };
  }

  async createEnvFile(dbConfig) {
    const envContent = `# CheckOps Database Configuration
DB_HOST=${dbConfig.host}
DB_PORT=${dbConfig.port}
DB_NAME=${dbConfig.database}
DB_USER=${dbConfig.user}
DB_PASSWORD=${dbConfig.password}

# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Optional: SSL Configuration (set to true for production)
DB_SSL=false
`;

    fs.writeFileSync('.env', envContent);
    console.log('✅ .env file created');

    // Add .env to .gitignore if it exists
    if (fs.existsSync('.gitignore')) {
      const gitignore = fs.readFileSync('.gitignore', 'utf8');
      if (!gitignore.includes('.env')) {
        fs.appendFileSync('.gitignore', '\n# Environment variables\n.env\n');
        console.log('✅ Added .env to .gitignore');
      }
    }
  }

  async createInitializationCode(dbConfig) {
    const initCode = `import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function initializeCheckOps() {
  try {
    console.log('🚀 Initializing CheckOps...');
    
    const checkops = new CheckOps({
      host: process.env.DB_HOST || '${dbConfig.host}',
      port: parseInt(process.env.DB_PORT) || ${dbConfig.port},
      database: process.env.DB_NAME || '${dbConfig.database}',
      user: process.env.DB_USER || '${dbConfig.user}',
      password: process.env.DB_PASSWORD || '${dbConfig.password}',
    });

    await checkops.initialize();
    console.log('✅ CheckOps initialized successfully!');
    
    // Test the connection
    const formCount = await checkops.getFormCount();
    console.log(\`📊 Current form count: \${formCount}\`);
    
    await checkops.close();
    console.log('🔒 Connection closed');
    
  } catch (error) {
    console.error('❌ CheckOps initialization failed:', error.message);
    process.exit(1);
  }
}

// Run initialization if this file is executed directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  initializeCheckOps();
}

export default initializeCheckOps;
`;

    fs.writeFileSync('checkops-init.js', initCode);
    console.log('✅ checkops-init.js created');
  }

  async runMigration(dbConfig) {
    try {
      // Set environment variables for migration
      process.env.DB_HOST = dbConfig.host;
      process.env.DB_PORT = dbConfig.port;
      process.env.DB_NAME = dbConfig.database;
      process.env.DB_USER = dbConfig.user;
      process.env.DB_PASSWORD = dbConfig.password;

      console.log('Running CheckOps database migrations...');
      execSync('npx @saiqa-tech/checkops migrate', { stdio: 'inherit' });
      console.log('✅ Database migration completed');
    } catch (error) {
      console.warn('⚠️  Migration failed. You may need to run it manually:');
      console.warn('   npx @saiqa-tech/checkops migrate');
      console.warn('   Or: node node_modules/@saiqa-tech/checkops/migrations/run.js');
    }
  }

  async createSampleCode() {
    const sampleCode = `import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

async function runCheckOpsExamples() {
  const checkops = new CheckOps({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await checkops.initialize();
    console.log('🚀 CheckOps Examples');
    console.log('===================\\n');

    // Example 1: Create a simple contact form
    console.log('📋 Creating a contact form...');
    const contactForm = await checkops.createForm({
      title: 'Contact Us',
      description: 'Get in touch with our team',
      questions: [
        {
          questionText: 'Your Name',
          questionType: 'text',
          required: true,
        },
        {
          questionText: 'Email Address',
          questionType: 'email',
          required: true,
        },
        {
          questionText: 'Subject',
          questionType: 'select',
          options: ['General Inquiry', 'Support', 'Sales', 'Partnership'],
          required: true,
        },
        {
          questionText: 'Message',
          questionType: 'textarea',
          required: true,
        },
      ],
    });
    console.log(\`✅ Contact form created with ID: \${contactForm.id}\`);

    // Example 2: Create a feedback form with rating
    console.log('\\n⭐ Creating a feedback form...');
    const feedbackForm = await checkops.createForm({
      title: 'Service Feedback',
      description: 'Help us improve our services',
      questions: [
        {
          questionText: 'Overall satisfaction',
          questionType: 'rating',
          options: [1, 2, 3, 4, 5],
          required: true,
        },
        {
          questionText: 'Which services did you use?',
          questionType: 'multiselect',
          options: [
            { key: 'support', label: 'Customer Support' },
            { key: 'sales', label: 'Sales Team' },
            { key: 'technical', label: 'Technical Support' },
            { key: 'billing', label: 'Billing' },
          ],
          required: false,
        },
        {
          questionText: 'Would you recommend us?',
          questionType: 'boolean',
          required: true,
        },
        {
          questionText: 'Additional comments',
          questionType: 'textarea',
          required: false,
        },
      ],
    });
    console.log(\`✅ Feedback form created with ID: \${feedbackForm.id}\`);

    // Example 3: Create a sample submission
    console.log('\\n📝 Creating sample submissions...');
    const submission1 = await checkops.createSubmission({
      formId: contactForm.id,
      submissionData: {
        'Your Name': 'John Doe',
        'Email Address': 'john@example.com',
        'Subject': 'General Inquiry',
        'Message': 'I would like to learn more about your services.',
      },
    });
    console.log(\`✅ Contact submission created with ID: \${submission1.id}\`);

    const submission2 = await checkops.createSubmission({
      formId: feedbackForm.id,
      submissionData: {
        'Overall satisfaction': 5,
        'Which services did you use?': ['support', 'technical'],
        'Would you recommend us?': true,
        'Additional comments': 'Great service, very helpful team!',
      },
    });
    console.log(\`✅ Feedback submission created with ID: \${submission2.id}\`);

    // Example 4: Get submission statistics
    console.log('\\n📊 Getting submission statistics...');
    const contactStats = await checkops.getSubmissionStats(contactForm.id);
    console.log('Contact form stats:', {
      totalSubmissions: contactStats.totalSubmissions,
      questionCount: Object.keys(contactStats.questionStats).length,
    });

    const feedbackStats = await checkops.getSubmissionStats(feedbackForm.id);
    console.log('Feedback form stats:', {
      totalSubmissions: feedbackStats.totalSubmissions,
      questionCount: Object.keys(feedbackStats.questionStats).length,
    });

    // Example 5: Create reusable questions
    console.log('\\n🔄 Creating reusable questions...');
    const nameQuestion = await checkops.createQuestion({
      questionText: 'Full Name',
      questionType: 'text',
      metadata: { category: 'personal-info', reusable: true },
    });
    console.log(\`✅ Reusable name question created with ID: \${nameQuestion.id}\`);

    const emailQuestion = await checkops.createQuestion({
      questionText: 'Email Address',
      questionType: 'email',
      metadata: { category: 'contact-info', reusable: true },
    });
    console.log(\`✅ Reusable email question created with ID: \${emailQuestion.id}\`);

    console.log('\\n🎉 All examples completed successfully!');
    console.log('\\nNext steps:');
    console.log('- Check the created forms and submissions in your database');
    console.log('- Explore the steering guides for advanced workflows');
    console.log('- Build your own forms using the CheckOps API');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
  } finally {
    await checkops.close();
  }
}

// Run examples if this file is executed directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  runCheckOpsExamples();
}

export default runCheckOpsExamples;
`;

    fs.writeFileSync('checkops-examples.js', sampleCode);
    console.log('✅ checkops-examples.js created');
  }

  async createWrapperExamples() {
    const wrapperExample = `import { CheckOpsWrapper, FormBuilder, FormTemplates } from './lib/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function wrapperExample() {
  console.log('🚀 CheckOps Wrapper Example');
  console.log('===========================\\n');

  // Initialize wrapper with enhanced features
  const checkops = new CheckOpsWrapper({
    enableLogging: true,
    enableMetrics: true,
    retryAttempts: 3,
    autoReconnect: true,
  });

  // Enable caching
  checkops.enableCache();

  // Listen to events
  checkops.on('initialized', () => {
    console.log('✅ CheckOps wrapper initialized');
  });

  checkops.on('formCreated', (form) => {
    console.log(\`📋 Form created: \${form.title}\`);
  });

  try {
    // Example 1: Using FormBuilder
    const contactForm = await checkops.createForm(
      new FormBuilder()
        .title('Contact Form')
        .description('Get in touch')
        .textQuestion('Name', true)
        .emailQuestion('Email', true)
        .textareaQuestion('Message', true)
        .build()
    );

    // Example 2: Using templates
    const feedbackForm = await checkops.createForm(
      FormTemplates.feedbackForm()
    );

    // Example 3: Create submissions
    await checkops.createSubmission({
      formId: contactForm.id,
      submissionData: {
        'Name': 'John Doe',
        'Email': 'john@example.com',
        'Message': 'Hello from the wrapper!',
      },
    });

    // Example 4: Get analytics with caching
    const stats = await checkops.getStats(feedbackForm.id, true);
    console.log('Form statistics:', stats);

    // Example 5: Health check
    const health = await checkops.healthCheck();
    console.log('Health status:', health.status);

    console.log('\\n🎉 Wrapper example completed!');

  } catch (error) {
    console.error('❌ Wrapper example failed:', error.message);
  } finally {
    await checkops.close();
  }
}

// Run if executed directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  wrapperExample();
}

export default wrapperExample;
`;

    fs.writeFileSync('checkops-wrapper-example.js', wrapperExample);
    console.log('✅ checkops-wrapper-example.js created');

    // Create Express integration example
    const expressExample = `import express from 'express';
import { createCheckOpsRouter } from './lib/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'CheckOps Express Integration',
    endpoints: {
      forms: '/api/checkops/forms',
      health: '/api/checkops/health',
    },
  });
});

// CheckOps routes
const checkopsRouter = await createCheckOpsRouter({
  enableLogging: true,
  enableMetrics: true,
});

app.use('/api/checkops', checkopsRouter);

app.listen(port, () => {
  console.log(\`🚀 Server running on http://localhost:\${port}\`);
  console.log(\`📋 CheckOps API: http://localhost:\${port}/api/checkops\`);
});
`;

    fs.writeFileSync('checkops-express-example.js', expressExample);
    console.log('✅ checkops-express-example.js created');
  }
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new CheckOpsSetup();
  setup.setup();
}

export default CheckOpsSetup;