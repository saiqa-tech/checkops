import { describe, expect, it, vi } from 'vitest';
import { FormBuilderSubmissionSDK, ValidationError } from '../src/index.js';
import type { FormSchema, SubmissionPayload } from '../src/types.js';

const schema: FormSchema = {
  id: 'contact-form',
  version: '1.0.0',
  fields: [
    {
      name: 'fullName',
      type: 'text',
      required: true,
      minLength: 2
    },
    {
      name: 'age',
      type: 'integer'
    },
    {
      name: 'email',
      type: 'email',
      required: true
    },
    {
      name: 'preferences',
      type: 'multi-select',
      options: [
        { value: 'a' },
        { value: 'b' },
        { value: 'c' }
      ]
    },
    {
      name: 'subscribe',
      type: 'boolean',
      defaultValue: false
    }
  ]
};

describe('FormBuilderSubmissionSDK', () => {
  it('builds a normalized submission payload and retains warnings', async () => {
    const sdk = new FormBuilderSubmissionSDK({ baseUrl: 'https://api.checkops.dev/' });

    const { payload, validation } = await sdk.buildSubmission(schema, {
      fullName: ' Alice Example ',
      age: '32',
      email: 'alice@example.com',
      preferences: 'a,c',
      subscribe: 'yes',
      ignoredField: 'value'
    });

    expect(payload.formId).toBe(schema.id);
    expect(payload.submittedAt).toMatch(/Z$/);
    expect(payload.data).toEqual({
      fullName: 'Alice Example',
      age: 32,
      email: 'alice@example.com',
      preferences: ['a', 'c'],
      subscribe: true
    });

    expect(validation.warnings).toContain('Unexpected field "ignoredField" was provided and has been ignored.');
  });

  it('throws a validation error for invalid submissions', async () => {
    const sdk = new FormBuilderSubmissionSDK({ baseUrl: 'https://api.checkops.dev' });

    await expect(
      sdk.submit(schema, {
        fullName: 'A',
        email: 'not-an-email'
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('submits payloads using the provided fetch implementation', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      expect(url).toBe('https://api.checkops.dev/forms/contact-form/submissions');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
        accept: 'application/json'
      });

      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
      expect(body.data).toMatchObject({
        fullName: 'Alice Example',
        email: 'alice@example.com'
      });

      return new Response(JSON.stringify({ submissionId: 'abc123' }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      });
    });

    const sdk = new FormBuilderSubmissionSDK({
      baseUrl: 'https://api.checkops.dev/',
      apiKey: 'secret-token',
      fetch: fetchMock
    });

    const result = await sdk.submit(schema, {
      fullName: 'Alice Example',
      email: 'alice@example.com'
    });

    expect(result.dryRun).toBe(false);
    expect(result.response?.status).toBe(201);
    expect(result.response?.data).toEqual({ submissionId: 'abc123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports dry-run submissions without network calls', async () => {
    const fetchMock = vi.fn();
    const sdk = new FormBuilderSubmissionSDK({ baseUrl: 'https://api.checkops.dev', fetch: fetchMock });

    const result = await sdk.submit(
      schema,
      {
        fullName: 'Dry Run User',
        email: 'dry@example.com'
      },
      { dryRun: true }
    );

    expect(result.dryRun).toBe(true);
    expect(result.response).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows submitting pre-built payloads and transforming responses', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { submissionId: 'xyz789' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const sdk = new FormBuilderSubmissionSDK({ baseUrl: 'https://api.checkops.dev/', fetch: fetchMock });

    const payload: SubmissionPayload = {
      formId: schema.id,
      submittedAt: new Date().toISOString(),
      data: {
        fullName: 'Payload User',
        email: 'payload@example.com'
      }
    };

    const result = await sdk.submitPayload(schema.id, payload, {
      transform: (body) => (body as { data: { submissionId: string } }).data
    });

    expect(result.response?.data).toEqual({ submissionId: 'xyz789' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes the base url', () => {
    const sdk = new FormBuilderSubmissionSDK({ baseUrl: 'https://api.checkops.dev/forms/' });
    expect(sdk.getBaseUrl()).toBe('https://api.checkops.dev/forms');
  });
});
