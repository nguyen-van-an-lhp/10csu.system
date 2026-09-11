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

// ĐỊNH NGHĨA MỚI (v13.0): SỔ HẠNH KIỂM CHUẨN HÓA
export type ConductTier = 'fault' | 'downgrade' | 'critical' | 'improve';

export interface ConductCatalogItem { code: string; text: string; criteria: string[]; points?: number; threshold?: number; }
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
  criteriaList: string[]; // danh sách 5 phẩm chất TT22 từ server
  logs: ConductLogEntry[];
  summary: Record<string, ConductSummary>;
}

// ĐỊNH NGHĨA MỚI (v14.0): BÁO CÁO BAN CÁN SỰ LỚP
export type ReportCategory = 'Học Tập' | 'Phong Trào' | 'Kỷ Luật' | 'Vệ Sinh' | 'Văn Hóa & Đạo Đức';
export type ReportScope = 'class' | 'group';

export interface RoleReportRule { scope: ReportScope; categories: ReportCategory[]; }
export type RoleReportScopeMap = Record<string, RoleReportRule>;

export type ReportStatus = 'tot' | 'co_van_de';
export type ViolationSubtype = 'nhac_nho' | 'lam_viec_rieng' | 'khong_hop_tac';

export interface OfficerReportSummary {
  id: string; weekId: string; reporterId: string; reporterRole: string; scope: ReportScope;
  groupNo: number | null; category: ReportCategory; status: ReportStatus; createdAt: string;
}
export interface OfficerReportDetail extends OfficerReportSummary {
  incidentDate: string; content: string; mentionedStudents: string[];
  period: string; day: string; subject: string; violationSubtype: ViolationSubtype | ''; reminderBy: string;
}

export interface TreasuryReport {
  id: string; weekId: string; reporterId: string; balance: number; purchases: string;
  spendProposal: string; collectProposal: string; createdAt: string;
}

// QUỸ LỚP — SỔ CÁI KẾ TOÁN KÉP (v23.0)
export type FundTxType = 'IN' | 'OUT';
export type FundTxStatus = 'active' | 'cancelled';
export interface FundTransaction {
  id: string; weekId: string; type: FundTxType; amount: number; category: string;
  description: string; proofImages: Attachment[]; createdBy: string;
  status: FundTxStatus; createdAt: string;
}
export type FundPeriodStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export interface FundPeriod {
  id: string; weekId: string; openingBalance: number; totalIn: number; totalOut: number;
  closingBalance: number; proposals: string; status: FundPeriodStatus;
  submittedBy: string; gvcnVerdict: string; approvedBy: string; createdAt: string; updatedAt: string;
}
export interface FundData {
  categories: { IN: string[]; OUT: string[] };
  transactions: FundTransaction[];
  periods: FundPeriod[];
}

export type ComplaintStatus = 'open' | 'resolved' | 'dismissed';
export interface Complaint {
  id: string; weekId: string; accuserId: string; accusedId: string; category: string;
  content: string; status: ComplaintStatus; gvcnVerdict: string; createdAt: string;
}

export type ConfessionVisibility = 'public' | 'gvcn';
export interface Confession {
  id: string; time: string; visibility: ConfessionVisibility; content: string; hidden: boolean;
  authorId?: string; createdAt: string;
}

// v28.0 — payload báo cáo thêm thông tin quyền do BACKEND quyết định
// (hocTapReportRoles / canReportHocTap), để giao diện dựng đúng quyền mà
// không hard-code lại danh sách vai trò ở 2 nơi dễ lệch nhau.
export interface ReportsData {
  categories: ReportCategory[];
  roleScope: RoleReportScopeMap;
  hocTapReportRoles: string[];
  canReportHocTap: boolean;
  violationSubtypes: ViolationSubtype[];
  officerReportsSummary: OfficerReportSummary[];
  officerReportsDetail: OfficerReportDetail[]; // rỗng nếu người gọi không có trách nhiệm báo cáo
  treasuryReports: TreasuryReport[];
  complaints: Complaint[]; // rỗng nếu người gọi không phải GVCN
  confessions: Confession[];
}

// ĐỊNH NGHĨA MỚI (v15.0): BẢNG DẶN DÒ GVBM & THỜI KHÓA BIỂU
export interface TkbPeriod { key: string; session: 'sang' | 'chieu'; label: string; time: string; }
export interface TeacherNote { id: string; subject: string; content: string; deadline: string; date: string; }
export type BoardNotes = Record<string, TeacherNote[]>;
export interface TkbSlot { subject: string; teacher: string; }
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

// ĐỊNH NGHĨA MỚI (v26.0): LỊCH TRỰC NHẬT
export type DutyDay = 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';
export type DutyRosterWeek = Partial<Record<DutyDay, string[]>>;
export type DutyRosterData = Record<string, DutyRosterWeek>;

// ĐỊNH NGHĨA MỚI (v25.0): TRANG PHÂN CÔNG
export type AssignmentType = 'hoat_dong_lop' | 'hoat_dong_truong' | 'hoc_tap';
export type AssignmentTargetType = 'individual' | 'group';
export type AssignmentStatus = 'assigned' | 'reported' | 'evaluated' | 'decided';
export type AssignmentRating = 'xuat_sac' | 'dat' | 'chua_dat';
export interface AssignmentScopeRule { types: AssignmentType[]; targetScope: 'class' | 'group'; }
export type AssignmentScopeMap = Record<string, AssignmentScopeRule>;
export interface AssignmentComment { id: string; authorId: string; authorName: string; content: string; createdAt: string; }
export interface Assignment {
  id: string; type: AssignmentType; assignerId: string; assignerRole: string;
  targetType: AssignmentTargetType; targetId: string | number; title: string; content: string;
  deadline: string; status: AssignmentStatus; selfReportedAt: string;
  evaluatorId: string; evaluatedAt: string; evaluationRating: AssignmentRating | ''; evaluationNote: string;
  decidedBy: string; decidedAt: string; decisionNote: string;
  comments: AssignmentComment[]; createdAt: string;
}
export interface DutySuggestion { weekId: string; suggestedGroupNo: number; }
export interface AssignmentsData { types: AssignmentType[]; scope: AssignmentScopeMap; ratings: AssignmentRating[]; list: Assignment[]; dutySuggestion: DutySuggestion; }

// ĐỊNH NGHĨA MỚI (v27.0): CÔNG NỢ QUỸ LỚP THEO ĐỢT
export type FundDebtStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';
export interface FundCollectionPeriod { id: string; category: string; name: string; amountPerPerson: number; deadline: string; createdBy: string; status: 'open' | 'closed'; createdAt: string; }
export interface FundDebt { id: string; periodId: string; studentId: string; amountOwed: number; amountPaid: number; status: FundDebtStatus; note: string; }
export interface FundDebtPayment { id: string; debtId: string; amount: number; note: string; recordedBy: string; createdAt: string; }
export interface FundDebtData { periods: FundCollectionPeriod[]; debts: FundDebt[]; payments: FundDebtPayment[]; }

export interface AppState {
  roster: User[];
  groups: ClassGroup[];
  posts: Post[];
  mentor: Question[];
  timeline: TimelineEvent[];
  currentWeek: string;
  weekAnchor?: string;
  seating?: any;
  conduct?: ConductData;
  reports?: ReportsData;
  board?: BoardData;
  fundData?: FundData;
  assignments?: AssignmentsData;
  fundDebt?: FundDebtData;
  dutyRoster?: DutyRosterData;
}