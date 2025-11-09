class ExcelExporter {
  constructor() {
    this.XLSX = window.XLSX;
  }

  // 导出个人排班
  exportPersonal(schedule, employeeName, dateRange) {
    const data = this.formatPersonalData(schedule, employeeName);
    const ws = this.XLSX.utils.aoa_to_sheet(data);
    this.styleWorksheet(ws);
    
    const wb = this.XLSX.utils.book_new();
    this.XLSX.utils.book_append_sheet(wb, ws, "个人排班表");
    
    this.XLSX.writeFile(wb, `${employeeName}_排班表_${dateRange}.xlsx`);
  }

  // 导出全局排班
  exportGlobal(schedule, employees, dateRange) {
    const data = this.formatGlobalData(schedule, employees);
    const ws = this.XLSX.utils.aoa_to_sheet(data);
    this.styleWorksheet(ws, true);
    
    const wb = this.XLSX.utils.book_new();
    this.XLSX.utils.book_append_sheet(wb, ws, "全局排班表");
    
    this.XLSX.writeFile(wb, `全员排班表_${dateRange}.xlsx`);
  }

  formatPersonalData(schedule, employeeName) {
    const data = [
      ['日期', '星期', '项目', '说明'],
      ...Object.entries(schedule)
        .filter(([_, item]) => item.employeeName === employeeName)
        .map(([date, item]) => [
          date,
          dayjs(date).format('ddd'),
          item.project,
          item.type === 'rest' ? '休息' : '值班'
        ])
    ];
    return data;
  }

  styleWorksheet(ws, isGlobal = false) {
    // 设置列宽
    const colWidths = isGlobal 
      ? [{wch: 12}, {wch: 8}, {wch: 15}, ...Array(20).fill({wch: 10})]
      : [{wch: 12}, {wch: 8}, {wch: 20}, {wch: 15}];
    
    ws['!cols'] = colWidths;

    // 添加样式（需要xlsx-style扩展）
    // 此处为简化示例，实际可引入xlsx-style库
  }
}

window.excelExporter = new ExcelExporter();