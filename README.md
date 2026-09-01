# IELTS Dictation

一个可自行部署的 IELTS Listening 逐句听写应用：上传 Transcript 截图，使用千问视觉模型识别和校对原文，批量生成全部句子语音，再进行无等待的逐句听写与词汇积累。

## 功能

- 上传 1–6 张连续 Transcript 截图并保持顺序
- `qwen3-vl-plus` 图片识别和人工校对
- 按句号、问号和感叹号规范化为“一条 segment 一句话”
- Part 1–4 模式及各 Part 独立语音配置
- `qwen-audio-3.0-tts-plus` 批量生成逐句音频
- 所有音频生成成功后才开放练习，失败时可安全重试
- 逐词听写、答案对齐、上一句/下一句、进度保存和重新开始
- `qwen3.6-flash` 语境释义，以及按 Practice 自动分组的个人单词本
- SQLite 本地持久化；截图、音频和数据保留在部署者自己的电脑
- 网页 AI 配置页只允许本机写入 `backend/.env`

## 技术栈

- Frontend：React 19、Vite 6、React Router
- Backend：FastAPI、Pydantic、SQLite、HTTPX
- AI：Alibaba Cloud DashScope / Qwen
- 默认端口：前端 `4173`，后端 `8010`

## 环境要求

- Node.js 20 或更高版本
- Python 3.11 或更高版本
- 一个可用的 [Alibaba Cloud Model Studio / DashScope](https://www.alibabacloud.com/help/en/model-studio/get-api-key) API Key

## 本机部署

### 1. 克隆项目

```bash
git clone https://github.com/cjy15530612552-sudo/ielts-dictation.git
cd ielts-dictation
```

### 2. 启动后端

Windows PowerShell：

```powershell
cd backend
Copy-Item .env.example .env
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

macOS / Linux：

```bash
cd backend
cp .env.example .env
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

### 3. 启动前端

另开一个终端，在项目根目录执行：

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

打开 `http://127.0.0.1:4173`，进入“AI 配置”填写自己的 DashScope API Key。后端会把 Key 保存到本机 `backend/.env` 并立即生效；网页和 API 不会回显 Key。

## API Key 与公开部署安全

三个模型名称在应用中固定：

```env
QWEN_VISION_MODEL=qwen3-vl-plus
QWEN_TEXT_MODEL=qwen3.6-flash
QWEN_TTS_MODEL=qwen-audio-3.0-tts-plus
```

- 仓库不包含任何 API Key。
- `backend/.env` 已被 Git 忽略，禁止提交真实文件。
- 网页保存/清除 Key 的接口只接受回环地址和本机 Origin，远程访客无法修改服务器 `.env`。
- 如果部署到远程服务器，请由服务器管理员直接设置环境变量或创建服务器端 `backend/.env`；不要把 Key 放进前端变量、JavaScript、Docker 镜像或 GitHub 仓库。
- GitHub Pages 只能托管静态前端，无法运行 FastAPI、SQLite、图片识别或 TTS，因此不能单独完成本项目部署。

远程前端构建时可指定后端地址：

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

同时把前端地址加入后端的 `FRONTEND_ORIGINS`。生产环境应使用 HTTPS，并通过反向代理将 `/api` 和 `/audio` 指向 FastAPI。

## 新建练习流程

1. 输入练习名称并选择 Part 1–4。
2. 上传 Transcript 截图并开始识别。
3. 校对结构化 Transcript；系统保证一个 segment 只包含一句话。
4. 点击“确认原文并生成语音”。
5. 后端批量生成全部句子音频，并验证音频数量与句子数量一致。
6. 全部成功后才返回首页并开放练习；任何一句失败都会保留在校对页，可点击重试。

## 听写快捷键

- `Enter`：移动到下一格；最后一格检查答案
- `Space`：当前格有内容且右侧存在空格时插入空位并将中间内容右移；否则移动到下一格
- `Backspace`：空输入时返回上一格
- `←` / `→`：先在当前单词的字母间移动光标；到达开头或末尾后切换输入格
- `Tab`：重播当前句并保留焦点
- `Esc`：停止播放

答案页支持“上一句”“再听一次”“下一句”；首页练习卡支持持久化的“重新开始”。

收藏单词时，后端会使用统一的 TTS 配置自动预生成并缓存单词发音。单词本中的喇叭按钮直接播放缓存音频；旧收藏或失败项目可点击喇叭重新生成。此能力适用于所有练习及未归类收藏。

## 数据目录

以下内容仅保存在部署者本机，并被 `.gitignore` 排除：

- `backend/data/ielts_dictation.sqlite3`：练习与词汇数据
- `backend/data/sessions/`：识别 session
- `backend/data/uploads/`：上传图片
- `backend/storage/audio/`：生成音频

备份这些目录即可迁移个人数据。不要公开包含个人 Transcript 或音频的备份。

## 测试

```bash
npm test
npm run build
npm run test:sites

cd backend
python -m pytest tests -q
```

浏览器视觉测试使用项目内的 Playwright 脚本和 Microsoft Edge 路径，主要面向本项目开发环境：

```bash
npm run test:visual
```

## API 概览

后端启动后访问 `http://127.0.0.1:8010/docs` 查看完整 OpenAPI 文档。主要接口包括：

- `/api/transcript/*`：上传、识别、校对和确认 Transcript
- `/api/practices/*`：练习、进度、重置与音频状态
- `/api/tts/*`：语音配置、批量生成与 Voice Lab
- `/api/vocabulary`、`/api/word/explain`：单词本和语境解释
- `/api/ai/config`、`/api/ai/key`：锁定模型配置与本机 Key 管理

## License

[MIT](LICENSE)
