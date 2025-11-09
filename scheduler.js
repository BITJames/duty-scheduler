class SmartScheduler {
  constructor() {
    this.holidays = this.getDefaultHolidays();
  }

  /**
   * 核心排班算法
   * @param {Array} employees - 员工列表
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @param {Object} config - 配置项
   * @returns {Object} 排班结果
   */
  generateSchedule(employees, startDate, endDate, config = {}) {
    const {
      includeSaturday = false,
      includeSunday = false,
      customProjects = [],
      maxRetries = 10
    } = config;

    if (employees.length === 0) {
      throw new Error('员工列表不能为空');
    }

    // 1. 计算有效值班日
    const dutyDays = this.getDutyDays(startDate, endDate, includeSaturday, includeSunday);
    
    // 2. 计算理想分配
    const totalDays = dutyDays.length;
    const baseCount = Math.floor(totalDays / employees.length);
    const remainder = totalDays % employees.length;
    
    // 3. 生成目标分配映射
    const targetDistribution = this.calculateTargetDistribution(employees, baseCount, remainder);
    
    // 4. 尝试排班（带重试机制）
    let bestSchedule = null;
    let minVariance = Infinity;
    
    for (let retry = 0; retry < maxRetries; retry++) {
      const schedule = this.trySchedule(dutyDays, employees, targetDistribution, customProjects);
      const variance = this.calculateVariance(schedule, targetDistribution);
      
      if (variance === 0) {
        // 完美平衡，立即返回
        return {
          schedule,
          stats: this.generateStats(schedule, employees),
          isBalanced: true,
          retryCount: retry + 1
        };
      }
      
      if (variance < minVariance) {
        minVariance = variance;
        bestSchedule = schedule;
      }
    }

    // 未找到完美解，返回最优解
    return {
      schedule: bestSchedule,
      stats: this.generateStats(bestSchedule, employees),
      isBalanced: false,
      warning: `经过${maxRetries}次尝试，仍无法完全平衡。最大差值：${minVariance}`
    };
  }

  // 获取值班日（排除节假日）
  getDutyDays(startDate, endDate, includeSaturday, includeSunday) {
    const days = [];
    const current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const dayOfWeek = current.day(); // 0=周日
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = this.isHoliday(current);
      
      if (!isHoliday) {
        if (!isWeekend || (dayOfWeek === 6 && includeSaturday) || (dayOfWeek === 0 && includeSunday)) {
          days.push(current.format('YYYY-MM-DD'));
        }
      }
      
      current.add(1, 'day');
    }
    return days;
  }

  // 计算目标分配
  calculateTargetDistribution(employees, baseCount, remainder) {
    const distribution = {};
    const shuffled = [...employees].sort(() => Math.random() - 0.5);
    
    employees.forEach((emp, idx) => {
      distribution[emp.id] = baseCount + (idx < remainder ? 1 : 0);
    });
    
    return distribution;
  }

  // 单次排班尝试
  trySchedule(dutyDays, employees, targetDistribution, customProjects) {
    const schedule = {};
    const employeeQueue = this.createPriorityQueue(employees, targetDistribution);
    
    dutyDays.forEach(date => {
      // 检查自定义项目
      const customProject = customProjects.find(p => p.date === date);
      if (customProject) {
        schedule[date] = {
          type: customProject.type, // 'duty' | 'rest'
          project: customProject.project || '休息',
          employee: customProject.type === 'duty' ? this.selectEmployee(employeeQueue, date, schedule) : null
        };
        return;
      }

      // 正常排班
      const employee = this.selectEmployee(employeeQueue, date, schedule);
      schedule[date] = {
        type: 'duty',
        project: '日常值班',
        employee,
        assignedAt: Date.now()
      };
      
      // 更新队列优先级
      this.updateQueue(employeeQueue, employee.id);
    });

    return schedule;
  }

  // 优先队列：剩余次数多者优先，避免连续排班
  createPriorityQueue(employees, targetDistribution) {
    return employees.map(emp => ({
      ...emp,
      remaining: targetDistribution[emp.id],
      lastDutyDate: null,
      consecutiveDays: 0
    })).sort((a, b) => b.remaining - a.remaining);
  }

  // 选择员工（避免连续排班）
  selectEmployee(queue, date, schedule) {
    const available = queue.filter(emp => {
      if (emp.remaining <= 0) return false;
      
      // 检查前一天是否已排班
      const yesterday = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
      const yesterdayDuty = schedule[yesterday];
      if (yesterdayDuty && yesterdayDuty.employee === emp.id) {
        return false;
      }
      
      return true;
    });

    // 如果都不可用，允许连续排班
    const candidates = available.length > 0 ? available : queue.filter(emp => emp.remaining > 0);
    
    // 随机选择（权重：剩余次数越多概率越高）
    const totalWeight = candidates.reduce((sum, emp) => sum + emp.remaining, 0);
    let random = Math.random() * totalWeight;
    
    for (const emp of candidates) {
      random -= emp.remaining;
      if (random <= 0) return emp;
    }
    
    return candidates[0];
  }

  // 更新队列状态
  updateQueue(queue, employeeId) {
    const emp = queue.find(e => e.id === employeeId);
    if (emp) {
      emp.remaining--;
    }
    queue.sort((a, b) => b.remaining - a.remaining);
  }

  // 计算方差
  calculateVariance(schedule, targetDistribution) {
    const actual = {};
    Object.values(schedule).forEach(item => {
      if (item.employee) {
        actual[item.employee] = (actual[item.employee] || 0) + 1;
      }
    });

    let variance = 0;
    Object.entries(targetDistribution).forEach(([empId, target]) => {
      const actualCount = actual[empId] || 0;
      variance = Math.max(variance, Math.abs(actualCount - target));
    });

    return variance;
  }

  // 生成统计
  generateStats(schedule, employees) {
    const stats = {};
    employees.forEach(emp => stats[emp.id] = { name: emp.name, count: 0 });

    Object.values(schedule).forEach(item => {
      if (item.employee && stats[item.employee]) {
        stats[item.employee].count++;
      }
    });

    return stats;
  }

  // 节假日判断
  isHoliday(date) {
    const dateStr = dayjs(date).format('MM-DD');
    return this.holidays.includes(dateStr);
  }

  // 内置节假日
  getDefaultHolidays() {
    return [
      '01-01', '02-14', '04-05', '05-01', '06-14',
      '09-21', '10-01', '10-02', '10-03'
    ];
  }
}

// 全局导出
window.scheduler = new SmartScheduler();