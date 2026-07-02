export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export type Project = {
  id: string;
  teamId: string;
  createdBy: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectColumn = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};
