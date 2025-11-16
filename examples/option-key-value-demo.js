import CheckOps from '../src/index.js';

async function demo() {
  const checkops = new CheckOps({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'checkops',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await checkops.initialize();
    console.log('✓ CheckOps initialized\n');

    console.log('=== DEMO: Option Key-Value System ===\n');

    console.log('1. Creating question with simple array (auto-generates keys)...');
    const question1 = await checkops.createQuestion({
      questionText: 'Select a color',
      questionType: 'select',
      options: ['Red', 'Blue', 'Green'],
    });
    console.log('   Question created:', question1.id);
    console.log('   Generated keys:', question1.options.map(o => o.key));
    console.log('');

    console.log('2. Creating question with structured options (custom keys)...');
    const question2 = await checkops.createQuestion({
      questionText: 'Select priority level',
      questionType: 'select',
      options: [
        { key: 'priority_high', label: 'High Priority' },
        { key: 'priority_medium', label: 'Medium Priority' },
        { key: 'priority_low', label: 'Low Priority' },
      ],
    });
    console.log('   Question created:', question2.id);
    console.log('   Options:', question2.options.map(o => `${o.key} => ${o.label}`));
    console.log('');

    console.log('3. Creating form with these questions...');
    const form = await checkops.createForm({
      title: 'Demo Form',
      description: 'Testing option key-value system',
      questions: [
        { questionId: question1.id },
        { questionId: question2.id },
      ],
    });
    console.log('   Form created:', form.id);
    console.log('');

    console.log('4. Submitting response with label (will be converted to key)...');
    const submission1 = await checkops.createSubmission({
      formId: form.id,
      submissionData: {
        [question1.id]: 'Red',
        [question2.id]: 'High Priority',
      },
    });
    console.log('   Submission created:', submission1.id);
    console.log('   Display data (labels):', submission1.submissionData);
    console.log('   Stored data (keys):', submission1._rawData);
    console.log('');

    console.log('5. Submitting response with key (will be kept as key)...');
    const submission2 = await checkops.createSubmission({
      formId: form.id,
      submissionData: {
        [question1.id]: question1.options[1].key,
        [question2.id]: 'priority_medium',
      },
    });
    console.log('   Submission created:', submission2.id);
    console.log('   Display data (labels):', submission2.submissionData);
    console.log('   Stored data (keys):', submission2._rawData);
    console.log('');

    console.log('6. Updating option label (key remains stable)...');
    await checkops.updateOptionLabel(
      question2.id,
      'priority_high',
      'Critical Priority',
      'demo@example.com'
    );
    console.log('   Label updated: "High Priority" → "Critical Priority"');
    console.log('');

    console.log('7. Retrieving old submission (displays NEW label)...');
    const retrievedSub1 = await checkops.getSubmission(submission1.id);
    console.log('   Display data (with new label):', retrievedSub1.submissionData);
    console.log('   Stored data (key unchanged):', retrievedSub1._rawData);
    console.log('');

    console.log('8. Getting option history...');
    const history = await checkops.getOptionHistory(question2.id, 'priority_high');
    console.log('   History records:', history.length);
    console.log('   Change:', history[0]);
    console.log('');

    console.log('9. Getting submission stats...');
    const stats = await checkops.getSubmissionStats(form.id);
    console.log('   Total submissions:', stats.totalSubmissions);
    console.log('   Priority question stats:');
    console.log('     - Answer distribution (by current label):', stats.questionStats[question2.id].answerDistribution);
    console.log('     - Key distribution (internal):', stats.questionStats[question2.id]._keyDistribution);
    console.log('');

    console.log('=== DEMO COMPLETE ===');
    console.log('✓ All features demonstrated successfully!');
    console.log('');
    console.log('Key Takeaways:');
    console.log('  1. Simple arrays are auto-converted to structured options');
    console.log('  2. Submissions can use labels OR keys (both work)');
    console.log('  3. Data is stored using stable keys');
    console.log('  4. Retrieval displays current labels');
    console.log('  5. Changing labels does NOT break existing data');
    console.log('  6. All label changes are tracked in history');
    console.log('  7. Stats aggregate by key, display by current label');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await checkops.close();
  }
}

demo().catch(console.error);
