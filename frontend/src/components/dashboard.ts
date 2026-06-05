import type { InventoryItem, ChangeLog, TransferRecord } from '../types';
import { inventoryApi } from '../api';

export function createDashboard(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'dashboard';
  return container;
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
  const [allItems, oosItems, lowItems, recentLogs, recentTransfers] = await Promise.all([
    inventoryApi.listItems(),
    inventoryApi.listItems({ out_of_stock: true }),
    inventoryApi.listItems({ low_stock: true }),
    inventoryApi.getChangeLogs({ limit: 15 }),
    inventoryApi.listTransfers({ limit: 10 }),
  ]);

  const totalQuantity = allItems.reduce((sum, i) => sum + i.quantity, 0);

  container.innerHTML = `
    <div class="dashboard-header">
      <h2>📊 库存概览</h2>
    </div>

    <div class="summary-cards">
      <div class="summary-card card-total">
        <div class="card-value">${totalQuantity}</div>
        <div class="card-label">总库存数量</div>
      </div>
      <div class="summary-card card-items">
        <div class="card-value">${allItems.length}</div>
        <div class="card-label">商品总条目</div>
      </div>
      <div class="summary-card card-oos">
        <div class="card-value">${oosItems.length}</div>
        <div class="card-label">缺货条目</div>
      </div>
      <div class="summary-card card-low">
        <div class="card-value">${lowItems.length}</div>
        <div class="card-label">低库存条目</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-section">
        <h3>🚨 缺货商品</h3>
        ${oosItems.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr><th>SKU</th><th>商品名称</th><th>状态</th></tr>
          </thead>
          <tbody>
            ${oosItems.map(i => `
              <tr class="row-out-of-stock">
                <td>${i.sku}</td>
                <td>${i.product_name}</td>
                <td><span class="status-badge status-out-of-stock">缺货</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<p class="empty-text">暂无缺货商品 🎉</p>'}
      </div>

      <div class="dashboard-section">
        <h3>⚠️ 低库存商品</h3>
        ${lowItems.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr><th>SKU</th><th>商品名称</th><th>数量</th><th>最低</th><th>状态</th></tr>
          </thead>
          <tbody>
            ${lowItems.map(i => `
              <tr class="row-low-stock">
                <td>${i.sku}</td>
                <td>${i.product_name}</td>
                <td>${i.quantity}</td>
                <td>${i.min_quantity}</td>
                <td><span class="status-badge status-low-stock">低库存</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<p class="empty-text">暂无低库存商品 🎉</p>'}
      </div>
    </div>

    <div class="dashboard-section">
      <h3>📝 近期变更记录</h3>
      ${recentLogs.length > 0 ? `
      <table class="data-table">
        <thead>
          <tr><th>类型</th><th>描述</th><th>操作人</th><th>时间</th></tr>
        </thead>
        <tbody>
          ${recentLogs.map(log => `
            <tr>
              <td><span class="changelog-type">${log.change_type}</span></td>
              <td>${log.description}</td>
              <td>${log.username || '-'}</td>
              <td>${formatTime(log.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : '<p class="empty-text">暂无变更记录</p>'}
    </div>

    <div class="dashboard-section">
      <h3>🔄 近期调拨动态</h3>
      ${recentTransfers.length > 0 ? `
      <table class="data-table">
        <thead>
          <tr><th>商品</th><th>调出节点</th><th>调入节点</th><th>数量</th><th>备注</th><th>操作人</th><th>时间</th></tr>
        </thead>
        <tbody>
          ${recentTransfers.map(t => `
            <tr class="row-transfer">
              <td>${t.product_name} (${t.sku})</td>
              <td><span class="transfer-direction transfer-out">${t.from_node_name}</span></td>
              <td><span class="transfer-direction transfer-in">${t.to_node_name}</span></td>
              <td><strong>${t.quantity}</strong></td>
              <td>${t.remark || '-'}</td>
              <td>${t.username || '-'}</td>
              <td>${formatTime(t.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : '<p class="empty-text">暂无调拨记录</p>'}
    </div>
  `;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}
