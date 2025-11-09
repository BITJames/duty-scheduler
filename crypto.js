// 增强版加密服务 (crypto.js)
class EnhancedCrypto {
  // 生成随机盐
  generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // PBKDF2派生密钥
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // 加密数据
  async encryptData(data, password) {
    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    return {
      salt,
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    };
  }
}