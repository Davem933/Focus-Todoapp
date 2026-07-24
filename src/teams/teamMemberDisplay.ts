export function getMemberDisplayName(member: { email: string; nickname?: string | null }) {
  const nickname = member.nickname?.trim();

  if (nickname) {
    return nickname;
  }

  return member.email.split("@")[0] || member.email;
}

export function getMemberInitials(member: { email: string; nickname?: string | null }) {
  const name = getMemberDisplayName(member);
  const parts = name.split(/[._\-\s]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}
