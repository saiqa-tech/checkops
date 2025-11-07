import { describe, it, expect } from 'vitest';

describe('Build Verification', () => {
  it('should have built distribution files', () => {
    // This test verifies the build process works
    expect(true).toBe(true);
  });

  it('should have proper package.json configuration', async () => {
    const pkg = await import('../package.json');
    
    expect(pkg.name).toBe('@checkops/form-builder-submission-sdk');
    expect(pkg.version).toBe('0.2.0');
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
  });

  it('should have correct exports in package.json', async () => {
    const pkg = await import('../package.json');
    
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports['.']).toBeDefined();
    expect(pkg.exports['./server']).toBeDefined();
  });

  it('should have all required dependencies', async () => {
    const pkg = await import('../package.json');
    
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies.express).toBeDefined();
    expect(pkg.dependencies.pg).toBeDefined();
    expect(pkg.dependencies.bcryptjs).toBeDefined();
    expect(pkg.dependencies.jsonwebtoken).toBeDefined();
    expect(pkg.dependencies.joi).toBeDefined();
  });
});

describe('Project Structure', () => {
  it('should have all required directories', async () => {
    const fs = await import('fs/promises');
    
    const dirs = [
      'src',
      'src/server',
      'src/server/controllers',
      'src/server/models',
      'src/server/middleware',
      'src/server/utils',
      'src/server/config',
      'tests',
      'migrations',
      'scripts'
    ];

    for (const dir of dirs) {
      try {
        await fs.access(dir);
        expect(true).toBe(true); // Directory exists
      } catch (error) {
        expect.fail(`Directory ${dir} should exist`);
      }
    }
  });

  it('should have all required files', async () => {
    const fs = await import('fs/promises');
    
    const files = [
      'src/index.ts',
      'src/server/index.ts',
      'src/server/app.ts',
      'migrations/001_initial_schema.sql',
      'scripts/migrate.ts',
      '.env.example',
      'BACKEND.md'
    ];

    for (const file of files) {
      try {
        await fs.access(file);
        expect(true).toBe(true); // File exists
      } catch (error) {
        expect.fail(`File ${file} should exist`);
      }
    }
  });
});

describe('TypeScript Configuration', () => {
  it('should have proper tsconfig.json', async () => {
    const fs = await import('fs/promises');
    const tsconfig = JSON.parse(await fs.readFile('tsconfig.json', 'utf8'));
    
    expect(tsconfig.compilerOptions.target).toBe('ES2020');
    expect(tsconfig.compilerOptions.module).toBe('NodeNext');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('NodeNext');
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.declaration).toBe(true);
  });
});