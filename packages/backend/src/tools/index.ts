import { toolRegistry } from './registry.js'
import { createBashTool } from './bash.js'
import { createReadTool } from './read.js'
import { createWriteTool } from './write.js'
import { createEditTool } from './edit.js'
import { createListTool } from './list.js'
import { createGlobTool } from './glob.js'
import { createGrepTool } from './grep.js'
import { createWebFetchTool } from './webfetch.js'
import { createWebSearchTool } from './websearch.js'
import { createTodoWriteTool } from './todo.js'
import { createTaskTool } from './task.js'

export { toolRegistry, registry as toolRegistryInstance } from './registry.js'
export { sanitize, sanitizeObject } from './sanitize.js'
export { truncateOutput, cleanupTruncateDir } from './truncate.js'
export { logPermission, getPermissionLogs, checkPermission } from './permission-log.js'
export { runInSandbox, readFileInSandbox, writeFileInSandbox, deleteFileInSandbox, listDirInSandbox, globInSandbox, grepInSandbox, stripAnsi } from './docker-sandbox.js'
export { createTodo, updateTodo, deleteTodo, listTodos, getTodo, loadTodos, saveTodos } from './todo-store.js'
export { createTask, updateTask, listTasks, getTask, loadTasks, saveTasks } from './task-store.js'

export type { SandboxConfig, SandboxOptions } from './docker-sandbox.js'
export type { Todo } from './todo-store.js'
export type { Task } from './task-store.js'

export type { Tool, ToolContext, ExecuteResult, ToolDefinition } from './types.js'

function registerAllTools() {
  toolRegistry.register(createBashTool())
  toolRegistry.register(createReadTool())
  toolRegistry.register(createWriteTool())
  toolRegistry.register(createEditTool())
  toolRegistry.register(createListTool())
  toolRegistry.register(createGlobTool())
  toolRegistry.register(createGrepTool())
  toolRegistry.register(createWebFetchTool())
  toolRegistry.register(createWebSearchTool())
  toolRegistry.register(createTodoWriteTool())
  toolRegistry.register(createTaskTool())

  console.log(`[Tools] Registered ${toolRegistry.listNames().length} tools`)
}

registerAllTools()
