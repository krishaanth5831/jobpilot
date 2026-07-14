// Turns the structured profile (extracted once at upload) into a clean
// markdown resume. It's the starting point the studio editor loads, the
// "reset to my uploaded resume" target, and the fallback the PDF uses before
// anything is saved. Pure JS (no deps) so it runs on the server (PDF) and in
// the browser (editor) alike. The shape matches lib/resume-markdown.js's
// parser: `# name`, a contact line, `## section`, `### sub`, and `- bullet`.

export function profileToMarkdown(profile) {
  if (!profile) return "";
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`# ${profile.name || "Your Name"}`);
  const contact = [profile.email, profile.location].filter(Boolean).join(" · ");
  if (contact) push(contact);
  push();

  const experience = profile.experience ?? [];
  if (experience.length) {
    push("## Experience");
    for (const job of experience) {
      const head = [job.title, job.company].filter(Boolean).join(" · ");
      if (head) push(`### ${head}`);
      if (job.duration) push(job.duration);
      for (const h of job.highlights ?? []) push(`- ${h}`);
      push();
    }
  }

  const projects = profile.projects ?? [];
  if (projects.length) {
    push("## Projects");
    for (const p of projects) {
      if (p.name) push(`### ${p.name}`);
      if (p.description) push(p.description);
      if (p.technologies?.length) push(`- ${p.technologies.join(", ")}`);
      push();
    }
  }

  const education = profile.education ?? [];
  if (education.length) {
    push("## Education");
    for (const e of education) {
      const degree = [e.degree, e.field].filter(Boolean).join(", ");
      const head = [degree, e.institution].filter(Boolean).join(" · ");
      if (head) push(`### ${head}`);
      if (e.graduation_year) push(e.graduation_year);
      push();
    }
  }

  const skills = (profile.skills ?? []).filter(Boolean);
  if (skills.length) {
    push("## Skills");
    push(skills.join(" · "));
    push();
  }

  return lines.join("\n").trim() + "\n";
}
