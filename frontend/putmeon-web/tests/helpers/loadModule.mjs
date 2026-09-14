import { readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import ts from 'typescript';

// Compile pure TypeScript modules in memory without generating build artifacts.
export function moduleUrl(path) {
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const bundled = compiled.replace(
    /(from\s+['"])(\.[^'"]+)(['"])/g,
    (_match, prefix, dependency, suffix) => {
      const target = resolve(dirname(path), dependency + (extname(dependency) ? '' : '.ts'));
      return prefix + moduleUrl(target) + suffix;
    },
  );
  return `data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`;
}
