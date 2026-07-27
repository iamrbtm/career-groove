export const followUpTypes = [
  "general_check",
  "recruiter_follow_up",
  "thank_you",
  "post_interview",
  "networking",
  "negotiation",
  "re_engagement",
] as const;

export type FollowUpType = (typeof followUpTypes)[number];

export const followUpTypeLabels: Record<FollowUpType, string> = {
  general_check: "General check-in",
  recruiter_follow_up: "Recruiter follow-up",
  thank_you: "Thank-you note",
  post_interview: "Post-interview follow-up",
  networking: "Networking outreach",
  negotiation: "Offer negotiation",
  re_engagement: "Re-engagement",
};

export const followUpTypeDescriptions: Record<FollowUpType, string> = {
  general_check: "A friendly check-in on your application status.",
  recruiter_follow_up: "A polite nudge to a recruiter or hiring manager.",
  thank_you: "A thank-you note after an interview or conversation.",
  post_interview: "A follow-up after a final round or take-home assignment.",
  networking: "Reaching out to a contact for advice or referral.",
  negotiation: "Discussing offer terms or compensation.",
  re_engagement: "Reconnecting after a period of no response.",
};

export const defaultCampaignSequence: FollowUpType[] = [
  "general_check",
  "recruiter_follow_up",
  "thank_you",
  "post_interview",
];

export function buildFollowUpSubject(type: FollowUpType, applicationTitle: string, company: string): string {
  const subjects: Record<FollowUpType, string> = {
    general_check: `Checking in on ${applicationTitle} at ${company}`,
    recruiter_follow_up: `Following up on ${applicationTitle} application — ${company}`,
    thank_you: `Thank you — ${applicationTitle} at ${company}`,
    post_interview: `Following up after my interview — ${applicationTitle} at ${company}`,
    networking: `Connecting about ${company} — ${applicationTitle}`,
    negotiation: `Question about the offer — ${applicationTitle} at ${company}`,
    re_engagement: `Still interested in ${applicationTitle} at ${company}`,
  };
  return subjects[type];
}

export function getDefaultDelay(type: FollowUpType): number {
  const delays: Record<FollowUpType, number> = {
    general_check: 7,
    recruiter_follow_up: 7,
    thank_you: 1,
    post_interview: 5,
    networking: 3,
    negotiation: 2,
    re_engagement: 14,
  };
  return delays[type];
}

export function buildFollowUpSystemPrompt(type: FollowUpType): string {
  const prompts: Record<FollowUpType, string> = {
    general_check:
      "Draft a concise, friendly check-in email to a hiring manager or recruiter. Express continued interest, briefly restate why you're a strong fit, and ask for a status update politely. Keep it to 3-4 sentences.",
    recruiter_follow_up:
      "Draft a polite follow-up email to a recruiter after submitting an application. Reference the role, restate enthusiasm, offer to provide any additional information, and ask for an update. Keep it professional and concise.",
    thank_you:
      "Draft a warm thank-you email after an interview. Reference something specific from the conversation, reiterate enthusiasm for the role and company, and mention briefly why you believe you're a great fit. Keep it to 3-4 sentences.",
    post_interview:
      "Draft a thoughtful post-interview follow-up email. Reference the specific interview round, express continued enthusiasm, briefly add any points you forgot to mention, and reiterate your interest. Keep it professional and warm.",
    networking:
      "Draft a networking outreach message. Be respectful of their time, mention any common ground (alma mater, mutual contact, shared interest), state your specific ask clearly, and make it easy for them to respond. Keep it to 4-5 sentences.",
    negotiation:
      "Draft a professional offer negotiation email. Express gratitude for the offer, state your specific request (salary, equity, start date, etc.) with a brief rationale, and reaffirm enthusiasm for the role. Keep it confident and respectful.",
    re_engagement:
      "Draft a re-engagement email after a period of no response. Reference the original application or conversation, politely check if the role is still open or if there are updates, and reaffirm your interest. Keep it light and professional.",
  };
  return prompts[type];
}
