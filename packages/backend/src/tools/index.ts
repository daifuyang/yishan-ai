import { createBashTool } from './bash.js';
import { createEditTool } from './edit.js';
import { createGlobTool } from './glob.js';
import { createGrepTool } from './grep.js';
import { createListTool } from './list.js';
import { createReadTool } from './read.js';
import { toolRegistry } from './registry.js';
import { createTaskTool } from './task.js';
import { createTimeTool } from './time.js';
import { createTodoWriteTool } from './todo.js';
import { createWriteTool } from './write.js';

export { registry as toolRegistryInstance, toolRegistry } from './registry.js';
export { sanitize, sanitizeObject } from './sanitize.js';
export type { Task } from './task-store.js';
export { createTask, getTask, listTasks, loadTasks, saveTasks, updateTask } from './task-store.js';
export type { Todo } from './todo-store.js';
export {
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
  loadTodos,
  saveTodos,
  updateTodo,
} from './todo-store.js';
export { cleanupTruncateDir, truncateOutput } from './truncate.js';

export type { JSONSchema, Tool, ToolContext } from './types.js';

function registerAllTools() {
  toolRegistry.register(createBashTool());
  toolRegistry.register(createReadTool());
  toolRegistry.register(createWriteTool());
  toolRegistry.register(createEditTool());
  toolRegistry.register(createListTool());
  toolRegistry.register(createGlobTool());
  toolRegistry.register(createGrepTool());
  toolRegistry.register(createTodoWriteTool());
  toolRegistry.register(createTaskTool());
  toolRegistry.register(createTimeTool());

  console.log(`[Tools] Registered ${toolRegistry.listNames().length} tools`);
}

registerAllTools();
