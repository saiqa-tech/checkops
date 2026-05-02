import { SubmissionService } from '../../../src/services/SubmissionService.js';
import { ValidationError } from '../../../src/utils/errors.js';

describe('SubmissionService', () => {
  let submissionService;

  beforeEach(() => {
    submissionService = new SubmissionService();
  });

  describe('validation', () => {
    it('should throw validation error for missing formId', async () => {
      await expect(
        submissionService.createSubmission({
          submissionData: { name: 'Test' },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for missing submissionData', async () => {
      await expect(
        submissionService.createSubmission({
          formId: 'FORM-001',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for invalid formId format', async () => {
      await expect(
        submissionService.createSubmission({
          formId: 'FORM-001',
          submissionData: { name: 'Test' },
        })
      ).rejects.toThrow(new ValidationError('Valid form UUID is required'));
    });

    it('should throw validation error for missing submission ID in update', async () => {
      await expect(
        submissionService.updateSubmissionById(null, { metadata: {} })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for missing submission ID in delete', async () => {
      await expect(
        submissionService.deleteSubmissionById(null)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for missing submission ID in getById', async () => {
      await expect(
        submissionService.getSubmissionById(null)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for missing form ID in getByFormId', async () => {
      await expect(
        submissionService.getSubmissionsByFormId(null)
      ).rejects.toThrow(ValidationError);
    });
  });
});
