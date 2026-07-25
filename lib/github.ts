import { Octokit } from "@octokit/rest";

function client() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

export async function createFeedbackIssue(input: { title: string; body: string; labels?: string[] }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) throw new Error("GITHUB_OWNER and GITHUB_REPO are required");
  const issue = await client().issues.create({ owner, repo, ...input });
  if (process.env.GITHUB_PROJECT_ID) await addIssueToProject(issue.data.node_id);
  return issue.data;
}

export async function addIssueToProject(contentId: string) {
  const projectId = process.env.GITHUB_PROJECT_ID;
  if (!projectId) return null;
  return client().graphql(
    `mutation($project: ID!, $content: ID!) { addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } } }`,
    { project: projectId, content: contentId },
  );
}
