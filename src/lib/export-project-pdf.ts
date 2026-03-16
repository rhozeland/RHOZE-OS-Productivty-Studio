import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  progress: number;
  parent_id: string | null;
  budget_amount: number;
  sort_order: number;
  stage_date_start: string | null;
  stage_date_end: string | null;
  location: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  total_budget: number;
  is_estimate: boolean;
  currency: string;
  created_at: string;
  vision?: string | null;
  scope_of_work?: string | null;
  runtime_notes?: string | null;
  categories?: string[] | null;
  client_name?: string | null;
  project_type?: string | null;
}

const CURRENCIES: Record<string, string> = {
  CAD: "$",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

// Brand colors
const BRAND = {
  black: [30, 30, 30] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
  yellow: [255, 230, 0] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  highlight: [255, 255, 140] as [number, number, number],
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface Approval {
  printed_name: string;
  role: string;
  signed_at: string;
}

export async function exportProjectPDF(
  project: Project,
  goals: Goal[] | undefined,
  approvals?: Approval[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 25;
  const marginRight = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  const stages = (goals ?? [])
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const getSubItems = (stageId: string) =>
    (goals ?? [])
      .filter((g) => g.parent_id === stageId)
      .sort((a, b) => a.sort_order - b.sort_order);

  const currencySymbol = CURRENCIES[project.currency] || "$";

  // Helper: add footer
  const addFooter = (pageNum: number) => {
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.gray);
    doc.text(String(pageNum), marginLeft, pageHeight - 12);
    doc.text("www.rhozeland.com", marginLeft, pageHeight - 7);
  };

  // Helper: add header with logo
  const addHeader = async () => {
    try {
      const img = await loadImage(rhozelandLogo);
      doc.addImage(img, "PNG", pageWidth / 2 - 40, y, 18, 18);
      // "RHOZELAND" text next to logo
      doc.setFontSize(28);
      doc.setTextColor(...BRAND.black);
      doc.setFont("helvetica", "normal");
      // Letter-spaced "RHOZELAND"
      const letters = "R H O Z E L A N D";
      doc.text(letters, pageWidth / 2 - 18, y + 13);
    } catch {
      // Fallback if logo fails
      doc.setFontSize(28);
      doc.setTextColor(...BRAND.black);
      doc.text("R H O Z E L A N D", pageWidth / 2, y + 13, { align: "center" });
    }
  };

  // Helper: section header with underline
  const sectionHeader = (title: string) => {
    checkPageBreak(15);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.black);
    doc.text(title, marginLeft, y);
    y += 2;
    doc.setDrawColor(...BRAND.lightGray);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 6;
  };

  // Helper: check page break
  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      addFooter(doc.getNumberOfPages());
      doc.addPage();
      y = 20;
    }
  };

  // Helper: body text with wrapping
  const bodyText = (text: string, indent = 0) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.black);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      checkPageBreak(6);
      doc.text(line, marginLeft + indent, y);
      y += 5;
    }
  };

  // ======== PAGE 1: Cover ========
  await addHeader();
  y += 25;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.black);
  doc.text("DESIGN PROJECT ROADMAP", pageWidth / 2, y, { align: "center" });
  y += 12;

  // Client info block
  const infoRows: [string, string][] = [];
  if (project.client_name) infoRows.push(["NAME:", project.client_name]);
  infoRows.push(["DATE ISSUED:", format(new Date(project.created_at), "dd MMM yyyy")]);
  infoRows.push(["REFERENCE ID:", project.id.slice(0, 8).toUpperCase()]);
  if (project.project_type && project.project_type !== "standard") {
    infoRows.push(["TYPE:", project.project_type.charAt(0).toUpperCase() + project.project_type.slice(1)]);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.black);
    doc.text(label, marginLeft, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginLeft + 35, y);
    y += 6;
  }

  // Separator line
  y += 2;
  doc.setDrawColor(...BRAND.black);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  // Executive Summary (project description)
  if (project.description) {
    sectionHeader("EXECUTIVE SUMMARY:");
    bodyText(project.description, 5);
    y += 6;
  }

  // Scope of Work categories
  if (project.categories && project.categories.length > 0) {
    sectionHeader("SCOPE OF WORK:");
    // Category pills in a row
    const cats = project.categories;
    const catWidth = contentWidth / Math.max(cats.length, 1);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    cats.forEach((cat, i) => {
      const x = marginLeft + i * catWidth;
      // Highlight box for active categories
      doc.setFillColor(...BRAND.highlight);
      doc.rect(x, y - 4, catWidth - 3, 6, "F");
      doc.setTextColor(...BRAND.black);
      doc.text(cat.toUpperCase(), x + 2, y);
    });
    y += 10;
  }

  // Scope of Work details
  if (project.scope_of_work) {
    sectionHeader("DELIVERABLES:");
    // Split by newlines and render
    const scopeLines = project.scope_of_work.split("\n");
    for (const line of scopeLines) {
      const trimmed = line.trim();
      if (!trimmed) { y += 3; continue; }
      const indent = line.startsWith("  ") || line.startsWith("\t") ? 10 : 5;
      checkPageBreak(6);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.black);
      const wrapped = doc.splitTextToSize(trimmed, contentWidth - indent);
      for (const w of wrapped) {
        checkPageBreak(6);
        doc.text(w, marginLeft + indent, y);
        y += 5;
      }
    }
    y += 6;
  }

  // Budget summary
  if (project.total_budget > 0) {
    checkPageBreak(20);
    sectionHeader("BUDGET:");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const budgetRows: string[][] = [];
    budgetRows.push(["Grand Total" + (project.is_estimate ? " (Estimate)" : ""),
      `${currencySymbol}${project.total_budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);

    const stageTotal = stages.reduce((sum, s) => sum + (s.budget_amount || 0), 0);
    stages.filter(s => s.budget_amount > 0).forEach((stage, i) => {
      budgetRows.push([`  Stage ${i + 1}: ${stage.title}`,
        `${currencySymbol}${stage.budget_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
    });

    if (project.total_budget > stageTotal && stageTotal > 0) {
      budgetRows.push(["  Unallocated",
        `${currencySymbol}${(project.total_budget - stageTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
    }

    autoTable(doc, {
      startY: y,
      head: [],
      body: budgetRows,
      theme: "plain",
      margin: { left: marginLeft, right: marginRight },
      styles: { fontSize: 10, cellPadding: 2, textColor: BRAND.black },
      columnStyles: {
        0: { fontStyle: "normal" },
        1: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.row.index === 0) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 11;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  addFooter(1);

  // ======== PAGE 2: Vision & Roadmap ========
  doc.addPage();
  y = 20;
  await addHeader();
  y += 25;

  // Vision Details
  if (project.vision || project.runtime_notes) {
    sectionHeader("VISION DETAILS");

    if (project.vision) {
      bodyText(project.vision, 0);
      y += 4;
    }

    if (project.runtime_notes) {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.black);
      doc.text("Timeline & Runtime:", marginLeft, y);
      y += 6;
      bodyText(project.runtime_notes, 5);
      y += 4;
    }
    y += 4;
  }

  // Roadmap stages
  if (stages.length > 0) {
    sectionHeader("ROADMAP");

    stages.forEach((stage, i) => {
      checkPageBreak(25);
      const subItems = getSubItems(stage.id);

      // Stage header row with date highlight
      const dateStr = [
        stage.stage_date_start ? format(new Date(stage.stage_date_start), "MMM d, yyyy") : "",
        stage.stage_date_end ? format(new Date(stage.stage_date_end), "MMM d, yyyy") : "",
      ].filter(Boolean).join(" - ");

      // Build table data
      const tableBody: string[][] = [];

      subItems.forEach((item, j) => {
        const check = item.status === "completed" ? "✓" : `${j + 1}`;
        let desc = item.title;
        if (item.description) desc += `\n   ${item.description}`;
        tableBody.push([check, desc]);
      });

      // If stage has description but no sub-items, show description
      if (subItems.length === 0 && stage.description) {
        tableBody.push(["", stage.description]);
      }

      // Location info
      if (stage.location) {
        tableBody.push(["", `Where: ${stage.location}`]);
      }

      autoTable(doc, {
        startY: y,
        margin: { left: marginLeft, right: marginRight },
        theme: "grid",
        styles: {
          fontSize: 10,
          cellPadding: 3,
          textColor: BRAND.black,
          lineColor: BRAND.lightGray,
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: BRAND.white,
          textColor: BRAND.black,
          fontStyle: "bold",
          fontSize: 11,
        },
        head: [[
          { content: `Stage ${i + 1}: ${stage.title}`, colSpan: 1, styles: { halign: "left" } } as any,
          { content: dateStr, colSpan: 1, styles: { halign: "left" } } as any,
        ]],
        body: tableBody.length > 0 ? tableBody : [["", "No deliverables defined yet"]],
        columnStyles: {
          0: { cellWidth: 15, halign: "center", fontStyle: "bold" },
          1: { cellWidth: contentWidth - 15 },
        },
        didParseCell: (data) => {
          // Highlight date cells
          if (data.section === "head" && data.column.index === 1) {
            data.cell.styles.fillColor = BRAND.highlight;
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    });
  }

  addFooter(2);

  // ======== PAGE 3: Approval ========
  doc.addPage();
  y = 20;
  await addHeader();
  y += 25;

  sectionHeader("APPROVAL AND FINAL SIGN-OFF");

  const clientApproval = approvals?.find((a) => a.role === "client");
  const specialistApproval = approvals?.find((a) => a.role === "specialist");

  autoTable(doc, {
    startY: y,
    margin: { left: marginLeft, right: marginRight },
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: BRAND.black,
      lineColor: BRAND.lightGray,
      lineWidth: 0.3,
    },
    head: [["APPROVAL AND FINAL SIGN-OFF", "ADMINISTERED BY"]],
    headStyles: {
      fillColor: BRAND.white,
      textColor: BRAND.black,
      fontStyle: "bold",
    },
    body: [
      [
        `Print Name: ${clientApproval?.printed_name || project.client_name || "________________"}`,
        `Print Name: ${specialistApproval?.printed_name || "________________"}`,
      ],
      [
        clientApproval
          ? `Signed: ${format(new Date(clientApproval.signed_at), "MMM d, yyyy")}`
          : "Signature: ________________",
        specialistApproval
          ? `Signed: ${format(new Date(specialistApproval.signed_at), "MMM d, yyyy")}`
          : "Signature: ________________",
      ],
    ],
    columnStyles: {
      0: { cellWidth: contentWidth / 2 },
      1: { cellWidth: contentWidth / 2 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Payment info placeholder
  checkPageBreak(30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.black);
  doc.text("Payment Information:", marginLeft, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (project.total_budget > 0) {
    doc.text(
      `Total: ${currencySymbol}${project.total_budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}${project.is_estimate ? " (Estimate)" : ""}`,
      marginLeft,
      y
    );
    y += 6;
  }

  doc.setFont("helvetica", "italic");
  doc.setTextColor(...BRAND.gray);
  doc.text("Interac e-transfer payment email: Rhozeland Creative Team - support@rhozeland.com", marginLeft, y);

  addFooter(3);

  // Save
  const fileName = `${project.title.replace(/[^a-zA-Z0-9]/g, "_")}_Roadmap.pdf`;
  doc.save(fileName);
}
