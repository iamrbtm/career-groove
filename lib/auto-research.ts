import { db } from "./db";
import { researchUrl, researchCompany } from "./research";
import { parseJobPost } from "./job-post-parser";

function summarize(text: string, maxLength = 300): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function extractSentences(text: string, count = 3): string {
  const sentences = text.match(/[^.!?\n]+[.!?]/g) || [text];
  return sentences.slice(0, count).join(" ").trim();
}

export async function autoResearchApplication(
  applicationId: string,
  userId: string,
  sourceUrl: string | null,
  companyName: string,
  jobDescription: string,
) {
  try {
    let result;
    if (sourceUrl) {
      result = await researchUrl(sourceUrl);
    } else if (companyName) {
      result = await researchCompany(companyName);
    } else {
      await db.query(
        `UPDATE applications SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{autoResearch}', $3::jsonb, true) WHERE id=$1 AND user_id=$2`,
        [applicationId, userId, JSON.stringify({ status: "unsupported", reason: "No URL or company name to research." })],
      );
      return;
    }

    const parsed = result.jobPosting || parseJobPost({ text: jobDescription, sourceUrl: sourceUrl || undefined, fallbackCompany: companyName });

    const companyAbout = result.companyWebsiteText ? summarize(result.companyWebsiteText) : "";
    const searchText = result.searchSnippets.join(". ");

    const mission = companyAbout
      ? extractSentences(companyAbout, 2)
      : searchText
        ? summarize(searchText, 200)
        : "";

    const market = [companyAbout ? extractSentences(companyAbout.slice(200), 2) : "", searchText ? summarize(searchText, 200) : ""]
      .filter(Boolean).join("\n");

    const interest = parsed?.mustHaveSkills?.length
      ? `This role matches skills including: ${parsed.mustHaveSkills.slice(0, 6).join(", ")}.`
      : "";

    const redFlags = [parsed?.redFlags?.length ? parsed.redFlags.join(", ") : "", parsed?.missingDetails?.length ? `Missing: ${parsed.missingDetails.slice(0, 3).join("; ")}.` : ""]
      .filter(Boolean).join("\n");

    const questions = parsed?.screeningQuestions?.length
      ? parsed.screeningQuestions.slice(0, 4).map((q) => `- ${q}`).join("\n")
      : "What is the team structure?\nWhat does success look like in the first 90 days?\nWhat are the biggest challenges the team faces?";

    const researchData = {
      status: "done",
      mission,
      market,
      interest,
      redFlags,
      questions,
      summary: parsed?.summary || "",
      skills: parsed?.mustHaveSkills || [],
      sources: result.sources,
    };

    await db.query(
      `UPDATE applications SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{autoResearch}', $3::jsonb, true) WHERE id=$1 AND user_id=$2`,
      [applicationId, userId, JSON.stringify(researchData)],
    );
  } catch (error) {
    console.error("Auto-research failed", error);
    await db.query(
      `UPDATE applications SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{autoResearch}', $3::jsonb, true) WHERE id=$1 AND user_id=$2`,
      [applicationId, userId, JSON.stringify({ status: "failed", reason: "Could not fetch or analyze company info for this role." })],
    );
  }
}
