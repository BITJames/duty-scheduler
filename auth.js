class AuthManager {
  constructor() {
    this.currentUser = null;
    this.STORAGE_KEY = 'duty_scheduler_accounts';
    this.SESSION_KEY = 'duty_scheduler_session';
  }

  // 密码哈希（使用Web Crypto API）
  async hashPassword(password, salt = 'duty_scheduler_salt') {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // 注册账户
  async register(username, password, role = 'employee') {
    const accounts = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    
    if (accounts.find(acc => acc.username === username)) {
      throw new Error('账户已存在');
    }

    // 密码强度校验
    if (!this.validatePassword(password)) {
      throw new Error('密码需包含大小写字母、数字，长度≥8');
    }

    const hashedPwd = await this.hashPassword(password);
    accounts.push({
      username,
      password: hashedPwd,
      role,
      createdAt: Date.now()
    });

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
    return true;
  }

  // 登录
  async login(username, password, remember = false) {
    const accounts = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    const hashedPwd = await this.hashPassword(password);
    const user = accounts.find(acc => 
      acc.username === username && acc.password === hashedPwd
    );

    if (!user) throw new Error('用户名或密码错误');

    this.currentUser = { ...user, password: undefined };
    
    // 会话存储
    const sessionData = {
      user: this.currentUser,
      expiry: remember ? Date.now() + 7 * 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000
    };
    
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    return this.currentUser;
  }

  // 自动登录
  autoLogin() {
    const session = JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null');
    if (session && session.expiry > Date.now()) {
      this.currentUser = session.user;
      return this.currentUser;
    }
    return null;
  }

  validatePassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password);
  }
}

// 全局导出
window.authManager = new AuthManager();