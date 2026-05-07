export interface Task {
  id: string;
  description: string;
  type: "research" | "code" | "test" | "verify";
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
}

export interface TaskPlan {
  objective: string;
  tasks: Task[];
  raw?: string;
}

export class TaskPlanner {
  async plan(objective: string, complete: (prompt: string) => Promise<string>): Promise<TaskPlan> {
    const raw = await complete(`Create an execution plan for this coding task.
Return only JSON in this shape:
[
  {"id":"short-id","description":"specific action","type":"research|code|test|verify","dependencies":[]}
]

Task:
${objective}`);
    const parsed = JSON.parse(raw) as Array<{
      id: string;
      description: string;
      type: Task["type"];
      dependencies?: string[];
    }>;
    return {
      objective,
      raw,
      tasks: parsed.map((task) => ({
        id: task.id,
        description: task.description,
        type: task.type,
        dependencies: task.dependencies ?? [],
        status: "pending",
      })),
    };
  }
}
