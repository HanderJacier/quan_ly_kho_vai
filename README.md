This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Quản lý dữ liệu kho

- Trang **Quản lý tồn kho** cho phép sửa thông tin cuộn và điều chỉnh số lượng có ghi giao dịch `ADJUSTMENT`.
- Cuộn chỉ được lưu trữ khi đã hết tồn; có thể xem và khôi phục cuộn đã lưu trữ. Không xóa cứng cuộn để bảo toàn liên kết lịch sử.
- Trang **Quản lý danh mục** cho phép thêm, sửa và ngừng/khôi phục danh mục vải, màu, loại, đơn vị, khách hàng và vị trí.
- Nhật ký nhập/xuất, cắt, chuyển kệ và điều chỉnh là bất biến; muốn sửa số liệu tồn hãy ghi nhận giao dịch điều chỉnh mới.
- Để cập nhật database hiện có đang thiếu mã lô hoặc nhà cung cấp, hãy sao lưu database rồi chạy `database/migrations/20261029_add_fabric_roll_lot_supplier.sql`. Migration này chỉ bổ sung hai cột còn thiếu và có thể chạy an toàn khi một hoặc cả hai cột đã tồn tại.
- Nếu thao tác **Ghi nhận mang vải ra cắt** báo lỗi do thiếu cột trong `cutting_orders`, hãy chạy `database/migrations/20261030_cutting_workflow_completion.sql`. Migration này bổ sung các cột ghi nhận dùng/trả vải và liên kết cuộn tiết kiệm, giữ nguyên các lần cắt hiện có.
- Để bật các luồng hạn lưu kho, tài khoản tiết kiệm, lịch sử cắt chi tiết và phiếu xuất, hãy sao lưu database rồi kiểm tra và chạy thủ công các migration theo thứ tự: `database/migrations/20261025_add_cutting_child_roll.sql`, `database/migrations/20261027_warehouse_workflows.sql`, rồi `database/migrations/20261028_cutting_return_completion.sql`. Migration 20261027 cũng bổ sung hai cột trên theo cách bỏ qua cột đã tồn tại. Ứng dụng không tự chạy migration.
- File schema SQL ban đầu có lệnh `DROP TABLE`; không chạy lại file đó trên database đang có dữ liệu. Chỉ dùng để khởi tạo database mới.
- Không triển khai phiên bản ứng dụng mới trước khi migration tương ứng đã được áp dụng thành công; các API mới truy vấn những cột và bảng do migration tạo.
- Quy trình cắt có hai bước: ghi nhận số mét mang ra trước; sau khi sản xuất xong, nhập số mét thực tế trả về trong lịch sử cắt và chọn tồn đầu khúc thường hoặc tồn tiết kiệm. Tồn tiết kiệm được tách riêng vì vải đã qua sản xuất.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
