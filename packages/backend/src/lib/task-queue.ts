interface Task {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: number;
}

class TaskQueue {
  private tasks = new Map<string, Task>();

  submit(id: string, executor: () => Promise<string>): Task {
    const task: Task = { id, status: 'pending', createdAt: Date.now() };
    this.tasks.set(id, task);

    setImmediate(async () => {
      task.status = 'running';
      try {
        task.result = await executor();
        task.status = 'completed';
      } catch (err) {
        task.error = String(err);
        task.status = 'failed';
      }
    });

    return task;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }
}

export const taskQueue = new TaskQueue();