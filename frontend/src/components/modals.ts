import type { TreeNode, NodeCreate } from '../types';
import { nodesApi, inventoryApi } from '../api';

export function createModal(title: string, content: HTMLElement): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `<h3>${title}</h3><button class="modal-close btn btn-xs">✕</button>`;

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.appendChild(content);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  overlay.querySelector('.modal-close')?.addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  return overlay;
}

export function createNodeForm(parentId: number | null, existingNode?: TreeNode): HTMLElement {
  const form = document.createElement('form');
  form.className = 'node-form';

  const nodeTypes = ['area', 'aisle', 'shelf', 'slot'];
  const nodeTypeLabels: Record<string, string> = { area: '区域', aisle: '通道', shelf: '货架', slot: '格位' };

  let defaultType = 'area';
  if (parentId !== null) {
    defaultType = 'aisle';
  }

  form.innerHTML = `
    <div class="form-group">
      <label>节点名称 *</label>
      <input type="text" name="name" value="${existingNode?.name || ''}" required />
    </div>
    <div class="form-group">
      <label>节点类型 *</label>
      <select name="node_type">
        ${nodeTypes.map(t => `<option value="${t}" ${t === (existingNode?.node_type || defaultType) ? 'selected' : ''}>${nodeTypeLabels[t]}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>节点编码 *</label>
      <input type="text" name="code" value="${existingNode?.code || ''}" required />
    </div>
    <div class="form-group">
      <label>描述</label>
      <textarea name="description" rows="2">${existingNode?.description || ''}</textarea>
    </div>
    <div class="form-group">
      <label>排序</label>
      <input type="number" name="sort_order" value="${existingNode?.sort_order || 0}" />
    </div>
    <input type="hidden" name="parent_id" value="${parentId ?? ''}" />
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">${existingNode ? '保存修改' : '创建节点'}</button>
      <button type="button" class="btn btn-secondary modal-cancel-btn">取消</button>
    </div>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data: NodeCreate = {
      name: fd.get('name') as string,
      node_type: fd.get('node_type') as string,
      code: fd.get('code') as string,
      parent_id: fd.get('parent_id') ? Number(fd.get('parent_id')) : null,
      description: (fd.get('description') as string) || '',
      sort_order: Number(fd.get('sort_order')) || 0,
    };

    try {
      if (existingNode) {
        await nodesApi.updateNode(existingNode.id, data);
      } else {
        await nodesApi.createNode(data);
      }
      form.dispatchEvent(new CustomEvent('node:saved', { bubbles: true }));
      const overlay = form.closest('.modal-overlay') as HTMLElement;
      if (overlay) overlay.remove();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  });

  form.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
    const overlay = form.closest('.modal-overlay') as HTMLElement;
    if (overlay) overlay.remove();
  });

  return form;
}

export function createInventoryForm(nodeId: number, existingItem?: any): HTMLElement {
  const form = document.createElement('form');
  form.className = 'inventory-form';

  form.innerHTML = `
    <input type="hidden" name="node_id" value="${nodeId}" />
    <div class="form-group">
      <label>SKU *</label>
      <input type="text" name="sku" value="${existingItem?.sku || ''}" required />
    </div>
    <div class="form-group">
      <label>商品名称 *</label>
      <input type="text" name="product_name" value="${existingItem?.product_name || ''}" required />
    </div>
    <div class="form-group">
      <label>数量</label>
      <input type="number" name="quantity" value="${existingItem?.quantity ?? 0}" min="0" />
    </div>
    <div class="form-group">
      <label>最低库存</label>
      <input type="number" name="min_quantity" value="${existingItem?.min_quantity ?? 0}" min="0" />
    </div>
    <div class="form-group">
      <label>单位</label>
      <input type="text" name="unit" value="${existingItem?.unit || '件'}" />
    </div>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">${existingItem ? '保存修改' : '添加条目'}</button>
      <button type="button" class="btn btn-secondary modal-cancel-btn">取消</button>
    </div>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      node_id: Number(fd.get('node_id')),
      sku: fd.get('sku') as string,
      product_name: fd.get('product_name') as string,
      quantity: Number(fd.get('quantity')) || 0,
      min_quantity: Number(fd.get('min_quantity')) || 0,
      unit: (fd.get('unit') as string) || '件',
    };

    try {
      if (existingItem) {
        const { node_id, ...updateData } = data;
        await inventoryApi.updateItem(existingItem.id, updateData);
      } else {
        await inventoryApi.createItem(data);
      }
      form.dispatchEvent(new CustomEvent('inventory:saved', { bubbles: true }));
      const overlay = form.closest('.modal-overlay') as HTMLElement;
      if (overlay) overlay.remove();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  });

  form.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
    const overlay = form.closest('.modal-overlay') as HTMLElement;
    if (overlay) overlay.remove();
  });

  return form;
}

