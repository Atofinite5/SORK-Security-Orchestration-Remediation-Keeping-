# TODO - Performance & UX Improvements

## Task: Make execution faster + CodeRabbit-like panel + GitHub push hooks

### Steps:

1. **Performance: Optimize lib/security/scanner.ts**:
   - Add parallel file scanning with worker threads
   - Cache results
   - Limit AST parsing for large files

2. **UX: Add CodeRabbit-like panel output in bin/sork.ts**:
   - Show agent panel with status
   - Progress bars for scan/fix operations
   - Better color-coded output

3. **GitHub Push Hook: Update lib/orchestrator.ts and bin/sork.ts**:
   - Add `sork pre-push` command
   - Create pre-push hook for GitHub push
   - Show pop-up notification before push

4. **Update version and publish**:
   - Bump version to 1.3.0
   - Publish to npm
