export type Team = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  ownerId: string;
};

export type TeamMember = {
  createdAt: string;
  email: string;
  nickname: string | null;
  role: "admin" | "member";
  userId: string;
};

export type TeamInvite = {
  createdAt: string;
  email: string;
  id: string;
  role: "member";
  status: "pending" | "accepted" | "cancelled";
};
