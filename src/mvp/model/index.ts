export type AnswerId = "a" | "b" | "c" | "d";

export type AnswerChoice = {
  id: AnswerId;
  label: string;
  text: string;
};

export type QuizQuestion = {
  id: number;
  prompt: string;
  explanation: string;
  choices: AnswerChoice[];
  correctAnswerId: AnswerId;
};

export type AppModel = {
  appName: string;
  timePerQuestionSec: number;
  pointsPerCorrect: number;
  questions: QuizQuestion[];
};

export const createModel = (): AppModel => ({
  appName: "mfe-kahoot-mini-react",
  timePerQuestionSec: 15,
  pointsPerCorrect: 100,
  questions: [
    {
      id: 1,
      prompt: "Thẻ HTML nào dùng để tạo liên kết sang trang khác?",
      explanation: "Thẻ <a> là anchor, dùng để tạo hyperlink.",
      correctAnswerId: "a",
      choices: [
        { id: "a", label: "A", text: "<a>" },
        { id: "b", label: "B", text: "<link>" },
        { id: "c", label: "C", text: "<href>" },
        { id: "d", label: "D", text: "<nav>" },
      ],
    },
    {
      id: 2,
      prompt: "Thuộc tính CSS nào đổi màu chữ?",
      explanation: "`color` điều khiển màu chữ, còn `background-color` là màu nền.",
      correctAnswerId: "b",
      choices: [
        { id: "a", label: "A", text: "font-color" },
        { id: "b", label: "B", text: "color" },
        { id: "c", label: "C", text: "text-style" },
        { id: "d", label: "D", text: "background-color" },
      ],
    },
    {
      id: 3,
      prompt: "Hook React nào thường dùng để lưu state cục bộ của component?",
      explanation: "`useState` là hook cơ bản để lưu và cập nhật local state.",
      correctAnswerId: "c",
      choices: [
        { id: "a", label: "A", text: "useEffect" },
        { id: "b", label: "B", text: "useRef" },
        { id: "c", label: "C", text: "useState" },
        { id: "d", label: "D", text: "useContext" },
      ],
    },
    {
      id: 4,
      prompt: "HTTP status code nào thường biểu thị request thành công?",
      explanation: "200 OK là mã phổ biến nhất cho một request thành công.",
      correctAnswerId: "d",
      choices: [
        { id: "a", label: "A", text: "404" },
        { id: "b", label: "B", text: "500" },
        { id: "c", label: "C", text: "302" },
        { id: "d", label: "D", text: "200" },
      ],
    },
    {
      id: 5,
      prompt: "Hàm JavaScript nào biến object thành JSON string?",
      explanation: "`JSON.stringify` serialize object thành chuỗi JSON.",
      correctAnswerId: "b",
      choices: [
        { id: "a", label: "A", text: "JSON.parse" },
        { id: "b", label: "B", text: "JSON.stringify" },
        { id: "c", label: "C", text: "Object.toJson" },
        { id: "d", label: "D", text: "String.json" },
      ],
    },
    {
      id: 6,
      prompt: "Method mảng nào trả về một mảng mới sau khi biến đổi từng phần tử?",
      explanation: "`map` tạo mảng mới với số lượng phần tử tương ứng.",
      correctAnswerId: "a",
      choices: [
        { id: "a", label: "A", text: "map" },
        { id: "b", label: "B", text: "forEach" },
        { id: "c", label: "C", text: "push" },
        { id: "d", label: "D", text: "splice" },
      ],
    },
    {
      id: 7,
      prompt: "Trong CSS, cần khai báo gì để sắp xếp phần tử bằng Flexbox?",
      explanation: "Flexbox được bật bằng `display: flex` trên phần tử cha.",
      correctAnswerId: "c",
      choices: [
        { id: "a", label: "A", text: "position: flex" },
        { id: "b", label: "B", text: "layout: flex" },
        { id: "c", label: "C", text: "display: flex" },
        { id: "d", label: "D", text: "flex: true" },
      ],
    },
    {
      id: 8,
      prompt: "single-spa được dùng chủ yếu để làm gì?",
      explanation: "single-spa giúp mount nhiều frontend app độc lập trong cùng một shell.",
      correctAnswerId: "d",
      choices: [
        { id: "a", label: "A", text: "Render video stream" },
        { id: "b", label: "B", text: "Kết nối database" },
        { id: "c", label: "C", text: "Biên dịch TypeScript" },
        { id: "d", label: "D", text: "Orchestrate nhiều microfrontend" },
      ],
    },
    {
      id: 9,
      prompt: "API trình duyệt nào lưu dữ liệu key-value bền vững giữa các lần reload?",
      explanation: "`localStorage` tồn tại qua reload và qua lần mở tab sau.",
      correctAnswerId: "b",
      choices: [
        { id: "a", label: "A", text: "sessionMemory" },
        { id: "b", label: "B", text: "localStorage" },
        { id: "c", label: "C", text: "document.cookieStore" },
        { id: "d", label: "D", text: "history.state" },
      ],
    },
    {
      id: 10,
      prompt: "Method nào thêm phần tử vào cuối mảng JavaScript?",
      explanation: "`push` thêm phần tử vào cuối mảng và trả về độ dài mới.",
      correctAnswerId: "a",
      choices: [
        { id: "a", label: "A", text: "push" },
        { id: "b", label: "B", text: "shift" },
        { id: "c", label: "C", text: "slice" },
        { id: "d", label: "D", text: "concatLast" },
      ],
    },
    {
      id: 11,
      prompt: "Trong TypeScript, kiểu nào diễn tả 'chuỗi hoặc null'?",
      explanation: "Union type dùng ký hiệu `|`, ví dụ `string | null`.",
      correctAnswerId: "c",
      choices: [
        { id: "a", label: "A", text: "string && null" },
        { id: "b", label: "B", text: "nullable<string>" },
        { id: "c", label: "C", text: "string | null" },
        { id: "d", label: "D", text: "string?" },
      ],
    },
    {
      id: 12,
      prompt: "Event nào thường gắn với việc submit một form HTML?",
      explanation: "Form phát ra event `submit` khi được gửi đi.",
      correctAnswerId: "d",
      choices: [
        { id: "a", label: "A", text: "change" },
        { id: "b", label: "B", text: "click" },
        { id: "c", label: "C", text: "input" },
        { id: "d", label: "D", text: "submit" },
      ],
    },
    {
      id: 13,
      prompt: "URL nào mở đầu phần query string trong trình duyệt?",
      explanation: "Query string bắt đầu bằng dấu hỏi `?`.",
      correctAnswerId: "a",
      choices: [
        { id: "a", label: "A", text: "?" },
        { id: "b", label: "B", text: "#" },
        { id: "c", label: "C", text: "&" },
        { id: "d", label: "D", text: "/" },
      ],
    },
    {
      id: 14,
      prompt: "Hàm nào chạy lặp lại theo chu kỳ thời gian trong JavaScript?",
      explanation: "`setInterval` gọi callback lặp lại cho đến khi bị clear.",
      correctAnswerId: "b",
      choices: [
        { id: "a", label: "A", text: "setTimeout" },
        { id: "b", label: "B", text: "setInterval" },
        { id: "c", label: "C", text: "requestOnce" },
        { id: "d", label: "D", text: "repeatLater" },
      ],
    },
    {
      id: 15,
      prompt: "Cặp giá trị nào thường được dùng để căn giữa item theo cả trục ngang và dọc trong Flexbox?",
      explanation:
        "`justify-content: center` căn theo trục chính và `align-items: center` căn theo trục phụ.",
      correctAnswerId: "d",
      choices: [
        { id: "a", label: "A", text: "text-align: center + margin: auto" },
        { id: "b", label: "B", text: "display: flex + gap: center" },
        { id: "c", label: "C", text: "place-content: center only" },
        { id: "d", label: "D", text: "justify-content: center + align-items: center" },
      ],
    },
  ],
});
