import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSkillManager } from '../lib/skill-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadTemplate(filename: string): string {
  const templatePath = path.join(__dirname, 'prompt', filename);
  return fs.readFileSync(templatePath, 'utf-8');
}

export interface PromptContext {
  workDir: string;
  sandboxDirs: string[];
  toolList: string;
  skills: string;
}

export interface PromptSection {
  name: string;
  order: number;
  render(ctx: PromptContext): string | null;
}

const personaSection: PromptSection = {
  name: 'persona',
  order: 0,
  render() {
    return loadTemplate('persona.txt');
  },
};

const environmentSection: PromptSection = {
  name: 'environment',
  order: 10,
  render(ctx) {
    return loadTemplate('environment.txt')
      .replace('{{WORK_DIR}}', ctx.workDir || '需配置')
      .replace(
        '{{SANDBOX_DIRS}}',
        ctx.sandboxDirs.length > 0 ? ctx.sandboxDirs.join('、') : '需配置'
      );
  },
};

const toolsGuidanceSection: PromptSection = {
  name: 'tools-guidance',
  order: 20,
  render(ctx) {
    return loadTemplate('tools-guidance.txt').replace('{{TOOL_LIST}}', ctx.toolList || '无');
  },
};

const skillCatalogSection: PromptSection = {
  name: 'skill-catalog',
  order: 30,
  render(ctx) {
    if (ctx.skills === '无') return null;
    return loadTemplate('skill-catalog.txt').replace('{{SKILLS}}', ctx.skills);
  },
};

const builtinSections: PromptSection[] = [
  personaSection,
  environmentSection,
  toolsGuidanceSection,
  skillCatalogSection,
];

function assembleSections(sections: PromptSection[], ctx: PromptContext): string {
  return sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => s.render(ctx))
    .filter((content): content is string => content !== null)
    .join('\n\n');
}

export interface SystemPromptOptions {
  workDir: string;
  sandboxDirs: string[];
  toolList: string;
}

export async function buildSystemPrompt(options: SystemPromptOptions): Promise<{
  prompt: string;
}> {
  const { workDir, sandboxDirs, toolList } = options;

  const skillManager = getSkillManager();
  const enabledSkills = await skillManager.getEnabledSkills();

  const skillsContent =
    enabledSkills.length > 0
      ? enabledSkills.map((s) => `【${s.metadata.name}】\n${s.content}`).join('\n\n')
      : '无';

  const ctx: PromptContext = { workDir, sandboxDirs, toolList, skills: skillsContent };

  const prompt = assembleSections(builtinSections, ctx);

  return { prompt };
}
