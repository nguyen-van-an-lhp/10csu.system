import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import {
  BookOpen, ShieldAlert, CheckCircle2, AlertTriangle, Clock, Shirt, DoorOpen,
  Building2, MessageSquareWarning, ListChecks, Trophy, Info, XCircle
} from 'lucide-react';

// ============================================================================
// DANH MỤC "TÍNH 1 LỖI" — số hóa nguyên văn từ bảng "Vi phạm tính 1 lỗi /
// Thông tư 22" (ảnh chụp sổ tay, trang 21 & 23). Mỗi hành vi giữ đúng nhãn
// tiêu chí Thông tư 22 (Trách nhiệm / Chăm chỉ / Nhân ái / Yêu nước) như in
// trên bản giấy — KHÔNG suy diễn thêm ngoài nội dung đã chụp.
// ============================================================================
const FAULT_ITEMS: { text: string; criteria: string[] }[] = [
  { text: 'Đi học trễ (tính từ lần thứ ba).', criteria: ['5-Trách nhiệm'] },
  { text: 'Đi học mà không điểm danh (tính từ lần thứ ba).', criteria: ['5-Trách nhiệm'] },
  { text: 'Không tham dự lễ hoặc sinh hoạt ngoại khóa (mỗi lần).', criteria: ['5-Trách nhiệm'] },
  { text: 'Nghỉ học có phép, tính từ ngày thứ năm (mỗi ngày).', criteria: ['5-Trách nhiệm'] },
  { text: 'Nghỉ học không phép (mỗi ngày).', criteria: ['5-Trách nhiệm'] },
  { text: 'Trốn tiết hoặc tự ý bỏ về sớm các buổi sinh hoạt tập thể (mỗi lần).', criteria: ['5-Trách nhiệm'] },
  { text: 'Vi phạm quy định của trường/lớp bị ghi nhận vào sổ đầu bài hoặc sổ theo dõi của nhà trường.', criteria: ['3-Chăm chỉ', '5-Trách nhiệm'] },
  { text: 'Tham gia không đủ 02 hoạt động/học kỳ.', criteria: ['3-Chăm chỉ'] },
  { text: 'Không hoàn thành nhiệm vụ được giao (mỗi lần).', criteria: ['5-Trách nhiệm'] },
  { text: 'Bỏ rác không đúng quy định (mỗi lần).', criteria: ['5-Trách nhiệm'] },
  { text: 'Vi phạm quy định của nhà nước về lĩnh vực thông tin và truyền thông.', criteria: ['5-Trách nhiệm'] },
  { text: 'Có hành vi, thái độ xúc phạm danh dự, nhân phẩm của người khác.', criteria: ['2-Nhân ái'] },
  { text: 'Tham gia hoặc tổ chức chống phá kỷ luật nhà trường hoặc an ninh địa phương.', criteria: ['5-Trách nhiệm'] },
  { text: 'Cố tình làm hư hỏng phần mềm học tập, trang thông tin điện tử của nhà trường.', criteria: ['5-Trách nhiệm'] },
  { text: 'Vi phạm những hành vi bị nghiêm cấm khác theo quy định của Pháp luật.', criteria: ['1-Yêu nước', '5-Trách nhiệm'] },
];

const EXEMPT_ITEMS = [
  'Nghỉ học có y chứng của cơ sở khám, chữa bệnh.',
  'Nghỉ học do gia đình có tang.',
  'Tham gia các kỳ thi chứng chỉ quốc tế (có minh chứng).',
  'Thực hiện hồ sơ nghĩa vụ quân sự; phỏng vấn, kiểm tra sức khỏe để hoàn tất hồ sơ du học hoặc định cư nước ngoài (có giấy tờ xác minh).',
  'Được triệu tập tham gia các hoạt động (có phê duyệt của Ban giám hiệu).',
  'Các hoạt động khác (có phê duyệt của Ban giám hiệu).',
];

