class DutySchedulerApp {
  constructor() {
    this.currentUser = null;
    this.employees = [];
    this.schedule = {};
    this.init();
  }

  async init() {
    // 1. 自动登录
    this.currentUser = authManager.autoLogin();
    
    if (!this.currentUser) {
      this.showLoginView();
    } else {
      this.loadData();
      this.showMainView();
    }

    // 2. 注册Service Worker（支持离线）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }

  loadData() {
    this.employees = JSON.parse(localStorage.getItem('employees') || '[]');
    this.schedule = JSON.parse(localStorage.getItem('schedule') || '{}');
  }

  saveData() {
    localStorage.setItem('employees', JSON.stringify(this.employees));
    localStorage.setItem('schedule', JSON.stringify(this.schedule));
    
    // 备份到IndexedDB
    this.backupToIndexedDB();
  }

  async backupToIndexedDB() {
    const db = await this.openIndexedDB();
    const tx = db.transaction('backups', 'readwrite');
    tx.objectStore('backups').add({
      data: { employees: this.employees, schedule: this.schedule },
      timestamp: Date.now()
    });
  }

  openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DutySchedulerDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        db.createObjectStore('backups', { autoIncrement: true });
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e);
    });
  }

  showLoginView() {
    document.body.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h2>值班系统登录</h2>
          <form id="loginForm">
            <input type="text" id="username" placeholder="用户名" required>
            <input type="password" id="password" placeholder="密码" required>
            <label>
              <input type="checkbox" id="remember"> 记住我（7天）
            </label>
            <button type="submit">登录</button>
            <button type="button" id="registerBtn">注册</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember').checked;
      
      try {
        await authManager.login(username, password, remember);
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  showMainView() {
    document.body.innerHTML = `
      <header class="app-header">
        <h1>项目值班安排系统</h1>
        <div class="user-info">
          <span>${this.currentUser.username}</span>
          <button id="logoutBtn">退出</button>
        </div>
      </header>
      
      <main class="app-main">
        <aside class="sidebar">
          <nav>
            <button class="nav-btn active" data-page="dashboard">仪表板</button>
            ${this.currentUser.role === 'manager' ? `
              <button class="nav-btn" data-page="employees">人员管理</button>
              <button class="nav-btn" data-page="scheduler">排班设置</button>
            ` : ''}
            <button class="nav-btn" data-page="calendar">我的排班</button>
          </nav>
        </aside>
        
        <section class="content" id="content"></section>
      </main>
    `;

    this.bindNavEvents();
    this.showPage('dashboard');
  }

  bindNavEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelector('.nav-btn.active')?.classList.remove('active');
        e.target.classList.add('active');
        this.showPage(e.target.dataset.page);
      };
    });

    document.getElementById('logoutBtn').onclick = () => {
      localStorage.removeItem('duty_scheduler_session');
      location.reload();
    };
  }

  showPage(page) {
    const content = document.getElementById('content');
    
    switch(page) {
      case 'dashboard':
        this.renderDashboard(content);
        break;
      case 'employees':
        this.renderEmployeeManagement(content);
        break;
      case 'scheduler':
        this.renderScheduler(content);
        break;
      case 'calendar':
        this.renderPersonalCalendar(content);
        break;
    }
  }

  renderDashboard(container) {
    const stats = this.calculateStats();
    container.innerHTML = `
      <div class="dashboard">
        <h2>仪表板</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <h3>员工总数</h3>
            <p class="stat-value">${stats.totalEmployees}</p>
          </div>
          <div class="stat-card">
            <h3>本月值班天数</h3>
            <p class="stat-value">${stats.monthDutyDays}</p>
          </div>
          <div class="stat-card">
            <h3>平均每人值班</h3>
            <p class="stat-value">${stats.avgDutyDays}</p>
          </div>
        </div>
      </div>
    `;
  }

  calculateStats() {
    const monthStart = dayjs().startOf('month');
    const monthEnd = dayjs().endOf('month');
    const monthDays = Object.keys(this.schedule).filter(date => 
      dayjs(date).isBetween(monthStart, monthEnd, null, '[]')
    );

    return {
      totalEmployees: this.employees.length,
      monthDutyDays: monthDays.length,
      avgDutyDays: this.employees.length > 0 
        ? (monthDays.length / this.employees.length).toFixed(1)
        : 0
    };
  }

  renderEmployeeManagement(container) {
    container.innerHTML = `
      <div class="employee-manager">
        <h2>人员管理</h2>
        <div class="toolbar">
          <button id="addEmployeeBtn">添加员工</button>
          <button id="batchImportBtn">批量导入</button>
          <button id="clearAllBtn" class="danger">清空所有</button>
        </div>
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="搜索员工...">
        </div>
        <ul id="employeeList" class="employee-list"></ul>
      </div>
    `;

    this.renderEmployeeList();
    this.bindEmployeeEvents();
  }

  renderEmployeeList(filter = '') {
    const list = document.getElementById('employeeList');
    const filtered = this.employees.filter(emp => 
      emp.name.toLowerCase().includes(filter.toLowerCase())
    );

    list.innerHTML = filtered.map(emp => `
      <li class="employee-item">
        <span>${emp.name}</span>
        <button class="delete-btn" data-id="${emp.id}">删除</button>
      </li>
    `).join('');
  }

  bindEmployeeEvents() {
    document.getElementById('addEmployeeBtn').onclick = () => {
      const name = prompt('请输入员工姓名：');
      if (name && !this.employees.find(e => e.name === name)) {
        this.employees.push({ id: Date.now().toString(), name });
        this.saveData();
        this.renderEmployeeList();
      }
    };

    document.getElementById('batchImportBtn').onclick = () => {
      const textarea = document.createElement('textarea');
      const modal = this.createModal('批量导入', `
        <p>每行输入一个姓名：</p>
        ${textarea.outerHTML}
        <button id="confirmImport">确认导入</button>
      `);
      
      document.getElementById('confirmImport').onclick = () => {
        const names = textarea.value.split('\n').filter(n => n.trim());
        const newEmployees = names.filter(name => 
          !this.employees.find(e => e.name === name.trim())
        ).map(name => ({
          id: Date.now().toString() + Math.random(),
          name: name.trim()
        }));
        
        this.employees.push(...newEmployees);
        this.saveData();
        this.renderEmployeeList();
        modal.remove();
      };
    };

    document.getElementById('clearAllBtn').onclick = () => {
      if (confirm('确认清空所有员工？相关排班数据也将删除！')) {
        const confirmCode = prompt('请输入确认码：');
        if (confirmCode === 'DELETE') {
          this.employees = [];
          this.schedule = {};
          this.saveData();
          this.renderEmployeeList();
        }
      }
    };

    document.getElementById('searchInput').oninput = (e) => {
      this.renderEmployeeList(e.target.value);
    };

    // 删除按钮事件委托
    document.getElementById('employeeList').onclick = (e) => {
      if (e.target.classList.contains('delete-btn')) {
        const id = e.target.dataset.id;
        if (confirm('确认删除？')) {
          this.employees = this.employees.filter(emp => emp.id !== id);
          // 联动删除排班数据
          Object.keys(this.schedule).forEach(date => {
            if (this.schedule[date].employee === id) {
              delete this.schedule[date];
            }
          });
          this.saveData();
          this.renderEmployeeList();
        }
      }
    };
  }

  renderScheduler(container) {
    container.innerHTML = `
      <div class="scheduler-panel">
        <h2>智能排班</h2>
        <form id="schedulerForm">
          <div class="form-group">
            <label>起止日期：</label>
            <input type="date" id="startDate" required>
            <span>至</span>
            <input type="date" id="endDate" required>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="includeSaturday"> 包含周六
            </label>
            <label>
              <input type="checkbox" id="includeSunday"> 包含周日
            </label>
          </div>
          <button type="submit">开始排班</button>
        </form>
        <div id="scheduleResult" class="result-panel"></div>
      </div>
    `;

    document.getElementById('schedulerForm').onsubmit = async (e) => {
      e.preventDefault();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      const includeSaturday = document.getElementById('includeSaturday').checked;
      const includeSunday = document.getElementById('includeSunday').checked;

      try {
        // 显示加载状态
        document.getElementById('scheduleResult').innerHTML = '<p>排班中...</p>';

        const result = scheduler.generateSchedule(
          this.employees,
          new Date(startDate),
          new Date(endDate),
          { includeSaturday, includeSunday }
        );

        this.schedule = result.schedule;
        this.saveData();

        this.renderScheduleResult(result);
      } catch (err) {
        alert('排班失败：' + err.message);
      }
    };
  }

  renderScheduleResult(result) {
    const container = document.getElementById('scheduleResult');
    const statsHtml = Object.values(result.stats).map(stat => `
      <li>${stat.name}: ${stat.count}次</li>
    `).join('');

    container.innerHTML = `
      <h3>排班完成</h3>
      <p class="${result.isBalanced ? 'success' : 'warning'}">
        ${result.isBalanced ? '✓ 排班已平衡' : `⚠ ${result.warning}`}
      </p>
      <h4>统计信息：</h4>
      <ul>${statsHtml}</ul>
      <button id="exportSchedule">导出Excel</button>
      <button id="previewGantt">预览甘特图</button>
    `;

    document.getElementById('exportSchedule').onclick = () => {
      excelExporter.exportGlobal(this.schedule, this.employees, '2024');
    };

    document.getElementById('previewGantt').onclick = () => {
      this.showGanttView();
    };
  }

  showGanttView() {
    const modal = this.createModal('排班总览', '<div id="ganttContainer"></div>');
    const gantt = new GanttView('ganttContainer');
    gantt.render(this.schedule, this.employees);
  }

  renderPersonalCalendar(container) {
    container.innerHTML = `
      <div class="personal-calendar">
        <h2>我的排班</h2>
        <div class="calendar-container" id="personalCalendar"></div>
        <button id="exportPersonal">导出我的排班</button>
      </div>
    `;

    const calendar = new CalendarView('personalCalendar');
    const personalSchedule = this.filterPersonalSchedule();
    calendar.render(personalSchedule, this.employees);

    document.getElementById('exportPersonal').onclick = () => {
      excelExporter.exportPersonal(
        personalSchedule,
        this.currentUser.username,
        '2024年'
      );
    };
  }

  filterPersonalSchedule() {
    const personal = {};
    const employee = this.employees.find(emp => emp.name === this.currentUser.username);
    
    if (!employee) return personal;

    Object.entries(this.schedule).forEach(([date, item]) => {
      if (item.employee === employee.id) {
        personal[date] = { ...item, employeeName: employee.name };
      }
    });

    return personal;
  }

  createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.close-btn').onclick = () => modal.remove();
    return modal;
  }
}

// 应用启动
window.addEventListener('DOMContentLoaded', () => {
  window.app = new DutySchedulerApp();
});