import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, '..');
const frontendDir = resolve(backendDir, '../frontend');
const publicDir = resolve(backendDir, 'public');

console.log('Building frontend...');
execSync('pnpm build', { cwd: frontendDir, stdio: 'inherit' });

console.log('Copying frontend build to public directory...');
if (existsSync(publicDir)) {
  rmSync(publicDir, { recursive: true });
}

execSync(`mkdir -p "${resolve(publicDir, '_next')}"`, { shell: '/bin/bash' });
execSync(`cp -r "${resolve(frontendDir, '.next', 'static')}" "${publicDir}/_next/static"`, {
  shell: '/bin/bash',
});
execSync(`cp -f "${resolve(frontendDir, '.next', 'BUILD_ID')}" "${publicDir}/"`, {
  shell: '/bin/bash',
});

const serverAppDir = resolve(frontendDir, '.next', 'server', 'app');

const rootHtmlFiles = [
  'index.html',
  'history.html',
  'preview.html',
  'settings.html',
  '_not-found.html',
];
for (const file of rootHtmlFiles) {
  const srcPath = resolve(serverAppDir, file);
  if (existsSync(srcPath)) {
    execSync(`cp -f "${srcPath}" "${publicDir}/"`, { shell: '/bin/bash' });
  }
}

const subDirs = ['settings'];
for (const subDir of subDirs) {
  const srcSubDir = resolve(serverAppDir, subDir);
  if (!existsSync(srcSubDir)) continue;

  execSync(`mkdir -p "${resolve(publicDir, subDir)}"`, { shell: '/bin/bash' });
  const files = execSync(`ls "${srcSubDir}"`, { shell: '/bin/bash' }).toString().split('\n');
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    execSync(`cp -f "${resolve(srcSubDir, file)}" "${resolve(publicDir, subDir, file)}"`, {
      shell: '/bin/bash',
    });
  }
}

console.log('Frontend build copied successfully.');
