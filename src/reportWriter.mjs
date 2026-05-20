import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const chineseSectionNumbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export function renderReport(summary) {
  const sections = summary.sections.map((section, sectionIndex) => {
    const sectionNumber = chineseSectionNumbers[sectionIndex] || String(sectionIndex + 1);
    const items = section.items.map((item, itemIndex) => renderItem(item, itemIndex)).join("\n");
    return `${sectionNumber}、${section.heading}\n${items}`;
  });

  return `${summary.date} 日报\n\n${sections.join("\n\n")}\n`;
}

function renderItem(item, itemIndex) {
  const itemNumber = itemIndex + 1;

  if (isStarItem(item)) {
    return [
      `${itemNumber}.${item.title}`,
      `   ${[item.situation, item.task, item.action, item.result].map(ensureSentence).join("")}`,
    ].join("\n");
  }

  return `${itemNumber}.${item}`;
}

function ensureSentence(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }

  return /[。！？.!?]$/.test(normalized) ? normalized : `${normalized}。`;
}

function isStarItem(item) {
  return (
    item &&
    typeof item === "object" &&
    ["title", "situation", "task", "action", "result"].every((field) =>
      Boolean(String(item[field] || "").trim()),
    )
  );
}

export async function writeReport(summary, outputDirectory = path.join(process.cwd(), "reports")) {
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `${summary.date}-daily.md`);
  await writeFile(outputPath, renderReport(summary), "utf8");

  return outputPath;
}
