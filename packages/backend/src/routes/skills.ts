import type { FastifyPluginAsync } from 'fastify';
import { getSkillManager } from '../lib/skill-manager.js';

const skillRoutes: FastifyPluginAsync = async (fastify) => {
  const skillManager = getSkillManager();

  await skillManager.scanSkills();

  fastify.get('/api/skills', async () => {
    const skills = await skillManager.scanSkills();
    return skills.map((skill) => ({
      name: skill.name,
      version: skill.metadata.version,
      description: skill.metadata.description,
      metadata: skill.metadata.metadata,
      enabled: skill.enabled,
      path: skill.path,
      files: skill.files.map((f) => ({ path: f.path })),
    }));
  });

  fastify.post('/api/skills', async (request) => {
    const { name, content } = request.body as { name: string; content: string };
    if (!name || !content) {
      throw new Error('name and content are required');
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error('name must be lowercase letters, numbers, and hyphens only');
    }

    const skill = await skillManager.addSkill(name, content);
    return {
      success: true,
      skill: {
        name: skill.name,
        version: skill.metadata.version,
        description: skill.metadata.description,
        metadata: skill.metadata.metadata,
        enabled: skill.enabled,
      },
    };
  });

  fastify.get('/api/skills/:name', async (request) => {
    const { name } = request.params as { name: string };
    const skill = await skillManager.getSkill(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }
    return {
      name: skill.name,
      version: skill.metadata.version,
      description: skill.metadata.description,
      metadata: skill.metadata.metadata,
      content: skill.content,
      enabled: skill.enabled,
      files: skill.files,
    };
  });

  fastify.put('/api/skills/:name', async (request) => {
    const { name } = request.params as { name: string };
    const { content } = request.body as { content: string };
    if (!content) {
      throw new Error('content is required');
    }

    const skill = await skillManager.updateSkill(name, content);
    return {
      success: true,
      skill: {
        name: skill.name,
        version: skill.metadata.version,
        description: skill.metadata.description,
        metadata: skill.metadata.metadata,
        enabled: skill.enabled,
      },
    };
  });

  fastify.delete('/api/skills/:name', async (request) => {
    const { name } = request.params as { name: string };
    await skillManager.removeSkill(name);
    return { success: true };
  });

  fastify.post('/api/skills/:name/enable', async (request) => {
    const { name } = request.params as { name: string };
    await skillManager.setSkillEnabled(name, true);
    return { success: true };
  });

  fastify.post('/api/skills/:name/disable', async (request) => {
    const { name } = request.params as { name: string };
    await skillManager.setSkillEnabled(name, false);
    return { success: true };
  });

  fastify.get('/api/skills/:name/files/*', async (request) => {
    const { name, '*': filePath } = request.params as { name: string; '*': string };
    const content = skillManager.getSkillFile(name, filePath);
    if (!content) {
      throw new Error(`File "${filePath}" not found in skill "${name}"`);
    }
    return { content };
  });
};

export default skillRoutes;
