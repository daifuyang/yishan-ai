import * as fs from 'node:fs';
import * as path from 'node:path';

export function isPathContained(target: string, allowedRoot: string): boolean {
  try {
    const resolvedTarget = fs.realpathSync(path.resolve(target));
    const resolvedRoot = fs.realpathSync(path.resolve(allowedRoot));
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
  } catch {
    const parent = path.dirname(path.resolve(target));
    try {
      const resolvedParent = fs.realpathSync(parent);
      const resolvedRoot = fs.realpathSync(path.resolve(allowedRoot));
      return resolvedParent === resolvedRoot || resolvedParent.startsWith(resolvedRoot + path.sep);
    } catch {
      return false;
    }
  }
}
