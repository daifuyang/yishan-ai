import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface Todo {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  content?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

const TODO_FILE = path.join(os.homedir(), '.yishan-ai/todos.md');

function ensureDir(): void {
  const dir = path.dirname(TODO_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function acquireLock(): { release: () => void } {
  const lockFile = `${TODO_FILE}.lock`;
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

function parseTodos(content: string): Map<string, Todo> {
  const todos = new Map<string, Todo>();
  const lines = content.split('\n');
  let currentTodo: Todo | null = null;

  for (const line of lines) {
    const dateMatch = line.match(/^##\s+(.+)$/);
    if (dateMatch) {
      continue;
    }

    const todoMatch = line.match(/^- \[([ x])\]\s+(\S+):\s+(.+)$/);
    if (todoMatch) {
      const status = todoMatch[1] === 'x' ? 'completed' : 'pending';
      const id = todoMatch[2];
      const title = todoMatch[3];
      currentTodo = {
        id,
        title,
        status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      todos.set(id, currentTodo);
      continue;
    }

    if (currentTodo && line.startsWith('  ')) {
      const metaMatch = line.match(/^\s+(\w+):\s*(.+)$/);
      if (metaMatch) {
        const key = metaMatch[1];
        const value = metaMatch[2].trim();
        if (key === 'created') currentTodo.createdAt = new Date(value).getTime();
        if (key === 'updated') currentTodo.updatedAt = new Date(value).getTime();
        if (key === 'completed') currentTodo.completedAt = new Date(value).getTime();
        if (key === 'content') currentTodo.content = value;
        if (key === 'status') currentTodo.status = value as Todo['status'];
      }
    }
  }

  return todos;
}

function formatTodos(todos: Map<string, Todo>): string {
  const lines: string[] = ['# todos', ''];

  const byDate = new Map<string, Todo[]>();
  for (const todo of todos.values()) {
    const date = new Date(todo.createdAt).toISOString().split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)?.push(todo);
  }

  const sortedDates = Array.from(byDate.keys()).sort().reverse();
  for (const date of sortedDates) {
    lines.push(`## ${date}`);
    const dateTodos = byDate.get(date) ?? [];
    dateTodos.sort((a, b) => a.createdAt - b.createdAt);
    for (const todo of dateTodos) {
      const checkbox = todo.status === 'completed' ? 'x' : ' ';
      lines.push(`- [${checkbox}] ${todo.id}: ${todo.title}`);
      lines.push(`  created: ${new Date(todo.createdAt).toISOString()}`);
      lines.push(`  updated: ${new Date(todo.updatedAt).toISOString()}`);
      if (todo.completedAt) {
        lines.push(`  completed: ${new Date(todo.completedAt).toISOString()}`);
      }
      lines.push(`  status: ${todo.status}`);
      if (todo.content) {
        lines.push(`  content: ${todo.content}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function loadTodos(): Map<string, Todo> {
  ensureDir();
  if (!fs.existsSync(TODO_FILE)) {
    return new Map();
  }
  try {
    const content = fs.readFileSync(TODO_FILE, 'utf8');
    return parseTodos(content);
  } catch {
    return new Map();
  }
}

export function saveTodos(todos: Map<string, Todo>): void {
  ensureDir();
  const content = formatTodos(todos);
  const lock = acquireLock();
  try {
    fs.writeFileSync(TODO_FILE, content, 'utf8');
  } finally {
    lock.release();
  }
}

export function createTodo(title: string, content?: string): Todo {
  const todos = loadTodos();
  const id = `todo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const todo: Todo = {
    id,
    title,
    status: 'pending',
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  todos.set(id, todo);
  saveTodos(todos);
  return todo;
}

export function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, 'title' | 'status' | 'content'>>
): Todo | null {
  const todos = loadTodos();
  const todo = todos.get(id);
  if (!todo) return null;

  if (updates.title !== undefined) todo.title = updates.title;
  if (updates.content !== undefined) todo.content = updates.content;
  if (updates.status !== undefined) {
    todo.status = updates.status;
    if (updates.status === 'completed') {
      todo.completedAt = Date.now();
    }
  }
  todo.updatedAt = Date.now();

  todos.set(id, todo);
  saveTodos(todos);
  return todo;
}

export function deleteTodo(id: string): boolean {
  const todos = loadTodos();
  if (!todos.has(id)) return false;
  todos.delete(id);
  saveTodos(todos);
  return true;
}

export function getTodo(id: string): Todo | null {
  const todos = loadTodos();
  return todos.get(id) || null;
}

export function listTodos(): Todo[] {
  const todos = loadTodos();
  return Array.from(todos.values()).sort((a, b) => b.createdAt - a.createdAt);
}
