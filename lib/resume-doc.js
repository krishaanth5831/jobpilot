// Turns the structured profile (extracted once at upload) into a clean
// markdown resume. It's the starting point the studio editor loads, the
// "reset to my uploaded resume" target, and the fallback the PDF uses before
// anything is saved. Pure JS (no deps) so it runs on the server (PDF) and in
// the browser (editor) alike. The shape matches lib/resume-markdown.js's
// parser: `# name`, a contact line, `## section`, `### sub`, and `- bullet`.

// The editable resume document: the resume-visible subset of the profile.
// The studio editor works on this shape, and profileToMarkdown() below turns
// it (or a full profile — same field names) into markdown for the PDF.
export function profileToDoc(profile) {
  const p = profile ?? {};
  return {
    name: p.name ?? "",
    email: p.email ?? "",
    location: p.location ?? "",
    experience: (p.experience ?? []).map((e) => ({
      title: e.title ?? "",
      company: e.company ?? "",
      duration: e.duration ?? "",
      highlights: [...(e.highlights ?? [])],
    })),
    education: (p.education ?? []).map((e) => ({
      degree: e.degree ?? "",
      field: e.field ?? "",
      institution: e.institution ?? "",
      graduation_year: e.graduation_year ?? "",
    })),
    skills: [...(p.skills ?? [])],
    projects: (p.projects ?? []).map((pr) => ({
      name: pr.name ?? "",
      description: pr.description ?? "",
      technologies: [...(pr.technologies ?? [])],
    })),
  };
}

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
      for (const h of (job.highlights ?? []).filter((x) => x && x.trim())) push(`- ${h.trim()}`);
      push();
    }
  }

  const projects = profile.projects ?? [];
  if (projects.length) {
    push("## Projects");
    for (const p of projects) {
      if (p.name) push(`### ${p.name}`);
      if (p.description) push(p.description);
      const tech = (p.technologies ?? []).map((x) => x.trim()).filter(Boolean);
      if (tech.length) push(`- ${tech.join(", ")}`);
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