const ACTIVITY_ROWS = [
  { group: 'Ban cán sự lớp', items: [
    { desc: 'Lớp trưởng, lớp phó, thủ quỹ, bí thư chi đoàn lớp, học sinh phụ trách micro và tủ thiết bị tin học của lớp.', level: 'Hoàn thành tốt trong học kỳ.', point: 2 },
    { desc: 'Tổ trưởng, ủy viên BCH chi đoàn lớp.', level: 'Hoàn thành tốt trong học kỳ.', point: 1 },
  ]},
  { group: 'Đoàn trường', items: [
    { desc: 'Ban chấp hành Đoàn trường.', level: 'Hoàn thành tốt trong học kỳ.', point: 2 },
    { desc: 'Cộng tác viên văn phòng Đoàn trường.', level: 'Hoàn thành.', point: 1 },
    { desc: 'Chủ nhiệm, phó chủ nhiệm CLB do Đoàn trường hoặc GV quản lý.', level: 'Tổ chức tốt các buổi sinh hoạt, điều hành tốt hoạt động CLB.', point: 2 },
  ]},
  { group: 'Đội trật tự học đường & Thư viện', items: [
    { desc: 'Đội trật tự học đường.', level: 'Hoàn thành tốt mỗi lần tham gia.', point: 1 },
    { desc: 'Cộng tác viên thư viện.', level: 'Hoàn thành tốt trong học kỳ.', point: 2 },
    { desc: 'Cộng tác viên thư viện.', level: 'Hoàn thành.', point: 1 },
  ]},
  { group: 'Các hoạt động thể thao', items: [
    { desc: 'VD: 1 lần thi cờ tướng, 1 lần thi cầu lông trường, thi đấu cầu lông cấp quận, tham gia chạy việt dã, một môn thi đấu ngày 9/1……', level: 'Mỗi lần tham gia.', point: 1 },
  ]},
  { group: 'Các hoạt động Đoàn', items: [
    { desc: 'Thi viết bài 20/11, thi làm thiệp, thi cắm hoa… Giấy CN chiến sĩ tình nguyện Hoa phượng đỏ (Quận Đoàn 5/Thành Đoàn cấp). Vào đến bán kết các cuộc thi cấp quận/thành do Đoàn trường phát động. Các hoạt động của Đoàn trường, Quận Đoàn.', level: 'Mỗi lần tham gia 1 hoạt động Đoàn từ cấp trường trở lên.', point: 1 },
  ]},
  { group: 'Các hoạt động văn nghệ', items: [
    { desc: 'Thi cấp trường, thi cấp thành…. Học sinh trong đội văn nghệ (danh sách do GV phụ trách đội chuyển sang).', level: 'Mỗi lần tham gia 1 hoạt động từ cấp trường trở lên.', point: 1 },
    { desc: 'Học sinh trong đội văn nghệ (danh sách do GV phụ trách đội chuyển sang).', level: 'Hoàn thành tốt trong học kỳ.', point: 2 },
  ]},
  { group: 'Các công tác khác của lớp, của trường', items: [
    { desc: 'Tham gia các hoạt động trong các buổi lễ, SHDC, sinh hoạt tập thể,…', level: 'Mỗi lần tham gia và được đánh giá tốt.', point: 1 },
  ]},
  { group: 'HSG Quốc gia / ISEF / NCKH / Olympic', items: [
    { desc: 'Dự thi HSG cấp Quốc gia, ISEF cấp thành (HKI), nghiên cứu khoa học cấp quốc gia (HKII), dự kỳ thi Olympic.', level: '1 lần tham dự hoặc 1 lần đạt giải, học sinh đạt giải HSGQG.', point: 2 },
  ]},
  { group: 'Điều động ngoài TKB', items: [
    { desc: 'Tham gia hoạt động do Đoàn trường, Quận Đoàn điều động ngoài thời khóa biểu.', level: 'Mỗi lần tham gia và được đánh giá tốt.', point: 1 },
  ]},
  { group: 'Cổ vũ phong trào', items: [
    { desc: 'Tham gia cổ vũ các hoạt động thể dục thể thao, Đoàn, ...', level: 'Mỗi lần tham gia và được ghi nhận.', point: 1 },
  ]},
];

