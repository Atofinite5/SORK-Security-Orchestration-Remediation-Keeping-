# Code Quality Guide

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
- Custom validation schemas in `src/validators/`

## 🚀 Workflow

### Before Committing
```bash
npm run qa:fix     # Auto-fix all issues
git add .
git commit -m "message"  # SORK pre-commit hook runs automatically
```

### Quality Checks
```bash
npm run lint       # Check linting
npm run format:check  # Check formatting
npm run type-check # Check TypeScript types
npm run qa         # Run all checks
```

## 📋 Validation Examples

### Environment Variables
```typescript
import { validateEnv } from './validators';

const env = validateEnv(); // Throws ZodError if invalid
console.log(env.NODE_ENV); // Type-safe!
```

### API Responses
```typescript
import { validateApiResponse } from './validators';

const response = await fetch('/api/user');
const data = validateApiResponse(await response.json()); // Validated!
```

## 🔍 SORK Integration

When you run `sork init && sork setup-hooks`:
1. Security vulnerabilities are automatically detected
2. Prettier & ESLint run before every commit
3. Zod validates all data flows
4. Pre-commit hook blocks unsafe commits

## ❓ Need Help?

- `sork --help` - See SORK commands
- `npm run qa:fix` - Auto-fix all issues
- Check `src/validators/` for validation schemas
