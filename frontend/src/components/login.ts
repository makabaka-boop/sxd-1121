import { authService } from '../auth';

export function createLoginPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'login-container';

  container.innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <h1>🏪 门店区域层级与库存管理系统</h1>
        <p>请登录以继续</p>
      </div>
      <form id="login-form" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input type="text" id="username" name="username" placeholder="请输入用户名" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input type="password" id="password" name="password" placeholder="请输入密码" required autocomplete="current-password" />
        </div>
        <div id="login-error" class="error-message" style="display:none;"></div>
        <button type="submit" class="btn btn-primary btn-block">登 录</button>
      </form>
      <div class="login-hint">
        <p>演示账号：</p>
        <p>管理员: admin / admin123</p>
        <p>门店人员: staff / staff123</p>
        <p>观察员: observer / observer123</p>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form') as HTMLFormElement;
  const errorDiv = container.querySelector('#login-error') as HTMLDivElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (container.querySelector('#username') as HTMLInputElement).value;
    const password = (container.querySelector('#password') as HTMLInputElement).value;
    errorDiv.style.display = 'none';
    try {
      await authService.login(username, password);
    } catch (err: any) {
      errorDiv.textContent = err.message || '登录失败';
      errorDiv.style.display = 'block';
    }
  });

  return container;
}
