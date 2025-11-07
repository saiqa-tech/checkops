# CheckOps Form Builder Submission SDK

An SDK for validating and submitting CheckOps Form Builder submissions. It provides pluggable validation, normalized payload creation, and a thin HTTP wrapper for creating submissions from browser or server runtimes.

## Installation

```bash
npm install @checkops/form-builder-submission-sdk
# or
pnpm add @checkops/form-builder-submission-sdk
```

## Usage

```ts
import { FormBuilderSubmissionSDK, type FormSchema } from '@checkops/form-builder-submission-sdk';

const schema: FormSchema = {
  id: 'contact-form',
  version: '1.0.0',
  fields: [
    { name: 'fullName', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'subscribe', type: 'boolean', defaultValue: false }
  ]
};

const sdk = new FormBuilderSubmissionSDK({
  baseUrl: 'https://api.checkops.dev',
  apiKey: process.env.CHECKOPS_API_KEY
});

const result = await sdk.submit(schema, {
  fullName: 'Jane Doe',
  email: 'jane@example.com'
});

console.log(result.response?.status); // 201
console.log(result.payload); // normalized payload that was sent
```

### Dry runs

Set `dryRun: true` on submission options to validate and build payloads without sending them to the API.

```ts
const { payload, validation } = await sdk.submit(schema, data, { dryRun: true });
```

### Custom fetch implementation

Provide a custom `fetch` implementation (for example `cross-fetch` or a mocked fetch) if the runtime does not support the Fetch API natively.

```ts
import fetch from 'cross-fetch';

const sdk = new FormBuilderSubmissionSDK({
  baseUrl: 'https://api.checkops.dev',
  apiKey: 'secret',
  fetch
});
```

## API Reference

- `FormBuilderSubmissionSDK`
  - `constructor(config)`
  - `validate(schema, data)`
  - `buildSubmission(schema, data, options)`
  - `submit(schema, data, options)`
  - `submitPayload(formId, payload, options)`
- Utilities: `validateFormData`, `httpRequest`
- Core types: `FormSchema`, `SubmissionPayload`, `SubmissionOptions`, `SubmitResult`, and more.

## Contributing

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Run tests with `npm test`.
4. Submit a pull request.

## License

[MIT](./LICENSE)
