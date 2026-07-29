import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName, getMemberInitials } from "../../../teams/teamMemberDisplay";

export function AssigneeAvatar({ member }: { member: TeamMember | null }) {
  if (!member) {
    return <span className="table-assignee-avatar table-assignee-avatar--empty">Nepriřazeno</span>;
  }

  return (
    <span className="table-assignee-avatar">
      <span className="table-assignee-avatar__initials" aria-hidden="true">
        {getMemberInitials(member)}
      </span>
      <span className="table-assignee-avatar__name">{getMemberDisplayName(member)}</span>
    </span>
  );
}
