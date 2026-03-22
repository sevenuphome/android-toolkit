export interface GradleTask {
  name: string;
  description: string;
  group: string;
  modulePath: string;
  fullTaskPath: string;
}

export interface TaskGroup {
  name: string;
  tasks: GradleTask[];
}
