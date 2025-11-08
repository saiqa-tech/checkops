import { generateFormId, generateQuestionId, generateSubmissionId } from '../../../src/utils/idGenerator.js';

describe('ID Generator', () => {
  describe('generateFormId', () => {
    it('should generate form ID with proper format', async () => {
      const mockClient = {
        query: () => Promise.resolve({ rows: [{ next_id: 1 }] }),
      };

      const id = await generateFormId(mockClient);

      expect(id).toBe('FORM-001');
    });

    it('should pad ID with zeros', async () => {
      const mockClient = {
        query: () => Promise.resolve({ rows: [{ next_id: 42 }] }),
      };

      const id = await generateFormId(mockClient);

      expect(id).toBe('FORM-042');
    });

    it('should handle large numbers', async () => {
      const mockClient = {
        query: () => Promise.resolve({ rows: [{ next_id: 9999 }] }),
      };

      const id = await generateFormId(mockClient);

      expect(id).toBe('FORM-9999');
    });
  });

  describe('generateQuestionId', () => {
    it('should generate question ID with proper format', async () => {
      const mockClient = {
        query: () => Promise.resolve({ rows: [{ next_id: 5 }] }),
      };

      const id = await generateQuestionId(mockClient);

      expect(id).toBe('Q-005');
    });
  });

  describe('generateSubmissionId', () => {
    it('should generate submission ID with proper format', async () => {
      const mockClient = {
        query: () => Promise.resolve({ rows: [{ next_id: 100 }] }),
      };

      const id = await generateSubmissionId(mockClient);

      expect(id).toBe('SUB-100');
    });
  });
});
