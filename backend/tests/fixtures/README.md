# Synthetic Workbook Fixtures

orders.xlsx.base64 and orders.xls.base64 contain actual Excel files encoded as text for reproducible tests. Each holds a single fictional GHS 125.50 order dated October 20, 2026, with human-readable headers. The XLSX reference is SYN-XLSX-001 and the legacy XLS reference is SYN-XLS-001.

The files were generated for this repository using openpyxl 3.1.5 and xlwt 1.3.0 respectively. xlwt was used only to create the static legacy fixture and is not required to run the application or its tests. Tests decode the bytes and read them with the application upload path; the legacy workbook is not a mocked reader response. Formula calculations and external connections are not executed.
