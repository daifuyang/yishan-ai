import { create } from 'zustand';

export interface SkillMetadata {
  requires?: {
    bins?: string[];
  };
  cliHelp?: string;
}

export interface Skill {
  name: string;
  version?: string;
  description: string;
  metadata?: SkillMetadata;
  content?: string;
  enabled: boolean;
  path?: string;
  files?: { path: string }[];
}

interface SkillStore {
  skills: Skill[];
  fetchSkills: () => Promise<void>;
  addSkill: (name: string, content: string) => Promise<void>;
  updateSkill: (name: string, content: string) => Promise<void>;
  removeSkill: (name: string) => Promise<void>;
  enableSkill: (name: string) => Promise<void>;
  disableSkill: (name: string) => Promise<void>;
}

const API_BASE = '';

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],

  fetchSkills: async () => {
    const res = await fetch(`${API_BASE}/api/skills`);
    const skills = await res.json();
    set({ skills });
  },

  addSkill: async (name: string, content: string) => {
    await fetch(`${API_BASE}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    });
    await get().fetchSkills();
  },

  updateSkill: async (name: string, content: string) => {
    await fetch(`${API_BASE}/api/skills/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    await get().fetchSkills();
  },

  removeSkill: async (name: string) => {
    await fetch(`${API_BASE}/api/skills/${name}`, { method: 'DELETE' });
    await get().fetchSkills();
  },

  enableSkill: async (name: string) => {
    await fetch(`${API_BASE}/api/skills/${name}/enable`, { method: 'POST' });
    await get().fetchSkills();
  },

  disableSkill: async (name: string) => {
    await fetch(`${API_BASE}/api/skills/${name}/disable`, { method: 'POST' });
    await get().fetchSkills();
  },
}));