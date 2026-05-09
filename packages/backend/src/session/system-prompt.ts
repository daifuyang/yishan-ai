import { getSkillManager } from '../lib/skill-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadTemplate(filename: string): string {
  const templatePath = path.join(__dirname, 'prompt', filename);
  return fs.readFileSync(templatePath, 'utf-8');
}

const PROMPT_DEFAULT = loadTemplate('default.txt');
const PROMPT_PLAN = loadTemplate('plan.txt');

export interface SystemPromptOptions {
  mode: 'plan' | 'build';
  workDir: string;
  sandboxDirs: string[];
  toolList: string;
}

function generateBuildSwitch(): string {
  return `<system-reminder>
Your operational mode has changed from plan to build.
You are no longer in read-only mode.
You are permitted to make file changes, run shell commands, and utilize your arsenal of tools as needed.
</system-reminder>`;
}

export async function buildSystemPrompt(options: SystemPromptOptions): Promise<{
  basePrompt: string;
  planReminder: string;
  buildSwitch: string;
}> {
  const { workDir, sandboxDirs, toolList } = options;

  const skillManager = getSkillManager();
  const enabledSkills = await skillManager.getEnabledSkills();

  const skillsContent = enabledSkills.length > 0
    ? enabledSkills.map(s => `【${s.metadata.name}】\n${s.content}`).join('\n\n')
    : '无';

  const basePrompt = PROMPT_DEFAULT
    .replace('{{WORK_DIR}}', workDir || '需配置')
    .replace('{{SANDBOX_DIRS}}', sandboxDirs.length > 0 ? sandboxDirs.join('、') : '需配置')
    .replace('{{TOOL_LIST}}', toolList || '无')
    .replace('{{SKILLS}}', skillsContent);

  return {
    basePrompt,
    planReminder: PROMPT_PLAN,
    buildSwitch: generateBuildSwitch(),
  };
}