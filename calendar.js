class CalendarView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentDate = dayjs();
    this.viewMode = 'month'; // 'month' | 'week'
  }

  render(schedule, employees) {
    this.container.innerHTML = `
      <div class="calendar-header">
        <button id="prevBtn">‹</button>
        <h3>${this.currentDate.format('YYYY年MM月')}</h3>
        <button id="nextBtn">›</button>
        <div class="view-toggle">
          <button class="${this.viewMode === 'month' ? 'active' : ''}" data-view="month">月</button>
          <button class="${this.viewMode === 'week' ? 'active' : ''}" data-view="week">周</button>
        </div>
      </div>
      <div class="calendar-grid" id="calendarGrid"></div>
    `;

    this.bindEvents();
    this.renderGrid(schedule, employees);
  }

  renderGrid(schedule, employees) {
    const grid = document.getElementById('calendarGrid');
    const days = this.viewMode === 'month' 
      ? this.getMonthDays()
      : this.getWeekDays();

    grid.innerHTML = days.map(day => {
      const dateStr = day.format('YYYY-MM-DD');
      const duty = schedule[dateStr];
      
      return `
        <div class="calendar-day ${day.isSame(dayjs(), 'day') ? 'today' : ''}">
          <div class="day-header">${day.date()}</div>
          ${duty ? `
            <div class="duty-item ${duty.type}">
              <span class="project">${duty.project}</span>
              <span class="employee">${duty.employeeName || '休息'}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  getMonthDays() {
    const start = this.currentDate.startOf('month');
    const end = this.currentDate.endOf('month');
    const days = [];
    
    let current = start;
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  }

  bindEvents() {
    document.getElementById('prevBtn').onclick = () => {
      this.currentDate = this.currentDate.subtract(1, this.viewMode === 'month' ? 'month' : 'week');
      this.render();
    };
    
    document.getElementById('nextBtn').onclick = () => {
      this.currentDate = this.currentDate.add(1, this.viewMode === 'month' ? 'month' : 'week');
      this.render();
    };
  }
}

// 甘特图视图（管理端）
class GanttView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(schedule, employees) {
    const dates = Object.keys(schedule).sort();
    
    this.container.innerHTML = `
      <div class="gantt-table">
        <table>
          <thead>
            <tr>
              <th>员工</th>
              ${dates.map(date => `<th>${dayjs(date).format('MM/DD')}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => `
              <tr>
                <td class="employee-name">${emp.name}</td>
                ${dates.map(date => {
                  const duty = schedule[date];
                  const isOnDuty = duty.employee === emp.id;
                  return `<td class="${isOnDuty ? 'on-duty' : 'off-duty'}">
                    ${isOnDuty ? duty.project.charAt(0) : ''}
                  </td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}