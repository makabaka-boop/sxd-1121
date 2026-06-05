import type { NodeAggregation, InventoryItem } from '../types';
import { inventoryApi } from '../api';

export function createNodeDetail(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'node-detail';
  container.innerHTML = `<div class="detail-placeholder">← 请在左侧树中选择一个节点查看详情</div>`;
  return container;
}

export async function renderNodeDetail(container: HTMLElement, aggregation: NodeAggregation): Promise<void> {
  const items = await inventoryApi.listItems({ node_id: aggregation.node_id });
  const s = aggregation.summary;

  const stockStatus = (item: InventoryItem): string => {
    if (item.quantity === 0) return 'out-of-stock';
    if (item.quantity <= item.min_quantity) return 'low-stock';
    return 'in-stock';
  };

  const statusLabel = (item: InventoryItem): string => {
    if (item.quantity === 0) return '缺货';
    if (item.quantity <= item.min_quantity) return '低库存';
    return '正常';
  };

  container.innerHTML = `
    <div class="detail-header">
      <h2>${aggregation.node_name}</h2>
      <span class="badge badge-${aggregation.node_type}">${getTypeLabelChinese(aggregation.node_type)}</span>
    </div>

    <div class="summary-cards">
      <div class="summary-card card-total">
        <div class="card-value">${s.total_quantity}</div>
        <div class="card-label">总库存数量</div>
      </div>
      <div class="summary-card card-items">
        <div class="card-value">${s.total_items}</div>
        <div class="card-label">商品条目</div>
      </div>
      <div class="summary-card card-oos">
        <div class="card-value">${s.out_of_stock_items}</div>
        <div class="card-label">缺货条目</div>
      </div>
      <div class="summary-card card-low">
        <div class="card-value">${s.low_stock_items}</div>
        <div class="card-label">低库存条目</div>
      </div>
    </div>

    ${items.length > 0 ? `
    <div class="detail-section">
      <h3>📋 当前节点库存</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>商品名称</th>
            <th>数量</th>
            <th>最低库存</th>
            <th>单位</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr class="row-${stockStatus(item)}">
              <td>${item.sku}</td>
              <td>${item.product_name}</td>
              <td><strong>${item.quantity}</strong></td>
              <td>${item.min_quantity}</td>
              <td>${item.unit}</td>
              <td><span class="status-badge status-${stockStatus(item)}">${statusLabel(item)}</span></td>
              <td>${item.quantity > 0 ? `<button class="btn btn-xs btn-info btn-transfer-item" data-item-id="${item.id}" data-item-sku="${item.sku}" data-item-name="${item.product_name}" data-item-qty="${item.quantity}" data-item-unit="${item.unit}" title="调拨">🔄 调拨</button>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${aggregation.children.length > 0 ? `
    <div class="detail-section">
      <h3>🌳 下级节点汇总</h3>
      <div class="children-grid">
        ${aggregation.children.map(child => `
          <div class="child-card">
            <div class="child-name">${child.node_name}</div>
            <span class="badge badge-${child.node_type}">${getTypeLabelChinese(child.node_type)}</span>
            <div class="child-stats">
              <span>库存: ${child.summary.total_quantity}</span>
              <span>条目: ${child.summary.total_items}</span>
              ${child.summary.out_of_stock_items > 0 ? `<span class="text-danger">缺货: ${child.summary.out_of_stock_items}</span>` : ''}
              ${child.summary.low_stock_items > 0 ? `<span class="text-warning">低库存: ${child.summary.low_stock_items}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${aggregation.recent_changes.length > 0 ? `
    <div class="detail-section">
      <h3>📝 近期变更</h3>
      <div class="changelog-list">
        ${aggregation.recent_changes.map(log => `
          <div class="changelog-item">
            <span class="changelog-type">${log.change_type}</span>
            <span class="changelog-desc">${log.description}</span>
            <span class="changelog-user">${log.username || ''}</span>
            <span class="changelog-time">${formatTime(log.created_at)}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${aggregation.recent_transfers.length > 0 ? `
    <div class="detail-section">
      <h3>🔄 近期调拨记录</h3>
      <table class="data-table">
        <thead>
          <tr><th>商品</th><th>方向</th><th>数量</th><th>备注</th><th>操作人</th><th>时间</th></tr>
        </thead>
        <tbody>
          ${aggregation.recent_transfers.map(t => {
            const isOut = t.from_node_id === aggregation.node_id;
            return `
              <tr class="row-transfer-${isOut ? 'out' : 'in'}">
                <td>${t.product_name} (${t.sku})</td>
                <td>
                  ${isOut
                    ? `<span class="transfer-direction transfer-out">调出 → ${t.to_node_name}</span>`
                    : `<span class="transfer-direction transfer-in">调入 ← ${t.from_node_name}</span>`
                  }
                </td>
                <td><strong>${t.quantity}</strong></td>
                <td>${t.remark || '-'}</td>
                <td>${t.username || '-'}</td>
                <td>${formatTime(t.created_at)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>` : ''}
  `;
}

function getTypeLabelChinese(type: string): string {
  const labels: Record<string, string> = {
    area: '区域',
    aisle: '通道',
    shelf: '货架',
    slot: '格位',
  };
  return labels[type] || type;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}
