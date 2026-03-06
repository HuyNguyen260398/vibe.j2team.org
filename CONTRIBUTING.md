# Hướng dẫn đóng góp

Cảm ơn bạn đã quan tâm đến dự án **vibe.j2team.org**! Dưới đây là hướng dẫn để bạn có thể tham gia.

## Yêu cầu

- [Node.js](https://nodejs.org/) phiên bản `^20.19.0` hoặc `>=22.12.0`
- [pnpm](https://pnpm.io/) (bắt buộc, không dùng npm/yarn)

## Bắt đầu

```sh
# 1. Fork repo trên GitHub

# 2. Clone về máy
git clone https://github.com/<username>/vibe.j2team.org.git
cd vibe.j2team.org

# 3. Cài đặt dependencies
pnpm install

# 4. Chạy dev server
pnpm dev
```

## Tạo trang mới

1. Tạo thư mục `src/views/<tên-trang-của-bạn>/` với file `index.vue`
2. Tạo file `meta.ts` trong cùng thư mục để khai báo tên, mô tả và tác giả (route tự động được tạo)
3. Xem trang mẫu: `src/views/hello-world/`

## Quy tắc code

- Sử dụng `<script setup lang="ts">` cho tất cả Vue component
- Sử dụng Composition API (không dùng Options API)
- Không sử dụng `any` hoặc `unknown` trong TypeScript
- Không sử dụng `class` trong TypeScript trừ khi bắt buộc
- Tuân thủ [Design System](docs/DESIGN_SYSTEM.md)
- Tiếng Việt phải có dấu

## Commit convention

Dự án sử dụng [Conventional Commits](https://www.conventionalcommits.org/). Commit message phải theo định dạng:

```
<type>: <mô tả>

Ví dụ:
feat: thêm trang game-2048
fix: sửa lỗi routing trang hello-world
docs: cập nhật README
style: format code
chore: cập nhật dependencies
```

Các type hợp lệ: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

## Quy tắc về branch

- **KHÔNG** làm việc trực tiếp trên branch `main`
- Luôn tạo branch mới từ `main` trước khi bắt đầu code
- Đặt tên branch theo format: `<type>/<mô-tả-ngắn>`
  - Ví dụ: `feat/trang-game-2048`, `fix/routing-hello-world`, `docs/cap-nhat-readme`
- Mỗi Pull Request chỉ nên chứa **một** thay đổi logic (một trang mới, một bug fix, ...)

## Tạo Pull Request

1. Tạo branch mới từ `main`: `git checkout -b feat/tên-trang`
2. Commit thay đổi theo convention ở trên
3. Push branch và tạo Pull Request vào `main`
4. Đảm bảo CI pass (lint, type-check, test, build)
5. Chờ review và merge!

## Các lệnh thường dùng

| Lệnh | Mô tả |
|------|-------|
| `pnpm dev` | Chạy dev server |
| `pnpm build` | Build production |
| `pnpm test:unit` | Chạy unit tests |
| `pnpm lint` | Lint code (có auto-fix) |
| `pnpm format` | Format code |
