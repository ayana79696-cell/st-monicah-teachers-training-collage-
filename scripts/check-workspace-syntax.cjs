const fs = require('node:fs');
const ts = require('typescript');
const file = 'app/workspace/page.tsx';
const sourceText = fs.readFileSync(file, 'utf8');
const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (source.parseDiagnostics.length) {
  for (const diagnostic of source.parseDiagnostics) {
    const position = source.getLineAndCharacterOfPosition(diagnostic.start || 0);
    console.error(`TSX syntax diagnostic at ${position.line + 1}:${position.character + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
  process.exit(1);
}
console.log('Workspace TSX parser check passed.');
