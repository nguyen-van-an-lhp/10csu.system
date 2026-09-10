/**
 * conductExport.ts — Xuất báo cáo hạnh kiểm dạng Word (.docx) trực tiếp trên
 * trình duyệt. Dùng thư viện "docx" (đã cài, chạy tốt trên browser). Người
 * dùng bấm nút → file tải về ngay, không cần round-trip server.
 *
 * Font: Times New Roman (có sẵn trên Windows/Mac, và là font chuẩn văn thư VN)
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType, VerticalAlign,
  PageOrientation,
} from 'docx';

// ─── DXA helpers ────────────────────────────────────────────────────────────
const pt  = (n: number) => n * 20;      // pt → half-pt (docx size unit)
const cm  = (n: number) => Math.round(n * 567); // cm → twip

const FONT  = 'Times New Roman';
const FONT2 = 'Arial'; // fallback for table headers

// ─── Run / Paragraph factories ───────────────────────────────────────────────
type RunOpts = { bold?: boolean; italic?: boolean; size?: number; color?: string; font?: string };

function run(text: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    text,
    font: opts.font ?? FONT,
    size: opts.size ?? pt(12),
    bold: opts.bold,
    italics: opts.italic,
    color: opts.color,
  });
}

function para(
  children: TextRun | TextRun[],
  align?: string,
  afterSpacing = 80
): Paragraph {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: (align ?? AlignmentType.LEFT) as typeof AlignmentType.LEFT,
    spacing: { after: afterSpacing },
  });
}

const LEFT   = AlignmentType.LEFT;
const CENTER = AlignmentType.CENTER;
const RIGHT  = AlignmentType.RIGHT;
const EMPTY  = new Paragraph({ children: [], spacing: { after: 120 } });

// ─── Table helpers ────────────────────────────────────────────────────────────
function headerCell(label: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'C0C0C0' },
    verticalAlign: VerticalAlign.CENTER,
    children: [para(run(label, { bold: true, size: pt(10), font: FONT2 }), CENTER, 40)],
  });
}

function dataCell(
  text: string, width: number,
  align: string = CENTER,
  opts: RunOpts = {}
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [para(run(text, { size: pt(11), ...opts }), align, 30)],
  });
}

// ─── EXPORT TYPES ────────────────────────────────────────────────────────────
export interface StudentRow {
  stt: number;
  name: string;
  group: number | null;
  raw: number;
  erased: number;
  normal: number;
  downgrade: number;
  critical: boolean;
  rank: string;
  note?: string;
}

export interface ExportMeta {
  filterLabel: string;
  semester?: string;
  schoolYear?: string;
  printDate: string;
  gvcn: string;
}

// ─── MAIN EXPORT FUNCTION ────────────────────────────────────────────────────
export async function exportConductReport(
  students: StudentRow[],
  meta: ExportMeta,
  filename = 'BaoCaoHanhKiem_10CSU.docx'
): Promise<void> {
  const total = students.length;
  const tot  = students.filter(s => s.rank === 'TỐT').length;
  const kha  = students.filter(s => s.rank === 'KHÁ').length;
  const dat  = students.filter(s => s.rank === 'ĐẠT').length;
  const cd   = students.filter(s => s.rank === 'CHƯA ĐẠT').length;
  const pctGood = total ? Math.round((tot + kha) / total * 100) : 0;
  const warned  = students.filter(s => s.normal >= 3 && s.rank !== 'CHƯA ĐẠT');
  const criticalList = students.filter(s => s.rank === 'CHƯA ĐẠT' || s.critical);

  // --- Cột bảng chi tiết (landscape A4, tổng ≈ 20700 twip usable) ---
  const COLS   = [600, 3800, 700, 1000, 1000, 1100, 1000, 1100, 1500, 4200];
  const TBL_W  = COLS.reduce((a, b) => a + b, 0); // 16000 twip
  const LABELS = ['STT', 'Họ và tên', 'Tổ', 'Lỗi thô', 'Đã xóa', 'Còn lại', 'Hạ bậc', 'N.Trọng', 'Xếp loại', 'Ghi chú'];

  const headerRow = new TableRow({
    tableHeader: true,
    children: LABELS.map((l, i) => headerCell(l, COLS[i])),
  });

  const dataRows = students.map(s => {
    const rankColor = s.rank === 'CHƯA ĐẠT' ? 'CC0000' : s.rank === 'ĐẠT' ? 'B45309' : undefined;
    return new TableRow({ children: [
      dataCell(String(s.stt),              COLS[0]),
      dataCell(s.name,                     COLS[1], LEFT, { bold: true }),
      dataCell(String(s.group ?? '—'),     COLS[2]),
      dataCell(String(s.raw),              COLS[3]),
      dataCell(s.erased ? String(s.erased) : '—', COLS[4]),
      dataCell(String(s.normal),           COLS[5], CENTER, { bold: s.normal >= 4, color: s.normal >= 8 ? 'CC0000' : s.normal >= 4 ? 'B45309' : undefined }),
      dataCell(s.downgrade ? String(s.downgrade) : '—', COLS[6]),
      dataCell(s.critical ? 'CÓ' : '—',   COLS[7], CENTER, { color: s.critical ? 'CC0000' : undefined }),
      dataCell(s.rank,                     COLS[8], CENTER, { bold: true, color: rankColor }),
      dataCell(s.note ?? '',               COLS[9], LEFT),
    ]});
  });

  const mainTable = new Table({
    width:        { size: TBL_W, type: WidthType.DXA },
    columnWidths: COLS,
    rows:         [headerRow, ...dataRows],
  });

  // --- Bảng tổng hợp (portrait A4, đặt sau table chi tiết) ---
  const SC = [3000, 1800, 1800, 1800, 1800, 1800, 1800, 2000]; // 15800
  const SW = SC.reduce((a, b) => a + b, 0);
  const SH_LABELS = ['Lớp', 'Tổng HS', 'TỐT', 'KHÁ', 'ĐẠT', 'CHƯA ĐẠT', 'Tỉ lệ T+K', 'Ghi chú'];
  const statHeader = new TableRow({ tableHeader: true, children: SH_LABELS.map((l, i) => headerCell(l, SC[i])) });
  const statData   = new TableRow({ children: [
    dataCell('Lớp 10CSU',    SC[0], LEFT, { bold: true }),
    dataCell(String(total),  SC[1]),
    dataCell(String(tot),    SC[2], CENTER, { color: '166534' }),
    dataCell(String(kha),    SC[3], CENTER, { color: '1e40af' }),
    dataCell(String(dat),    SC[4], CENTER, { color: 'B45309' }),
    dataCell(String(cd),     SC[5], CENTER, { color: 'CC0000', bold: cd > 0 }),
    dataCell(`${pctGood}%`,  SC[6]),
    dataCell('',             SC[7]),
  ]});
  const summaryTable = new Table({ width: { size: SW, type: WidthType.DXA }, columnWidths: SC, rows: [statHeader, statData] });

  // --- Document ---
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          // A4 landscape: width=16838, height=11906 twip (standard)
          size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
          margin: { top: cm(1.5), right: cm(1.5), bottom: cm(1.5), left: cm(2.5) },
        },
      },
      children: [
        // --- Tiêu đề ---
        para(run('SỞ GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ HỒ CHÍ MINH', { bold: true, size: pt(11) }), CENTER, 40),
        para(run('TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG', { bold: true, size: pt(12) }), CENTER, 60),
        EMPTY,
        para(run('BẢNG ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH', { bold: true, size: pt(16) }), CENTER, 40),
        para([
          run('Lớp 10CSU  —  ', { bold: true, size: pt(13) }),
          run(meta.filterLabel, { size: pt(13) }),
        ], CENTER, 40),
        ...(meta.semester ? [
          para(run(`${meta.semester}  |  Năm học ${meta.schoolYear ?? ''}`, { size: pt(11), italic: true }), CENTER, 40),
        ] : []),
        para([
          run('GVCN: ', { size: pt(11) }),
          run(meta.gvcn, { bold: true, size: pt(11) }),
          run('     ĐT: 0326.830.265     |     Ngày xuất: ' + meta.printDate, { size: pt(11) }),
        ], CENTER, 80),

        EMPTY,

        // --- Phần I: bảng chi tiết ---
        para(run('I. BẢNG DANH SÁCH CHI TIẾT', { bold: true, size: pt(12) }), LEFT, 60),
        mainTable,
        EMPTY,

        // --- Phần II: tổng hợp ---
        para(run('II. KẾT QUẢ TỔNG HỢP', { bold: true, size: pt(12) }), LEFT, 60),
        summaryTable,
        EMPTY,

        // --- Cảnh báo ---
        ...(criticalList.length > 0 ? [
          para(run(`🚨 CHƯA ĐẠT (${criticalList.length} học sinh): ` + criticalList.map(s => `${s.name} — ${s.normal} lỗi`).join('; '), { size: pt(11), color: 'CC0000', bold: true }), LEFT, 40),
        ] : []),
        ...(warned.length > 0 ? [
          para(run(`⚠ Cảnh báo sắp mất hạng (${warned.length} học sinh): ` + warned.map(s => `${s.name} (Tổ ${s.group ?? '?'}) — ${s.normal} lỗi`).join('; '), { size: pt(11), color: 'B45309' }), LEFT, 60),
        ] : []),

        EMPTY, EMPTY,

        // --- Chữ ký ---
        para(run('TP. Hồ Chí Minh, ngày .... tháng .... năm 20....', { size: pt(12), italic: true }), RIGHT, 60),
        para(run('GIÁO VIÊN CHỦ NHIỆM', { bold: true, size: pt(12) }), RIGHT, 40),
        para(run('(Ký tên, đóng dấu)', { size: pt(11), italic: true }), RIGHT, 400),
        para(run(meta.gvcn, { bold: true, size: pt(12) }), RIGHT, 40),
      ],
    }],
  });

  // --- Download ---
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}