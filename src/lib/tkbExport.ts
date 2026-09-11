/**
 * tkbExport.ts — Xuất Thời khóa biểu dạng Word (.docx) để in, dùng chung
 * thư viện "docx" và cùng khuôn khổ tiêu đề/chữ ký với conductExport.ts
 * (Times New Roman, khổ A4 ngang) để hai file xuất trong hệ thống đồng bộ.
 */
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, ShadingType, VerticalAlign,
    PageOrientation,
  } from 'docx';
  import type { BoardTkb, TkbPeriod } from '../types';
  
  const pt = (n: number) => n * 20;
  const cm = (n: number) => Math.round(n * 567);
  
  const FONT = 'Times New Roman';
  const FONT2 = 'Arial';
  
  type RunOpts = { bold?: boolean; italic?: boolean; size?: number; color?: string; font?: string };
  function run(text: string, opts: RunOpts = {}): TextRun {
    return new TextRun({ text, font: opts.font ?? FONT, size: opts.size ?? pt(11), bold: opts.bold, italics: opts.italic, color: opts.color });
  }
  function para(children: TextRun | TextRun[], align?: string, afterSpacing = 60): Paragraph {
    return new Paragraph({ children: Array.isArray(children) ? children : [children], alignment: (align ?? AlignmentType.LEFT) as typeof AlignmentType.LEFT, spacing: { after: afterSpacing } });
  }
  const LEFT = AlignmentType.LEFT;
  const CENTER = AlignmentType.CENTER;
  const RIGHT = AlignmentType.RIGHT;
  const EMPTY = new Paragraph({ children: [], spacing: { after: 100 } });
  
  function headerCell(label: string, width: number): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'C0C0C0' },
      verticalAlign: VerticalAlign.CENTER,
      children: [para(run(label, { bold: true, size: pt(10), font: FONT2 }), CENTER, 30)],
    });
  }
  
  const DAY_LABELS_EXPORT: Record<string, string> = { T2: 'Thứ Hai', T3: 'Thứ Ba', T4: 'Thứ Tư', T5: 'Thứ Năm', T6: 'Thứ Sáu', T7: 'Thứ Bảy', CN: 'Chủ nhật' };
  
  export interface TkbExportMeta {
    semester: string;
    schoolYear: string;
    appliedDate?: string;
    printDate: string;
    gvcn: string;
  }
  
  export async function exportTkbToWord(
    tkb: BoardTkb,
    meta: TkbExportMeta,
    days: string[],
    periods: TkbPeriod[],
    filename = 'ThoiKhoaBieu_10CSU.docx'
  ): Promise<void> {
    const sangPeriods = periods.filter(p => p.session === 'sang');
    const chieuPeriods = periods.filter(p => p.session === 'chieu');
  
    // Cột: Buổi (nhỏ) + Tiết (nhãn + giờ) + 1 cột/ngày, chia đều phần còn lại
    // của khổ A4 ngang (usable ≈ 14600 twip sau khi trừ lề, khớp conductExport).
    const BUOI_W = 700, TIET_W = 1900;
    const USABLE = 14600;
    const DAY_W = Math.floor((USABLE - BUOI_W - TIET_W) / Math.max(1, days.length));
    const COLS = [BUOI_W, TIET_W, ...days.map(() => DAY_W)];
    const TBL_W = COLS.reduce((a, b) => a + b, 0);
  
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        headerCell('Buổi', COLS[0]),
        headerCell('Tiết', COLS[1]),
        ...days.map((d, i) => headerCell(DAY_LABELS_EXPORT[d] || d, COLS[2 + i])),
      ],
    });
  
    function slotCell(day: string, p: TkbPeriod, width: number): TableCell {
      const slot = tkb[`${day}-${p.key}`];
      if (!slot) {
        return new TableCell({ width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [para(run('—', { size: pt(10), color: '9CA3AF' }), CENTER, 20)] });
      }
      const children = [para(run(slot.subject, { bold: true, size: pt(10) }), CENTER, slot.teacher ? 10 : 20)];
      if (slot.teacher) children.push(para(run(slot.teacher, { size: pt(9), color: '6B7280' }), CENTER, 20));
      return new TableCell({ width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children });
    }
  
    function sessionRows(list: TkbPeriod[], label: string): TableRow[] {
      return list.map((p, idx) => new TableRow({
        children: [
          ...(idx === 0 ? [new TableCell({
            width: { size: COLS[0], type: WidthType.DXA },
            rowSpan: list.length,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F4F6' },
            children: [para(run(label, { bold: true, size: pt(10) }), CENTER, 20)],
          })] : []),
          new TableCell({
            width: { size: COLS[1], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              para(run(p.label.split(' - ')[1] || p.label, { bold: true, size: pt(10) }), LEFT, 10),
              para(run(p.time, { size: pt(8), color: '9CA3AF' }), LEFT, 20),
            ],
          }),
          ...days.map((d, i) => slotCell(d, p, COLS[2 + i])),
        ],
      }));
    }
  
    const mainTable = new Table({
      width: { size: TBL_W, type: WidthType.DXA },
      columnWidths: COLS,
      rows: [headerRow, ...sessionRows(sangPeriods, 'Sáng'), ...sessionRows(chieuPeriods, 'Chiều')],
    });
  
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
            margin: { top: cm(1.5), right: cm(1.5), bottom: cm(1.5), left: cm(2.5) },
          },
        },
        children: [
          para(run('SỞ GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ HỒ CHÍ MINH', { bold: true, size: pt(11) }), CENTER, 30),
          para(run('TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG', { bold: true, size: pt(12) }), CENTER, 60),
          EMPTY,
          para(run('THỜI KHÓA BIỂU LỚP 10CSU', { bold: true, size: pt(16) }), CENTER, 40),
          para(run(`${meta.semester} — Năm học ${meta.schoolYear}`, { size: pt(12), italic: true }), CENTER, 40),
          ...(meta.appliedDate ? [para(run(`Áp dụng từ ngày ${meta.appliedDate}`, { size: pt(11) }), CENTER, 40)] : []),
          para([
            run('GVCN: ', { size: pt(11) }),
            run(meta.gvcn, { bold: true, size: pt(11) }),
            run('     |     Ngày xuất: ' + meta.printDate, { size: pt(11) }),
          ], CENTER, 100),
  
          mainTable,
  
          EMPTY, EMPTY,
  
          para(run('TP. Hồ Chí Minh, ngày .... tháng .... năm 20....', { size: pt(12), italic: true }), RIGHT, 60),
          para(run('GIÁO VIÊN CHỦ NHIỆM', { bold: true, size: pt(12) }), RIGHT, 40),
          para(run('(Ký tên, đóng dấu)', { size: pt(11), italic: true }), RIGHT, 400),
          para(run(meta.gvcn, { bold: true, size: pt(12) }), RIGHT, 40),
        ],
      }],
    });
  
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }