import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import {
  BookOpen, ShieldAlert, CheckCircle2, AlertTriangle, Clock, Shirt, DoorOpen,
  Building2, MessageSquareWarning, ListChecks, Trophy, Info, XCircle, 
  GraduationCap, Calculator, Award, Star, HeartHandshake, Flag
} from 'lucide-react';

// ============================================================================
// DỮ LIỆU SỐ HÓA - TUÂN THỦ TUYỆT ĐỐI NGUYÊN VĂN TỪ SỔ TAY 
// ============================================================================

const FAULT_ITEMS = [
  { text: 'Mỗi lần đi học trễ, tính từ lần thứ ba.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mỗi lần đi học mà không điểm danh, tính từ lần thứ ba.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mỗi lần không tham dự lễ hoặc sinh hoạt ngoại khóa.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mỗi ngày nghỉ học có phép, tính từ ngày thứ năm.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mỗi ngày nghỉ học không phép.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mỗi lần trốn tiết hoặc tự ý bỏ về sớm các buổi sinh hoạt tập thể.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mỗi lần vi phạm quy định của trường/lớp bị ghi nhận vào sổ đầu bài hoặc sổ theo dõi của nhà trường.', criteria: ['3-Chăm chỉ', '5-Trách nhiệm'] },
  { text: 'Tham gia không đủ 02 hoạt động/học kỳ.', criteria: ['3-Chăm chỉ'] },
  { text: 'Mỗi lần không hoàn thành nhiệm vụ được giao.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mỗi lần bỏ rác không đúng quy định.', criteria: ['5-Trách nhiệm'] },
  { text: 'Vi phạm luật giao thông (có gửi giấy từ cơ quan CA) - Tính theo số lỗi được ghi trong biên bản vi phạm cảnh sát giao thông.', criteria: ['1-Yêu nước', '5-Trách nhiệm'] },
  { text: 'Vi phạm quy định của nhà nước về lĩnh vực thông tin và truyền thông.', criteria: ['5-Trách nhiệm'] },
  { text: 'Có hành vi, thái độ xúc phạm danh dự, nhân phẩm của người khác.', criteria: ['2-Nhân ái'] },
  { text: 'Tham gia hoặc tổ chức chống phá kỷ luật nhà trường hoặc an ninh địa phương.', criteria: ['5-Trách nhiệm'] },
  { text: 'Cố tình làm hư hỏng phần mềm học tập, trang thông tin điện tử của nhà trường.', criteria: ['5-Trách nhiệm'] },
  { text: 'Vi phạm những hành vi bị nghiêm cấm khác theo quy định của Pháp luật.', criteria: ['1-Yêu nước', '5-Trách nhiệm'] },
];

const DOWNGRADE_FAULTS = [
  { text: 'Có hành vi không trung thực trong học tập hoặc trong cuộc sống.', criteria: ['4-Trung thực'] },
  { text: 'Có hành vi không trung thực trong giờ kiểm tra tại lớp.', criteria: ['4-Trung thực'] },
  { text: 'Tự ý sử dụng tài sản của nhà trường khi chưa được phép.', criteria: ['5-Trách nhiệm'] },
  { text: 'Tự ý đăng các thông tin nội bộ gây ảnh hưởng xấu đến trường, lớp.', criteria: ['5-Trách nhiệm'] },
  { text: 'Tự ý tổ chức các hoạt động trực tiếp hoặc trực tuyến trong nhà trường mà chưa được sự cho phép.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mua bán, sử dụng rượu, bia, thuốc lá.', criteria: ['5-Trách nhiệm'] },
];

const SEVERE_FAULTS = [
  { text: 'Có hành vi gian lận trong kiểm tra tập trung tại trường, các kì thi do Sở, Bộ tổ chức có lập biên bản và chịu xử lý điểm số bài kiểm tra hoặc bài thi theo quy định của hội đồng kiểm tra/thi.', criteria: ['4-Trung thực'] },
  { text: 'Vô lễ với Cán Bộ, Giáo viên, Nhân viên trong trường.', criteria: ['2-Nhân ái'] },
  { text: 'Đánh bạn hoặc đưa người ngoài vào trường làm mất an ninh trật tự trong nhà trường.', criteria: ['5-Trách nhiệm'] },
  { text: 'Mang vào trường chất gây cháy, nổ, chất kích thích, chất gây nghiện.', criteria: ['5-Trách nhiệm'] },
  { text: 'Ăn cắp hay phá hoại tài sản của người khác hoặc của trường.', criteria: ['4-Trung thực', '5-Trách nhiệm'] },
  { text: 'Sử dụng, trao đổi, truyền bá sản phẩm văn hóa có nội dung kích động, bạo lực, đồi trụy,...', criteria: ['1-Yêu nước', '5-Trách nhiệm'] },
];

const EXEMPT_ITEMS = [
  'Học sinh nghỉ học có y chứng của cơ sở khám, chữa bệnh.',
  'Học sinh nghỉ học do gia đình có tang.',
  'Học sinh tham gia các kỳ thi chứng chỉ quốc tế (có minh chứng).',
  'Các trường hợp như thực hiện hồ sơ nghĩa vụ quân sự; phỏng vấn, kiểm tra sức khỏe để hoàn tất hồ sơ du học hoặc định cư nước ngoài (có giấy tờ xác minh).',
  'Học sinh được triệu tập tham gia các hoạt động (có phê duyệt của Ban giám hiệu).',
  'Các hoạt động khác (có phê duyệt của Ban giám hiệu).',
];

const ACTIVITY_ROWS = [
  { group: 'Ban cán sự lớp', items: [
    { desc: 'Lớp trưởng, lớp phó, thủ quỹ, bí thư chi đoàn, học sinh phụ trách micro và tủ thiết bị tin học của lớp.', level: 'Hoàn thành tốt trong học kì.', point: 2 },
    { desc: 'Tổ trưởng, ủy viên BCH chi đoàn lớp.', level: 'Hoàn thành tốt trong học kì.', point: 1 },
  ]},
  { group: 'Đoàn trường', items: [
    { desc: 'Ban chấp hành Đoàn trường.', level: 'Hoàn thành tốt trong học kì.', point: 2 },
    { desc: 'Cộng tác viên văn phòng Đoàn trường.', level: 'Hoàn thành tốt trong học kì.', point: 2 },
    { desc: 'Chủ nhiệm, phó chủ nhiệm Câu lạc bộ do Đoàn trường hoặc do giáo viên quản lý.', level: 'Hoàn thành.', point: 1 },
    { desc: 'Chủ nhiệm, phó chủ nhiệm Câu lạc bộ do Đoàn trường hoặc do giáo viên quản lý.', level: 'Tổ chức tốt các buổi sinh hoạt, điều hành tốt hoạt động CLB.', point: 2 },
  ]},
  { group: 'Đội trật tự học đường & Thư viện', items: [
    { desc: 'Đội trật tự học đường.', level: 'Hoàn thành tốt mỗi lần tham gia.', point: 1 },
    { desc: 'Cộng tác viên thư viện.', level: 'Hoàn thành tốt trong học kì.', point: 2 },
    { desc: 'Cộng tác viên thư viện.', level: 'Hoàn thành.', point: 1 },
  ]},
  { group: 'Các hoạt động thể thao', items: [
    { desc: 'VD: 1 lần thi cờ tướng, 1 lần thi cầu lông cấp trường, 1 lần thi đấu cầu lông cấp quận, tham gia chạy việt dã, một môn thi đấu trong ngày 9/1 ......', level: 'Mỗi lần tham gia.', point: 1 },
  ]},
  { group: 'Các hoạt động Đoàn', items: [
    { desc: 'Thi viết bài 20/11, thi làm thiệp, thi cắm hoa...\nHọc sinh có giấy chứng nhận chiến sĩ tình nguyện Hoa phượng đỏ (Quận Đoàn 5/Thành Đoàn cấp).\nHọc sinh vào đến bán kết các cuộc thi (cấp quận/cấp thành phố) do Đoàn trường phát động.\nCác điều động của Đoàn trường, Quận đoàn.', level: 'Mỗi lần tham gia 1 hoạt động Đoàn từ cấp trường trở lên.', point: 1 },
  ]},
  { group: 'Các hoạt động văn nghệ', items: [
    { desc: 'Thi cấp trường, thi cấp thành....\nHọc sinh trong đội văn nghệ (danh sách do giáo viên phụ trách đội chuyển sang).', level: 'Mỗi lần tham gia 1 hoạt động từ cấp trường trở lên.', point: 1 },
    { desc: 'Học sinh trong đội văn nghệ (danh sách do giáo viên phụ trách đội chuyển sang).', level: 'Hoàn thành tốt trong học kỳ.', point: 2 },
  ]},
  { group: 'Các công tác khác của lớp, của trường', items: [
    { desc: 'Tham gia các hoạt động trong các buổi lễ, SHDC, sinh hoạt tập thể,...', level: 'Mỗi lần tham gia và được đánh giá tốt.', point: 1 },
  ]},
  { group: 'HSG Quốc gia / ISEF / NCKH / Olympic', items: [
    { desc: 'Học sinh tham dự kỳ thi HSG cấp Quốc gia, ISEF cấp thành phố (HKI), nghiên cứu khoa học cấp quốc gia (HKII) và học sinh tham dự kỳ thi Olympic.', level: '1 lần tham dự hoặc 1 lần đạt giải, học sinh đạt giải HSGQG.', point: 2 },
  ]},
  { group: 'Điều động ngoài TKB', items: [
    { desc: 'Tham gia hoạt động do Đoàn trường, Quận Đoàn điều động ngoài TKB.', level: 'Mỗi lần tham gia và được đánh giá tốt.', point: 1 },
  ]},
  { group: 'Cổ vũ phong trào', items: [
    { desc: 'Học sinh tham gia cổ vũ các hoạt động thể dục thể thao, Đoàn, ...', level: 'Mỗi lần tham gia và được ghi nhận.', point: 1 },
  ]},
];

