export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const appId = teamId ? `${teamId}.com.careergroove.careergroove` : null;
  return Response.json({
    webcredentials: { apps: appId ? [appId] : [] },
  }, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
