# Retail Intelligence – Slides (LaTeX Beamer)

Bộ 20 slide thuyết trình CO4033 (tỉ lệ `16:9`, canvas `1920x1080 px`, lề `128 px`) đồng bộ màu sắc và kiểu chữ với giao diện React 18 + Apache ECharts 6 (`#0F172A`, `#F8FAFC`, `#FFFFFF`, Cobalt/Emerald/Amber/Rose, `Be Vietnam Pro` 400/600/800).

## Cấu trúc thư mục

| Thành phần | Mô tả |
|---|---|
| `slides.tex` | Nội dung 20 slide (`frame`) kèm lời thoại ẩn trong `\note{...}` |
| `beamerthemeretailintel.sty` | Theme `retailintel`: bảng màu, font, footer (không ghi tên người trình bày), macro vẽ |
| `fonts/` | Bộ chữ `BeVietnamPro` (`Regular`, `SemiBold`, `ExtraBold`, `Italic`) + `OFL.txt` |
| `images/` | Ảnh chụp giao diện dùng ở slide `10`, `13`, `16` (`tab1_eda.png`, `tab2_forecast.png`, `tab3_inventory.png`) |

## Biên dịch

Yêu cầu **XeLaTeX** (`fontspec`). Font tải trực tiếp từ `fonts/` qua `Path=fonts/`, không cần cài font hệ thống.

```sh
latexmk -xelatex slides.tex
```

**Overleaf:** Tải lên toàn bộ thư mục `LaTeX/slides/` (giữ nguyên `fonts/` và `images/` cạnh `slides.tex`), chọn *Menu → Compiler* là **XeLaTeX**.

Gói cần thiết (có sẵn trong TeX Live / Overleaf): `beamer` (`translator`), `fontspec`, `tikz`/`pgf`, `xcolor`, `graphicx`.

## Ghi chú thuyết trình (Speaker Notes)

Mỗi `frame` kết thúc bằng `\note{...}`. Trong ghi chú cần escape `%` thành `\%` và `_` thành `\_`.

Mặc định ghi chú được ẩn. Để xuất bản kèm ghi chú, bỏ comment **một** dòng ở đầu `slides.tex`:

```latex
\setbeameroption{show notes on second screen=right} % slide trái + ghi chú phải
\setbeameroption{show only notes}                   % chỉ xuất bản ghi chú
```

Chế độ hai màn hình tách tốt trên `pympress` hoặc `dspdfviewer` khi trình chiếu.

## Chỉnh sửa nhanh

Tọa độ dùng đơn vị `px` tính từ góc trên-trái của khung `1920x1080`:

- `\rislide[light|accent|dark]{...}`: Khung nền mỗi slide; thêm `\riNoFooter` để ẩn footer (slide 1 và 18).
- `\riHead{eyebrow}{title}`: Tiêu đề mục + tiêu đề chính ở lề trên.
- `\riT[opts]{x}{y}{font}{text}` / `\riTw[opts]{x}{y}{w}{font}{text}`: Văn bản 1 dòng hoặc tự xuống dòng; cỡ chữ `\fBig`, `\fTitle`, `\fNsixty`, `\fHthree`, `\fBody`, `\fBodyS`, `\fSmall`, `\fSmallS`, `\fMicro`, `\fEyebrow`.
- `\riCard`, `\riCardDark`, `\riCardSoft`, `\riKpiCard`, `\riPill`, `\riNode`, `\riShot`, `\riTable` + `\riRow`, style mũi tên `ri conn`.

## Cần điền trước khi nộp

Cập nhật danh sách `[Thành viên 2 · Thành viên 3 · Thành viên 4 · Thành viên 5 · Thành viên 6]` ở **Slide 1** trong `slides.tex`.
