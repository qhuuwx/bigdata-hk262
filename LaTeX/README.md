# Hướng dẫn Biên dịch Báo cáo LaTeX (`LaTeX/reports`)

Báo cáo sử dụng lớp tài liệu `hcmut-report.cls`, gói tô sáng mã nguồn `minted` (cần `-shell-escape` + Python `pygments`), sơ đồ vector Mermaid (`.mmd.pdf`) và thư mục tài liệu tham khảo `refs.bib`.

---

## Yêu cầu công cụ

- **TeX Distribution:** TeX Live (`pdflatex`, `bibtex`) hoặc MiKTeX + `latexmk`.
- **Python Pygments:** `pip install pygments` (phục vụ gói `minted`).
- **Mermaid CLI (khi sửa file `.mmd`):** `npm install -g @mermaid-js/mermaid-cli` (`mmdc`).

---

## 1. Biên dịch báo cáo PDF (`LaTeX/reports/main.tex`)

> **Lưu ý (`minted v3` / TeX Live 2026):** Cần đặt `TEXMF_OUTPUT_DIRECTORY=.` khi gọi `pdflatex` để `minted` tìm thấy tệp tạm trong thư mục hiện tại.

### macOS / Linux (`zsh` / `bash`)
```bash
cd LaTeX/reports
TEXMF_OUTPUT_DIRECTORY=. pdflatex -interaction=nonstopmode -shell-escape main.tex
bibtex main
TEXMF_OUTPUT_DIRECTORY=. pdflatex -interaction=nonstopmode -shell-escape main.tex
TEXMF_OUTPUT_DIRECTORY=. pdflatex -interaction=nonstopmode -shell-escape main.tex
```

### Windows (`PowerShell`)
```powershell
cd LaTeX\reports
$env:TEXMF_OUTPUT_DIRECTORY = "."
pdflatex -interaction=nonstopmode -shell-escape main.tex
bibtex main
pdflatex -interaction=nonstopmode -shell-escape main.tex
pdflatex -interaction=nonstopmode -shell-escape main.tex
```

*(Nếu gặp lỗi tệp tạm `minted` hỏng từ lần chạy trước, xóa các tệp `_FAD58*` / `main.aux` / `main.lol` / `main.out` rồi chạy lại chuỗi lệnh trên.)*

---

## 2. Kết xuất lại Sơ đồ Mermaid (`diagrams/*.mmd`)

Các sơ đồ được chèn vào báo cáo qua `\mermaidfile{diagrams/<tên>.mmd}` (tự nạp tệp `<tên>.mmd.pdf` dựng sẵn). Giữ sơ đồ đơn giản ($\le 12$ nút, nhãn ngắn) và dùng cú pháp Mermaid 10 cơ bản.

### macOS / Linux (`zsh` / `bash`)
```bash
cd LaTeX/reports/diagrams
for f in *.mmd; do mmdc -i "$f" -o "${f}.pdf"; done
```

### Windows (`PowerShell`)
```powershell
cd LaTeX\reports\diagrams
Get-ChildItem *.mmd | ForEach-Object { mmdc -i $_.Name -o "$($_.Name).pdf" }
```

---

## 3. Danh sách sơ đồ & Chương tương ứng

- **Phần mở đầu (`0_pre-report.tex`):** `project_gantt.mmd`, `ishikawa_fullstack.svg` (`ishikawa_fullstack.svg.pdf`), `repo_tree.svg` (`repo_tree.svg.pdf`)
- **Chương 1 (`1_intro.tex`):** `system_overview.mmd`, `decision_levels.mmd`, `kpi_scope.mmd`
- **Chương 2 (`2_eda.tex`):** `eda_pipeline.mmd`
- **Chương 3 (`3_architecture_data.tex`):** `system_architecture.mmd`, `data_pipeline.mmd`
- **Chương 4 (`4_core_engines.tex`):** `polling_lifecycle.mmd`, `forecast_flow.mmd`, `inventory_classify_flow.mmd`
- **Chương 5 (`5_ui_deployment.tex`):** `docker_topology.mmd` (cùng ảnh chụp màn hình trong `images/tab1_eda.png`..`tab3_inventory.png`)
- **Chương 6 (`6_testing_evaluation.tex`):** `test_pyramid.mmd`
