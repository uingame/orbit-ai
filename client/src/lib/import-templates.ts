import * as XLSX from "xlsx";

export type TemplateDefinition = {
  filename: string;
  sheetName: string;
  headers: string[];
  example: Record<string, string>;
};

export const importTemplates = {
  judges: {
    filename: "judges-template.xlsx",
    sheetName: "Judges",
    headers: ["name", "username", "phone", "languages", "restrictions"],
    example: {
      name: "John Smith",
      username: "john.smith",
      phone: "+1234567890",
      languages: "English;Hebrew",
      restrictions: "",
    },
  } satisfies TemplateDefinition,

  teams: {
    filename: "teams-template.xlsx",
    sheetName: "Teams",
    headers: ["name", "schoolName", "city", "category", "language"],
    example: {
      name: "Team Alpha",
      schoolName: "Lincoln High",
      city: "New York",
      category: "ElementarySchool",
      language: "English",
    },
  } satisfies TemplateDefinition,

  stations: {
    filename: "stations-template.xlsx",
    sheetName: "Stations",
    headers: ["name", "rubric"],
    example: {
      name: "Innovation",
      rubric: '{"criteria":[{"name":"Creativity","maxPoints":10}]}',
    },
  } satisfies TemplateDefinition,
} as const;

export function downloadTemplate(template: TemplateDefinition): void {
  const worksheet = XLSX.utils.json_to_sheet([template.example], {
    header: template.headers,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, template.sheetName);
  XLSX.writeFile(workbook, template.filename);
}
