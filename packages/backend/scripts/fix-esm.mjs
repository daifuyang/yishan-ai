import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = join(__dirname, '..', 'dist', 'generated', 'prisma');

function fixEsmImports(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  content = content.replace(/from ['"](\.[^'"]+)['"]/g, (match, name) => {
    if (!name.endsWith('.js')) {
      return `from '${name}.js'`;
    }
    return match;
  });

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ESM imports in ${filePath}`);
  }
}

function processDir(dir) {
  for (const item of readdirSync(dir)) {
    const fullPath = join(dir, item);
    if (statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (item.endsWith('.js')) {
      fixEsmImports(fullPath);
    }
  }
}

processDir(generatedDir);
console.log('ESM imports fixed.');