export default function Rules() {
  const [activeTab, setActiveTab] = useState<'general' | 'conduct' | 'activities' | 'faults' | 'evaluation'>('general');

  const tabs = [
    { id: 'general', label: 'Thời gian & Tác phong' },
    { id: 'conduct', label: 'Cơ sở vật chất & Ứng xử' },
    { id: 'activities', label: 'Hoạt động & Điểm cộng' },
    { id: 'faults', label: 'Vi phạm & Xếp loại' },
    { id: 'evaluation', label: 'Học tập & Khen thưởng' },
  ] as const;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-primary-800 to-primary-700 p-6 md:p-8 rounded-3xl border border-primary-900 shadow-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4">
             <BookOpen size={200} />
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-sans font-extrabold text-white flex items-center gap-3">
              <BookOpen size={32} className="text-amber-400" /> Sổ tay nội quy và đánh giá
            </h1>
            <p className="text-primary-100 mt-2 text-sm max-w-2xl">Toàn văn quy chế rèn luyện, thang điểm, tiêu chí Thông tư 22 và quy tắc xét duyệt trường THPT chuyên Lê Hồng Phong.</p>
          </div>
          <div className="flex flex-wrap bg-black/20 p-1.5 rounded-2xl w-full lg:w-auto gap-1 relative z-10">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-white shadow-md text-primary-800 scale-105' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: THỜI GIAN & TÁC PHONG (Trang 16, 17) */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-xl font-sans font-bold text-primary-700 mb-4 flex items-center gap-2"><Clock size={20}/> 1. Quy định về thời gian tiết học</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                  <div className="bg-gray-100 px-4 py-3 font-bold text-gray-800 text-sm flex justify-between"><span>BUỔI SÁNG</span></div>
                  <div className="p-4 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between border-b pb-1"><span>Tiết 1:</span> <span className="font-bold">07g30 – 08g15</span></div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 2:</span> <span className="font-bold">08g20 – 09g05</span></div>
                    <div className="text-center font-bold text-primary-700 bg-primary-50 py-1.5 rounded my-1">Ra chơi 20 phút</div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 3:</span> <span className="font-bold">09g25 – 10g10</span></div>
                    <div className="flex justify-between"><span>Tiết 4:</span> <span className="font-bold">10g15 – 11g00</span></div>
                    <div className="text-center font-bold text-gray-600 pt-3 border-t bg-gray-50 rounded-b mt-2 pb-2">Học sinh nghỉ trưa 120 phút</div>
                  </div>
                </div>
                <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                  <div className="bg-gray-100 px-4 py-3 font-bold text-gray-800 text-sm">BUỔI CHIỀU & THỨ BẢY</div>
                  <div className="p-4 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between border-b pb-1"><span>Tiết 1:</span> <span className="font-bold">13g00 – 13g45</span></div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 2:</span> <span className="font-bold">13g50 – 14g35</span></div>
                    <div className="text-center font-bold text-primary-700 bg-primary-50 py-1.5 rounded my-1">Ra chơi 20 phút</div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 3:</span> <span className="font-bold">14g55 – 15g40</span></div>
                    <div className="flex justify-between"><span>Tiết 4:</span> <span className="font-bold">15g45 – 16g30</span></div>
                    <div className="text-center font-bold text-blue-900 bg-blue-50 py-2 rounded mt-2 text-xs">Chiều Thứ Bảy:<br/>Hoạt động Câu lạc bộ - Đội - Nhóm của học sinh</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2"><ListChecks size={18} className="text-blue-600"/> 2. Điểm danh, xin phép vắng, trễ hoặc về sớm</h3>
                <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                  <p>- Học sinh điểm danh qua các thiết bị nhận diện khuôn mặt vào đầu mỗi buổi học theo thời khóa biểu.</p>
                  <p>- Học sinh phải thực hiện điểm danh <strong>trước giờ học ít nhất 5 phút</strong> và có mặt tại lớp trước khi bắt đầu tiết học.</p>
                  <p>- Khi học sinh đi học trễ (theo ghi nhận của hệ thống điểm danh) hoặc vào trễ tiết học (theo ghi nhận của giáo viên bộ môn): học sinh phải làm bản kiểm điểm (có chữ kí của phụ huynh) nộp cho Giáo viên chủ nhiệm, trễ nhất vào ngày hôm sau.</p>
                  <p>- Khi học sinh nghỉ học trong ngày, học sinh nộp đơn xin phép và minh chứng (nếu có) tại phòng giám thị, trễ nhất vào ngày hôm sau.</p>
                  <p>- Khi học sinh nghỉ học từ 2 ngày liên tiếp trở lên, phụ huynh trực tiếp đến phòng giám thị của trường nộp đơn xin phép, trễ nhất vào ngày học sinh đi học lại.</p>
                  <p className="text-red-700 bg-red-50 p-2 rounded-lg border border-red-100 font-medium">- Học sinh nghỉ học quá 45 ngày trong một năm học (bao gồm nghỉ học có phép và không phép, nghỉ học liên tục hoặc không liên tục) sẽ không được lên lớp hoặc không được công nhận hoàn thành chương trình trung học phổ thông.</p>
                  <p>- Trường hợp học sinh xin về sớm, phụ huynh phải trực tiếp đến trường xin phép và đón học sinh (Phụ huynh mang theo giấy tờ tùy thân).</p>
                  <p>- Trường hợp học sinh muốn xuống phòng y tế trong giờ học, học sinh phải xin phép giáo viên dạy lớp. Khi trở về lớp, học sinh trình giáo viên bộ môn giấy xin phép có ghi rõ giờ đến và giờ rời phòng y tế của cán bộ phòng y tế (theo mẫu).</p>
                  <p>- Khi học sinh nghỉ học không xin phép thì nhà trường sẽ mời phụ huynh. Nếu phụ huynh học sinh không vào trường theo thư mời thì nhà trường sẽ xử lý theo quyết định của Hội đồng xét duyệt mức độ rèn luyện của học sinh.</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2"><Shirt size={18} className="text-emerald-600"/> 3. Quy định về đồng phục, tác phong</h3>
                <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                  <p>- Khi vào trường, học sinh mặc đúng đồng phục nhà trường và có phù hiệu đúng tên lớp.</p>
                  <p>- Đồng phục sơ mi: bỏ áo sơ mi vào quần/váy, không cắt ngắn chiều dài váy, mang giày xăng-đan hoặc giày thể thao.</p>
                  <p>- Vào các ngày lễ và buổi sáng Thứ Hai, nữ sinh mặc trang phục áo dài trắng, kiểu truyền thống, mang xăng-đan cao không quá 5 cm.</p>
                  <p>- Khi học thể dục hoặc giáo dục quốc phòng, học sinh phải mặc đồng phục thể dục theo quy định của trường, mang giày thể thao.</p>
                  <p>- Học sinh để tóc gọn gàng; không nhuộm tóc; không trang điểm; không sơn móng tay, móng chân; không được có hình xăm hoặc trang sức khác lạ. Nam sinh không được đeo bông tai, nữ sinh không được đeo nhiều bông tai.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CƠ SỞ VẬT CHẤT & ỨNG XỬ (Trang 18, 20, 13, 14, 15) */}
        {activeTab === 'conduct' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-xl font-sans font-bold text-primary-700 border-b pb-3 flex items-center gap-2"><Star size={20}/> Nội quy Học sinh (Theo Thông tư 22)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-2">
                  <h4 className="font-bold text-red-800 flex items-center gap-1"><Flag size={16}/> ĐIỀU 1: Yêu nước</h4>
                  <ul className="list-disc pl-4 text-gray-700 space-y-1 text-xs">
                    <li>Yêu thiên nhiên, di sản, yêu con người. Tự hào và bảo vệ thiên nhiên, di sản, con người.</li>
                    <li>Tự giác thực hiện và vận động người khác thực hiện các quy định của pháp luật, góp phần bảo vệ và xây dựng Nhà nước XHCN Việt Nam.</li>
                    <li>Chủ động, tích cực tham gia và vận động người khác tham gia các hoạt động bảo vệ, phát huy giá trị truyền thống, các di sản văn hóa.</li>
                    <li>Đấu tranh với các âm mưu, hành động xâm phạm lãnh thổ, biên giới quốc gia, các vùng biển thuộc chủ quyền...</li>
                  </ul>
                </div>
                <div className="bg-pink-50/50 p-4 rounded-xl border border-pink-100 space-y-2">
                  <h4 className="font-bold text-pink-800 flex items-center gap-1"><HeartHandshake size={16}/> ĐIỀU 2: Nhân ái</h4>
                  <ul className="list-disc pl-4 text-gray-700 space-y-1 text-xs">
                    <li>Yêu con người, yêu cái đẹp, yêu cái thiện. Kính trọng người lớn tuổi, thầy cô; thương yêu, giúp đỡ và xây dựng tập thể đoàn kết.</li>
                    <li>Tôn trọng quyền và lợi ích hợp pháp của mọi người; đấu tranh với hành vi xâm phạm.</li>
                    <li>Chủ động vận động tham gia các hoạt động từ thiện, phục vụ cộng đồng. Có năng lực giao tiếp hợp tác tốt.</li>
                    <li>Tôn trọng sự khác biệt giữa con người và nền văn hóa (nghề nghiệp, hoàn cảnh, sự đa dạng văn hóa). Sẵn sàng học hỏi, hòa nhập; Ghét cái xấu, cái ác.</li>
                  </ul>
                </div>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                  <h4 className="font-bold text-blue-800 flex items-center gap-1"><BookOpen size={16}/> ĐIỀU 3: Chăm chỉ</h4>
                  <ul className="list-disc pl-4 text-gray-700 space-y-1 text-xs">
                    <li><strong>Chăm học:</strong> Đánh giá điểm mạnh/yếu của bản thân. Có năng lực tự chủ, tự học, giải quyết vấn đề. Tích cực tìm tòi, sáng tạo; có ý chí vượt qua khó khăn để đạt kết quả tốt.</li>
                    <li><strong>Chăm làm:</strong> Tích cực tham gia và vận động tham gia các công việc tập thể, phục vụ cộng đồng. Tham gia đầy đủ các hoạt động giáo dục. Tích cực rèn luyện đảm bảo sức khỏe, bảo vệ môi trường.</li>
                  </ul>
                </div>
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-2">
                  <h4 className="font-bold text-amber-800 flex items-center gap-1"><CheckCircle2 size={16}/> ĐIỀU 4: Trung thực</h4>
                  <ul className="list-disc pl-4 text-gray-700 space-y-1 text-xs">
                    <li>Nhận thức và hành động theo lẽ phải; Sẵn sàng đấu tranh bảo vệ lẽ phải, bảo vệ người tốt, điều tốt.</li>
                    <li>Thật thà, ngay thẳng trong học tập và làm việc.</li>
                    <li>Tự giác tham gia và vận động người khác tham gia phát hiện, đấu tranh với các hành vi thiếu trung thực trong học tập, trong cuộc sống, các hành vi vi phạm chuẩn mực đạo đức, pháp luật.</li>
                  </ul>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-2 lg:col-span-2">
                  <h4 className="font-bold text-emerald-800 flex items-center gap-1"><ShieldAlert size={16}/> ĐIỀU 5: Trách nhiệm</h4>
                  <ul className="list-disc pl-4 text-gray-700 space-y-1 text-xs grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <li><strong>Với bản thân:</strong> Tích cực, tự giác rèn luyện. Sẵn sàng chịu trách nhiệm về lời nói, hành động; không đổ lỗi.</li>
                      <li><strong>Với gia đình:</strong> Có ý thức làm tròn bổn phận. Quan tâm bàn bạc, xây dựng, thực hiện kế hoạch chi tiêu hợp lí.</li>
                    </div>
                    <div>
                      <li><strong>Với nhà trường & xã hội:</strong> Thực hiện nghiêm túc nội quy; chấp hành pháp luật, an toàn giao thông; đấu tranh phê bình hành vi vô kỉ luật. Tích cực hoạt động công ích, tuyên truyền pháp luật.</li>
                      <li><strong>Với môi trường:</strong> Tiết kiệm tài nguyên; đấu tranh ngăn chặn xả rác, phá hoại. Phòng chống thiên tai, ứng phó biến đổi khí hậu.</li>
                    </div>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2"><Building2 size={18} className="text-amber-600"/> 4. Quy định về sử dụng cơ sở vật chất</h3>
                <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                  <p>- Học sinh phải có ý thức tiết kiệm và giữ gìn của công: phải tắt đèn, quạt, nước khi không sử dụng; Dọn vệ sinh và quét lớp hàng ngày; Bỏ rác đúng nơi quy định; Học sinh không viết, vẽ, dán giấy lên tường, mặt bàn; không leo trèo phá cây xanh trong trường.</p>
                  <p>- Học sinh không được xâm phạm tài sản của người khác và của công.</p>
                  <p>- Học sinh chỉ được sử dụng các dụng cụ, thiết bị,...tài sản của nhà trường khi được cho phép.</p>
                  <p>- Học sinh không đem vật dụng hoặc tư trang quý giá vào trường; tự bảo quản vật dụng cá nhân.</p>
                  <p>- Học sinh tham gia bán trú hoặc xe đưa rước phải thực hiện đúng Nội quy bán trú và quy định của xe đưa rước.</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2"><DoorOpen size={18} className="text-blue-600"/> 5. Quy định về việc vào cổng và ra cổng của học sinh</h3>
                <div className="overflow-x-auto border border-gray-200 rounded-xl mt-3 shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-800 font-bold border-b border-gray-300">
                      <tr><th className="p-3 border-r border-gray-200 w-2/5">CỔNG TRƯỜNG</th><th className="p-3 text-center">HƯỚNG DẪN</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-700">
                      <tr>
                        <td className="p-3 font-semibold border-r border-gray-200">Cổng A (cổng chính, 235 Nguyễn Văn Cừ)</td>
                        <td className="p-3">Dành cho học sinh đi bộ hoặc đi xe đưa rước.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold border-r border-gray-200">Cổng D (cách cổng A khoảng 50m về hướng Đại học Khoa học Tự nhiên)</td>
                        <td className="p-3">Dành cho học sinh tự đi xe, gửi xe tại hầm xe khu D.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2"><MessageSquareWarning size={18} className="text-purple-600"/> 7. Quy định về văn hóa ứng xử</h3>
                <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                  <p>- Hành vi, ngôn ngữ, ứng xử của học sinh phải đúng mực, tôn trọng, lễ phép, thân thiện, bảo đảm tính văn hóa, phù hợp với đạo đức và lối sống của lứa tuổi học sinh trung học.</p>
                  <p>- Học sinh không được sử dụng, trao đổi, truyền bá sản phẩm văn hóa có nội dung xấu, kích động, bạo lực, đồi trụy,...</p>
                  <p>- Học sinh không được đánh nhau, gây rối trật tự, an ninh trong nhà trường và nơi công cộng.</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2"><ShieldAlert size={18} className="text-red-600"/> 8. Các quy định khác</h3>
                <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
                  <p>- Học sinh phải tuyệt đối trung thực trong học tập và trong cuộc sống.</p>
                  <p>- Trong các giờ kiểm tra tại lớp và các kỳ thi, học sinh phải thực hiện nghiêm túc các quy chế và quy định của nhà trường/hội đồng thi.</p>
                  <p>- Học sinh không được có biểu hiện tình cảm không phù hợp trong trường học.</p>
                  <p>- Học sinh không được đưa người lạ vào trường nếu không được cho phép.</p>
                  <p>- Học sinh không được sử dụng điện thoại di động/thiết bị điện tử khi không được giáo viên cho phép.</p>
                  <p>- Học sinh không được mua bán, sử dụng rượu, bia, thuốc lá, chất gây nghiện,...</p>
                  <p>- Học sinh không được mang vào trường các chất gây cháy, nổ.</p>
                  <p>- Học sinh phải tham gia Bảo hiểm y tế theo Luật bảo hiểm y tế.</p>
                  <p>- Học sinh phải thực hiện tốt Luật giao thông đường bộ và các quy định khác của Pháp luật.</p>
                  <p>- Học sinh phải thực hiện tốt Luật an ninh mạng và các quy định về thông tin – truyền thông.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HOẠT ĐỘNG & ĐIỂM CỘNG (Trang 18, 19, 20) */}
        {activeTab === 'activities' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2"><Trophy size={18} className="text-amber-500"/> 6. Quy định về tham gia các hoạt động</h3>
              <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                <p>- Tích cực tham gia các hoạt động do nhà trường tổ chức, các câu lạc bộ và các phong trào Đoàn Thanh niên...</p>
                <p>- Học sinh không được tự ý tổ chức các hoạt động trong nhà trường mà không được sự cho phép của Ban giám hiệu.</p>
                <p>- Học sinh không được tham gia các trang mạng xã hội với thái độ không đúng đắn gây ảnh hưởng xấu cho cá nhân hoặc tập thể; vi phạm quy định của nhà nước về lĩnh vực thông tin và truyền thông.</p>
                <p>- Khi chào cờ hoặc tham dự các buổi lễ, ngoại khóa, học sinh phải nghiêm túc, xếp hàng đúng nơi quy định, không nói chuyện, không làm việc riêng và tuyệt đối tuân theo sự điều khiển chung.</p>
                <p className="font-semibold text-primary-800 bg-primary-50 p-2 rounded-lg border border-primary-100">- Mỗi học kì, học sinh phải tham gia đủ 02 hoạt động phong trào hoặc công tác trường/lớp.</p>
                <p className="font-semibold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100">- Học sinh tham gia nhiều hơn 02 hoạt động sẽ được ghi nhận xem xét trong việc cải thiện lỗi chuyên cần (mỗi hoạt động được cải thiện 1 lỗi).</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-xl font-sans font-bold text-primary-700 mb-2">Quy định về đánh giá số lượng hoạt động của học sinh</h2>
              <p className="text-sm text-gray-500 mb-4 italic">(GVCN thống kê số hoạt động của học sinh mỗi tuần và báo cáo khối chủ nhiệm mỗi tháng).</p>

              <div className="overflow-x-auto border border-gray-300 rounded-xl shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-200 text-gray-800 font-bold border-b-2 border-gray-300">
                    <tr>
                      <th className="p-3 border-r border-gray-300 w-1/4">Nhóm hoạt động</th>
                      <th className="p-3 border-r border-gray-300">Nội dung hoạt động</th>
                      <th className="p-3 border-r border-gray-300 w-[20%] text-center">Mức độ đánh giá</th>
                      <th className="p-3 text-center w-[12%]">Số hoạt động được tính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800 align-top">
                    {ACTIVITY_ROWS.map((row, ri) => (
                      row.items.map((it, ii) => (
                        <tr key={`${ri}-${ii}`} className="hover:bg-gray-50">
                          {ii === 0 && (
                            <td rowSpan={row.items.length} className="p-3 font-semibold text-gray-900 align-middle border-r border-gray-200 bg-gray-50/50">{row.group}</td>
                          )}
                          <td className="p-3 border-r border-gray-200 whitespace-pre-wrap">{it.desc}</td>
                          <td className="p-3 border-r border-gray-200 text-center align-middle text-gray-600 text-xs italic">{it.level}</td>
                          <td className="p-3 text-center font-bold text-lg text-primary-700 align-middle bg-primary-50/30">{it.point}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VI PHẠM & XẾP LOẠI (Trang 21, 22, 23) */}
        {activeTab === 'faults' && (
          <div className="space-y-6 animate-in fade-in duration-300">

            <div className="bg-slate-900 p-6 rounded-3xl shadow-lg border border-slate-800">
              <h2 className="text-xl font-sans font-bold text-white mb-5 flex items-center gap-2"><ShieldAlert size={24} className="text-amber-400"/> 9. Mức đánh giá kết quả rèn luyện theo lỗi vi phạm</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity"><Star className="text-emerald-400" size={32}/></div>
                  <span className="text-emerald-400 font-extrabold text-2xl block mb-1">Mức Tốt</span>
                  <span className="text-sm text-gray-300 font-medium">Từ 00 đến 03 lỗi vi phạm.</span>
                </div>
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity"><CheckCircle2 className="text-blue-400" size={32}/></div>
                  <span className="text-blue-400 font-extrabold text-2xl block mb-1">Mức Khá</span>
                  <span className="text-sm text-gray-300 font-medium">Từ 04 đến 07 lỗi vi phạm.</span>
                </div>
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity"><AlertTriangle className="text-amber-400" size={32}/></div>
                  <span className="text-amber-400 font-extrabold text-2xl block mb-1">Mức Đạt</span>
                  <span className="text-sm text-gray-300 font-medium">Từ 08 đến 10 lỗi vi phạm.</span>
                </div>
                <div className="bg-red-950/40 p-5 rounded-2xl border border-red-500/30 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity"><XCircle className="text-red-500" size={32}/></div>
                  <span className="text-red-500 font-extrabold text-2xl block mb-1">Mức Chưa đạt</span>
                  <span className="text-sm text-gray-300 font-medium leading-tight">Trên 10 lỗi vi phạm hoặc vi phạm lỗi nghiêm trọng.</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-xl font-sans font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg text-sm">Bảng 1</span> Vi phạm tính 1 lỗi
              </h2>
              <div className="overflow-x-auto border border-gray-300 rounded-xl shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-amber-50 text-amber-900 font-bold border-b-2 border-amber-200">
                    <tr><th className="p-3 border-r border-amber-200">Vi phạm tính 1 lỗi</th><th className="p-3 w-[20%] text-center">Thông tư 22</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800">
                    {FAULT_ITEMS.map((f, i) => (
                      <tr key={i} className="hover:bg-amber-50/30">
                        <td className="p-3 border-r border-gray-200">{f.text}</td>
                        <td className="p-3 text-center space-y-1">
                          {f.criteria.map(c => <span key={c} className="block w-full px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">{c}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-xl font-sans font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-lg text-sm">Bảng 2</span> Vi phạm hạ 1 mức rèn luyện
              </h2>
              <div className="overflow-x-auto border border-gray-300 rounded-xl shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-orange-50 text-orange-900 font-bold border-b-2 border-orange-200">
                    <tr><th className="p-3 border-r border-orange-200">Vi phạm hạ 1 mức rèn luyện</th><th className="p-3 w-[20%] text-center">Thông tư 22</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800">
                    {DOWNGRADE_FAULTS.map((f, i) => (
                      <tr key={i} className="hover:bg-orange-50/30">
                        <td className="p-3 border-r border-gray-200">{f.text}</td>
                        <td className="p-3 text-center space-y-1">
                          {f.criteria.map(c => <span key={c} className="block w-full px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">{c}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-xl font-sans font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-lg text-sm">Bảng 3</span> Các vi phạm nghiêm trọng - mức rèn luyện Chưa đạt
              </h2>
              <div className="overflow-x-auto border border-red-300 rounded-xl shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-red-50 text-red-900 font-bold border-b-2 border-red-200">
                    <tr><th className="p-3 border-r border-red-200">Các vi phạm nghiêm trọng - mức rèn luyện Chưa đạt</th><th className="p-3 w-[20%] text-center">Thông tư 22</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800">
                    {SEVERE_FAULTS.map((f, i) => (
                      <tr key={i} className="hover:bg-red-50/30">
                        <td className="p-3 border-r border-gray-200">{f.text}</td>
                        <td className="p-3 text-center space-y-1">
                          {f.criteria.map(c => <span key={c} className="block w-full px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">{c}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4">
              <h3 className="text-lg font-sans font-bold text-blue-900 flex items-center gap-2"><Info size={20}/> Lưu ý quan trọng</h3>
              
              <div className="space-y-4 text-sm text-gray-800">
                <div>
                  <p className="font-bold text-gray-900 mb-2">1. Trường hợp học sinh nghỉ học được xem xét không tính lỗi:</p>
                  <ul className="space-y-2">
                    {EXEMPT_ITEMS.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 bg-white/60 border border-blue-100 rounded-xl p-2.5">
                        <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" /> {it}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-white/80 p-4 rounded-xl border border-blue-100 space-y-3">
                  <p className="flex items-start gap-2">
                    <span className="font-bold shrink-0">2.</span> 
                    <span>Khi học sinh vi phạm đến lỗi thứ 03, giáo viên chủ nhiệm thông báo đến phụ huynh để phối hợp trong việc giáo dục học sinh, có lưu hồ sơ trong sổ chủ nhiệm.</span>
                  </p>
                  <p className="flex items-start gap-2 text-red-700 font-medium">
                    <span className="font-bold shrink-0">3.</span> 
                    <span>Khi nhà trường mời phụ huynh để phối hợp giáo dục học sinh mà phụ huynh không đến, nhà trường sẽ xử lý theo quyết định của Hội đồng xét duyệt mức độ rèn luyện của học sinh.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold shrink-0">4.</span> 
                    <span>Kết quả rèn luyện mỗi học kỳ của học sinh sẽ được tính và cập nhật theo kế hoạch thời gian năm học.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: HỌC TẬP & KHEN THƯỞNG (Trang 9, 10, 11, 12, 13) */}
        {activeTab === 'evaluation' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-2xl font-sans font-bold text-primary-800 border-b pb-4 flex items-center gap-2"><Calculator size={28}/> A. Đánh giá kết quả học tập</h2>
              
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-gray-900">1. Kết quả học tập của học sinh theo môn học</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Môn nhận xét */}
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-3">
                    <h4 className="font-bold text-primary-700">a) Đối với môn học đánh giá bằng nhận xét</h4>
                    <p className="text-sm text-gray-700">Trong một học kì, kết quả học tập mỗi môn học của học sinh được đánh giá theo 01 trong 02 mức: Đạt, Chưa đạt.</p>
                    <ul className="text-sm text-gray-700 space-y-1 pl-2 border-l-2 border-primary-300">
                      <li><strong>+ Mức Đạt:</strong> Có đủ số lần kiểm tra, đánh giá theo quy định và tất cả các lần được đánh giá mức Đạt.</li>
                      <li><strong>+ Mức Chưa đạt:</strong> Các trường hợp còn lại.</li>
                    </ul>
                    <p className="text-sm text-gray-700 pt-2 border-t border-gray-200 mt-2">Cả năm học:</p>
                    <ul className="text-sm text-gray-700 space-y-1 pl-2 border-l-2 border-primary-300">
                      <li><strong>+ Mức Đạt:</strong> Kết quả học tập học kì II được đánh giá mức Đạt.</li>
                      <li><strong>+ Mức Chưa đạt:</strong> Kết quả học tập học kì II đánh giá mức Chưa đạt.</li>
                    </ul>
                  </div>

                  {/* Môn nhận xét kết hợp điểm số */}
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 space-y-3">
                    <h4 className="font-bold text-blue-800">b) Đối với môn học đánh giá bằng nhận xét kết hợp đánh giá bằng điểm số</h4>
                    <p className="text-sm text-gray-700">- <strong>Điểm trung bình môn học kì</strong> (ĐTB<sub>mhk</sub>) đối với mỗi môn học được tính như sau:</p>
                    
                    {/* KHỐI CÔNG THỨC TOÁN HỌC CSS ĐỈNH CAO */}
                    <div className="bg-gray-200 p-4 rounded-xl flex justify-center items-center font-serif text-base lg:text-lg overflow-x-auto my-3">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <div className="font-bold">ĐTB<sub>mhk</sub></div>
                        <div>=</div>
                        <div className="flex flex-col items-center">
                          <div className="border-b border-gray-800 pb-1 mb-1 px-2">TĐĐG<sub>tx</sub> + 2.(ĐĐG<sub>gk</sub>) + 3.(ĐĐG<sub>ck</sub>)</div>
                          <div>Số ĐĐG<sub>tx</sub> + 5</div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 text-center italic">TĐĐGtx: Tổng điểm đánh giá thường xuyên.</p>

                    <p className="text-sm text-gray-700 mt-4">- <strong>Điểm trung bình môn cả năm</strong> (ĐTB<sub>mcn</sub>) được tính như sau:</p>
                    <div className="bg-gray-200 p-4 rounded-xl flex justify-center items-center font-serif text-base lg:text-lg overflow-x-auto my-3">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <div className="font-bold">ĐTB<sub>mcn</sub></div>
                        <div>=</div>
                        <div className="flex flex-col items-center">
                          <div className="border-b border-gray-800 pb-1 mb-1 px-4">ĐTB<sub>mhkI</sub> + 2.(ĐTB<sub>mhkII</sub>)</div>
                          <div>3</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">2. Kết quả học tập trong từng học kì, cả năm học (4 mức)</h3>
                <p className="text-sm text-gray-600 italic">Lưu ý: Không còn ĐTB các môn, đánh giá dựa trên ĐTB của từng môn.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
                    <h4 className="font-bold text-emerald-700 mb-2">a) Mức Tốt:</h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                      <li>Tất cả các môn học đánh giá bằng nhận xét được đánh giá mức Đạt.</li>
                      <li>Tất cả các môn học đánh giá bằng nhận xét kết hợp đánh giá bằng điểm số có ĐTBmhk, ĐTBmcn từ <strong>6,5 điểm</strong> trở lên, trong đó có ít nhất 06 môn học có ĐTBmhk, ĐTBmcn đạt từ <strong>8,0 điểm</strong> trở lên.</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30">
                    <h4 className="font-bold text-blue-700 mb-2">b) Mức Khá:</h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                      <li>Tất cả các môn học đánh giá bằng nhận xét được đánh giá mức Đạt.</li>
                      <li>Tất cả các môn học đánh giá bằng nhận xét kết hợp đánh giá bằng điểm số có ĐTBmhk, ĐTBmcn từ <strong>5,0 điểm</strong> trở lên, trong đó có ít nhất 06 môn học có ĐTBmhk, ĐTBmcn đạt từ <strong>6,5 điểm</strong> trở lên.</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30">
                    <h4 className="font-bold text-amber-700 mb-2">c) Mức Đạt:</h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                      <li>Có <strong>nhiều nhất 01 (một)</strong> môn học đánh giá bằng nhận xét được đánh giá mức Chưa đạt.</li>
                      <li>Có ít nhất 06 môn học đánh giá bằng nhận xét kết hợp đánh giá bằng điểm số có ĐTBmhk, ĐTBmcn từ <strong>5,0 điểm</strong> trở lên; <strong>không có môn học nào</strong> có ĐTBmhk, ĐTBmcn dưới <strong>3,5 điểm</strong>.</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50/30">
                    <h4 className="font-bold text-red-700 mb-2">d) Mức Chưa đạt:</h4>
                    <p className="text-sm text-gray-700 pl-2">Các trường hợp còn lại.</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-1">3. Điều chỉnh mức đánh giá kết quả học tập</h3>
                <p className="text-sm text-gray-800">Nếu mức đánh giá kết quả học tập bị thấp xuống từ 02 (hai) mức trở lên so với mức đánh giá quy định tại điểm a, điểm b (Tốt, Khá) <strong>do kết quả của duy nhất 01 (một) môn học</strong> thì mức đánh giá kết quả học tập được điều chỉnh lên mức liền kề.</p>
              </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-2xl font-sans font-bold text-emerald-800 border-b pb-4 flex items-center gap-2"><GraduationCap size={28}/> B. Đánh giá kết quả rèn luyện</h2>
              
              <div className="space-y-4 text-sm text-gray-700">
                <p className="italic">Trích Điều 8 - Thông tư 22/2021/TT-BGDĐT.</p>
                <p>Kết quả rèn luyện của học sinh trong từng học kì và cả năm học được đánh giá theo 01 (một) trong 04 (bốn) mức: <strong>Tốt, Khá, Đạt, Chưa đạt.</strong></p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-2 border-b pb-1">a) Kết quả rèn luyện của học sinh trong từng học kì</h4>
                    <ul className="space-y-2">
                      <li><strong>- Mức Tốt:</strong> Đáp ứng tốt yêu cầu cần đạt, có nhiều biểu hiện nổi bật.</li>
                      <li><strong>- Mức Khá:</strong> Đáp ứng yêu cầu cần đạt, có biểu hiện nổi bật nhưng chưa đạt mức Tốt.</li>
                      <li><strong>- Mức Đạt:</strong> Đáp ứng yêu cầu cần đạt.</li>
                      <li><strong>- Mức Chưa đạt:</strong> Chưa đáp ứng yêu cầu cần đạt.</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-2 border-b pb-1">b) Kết quả rèn luyện của học sinh cả năm học</h4>
                    <ul className="space-y-2">
                      <li><strong>- Mức Tốt:</strong> HK II mức Tốt, HK I từ Khá trở lên.</li>
                      <li><strong>- Mức Khá:</strong> HK II mức Khá, HK I từ Đạt trở lên; hoặc HK II mức Đạt, HK I mức Tốt; hoặc HK II mức Tốt, HK I Đạt/Chưa đạt.</li>
                      <li><strong>- Mức Đạt:</strong> HK II mức Đạt, HK I mức Khá, Đạt hoặc Chưa đạt; hoặc HK II mức Khá, HK I Chưa đạt.</li>
                      <li><strong>- Mức Chưa đạt:</strong> Các trường hợp còn lại.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <h2 className="text-xl font-sans font-bold text-gray-900 border-b pb-3 flex items-center gap-2"><DoorOpen size={24} className="text-blue-600"/> C. Lên lớp & Rèn luyện trong hè</h2>
                <div className="text-sm text-gray-700 space-y-3">
                  <p className="font-bold text-blue-900">Được lên lớp khi đủ các điều kiện:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Kết quả rèn luyện cả năm học (bao gồm kết quả đánh giá lại sau khi rèn luyện trong kì nghỉ hè) được đánh giá mức <strong>Đạt trở lên</strong>.</li>
                    <li>Kết quả học tập cả năm học (bao gồm kết quả đánh giá lại các môn học) được đánh giá mức <strong>Đạt trở lên</strong>.</li>
                    <li>Nghỉ học <strong>không quá 45 buổi</strong> trong một năm học (tính theo kế hoạch giáo dục, bao gồm có phép/không phép, liên tục/không liên tục).</li>
                  </ul>
                  <p className="font-bold text-amber-700 mt-4 pt-4 border-t">Rèn luyện trong kì nghỉ hè:</p>
                  <p>Học sinh có kết quả rèn luyện cả năm học đánh giá mức Chưa đạt thì phải rèn luyện trong kì nghỉ hè. Cuối kì nghỉ hè, GVCN đánh giá báo cáo kết quả cho Hiệu trưởng xét.</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <h2 className="text-xl font-sans font-bold text-gray-900 border-b pb-3 flex items-center gap-2"><Award size={24} className="text-amber-500"/> Khen thưởng</h2>
                <div className="text-sm text-gray-700 space-y-4">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2"><Star size={16} fill="currentColor"/> Danh hiệu "Học sinh Xuất sắc"</h4>
                    <p>Đối với những học sinh có kết quả rèn luyện cả năm học đánh giá mức <strong>Tốt</strong>, kết quả học tập cả năm học đánh giá mức <strong>Tốt</strong> và có ít nhất 06 môn học đánh giá bằng nhận xét kết hợp đánh giá bằng điểm số có ĐTBmcn đạt từ <strong>9,0 điểm</strong> trở lên.</p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Award size={16}/> Danh hiệu "Học sinh Giỏi"</h4>
                    <p>Đối với những học sinh có kết quả rèn luyện cả năm học đánh giá mức <strong>Tốt</strong> và kết quả học tập cả năm học được đánh giá mức <strong>Tốt</strong>.</p>
                  </div>

                  <p className="italic text-gray-600 text-xs mt-2">* Khen thưởng học sinh có thành tích đột xuất trong rèn luyện và học tập trong năm học.</p>
                  <p className="italic text-gray-600 text-xs">* Học sinh có thành tích đặc biệt được nhà trường xem xét, đề nghị cấp trên khen thưởng.</p>
                </div>
              </div>
            </div>
            
          </div>
        )}

      </div>
    </Layout>
  );
}