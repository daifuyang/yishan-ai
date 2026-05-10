import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface SkillMetadata {
  name: string;
  version?: string;
  description: string;
  metadata?: {
    requires?: {
      bins?: string[];
    };
    cliHelp?: string;
  };
}

export interface SkillFile {
  path: string;
  contents?: string;
}

export interface Skill {
  name: string;
  path: string;
  metadata: SkillMetadata;
  content: string;
  files: SkillFile[];
  enabled: boolean;
}

interface SkillConfig {
  skills: Record<string, { enabled?: boolean }>;
}

export class SkillManager {
  private skillsDir: string;
  private configPath: string;
  private skills: Map<string, Skill> = new Map();
  private config: SkillConfig = { skills: {} };

  constructor(configDir?: string) {
    const homeDir = os.homedir();
    const yishanDir = configDir || path.join(homeDir, '.yishan-ai');
    this.skillsDir = path.join(yishanDir, 'skills');
    this.configPath = path.join(yishanDir, 'skills-config.json');

    if (!fs.existsSync(yishanDir)) {
      fs.mkdirSync(yishanDir, { recursive: true });
    }
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  async loadConfig(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      this.config = { skills: {} };
      return;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(content);
    } catch (err) {
      console.error('Failed to load skills config:', err);
      this.config = { skills: {} };
    }
  }

  async saveConfig(): Promise<void> {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async scanSkills(): Promise<Skill[]> {
    await this.loadConfig();
    this.skills.clear();

    if (!fs.existsSync(this.skillsDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(this.skillsDir, entry.name);
      const skillFilePath = path.join(skillPath, 'SKILL.md');

      if (!fs.existsSync(skillFilePath)) continue;

      try {
        const skill = await this.loadSkillFromPath(entry.name, skillPath);
        this.skills.set(entry.name, skill);
      } catch (err) {
        console.error(`Failed to load skill "${entry.name}":`, err);
      }
    }

    return Array.from(this.skills.values());
  }

  private async loadSkillFromPath(name: string, skillPath: string): Promise<Skill> {
    const skillFilePath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillFilePath, 'utf-8');
    const metadata = this.parseSkillMetadata(content);

    const files = await this.scanSkillFiles(skillPath);

    const enabled = this.config.skills[name]?.enabled ?? true;

    return {
      name,
      path: skillPath,
      metadata,
      content,
      files,
      enabled,
    };
  }

  private async scanSkillFiles(skillPath: string): Promise<SkillFile[]> {
    const files: SkillFile[] = [];

    const scanDir = (dirPath: string, basePath: string = skillPath) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
          scanDir(fullPath, basePath);
        } else {
          files.push({
            path: relativePath,
            contents: fs.readFileSync(fullPath, 'utf-8'),
          });
        }
      }
    };

    scanDir(skillPath);
    return files;
  }

  parseSkillMetadata(content: string): SkillMetadata {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return {
        name: '',
        description: '',
      };
    }

    try {
      const frontmatterStr = frontmatterMatch[1];

      const extractValue = (key: string): string | undefined => {
        const patterns = [
          new RegExp(`^${key}:\\s*["']([^"']*)["']`, 'm'),
          new RegExp(`^${key}:\\s*\\[(.*?)\\]`, 'm'),
          new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'),
        ];
        for (const pattern of patterns) {
          const match = frontmatterStr.match(pattern);
          if (match) {
            return match[1].trim();
          }
        }
        return undefined;
      };

      const name = extractValue('name') || '';
      const version = extractValue('version');
      const description = extractValue('description') || '';

      const metadata: SkillMetadata['metadata'] = {};
      const binsMatch = frontmatterStr.match(/bins:\s*\[(.*?)\]/);
      if (binsMatch) {
        metadata.requires = {
          bins: binsMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')),
        };
      }
      const cliHelp = extractValue('cliHelp');
      if (cliHelp) {
        metadata.cliHelp = cliHelp;
      }

      return {
        name,
        version,
        description,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } catch (err) {
      console.error('Failed to parse frontmatter:', err);
      return {
        name: '',
        description: '',
      };
    }
  }

  async getSkill(name: string): Promise<Skill | null> {
    if (this.skills.size === 0) {
      await this.scanSkills();
    }
    return this.skills.get(name) || null;
  }

  async addSkill(name: string, skillContent: string): Promise<Skill> {
    const skillPath = path.join(this.skillsDir, name);

    if (fs.existsSync(skillPath)) {
      throw new Error(`Skill "${name}" already exists`);
    }

    fs.mkdirSync(skillPath, { recursive: true });
    fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillContent);

    const skill = await this.loadSkillFromPath(name, skillPath);
    this.skills.set(name, skill);

    if (!this.config.skills[name]) {
      this.config.skills[name] = { enabled: true };
    }
    await this.saveConfig();

    return skill;
  }

  async updateSkill(name: string, skillContent: string): Promise<Skill> {
    const skillPath = path.join(this.skillsDir, name);

    if (!fs.existsSync(skillPath)) {
      throw new Error(`Skill "${name}" not found`);
    }

    fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillContent);

    const skill = await this.loadSkillFromPath(name, skillPath);
    this.skills.set(name, skill);

    return skill;
  }

  async removeSkill(name: string): Promise<void> {
    const skillPath = path.join(this.skillsDir, name);

    if (!fs.existsSync(skillPath)) {
      throw new Error(`Skill "${name}" not found`);
    }

    fs.rmSync(skillPath, { recursive: true, force: true });
    this.skills.delete(name);
    delete this.config.skills[name];
    await this.saveConfig();
  }

  async setSkillEnabled(name: string, enabled: boolean): Promise<void> {
    if (!this.config.skills[name]) {
      this.config.skills[name] = {};
    }
    this.config.skills[name].enabled = enabled;
    await this.saveConfig();

    const skill = this.skills.get(name);
    if (skill) {
      skill.enabled = enabled;
    }
  }

  getSkillFile(name: string, filePath: string): string | null {
    const skill = this.skills.get(name);
    if (!skill) return null;

    const file = skill.files.find((f) => f.path === filePath);
    return file?.contents || null;
  }

  async getEnabledSkills(): Promise<Skill[]> {
    if (this.skills.size === 0) {
      await this.scanSkills();
    }
    return Array.from(this.skills.values()).filter((s) => s.enabled);
  }
}

let skillManager: SkillManager | null = null;

export function getSkillManager(): SkillManager {
  if (!skillManager) {
    skillManager = new SkillManager();
  }
  return skillManager;
}
