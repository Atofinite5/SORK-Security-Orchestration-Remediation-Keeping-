import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from './logger.js';

export class ProjectScaffolder {
  constructor(private projectPath: string, private logger: Logger) {}

  async setupPrettier(): Promise<void> {
    this.logger.info('Setting up Prettier...');

    const prettierConfig = {
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      bracketSpacing: true,
      arrowParens: 'always',
      endOfLine: 'lf',
    };

    const configPath = path.join(this.projectPath, '.prettierrc.json');
    await fs.writeFile(configPath, JSON.stringify(prettierConfig, null, 2));
    this.logger.success('✓ Prettier configured (.prettierrc.json)');

    // Create .prettierignore
    const prettierIgnore = `node_modules/
dist/
build/
coverage/
.next/
out/
.env*
*.log
`;
    const ignorePath = path.join(this.projectPath, '.prettierignore');
    await fs.writeFile(ignorePath, prettierIgnore);
    this.logger.success('✓ Prettier ignore file created');
  }

  async setupESLint(): Promise<void> {
    this.logger.info('Setting up ESLint...');

    const eslintConfig = {
      env: {
        node: true,
        es2022: true,
      },
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: {
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-unused-vars': 'error',
        'prefer-const': 'error',
        'no-var': 'error',
        'eqeqeq': ['error', 'always'],
        'curly': 'error',
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'indent': ['error', 2],
        'comma-dangle': ['error', 'always-multiline'],
        'space-before-function-paren': ['error', 'never'],
        'keyword-spacing': 'error',
        'space-infix-ops': 'error',
        'object-curly-spacing': ['error', 'always'],
      },
      overrides: [
        {
          files: ['*.ts', '*.tsx'],
          parser: '@typescript-eslint/parser',
          extends: [
            'eslint:recommended',
            'plugin:@typescript-eslint/recommended',
          ],
          plugins: ['@typescript-eslint'],
          rules: {
            '@typescript-eslint/explicit-function-return-types': 'off',
            '@typescript-eslint/no-unused-vars': [
              'error',
              { argsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
          },
        },
      ],
    };

    const configPath = path.join(this.projectPath, '.eslintrc.json');
    await fs.writeFile(configPath, JSON.stringify(eslintConfig, null, 2));
    this.logger.success('✓ ESLint configured (.eslintrc.json)');

    // Create .eslintignore
    const eslintIgnore = `node_modules/
dist/
build/
coverage/
.next/
*.config.js
`;
    const ignorePath = path.join(this.projectPath, '.eslintignore');
    await fs.writeFile(ignorePath, eslintIgnore);
    this.logger.success('✓ ESLint ignore file created');
  }

  async setupZodValidation(): Promise<void> {
    this.logger.info('Setting up Zod validation schemas...');

    const zodValidatorCode = `import { z } from 'zod';

/**
 * Environment Variable Validation Schema
 * Validates all environment variables at startup
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Add your env vars here
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * Throws ZodError if validation fails
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(\`  - \${err.path.join('.')}: \${err.message}\`);
      });
    }
    throw error;
  }
}

/**
 * Generic API Response Validator
 * Use this for validating API responses
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

/**
 * Validate API responses with proper error messages
 */
export function validateApiResponse(data: unknown): ApiResponse {
  try {
    return apiResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors
        .map((err) => \`\${err.path.join('.')}: \${err.message}\`)
        .join(', ');
      throw new Error(\`Invalid API response: \${messages}\`);
    }
    throw error;
  }
}
`;

    const validatorsDir = path.join(this.projectPath, 'src', 'validators');
    await fs.mkdir(validatorsDir, { recursive: true });

    const validatorPath = path.join(validatorsDir, 'index.ts');
    await fs.writeFile(validatorPath, zodValidatorCode);
    this.logger.success('✓ Zod validators created (src/validators/index.ts)');
  }

  async setupScripts(): Promise<void> {
    this.logger.info('Updating package.json scripts...');

    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Add quality assurance scripts
      packageJson.scripts.lint = 'eslint . --ext .ts,.tsx,.js,.jsx';
      packageJson.scripts['lint:fix'] = 'eslint . --ext .ts,.tsx,.js,.jsx --fix';
      packageJson.scripts.format = 'prettier --write .';
      packageJson.scripts['format:check'] = 'prettier --check .';
      packageJson.scripts['qa'] = 'npm run format:check && npm run lint && npm run type-check';
      packageJson.scripts['qa:fix'] = 'npm run format && npm run lint:fix';

      // Add Zod if not present
      if (!packageJson.dependencies?.zod && !packageJson.devDependencies?.zod) {
        if (!packageJson.dependencies) {
          packageJson.dependencies = {};
        }
        packageJson.dependencies.zod = '^3.22.0';
      }

      // Ensure Prettier and ESLint are in devDependencies
      if (!packageJson.devDependencies) {
        packageJson.devDependencies = {};
      }
      packageJson.devDependencies.prettier = '^3.0.0';
      packageJson.devDependencies.eslint = '^8.50.0';

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
      );

      this.logger.success('✓ Package.json scripts updated');
      this.logger.info('  Available commands:');
      this.logger.info('    npm run lint       - Check code quality');
      this.logger.info('    npm run lint:fix   - Auto-fix linting issues');
      this.logger.info('    npm run format     - Format code with Prettier');
      this.logger.info('    npm run qa         - Run full quality checks');
      this.logger.info('    npm run qa:fix     - Auto-fix all quality issues');
    } catch (error) {
      this.logger.warn(
        `Could not update package.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async createQualityGuide(): Promise<void> {
    this.logger.info('Creating quality guide...');

    const guideContent = `# Code Quality Guide

This project uses **SORK** with **Prettier**, **ESLint**, and **Zod** for maximum code quality.

## 🎯 Quality Standards

### Formatting (Prettier)
- 2 space indentation
- Single quotes
- Trailing commas in multiline
- 100 character line width
- Auto-formatted on every commit (via SORK)

### Linting (ESLint)
- No unused variables
- No console.log (except warnings/errors)
- Const-first variable declarations
- Strict equality (===)
- Explicit error handling

### Validation (Zod)
- Runtime type validation for all external data
- Environment variable validation at startup
- API response validation
- Custom validation schemas in \`src/validators/\`

## 🚀 Workflow

### Before Committing
\`\`\`bash
npm run qa:fix     # Auto-fix all issues
git add .
git commit -m "message"  # SORK pre-commit hook runs automatically
\`\`\`

### Quality Checks
\`\`\`bash
npm run lint       # Check linting
npm run format:check  # Check formatting
npm run type-check # Check TypeScript types
npm run qa         # Run all checks
\`\`\`

## 📋 Validation Examples

### Environment Variables
\`\`\`typescript
import { validateEnv } from './validators';

const env = validateEnv(); // Throws ZodError if invalid
console.log(env.NODE_ENV); // Type-safe!
\`\`\`

### API Responses
\`\`\`typescript
import { validateApiResponse } from './validators';

const response = await fetch('/api/user');
const data = validateApiResponse(await response.json()); // Validated!
\`\`\`

## 🔍 SORK Integration

When you run \`sork init && sork setup-hooks\`:
1. Security vulnerabilities are automatically detected
2. Prettier & ESLint run before every commit
3. Zod validates all data flows
4. Pre-commit hook blocks unsafe commits

## ❓ Need Help?

- \`sork --help\` - See SORK commands
- \`npm run qa:fix\` - Auto-fix all issues
- Check \`src/validators/\` for validation schemas
`;

    const guidePath = path.join(this.projectPath, 'CODE_QUALITY.md');
    await fs.writeFile(guidePath, guideContent);
    this.logger.success('✓ Code quality guide created (CODE_QUALITY.md)');
  }

  async scaffoldAll(): Promise<void> {
    this.logger.section('Setting Up Complete Development Environment');

    try {
      await this.setupPrettier();
      await this.setupESLint();
      await this.setupZodValidation();
      await this.setupScripts();
      await this.createQualityGuide();

      this.logger.section('✅ Development Environment Ready!');
      this.logger.success('Your project now has:');
      this.logger.info('  ✓ Prettier - Code formatting');
      this.logger.info('  ✓ ESLint - Code linting & best practices');
      this.logger.info('  ✓ Zod - Runtime type validation');
      this.logger.info('  ✓ SORK - Security orchestration');
      this.logger.info('  ✓ Pre-commit hooks - Automatic checks');
      this.logger.info('\nRun: npm run qa:fix to auto-fix all issues');
      this.logger.info('Then: sork setup-hooks to enable security checks');
    } catch (error) {
      this.logger.error(
        `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
