# CareerGroove Job Capture Extension

This is a Manifest V3 browser extension for saving job posts directly into CareerGroove Tracker Studio.

## Load Locally

1. Run CareerGroove and sign in at `http://localhost:3000`.
2. Open Chrome or Edge extension settings.
3. Enable developer mode.
4. Choose **Load unpacked** and select this `browser-extension` folder.
5. Open a job post, click the CareerGroove extension, review the parsed fields, and choose **Save role**.

The extension stores only the CareerGroove app URL in browser sync storage. Captured posting text is sent to your CareerGroove instance through the existing authenticated `/api/applications/parse` and `/api/applications` routes.

## Production Notes

- Set the popup CareerGroove URL to the deployed HTTPS origin before packaging.
- Keep the user signed in to CareerGroove in the same browser profile.
- The extension uses the active tab content only when the user opens the popup or context-menu capture.
