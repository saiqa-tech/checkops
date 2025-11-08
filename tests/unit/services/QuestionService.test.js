import { QuestionService } from '../../../src/services/QuestionService.js';
import { ValidationError } from '../../../src/utils/errors.js';

describe('QuestionService', () => {
  let questionService;

  beforeEach(() => {
    questionService = new QuestionService();
  });

  describe('validation', () => {
    it('should throw validation error for missing question text', async () => {
      await expect(
        questionService.createQuestion({
          questionType: 'text',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for invalid question type', async () => {
      await expect(
        questionService.createQuestion({
          questionText: 'Test?',
          questionType: 'invalid',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for select without options', async () => {
      await expect(
        questionService.createQuestion({
          questionText: 'Choose one',
          questionType: 'select',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for missing question type', async () => {
      await expect(
        questionService.createQuestion({
          questionText: 'Test?',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for radio without options', async () => {
      await expect(
        questionService.createQuestion({
          questionText: 'Choose',
          questionType: 'radio',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for checkbox without options', async () => {
      await expect(
        questionService.createQuestion({
          questionText: 'Select all',
          questionType: 'checkbox',
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
