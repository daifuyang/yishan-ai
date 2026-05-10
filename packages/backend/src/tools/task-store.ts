import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

const TASK_FILE = path.join(os.homedir(), '.yishan-ai/tasks.md');

function ensureDir(): void {
  const dir = path.dirname(TASK_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function acquireLock(): { release: () => void } {
  const lockFile = `${TASK_FILE}.lock`;
  while (fs.existsSync(lockFile)) {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    wait(10);
  }
  fs.writeFileSync(lockFile, String(process.pid));
  return {
    release: () => {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
    },
  };
}

function parseTasks(content: string): Map<string, Task> {
  const tasks = new Map<string, Task>();
  const lines = content.split('\n');
  let currentTask: Task | null = null;

  for (const line of lines) {
    const taskMatch = line.match(/^- \[([ x!])\]\s+(\S+):\s+(.+)$/);
    if (taskMatch) {
      const statusChar = taskMatch[1];
      let status: Task['status'];
      if (statusChar === 'x') status = 'completed';
      else if (statusChar === '!') status = 'failed';
      else status = 'pending';

      const id = taskMatch[2];
      const description = taskMatch[3];
      currentTask = {
        id,
        description,
        status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      tasks.set(id, currentTask);
      continue;
    }

    if (currentTask && line.startsWith('  ')) {
      const metaMatch = line.match(/^\s+(\w+):\s*(.*)$/);
      if (metaMatch) {
        const key = metaMatch[1];
        const value = metaMatch[2].trim();
        if (key === 'created') currentTask.createdAt = new Date(value).getTime();
        if (key === 'updated') currentTask.updatedAt = new Date(value).getTime();
        if (key === 'completed') currentTask.completedAt = new Date(value).getTime();
        if (key === 'result') currentTask.result = value;
      }
    }
  }

  return tasks;
}

function formatTasks(tasks: Map<string, Task>): string {
  const lines: string[] = ['# tasks', ''];

  const sortedTasks = Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);

  for (const task of sortedTasks) {
    let statusChar = ' ';
    if (task.status === 'completed') statusChar = 'x';
    if (task.status === 'failed') statusChar = '!';
    lines.push(`- [${statusChar}] ${task.id}: ${task.description}`);
    lines.push(`  created: ${new Date(task.createdAt).toISOString()}`);
    lines.push(`  updated: ${new Date(task.updatedAt).toISOString()}`);
    lines.push(`  status: ${task.status}`);
    if (task.completedAt) {
      lines.push(`  completed: ${new Date(task.completedAt).toISOString()}`);
    }
    if (task.result) {
      lines.push(`  result: ${task.result}`);
    }
  }

  return lines.join('\n');
}

export function loadTasks(): Map<string, Task> {
  ensureDir();
  if (!fs.existsSync(TASK_FILE)) {
    return new Map();
  }
  try {
    const content = fs.readFileSync(TASK_FILE, 'utf8');
    return parseTasks(content);
  } catch {
    return new Map();
  }
}

export function saveTasks(tasks: Map<string, Task>): void {
  ensureDir();
  const content = formatTasks(tasks);
  const lock = acquireLock();
  try {
    fs.writeFileSync(TASK_FILE, content, 'utf8');
  } finally {
    lock.release();
  }
}

export function createTask(description: string): Task {
  const tasks = loadTasks();
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const task: Task = {
    id,
    description,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.set(id, task);
  saveTasks(tasks);
  return task;
}

export function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'description' | 'status' | 'result'>>
): Task | null {
  const tasks = loadTasks();
  const task = tasks.get(id);
  if (!task) return null;

  if (updates.description !== undefined) task.description = updates.description;
  if (updates.result !== undefined) task.result = updates.result;
  if (updates.status !== undefined) {
    task.status = updates.status;
    if (updates.status === 'completed' || updates.status === 'failed') {
      task.completedAt = Date.now();
    }
  }
  task.updatedAt = Date.now();

  tasks.set(id, task);
  saveTasks(tasks);
  return task;
}

export function deleteTask(id: string): boolean {
  const tasks = loadTasks();
  if (!tasks.has(id)) return false;
  tasks.delete(id);
  saveTasks(tasks);
  return true;
}

export function getTask(id: string): Task | null {
  const tasks = loadTasks();
  return tasks.get(id) || null;
}

export function listTasks(): Task[] {
  const tasks = loadTasks();
  return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
}
