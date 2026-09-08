export type Role =
  | 'gvcn'
  | 'loptruong' | 'hoctap' | 'kyluat' | 'bithu' | 'vannghe' | 'thuquy'
  | 'to1' | 'to2' | 'to3' | 'to4' | 'to5' | 'to6' | 'to7' | 'to8'
  | 'student';

export interface User { id: string; username: string; name: string; role: Role; group?: number | null; isLeader?: boolean; active?: boolean; avatar?: string; }
export interface Session { username: string; name: string; role: Role; rawRole?: string; groupNo?: number | null; isLeader?: boolean; avatar?: string; token?: string; expiresAt?: number; }
export interface Attachment { id: string; name: string; type: string; url: string; }
export interface Post { id: string; time: string; channel: string; column: string; category: string; title: string; content: string; attachments?: Attachment[]; authorId: string; authorName: string; authorRole: string; pinned?: boolean; likes: string[]; }
export interface ClassGroup { groupNo: number; groupName: string; leaderId: string; note?: string; }
export interface Reply { id: string; parentId: string | null; content: string; attachments?: Attachment[]; authorId: string; authorName: string; authorRole: string; time: string; isVerified?: boolean; }
export interface Question { id: string; time: string; subject: string; question: string; attachments?: Attachment[]; askerDisplay: string; askerRealId: string; replies: Reply[]; }

// ĐỊNH NGHĨA MỚI: KIỂM SOÁT LỊCH TRÌNH CHẶT CHẼ
export type TimelineType = 'exam' | 'deadline' | 'event' | 'meeting';
export type TimelineStatus = 'pending' | 'completed' | 'cancelled';

export interface TimelineEvent {
  id: string;
  type: TimelineType;
  date: string; // Chuẩn YYYY-MM-DD
  timeSlot: string;
  title: string;
  description: string;
  status: TimelineStatus;
  createdBy: string;
}

// ĐỊNH NGHĨA MỚI (v13.0): SỔ HẠNH KIỂM CHUẨN HÓA — khớp với danh mục cố định
// và sheet ConductLog phía Code.gs. Không còn "any" tự do như bản cũ.
export type ConductTier = 'fault' | 'downgrade' | 'critical' | 'improve';

export interface ConductCatalogItem { code: string; text: string; criteria: string[]; points?: number; }
export interface ConductCatalog {
  faults: ConductCatalogItem[];
  downgrades: ConductCatalogItem[];
  critical: ConductCatalogItem[];
  improve: ConductCatalogItem[];
}

export interface ConductLogEntry {
  id: string;
  time: string;
  studentId: string;
  violationCode: string; // mã trong catalog, hoặc 'CUSTOM'
  text: string;
  criteria: string[];
  tier: ConductTier;
  points: number;
  note: string;
  author: string;
}

export interface ConductSummary {
  studentId: string;
  studentName: string;
  rawFaults: number;      // tổng lỗi thô trước khi trừ cải thiện
  improvePoints: number;  // tổng điểm hoạt động tích lũy
  erasedFaults: number;   // số lỗi đã được xóa = floor(improvePoints / 2)
  normalFaults: number;   // lỗi còn lại sau khi trừ
  downgradeFaults: number;
  hasCritical: boolean;
  rank: 'TỐT' | 'KHÁ' | 'ĐẠT' | 'CHƯA ĐẠT';
}

export interface ConductData {
  catalog: ConductCatalog;
  logs: ConductLogEntry[];
  summary: Record<string, ConductSummary>;
}

// ĐỊNH NGHĨA MỚI (v14.0): BÁO CÁO BAN CÁN SỰ LỚP — thay thế hoàn toàn
// WeeklyReport (điểm 0-10 tổ trưởng chấm) đã bị khai tử.
export type ReportCategory = 'Học Tập' | 'Phong Trào' | 'Kỷ Luật' | 'Vệ Sinh' | 'Văn Hóa & Đạo Đức';
export type ReportScope = 'class' | 'group';

export interface RoleReportRule { scope: ReportScope; categories: ReportCategory[]; }
export type RoleReportScopeMap = Record<string, RoleReportRule>;

export interface OfficerReport {
  id: string; weekId: string; reporterId: string; reporterRole: string; scope: ReportScope;
  groupNo: number | null; category: ReportCategory; content: string; mentionedStudents: string[]; createdAt: string;
}

export interface TreasuryReport {
  id: string; weekId: string; reporterId: string; balance: number; purchases: string;
  spendProposal: string; collectProposal: string; createdAt: string;
}

export type ComplaintStatus = 'open' | 'resolved' | 'dismissed';
export interface Complaint {
  id: string; weekId: string; accuserId: string; accusedId: string; category: string;
  content: string; status: ComplaintStatus; gvcnVerdict: string; createdAt: string;
}

export type ConfessionVisibility = 'public' | 'gvcn';
export interface Confession {
  id: string; time: string; visibility: ConfessionVisibility; content: string; hidden: boolean;
  authorId?: string; // chỉ có giá trị khi visibility === 'gvcn' — 'public' luôn ẩn danh, kể cả với GVCN
  createdAt: string;
}

export interface ReportsData {
  categories: ReportCategory[];
  roleScope: RoleReportScopeMap;
  officerReports: OfficerReport[];
  treasuryReports: TreasuryReport[];
  complaints: Complaint[]; // rỗng nếu người gọi không phải GVCN
  confessions: Confession[];
}

// ĐỊNH NGHĨA MỚI (v15.0): BẢNG DẶN DÒ GVBM & THỜI KHÓA BIỂU
export interface TkbPeriod { key: string; session: 'sang' | 'chieu'; label: string; time: string; }
export interface TeacherNote { id: string; subject: string; content: string; deadline: string; }
/** khóa dạng "T2-sang" | "CN-chieu" → danh sách dặn dò của buổi đó */
export type BoardNotes = Record<string, TeacherNote[]>;
/** một tiết trong TKB: môn + giáo viên phụ trách */
export interface TkbSlot { subject: string; teacher: string; }
/** khóa dạng "T2-S1" → tiết học (môn + GV) */
export type BoardTkb = Record<string, TkbSlot>;
export interface TkbMeta { semester: string; schoolYear: string; updatedDate: string; appliedDate: string; }

export interface BoardData {
  notes: BoardNotes;
  tkb: BoardTkb;
  tkbMeta: TkbMeta;
  subjects: string[];
  tkbDays: string[];
  tkbPeriods: TkbPeriod[];
  canManage: boolean;
}

export interface AppState {
  roster: User[];
  groups: ClassGroup[];
  posts: Post[];
  mentor: Question[];
  timeline: TimelineEvent[]; // Loại bỏ any[]
  currentWeek: string;
  seating?: any;
  conduct?: ConductData; // Trước đây thiếu — nguyên nhân Conduct.tsx luôn nhận undefined
  reports?: ReportsData;
  board?: BoardData;
}