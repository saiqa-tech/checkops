import { createPool, defaultDatabaseConfig } from '../src/config/database.js';
import { FormService } from '../src/services/FormService.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { SecurityService } from '../src/services/SecurityService.js';
import { ValidationService } from '../src/services/ValidationService.js';
import { IdGenerator } from '../src/services/IdGenerator.js';

// Initialize services
const pool = createPool(defaultDatabaseConfig);
const formService = new FormService(pool);
const submissionService = new SubmissionService(pool);
const securityService = new SecurityService(pool, 'your-jwt-secret-for-production');
const validationService = new ValidationService(pool);
const idGenerator = new IdGenerator(pool);

async function quickStart() {
  console.log('🚀 CheckOps Form Builder SDK - Quick Start Example');
  
  try {
    // 1. Create a form
    console.log('📝 Creating form...');
    const form = await formService.createForm({
      title: 'Contact Form',
      description: 'A simple contact form for demonstration',
      schema: {
        id: 'contact-form',
        fields: [
          {
            name: 'name',
            label: 'Full Name',
            type: 'text',
            required: true
          },
          {
            name: 'email',
            label: 'Email Address',
            type: 'email',
            required: true
          },
          {
            name: 'message',
            label: 'Message',
            type: 'textarea',
            required: true
          }
        ]
      },
      createdBy: 'demo-user'
    });

    console.log(`✅ Form created with ID: ${form.id}`);

    // 2. Create validation rules for the form fields
    console.log('🔧 Creating validation rules...');
    
    await validationService.createValidationRule({
      fieldId: 'name',
      type: 'required',
      parameters: {},
      errorMessage: 'Name is required'
    });

    await validationService.createValidationRule({
      fieldId: 'email',
      type: 'email',
      parameters: {},
      errorMessage: 'Please enter a valid email address'
    });

    await validationService.createValidationRule({
      fieldId: 'message',
      type: 'min_length',
      parameters: { minLength: 10 },
      errorMessage: 'Message must be at least 10 characters'
    });

    console.log('✅ Validation rules created');

    // 3. Create an API key for form access
    console.log('🔐 Creating API key...');
    const { apiKey, apiKeyData } = await securityService.createApiKey({
      name: 'Demo API Key',
      permissions: ['forms:read', 'forms:create', 'submissions:create', 'submissions:read'],
      rateLimitPerHour: 1000,
      createdBy: 'demo-user'
    });

    console.log(`✅ API key created: ${apiKey}`);
    console.log(`📋 API Key ID: ${apiKeyData.id}`);

    // 4. Test form submission
    console.log('📤 Testing form submission...');
    const submission = await submissionService.createSubmission({
      formId: form.id,
      data: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        message: 'Hello, this is a test submission from the CheckOps SDK!'
      },
      submittedBy: 'demo-user'
    });

    console.log(`✅ Submission created with ID: ${submission.id}`);

    // 5. Get all forms
    console.log('📋 Retrieving all forms...');
    const allForms = await formService.getAllForms(10, 0);
    console.log(`Found ${allForms.length} forms`);

    // 6. Get submissions for the form
    console.log('📊 Retrieving submissions...');
    const submissions = await submissionService.getSubmissionsByFormId(form.id, 10, 0);
    console.log(`Found ${submissions.length} submissions for form`);

    // 7. Get submission statistics
    console.log('📈 Getting submission statistics...');
    const stats = await submissionService.getSubmissionStats(form.id);
    console.log('Submission Stats:', stats);

    // 8. Test API key authentication
    console.log('🔐 Testing API key authentication...');
    const authResult = await securityService.authenticate({
      apiKey: 'invalid-key'
    });
    console.log('Auth result:', authResult);

    const validAuthResult = await securityService.authenticate({ apiKey });
    if (validAuthResult.isValid) {
      console.log('✅ API key authentication successful');
      
      // Test permission check
      const hasPermission = await securityService.checkPermission(
        validAuthResult.apiKey!,
        'forms:delete'
      );
      console.log('Has delete permission:', hasPermission);
      
      // Generate JWT token
      const token = await securityService.generateJwtToken({
        userId: 'demo-user',
        permissions: validAuthResult.apiKey!.permissions
      });
      console.log(`✅ JWT Token generated: ${token}`);
    }

    // 9. Test ID generation
    console.log('🔢 Testing ID generation...');
    const formId = await idGenerator.getNextId('forms');
    const submissionId = await idGenerator.getNextId('submissions');
    console.log(`Generated IDs: form_${formId}, submission_${submissionId}`);

    console.log('\n🎉 Quick start completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Use the API key in your application headers: Authorization: Bearer', apiKey);
    console.log('2. Call the services in your Node.js application');
    console.log('3. Check the generated IDs and data in your database');
    console.log('4. Refer to NPM_SETUP.md for detailed usage instructions');

  } catch (error) {
    console.error('❌ Error during quick start:', error);
  } finally {
    await pool.end();
  }
}

// Run quick start if this file is executed directly
if (require.main === module) {
  quickStart();
}

export { quickStart };