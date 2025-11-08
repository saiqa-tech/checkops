import { FormService } from '../../../src/services/FormService.js';
import { ValidationError } from '../../../src/utils/errors.js';

describe('FormService', () => {
  let formService;

  beforeEach(() => {
    formService = new FormService();
  });

  describe('enrichQuestions', () => {
    it('should return questions as-is when no questionId', async () => {
      const questions = [
        { questionText: 'Test?', questionType: 'text' },
      ];

      const result = await formService.enrichQuestions(questions);

      expect(result).toEqual(questions);
    });

    it('should enrich questions with questionId', async () => {
      const questions = [
        { questionId: 'Q-001', required: true },
      ];

      const result = await formService.enrichQuestions(questions);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('questionId');
    });
  });

  describe('validation', () => {
    it('should throw validation error for invalid title', async () => {
      await expect(
        formService.createForm({
          title: '',
          questions: [{ questionText: 'Test?', questionType: 'text' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for empty questions', async () => {
      await expect(
        formService.createForm({
          title: 'Test Form',
          questions: [],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for missing title', async () => {
      await expect(
        formService.createForm({
          questions: [{ questionText: 'Test?', questionType: 'text' }],
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
