export async function GET() {
  return Response.json({
    methods: {
      credentials: true,
      apple: Boolean(process.env.AUTH_APPLE_IOS_CLIENT_ID),
      google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
      passkey: process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS === "true",
    },
    tokenPolicy: { accessTokenLifetimeSeconds: 900, refreshTokenLifetimeSeconds: 2592000 },
  }, { headers: { "Cache-Control": "private, max-age=60" } });
}