export default function Rules() {
  const [activeTab, setActiveTab] = useState<'general' | 'conduct' | 'activities' | 'faults'>('general');

  const tabs = [
    { id: 'general', label: 'Thời gian & Tác phong' },
    { id: 'conduct', label: 'Cơ sở vật chất & Ứng xử' },
    { id: 'activities', label: 'Hoạt động & Điểm cộng' },
    { id: 'faults', label: 'Vi phạm & Xếp loại' },
  ] as const;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-900 uppercase">Sổ Tay Nội Quy & Đánh Giá Hạnh Kiểm</h1>
            <p className="text-stone-500 mt-1">Toàn văn quy chế rèn luyện, thang điểm và quy tắc xét duyệt trường THPT Chuyên Lê Hồng Phong.</p>
          </div>
          <div className="flex flex-wrap bg-stone-100 p-1.5 rounded-2xl w-full md:w-auto gap-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${activeTab === t.id ? 'bg-white shadow-sm text-red-900' : 'text-stone-500 hover:text-stone-800'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* GHI CHÚ NGUỒN DỮ LIỆU — minh bạch phạm vi số hóa */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900">
          <Info size={18} className="shrink-0 mt-0.5" />
          <p><strong>Về nội dung trang này:</strong> Toàn bộ dữ liệu bên dưới được số hóa trực tiếp từ các trang 17–21 và 23 của Sổ tay. Riêng <strong>trang 22</strong> (nằm giữa hai trang trên, nhiều khả năng chứa phần tiếp theo của bảng vi phạm) chưa có trong ảnh chụp — mục "Hạ 1 mức rèn luyện" và "Vi phạm nghiêm trọng" ở tab <em>Vi phạm & Xếp loại</em> được giữ nguyên theo dữ liệu đã có sẵn trong hệ thống trước đó và cần GVCN đối chiếu lại bản giấy trang 22 để xác nhận.</p>
        </div>

        {/* TAB 1: THỜI GIAN & TÁC PHONG */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-in fade-in duration-200">

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h2 className="text-xl font-serif font-bold text-red-900 mb-4 flex items-center gap-2"><Clock size={20}/> 1. Quy định thời gian tiết học</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="overflow-hidden border border-stone-200 rounded-xl">
                  <div className="bg-stone-100 px-4 py-2 font-bold text-stone-700 text-sm">BUỔI SÁNG</div>
                  <div className="p-4 space-y-2 text-sm text-stone-700">
                    <div className="flex justify-between border-b pb-1"><span>Tiết 1:</span> <span className="font-bold">07h30 - 08h15</span></div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 2:</span> <span className="font-bold">08h20 - 09h05</span></div>
                    <div className="text-center font-bold text-red-800 bg-red-50 py-1 rounded">Ra chơi 20 phút</div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 3:</span> <span className="font-bold">09h25 - 10h10</span></div>
                    <div className="flex justify-between"><span>Tiết 4:</span> <span className="font-bold">10h15 - 11h00</span></div>
                    <div className="text-center font-medium text-stone-500 pt-2 border-t">Học sinh nghỉ trưa 120 phút</div>
                  </div>
                </div>
                <div className="overflow-hidden border border-stone-200 rounded-xl">
                  <div className="bg-stone-100 px-4 py-2 font-bold text-stone-700 text-sm">BUỔI CHIỀU & THỨ BẢY</div>
                  <div className="p-4 space-y-2 text-sm text-stone-700">
                    <div className="flex justify-between border-b pb-1"><span>Tiết 1:</span> <span className="font-bold">13h00 - 13h45</span></div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 2:</span> <span className="font-bold">13h50 - 14h35</span></div>
                    <div className="text-center font-bold text-red-800 bg-red-50 py-1 rounded">Ra chơi 20 phút</div>
                    <div className="flex justify-between border-b pb-1"><span>Tiết 3:</span> <span className="font-bold">14h55 - 15h40</span></div>
                    <div className="flex justify-between"><span>Tiết 4:</span> <span className="font-bold">15h45 - 16h30</span></div>
                    <div className="text-center font-bold text-blue-900 bg-blue-50 py-1 rounded mt-2">Chiều Thứ Bảy: Hoạt động CLB - Đội - Nhóm</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                <h3 className="font-bold text-stone-900 border-b pb-2 flex items-center gap-2"><ListChecks size={16}/> 2. Điểm danh, phép & xin về sớm</h3>
                <p className="text-xs text-stone-700 leading-relaxed">
                  - Điểm danh qua thiết bị nhận diện khuôn mặt trước giờ học ít nhất 5 phút.<br/>
                  - Đi trễ hoặc trễ tiết phải làm bản kiểm điểm (có chữ ký phụ huynh) nộp cho GVCN chậm nhất ngày hôm sau.<br/>
                  - Nghỉ học nộp đơn xin phép và minh chứng tại phòng giám thị. Nghỉ từ 2 ngày liên tiếp, phụ huynh trực tiếp nộp đơn.<br/>
                  - <strong className="text-red-900">Nghỉ quá 45 ngày</strong> (có/không phép, liên tục/không liên tục) sẽ không được lên lớp.<br/>
                  - Trường hợp học sinh xin về sớm, <strong>phụ huynh phải trực tiếp đến trường xin phép và đón học sinh</strong> (mang theo giấy tờ tùy thân).<br/>
                  - Muốn xuống phòng y tế trong giờ học, học sinh phải xin phép GV dạy lớp; khi trở về lớp phải trình giấy ghi rõ giờ đến/rời phòng y tế (theo mẫu).<br/>
                  - Nghỉ học không xin phép: nhà trường mời phụ huynh. Nếu phụ huynh không đến theo thư mời, nhà trường xử lý theo quyết định của Hội đồng xét duyệt mức độ rèn luyện.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                <h3 className="font-bold text-stone-900 border-b pb-2 flex items-center gap-2"><Shirt size={16}/> 3. Đồng phục & Tác phong</h3>
                <p className="text-xs text-stone-700 leading-relaxed">
                  - Vào trường mặc đúng đồng phục nhà trường, có phù hiệu đúng tên lớp.<br/>
                  - Đồng phục sơ mi: bỏ áo sơ mi vào quần/váy, không cắt ngắn chiều dài váy, mang giày xăng-đan hoặc giày thể thao.<br/>
                  - Ngày lễ & sáng thứ Hai: nữ sinh mặc trang phục áo dài trắng kiểu truyền thống, xăng-đan cao không quá 5 cm.<br/>
                  - Học thể dục hoặc GDQP: mặc đồng phục thể dục theo quy định, mang giày thể thao.<br/>
                  - Tóc gọn gàng; không nhuộm tóc; không trang điểm; không sơn móng tay, móng chân; không hình xăm hoặc trang sức khác lạ. Nam sinh không đeo bông tai, nữ sinh không đeo nhiều bông tai.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 border-b pb-2 flex items-center gap-2"><DoorOpen size={16}/> 5. Quy định về việc vào cổng và ra cổng</h3>
              <div className="overflow-x-auto border border-stone-200 rounded-xl mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-700 font-bold">
                    <tr><th className="p-3 border-b w-1/3">Cổng trường</th><th className="p-3 border-b">Hướng dẫn</th></tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-stone-700">
                    <tr><td className="p-3 font-bold text-stone-900">Cổng A (cổng chính, 235 Nguyễn Văn Cừ)</td><td className="p-3">Dành cho học sinh đi bộ hoặc đi xe đưa rước.</td></tr>
                    <tr><td className="p-3 font-bold text-stone-900">Cổng D (cách cổng A khoảng 50m, hướng Đại học Khoa học Tự nhiên)</td><td className="p-3">Dành cho học sinh tự đi xe, gửi xe tại hầm xe khu D.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed pt-1">- Không đem người lạ vào trường khi chưa được phép. Không sử dụng điện thoại di động/thiết bị điện tử khi chưa được giáo viên cho phép.</p>
            </div>
          </div>
        )}

        {/* TAB 2: CƠ SỞ VẬT CHẤT, THAM GIA HOẠT ĐỘNG, VĂN HÓA ỨNG XỬ, QUY ĐỊNH KHÁC */}
        {activeTab === 'conduct' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 border-b pb-2 flex items-center gap-2"><Building2 size={16}/> 4. Quy định về sử dụng cơ sở vật chất</h3>
              <p className="text-xs text-stone-700 leading-relaxed">
                - Có ý thức tiết kiệm và giữ gìn của công: tắt đèn, quạt, nước khi không sử dụng; dọn vệ sinh và quét lớp hàng ngày; bỏ rác đúng nơi quy định; không viết, vẽ, dán giấy lên tường, mặt bàn; không leo trèo phá cây xanh trong trường.<br/>
                - Không được xâm phạm tài sản của người khác và của công.<br/>
                - Chỉ được sử dụng các dụng cụ, thiết bị, tài sản của nhà trường khi được cho phép.<br/>
                - Không đem vật dụng hoặc tư trang quý giá vào trường; tự bảo quản vật dụng cá nhân.<br/>
                - Tham gia bán trú hoặc xe đưa rước phải thực hiện đúng Nội quy bán trú và quy định của xe đưa rước.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 border-b pb-2 flex items-center gap-2"><Trophy size={16}/> 6. Quy định về tham gia các hoạt động</h3>
              <p className="text-xs text-stone-700 leading-relaxed">
                - Tích cực tham gia các hoạt động do nhà trường tổ chức, các câu lạc bộ và các phong trào Đoàn Thanh niên.<br/>
                - Không được tự ý tổ chức các hoạt động trong nhà trường mà không được sự cho phép của Ban giám hiệu.<br/>
                - Không được tham gia các trang mạng xã hội với thái độ không đúng đắn gây ảnh hưởng xấu cho cá nhân hoặc tập thể; vi phạm quy định của nhà nước về lĩnh vực thông tin và truyền thông.<br/>
                - Khi chào cờ hoặc tham dự các buổi lễ, ngoại khóa, phải nghiêm túc, xếp hàng đúng nơi quy định, không nói chuyện, không làm việc riêng, tuyệt đối tuân theo sự điều khiển chung.<br/>
                - <strong className="text-stone-900">Mỗi học kỳ phải tham gia đủ 02 hoạt động</strong> phong trào hoặc công tác trường/lớp.<br/>
                - Tham gia nhiều hơn 02 hoạt động sẽ được ghi nhận xem xét cải thiện lỗi chuyên cần (mỗi hoạt động cải thiện 1 lỗi).
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 border-b pb-2 flex items-center gap-2"><MessageSquareWarning size={16}/> 7. Quy định về văn hóa ứng xử</h3>
              <p className="text-xs text-stone-700 leading-relaxed">
                - Hành vi, ngôn ngữ, ứng xử phải đúng mực, tôn trọng, lễ phép, thân thiện, bảo đảm tính văn hóa, phù hợp với đạo đức và lối sống của lứa tuổi học sinh trung học.<br/>
                - Không được sử dụng, trao đổi, truyền bá sản phẩm văn hóa có nội dung xấu, kích động, bạo lực, đồi trụy,…<br/>
                - Không được đánh nhau, gây rối trật tự, an ninh trong nhà trường và nơi công cộng.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 border-b pb-2 flex items-center gap-2"><ShieldAlert size={16}/> 8. Các quy định khác</h3>
              <p className="text-xs text-stone-700 leading-relaxed">
                - Tuyệt đối trung thực trong học tập và trong cuộc sống.<br/>
                - Trong các giờ kiểm tra tại lớp và các kỳ thi, thực hiện nghiêm túc các quy chế và quy định của nhà trường/hội đồng thi.<br/>
                - Không được có biểu hiện tình cảm không phù hợp trong trường học.<br/>
                - Không được đưa người lạ vào trường nếu không được cho phép.<br/>
                - Không được sử dụng điện thoại di động/thiết bị điện tử khi chưa được giáo viên cho phép.<br/>
                - Không được mua bán, sử dụng rượu, bia, thuốc lá, chất gây nghiện,…<br/>
                - Không được mang vào trường các chất gây cháy, nổ.<br/>
                - Phải tham gia Bảo hiểm y tế theo Luật bảo hiểm y tế.<br/>
                - Phải thực hiện tốt Luật giao thông đường bộ và các quy định khác của Pháp luật.<br/>
                - Phải thực hiện tốt Luật an ninh mạng và các quy định về thông tin – truyền thông.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: HOẠT ĐỘNG & ĐIỂM CỘNG */}
        {activeTab === 'activities' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h2 className="text-xl font-serif font-bold text-red-900 mb-2">Quy định đánh giá số lượng hoạt động của học sinh</h2>
              <p className="text-sm text-stone-500 mb-6">Mỗi học kỳ, học sinh phải tham gia đủ tối thiểu 02 hoạt động phong trào hoặc công tác trường/lớp. Tham gia nhiều hơn được dùng để cải thiện lỗi chuyên cần (1 hoạt động bù 1 lỗi). GVCN thống kê số hoạt động của học sinh mỗi tuần và báo cáo khối chủ nhiệm mỗi tháng.</p>

              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-100 text-stone-700 font-bold">
                    <tr>
                      <th className="p-3 border-b w-[22%]">Nhóm hoạt động</th>
                      <th className="p-3 border-b">Nội dung / Mức độ đánh giá</th>
                      <th className="p-3 border-b text-center w-[10%]">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-stone-700 align-top">
                    {ACTIVITY_ROWS.map((row, ri) => (
                      row.items.map((it, ii) => (
                        <tr key={`${ri}-${ii}`}>
                          {ii === 0 && (
                            <td rowSpan={row.items.length} className="p-3 font-bold text-stone-900 align-top border-r border-stone-100">{row.group}</td>
                          )}
                          <td className="p-3">
                            <span className="block text-stone-800">{it.desc}</span>
                            <span className="block text-[11px] text-stone-500 italic mt-0.5">{it.level}</span>
                          </td>
                          <td className="p-3 text-center font-bold text-red-900">{it.point}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VI PHẠM & XẾP LOẠI */}
        {activeTab === 'faults' && (
          <div className="space-y-6 animate-in fade-in duration-200">

            <div className="bg-stone-900 p-6 rounded-2xl text-stone-200 shadow-sm border border-stone-800">
              <h2 className="text-xl font-serif font-bold text-white mb-4 flex items-center gap-2"><ShieldAlert size={20}/> 9. Mức đánh giá kết quả rèn luyện theo lỗi vi phạm</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                  <span className="text-emerald-400 font-bold text-lg block mb-1">Xếp loại TỐT</span>
                  <span className="text-sm text-stone-300">Từ 00 đến 03 lỗi vi phạm.</span>
                </div>
                <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                  <span className="text-blue-400 font-bold text-lg block mb-1">Xếp loại KHÁ</span>
                  <span className="text-sm text-stone-300">Từ 04 đến 07 lỗi vi phạm.</span>
                </div>
                <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                  <span className="text-amber-400 font-bold text-lg block mb-1">Xếp loại ĐẠT</span>
                  <span className="text-sm text-stone-300">Từ 08 đến 10 lỗi vi phạm.</span>
                </div>
                <div className="bg-stone-800 p-4 rounded-xl border border-red-500/50">
                  <span className="text-red-500 font-bold text-lg block mb-1">CHƯA ĐẠT</span>
                  <span className="text-sm text-stone-300">Trên 10 lỗi hoặc vi phạm lỗi nghiêm trọng.</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-xl font-serif font-bold text-stone-900">1. Bảng vi phạm tính 1 lỗi (quy đổi theo Thông tư 22)</h2>
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-700 font-bold">
                    <tr><th className="p-3 border-b">Hành vi vi phạm (tính 1 lỗi)</th><th className="p-3 border-b w-[24%]">Tiêu chí Thông tư 22</th></tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-stone-700">
                    {FAULT_ITEMS.map((f, i) => (
                      <tr key={i}>
                        <td className="p-3">{f.text}</td>
                        <td className="p-3 space-x-1">
                          {f.criteria.map(c => <span key={c} className="inline-block px-2 py-0.5 bg-stone-100 rounded-full text-[10px] font-bold text-stone-600">{c}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200">
                <span className="font-bold text-amber-900 block mb-2">2. Vi phạm HẠ 1 MỨC rèn luyện (tụt bậc ngay)</span>
                <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800">
                  <li>Không trung thực trong học tập, kiểm tra hoặc cuộc sống.</li>
                  <li>Tự ý sử dụng tài sản nhà trường, đăng thông tin nội bộ gây ảnh hưởng xấu.</li>
                  <li>Tự ý tổ chức hoạt động trực tiếp/trực tuyến trong trường khi chưa được phép.</li>
                  <li>Mua bán, sử dụng rượu bia, thuốc lá.</li>
                </ul>
                <p className="text-[10px] text-amber-700 italic mt-2">* Chưa được xác nhận lại với trang 22 — xem ghi chú nguồn dữ liệu ở đầu trang.</p>
              </div>

              <div className="p-5 bg-red-50 rounded-2xl border border-red-200">
                <span className="font-bold text-red-900 block mb-2">3. Vi phạm NGHIÊM TRỌNG (xếp loại CHƯA ĐẠT ngay)</span>
                <ul className="list-disc pl-5 space-y-1 text-xs text-red-800">
                  <li>Gian lận trong kỳ thi tập trung do Sở/Bộ tổ chức (lập biên bản, xử lý theo hội đồng thi).</li>
                  <li>Vô lễ với Cán bộ, Giáo viên, Nhân viên nhà trường; đánh bạn hoặc đưa người ngoài vào trường.</li>
                  <li>Mang chất cháy nổ, chất kích thích vào trường; ăn cắp, phá hoại tài sản nhà trường.</li>
                </ul>
                <p className="text-[10px] text-red-700 italic mt-2">* Chưa được xác nhận lại với trang 22 — xem ghi chú nguồn dữ liệu ở đầu trang.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2"><CheckCircle2 size={20} className="text-emerald-600"/> Trường hợp nghỉ học KHÔNG bị tính lỗi</h2>
              <ul className="space-y-2">
                {EXEMPT_ITEMS.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-stone-700 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" /> {it}
                  </li>
                ))}
              </ul>

              <div className="pt-2 space-y-2 text-xs text-stone-600 border-t border-stone-100">
                <p className="flex items-start gap-2"><AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5"/> Khi học sinh vi phạm đến lỗi thứ 03, GVCN thông báo đến phụ huynh để phối hợp giáo dục, có lưu hồ sơ trong sổ chủ nhiệm.</p>
                <p className="flex items-start gap-2"><XCircle size={14} className="text-red-500 shrink-0 mt-0.5"/> Khi nhà trường mời phụ huynh mà phụ huynh không đến, nhà trường xử lý theo quyết định của Hội đồng xét duyệt mức độ rèn luyện.</p>
                <p className="flex items-start gap-2"><BookOpen size={14} className="text-stone-400 shrink-0 mt-0.5"/> Kết quả rèn luyện mỗi học kỳ được tính và cập nhật theo kế hoạch thời gian năm học.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
