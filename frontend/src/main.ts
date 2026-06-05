import './styles/main.css';
import { authService } from './auth';
import type { TreeNode } from './types';
import { nodesApi, inventoryApi } from './api';
import { createLoginPage } from './components/login';
import { createTreeView } from './components/tree-view';
import { createNodeDetail, renderNodeDetail } from './components/node-detail';
import { createDashboard, renderDashboard } from './components/dashboard';
import { createModal, createNodeForm, createInventoryForm, createTransferForm } from './components/modals';

const app = document.getElementById('app')!;

let currentTreeData: TreeNode[] = [];
let selectedNodeId: number | null = null;

function renderApp() {
  const state = authService.getState();
  if (!state.isAuthenticated) {
    renderLogin();
    return;
  }
  renderMainLayout();
}

function renderLogin() {
  app.innerHTML = '';
  app.appendChild(createLoginPage());
}

function renderMainLayout() {
  const user = authService.getState().user!;
  const role = user.role;
  const roleLabels: Record<string, string> = { admin: '管理员', staff: '门店人员', observer: '观察员' };

  app.innerHTML = `
    <div class="app-layout">
      <header class="app-header">
        <h1>🏪 门店区域层级与库存管理</h1>
        <div class="header-user">
          <span class="user-info">${user.display_name || user.username}</span>
          <span class="user-role">${roleLabels[role] || role}</span>
          ${role === 'observer' ? '<button class="btn btn-xs btn-info" id="btn-export">📥 导出清单</button>' : ''}
          ${role === 'admin' || role === 'staff' ? '<button class="btn btn-xs btn-info" id="btn-export">📥 导出清单</button>' : ''}
          <button class="btn btn-xs btn-secondary" id="btn-logout">退出</button>
        </div>
      </header>
      <div class="app-body">
        <aside class="app-sidebar">
          <div class="app-sidebar-tabs">
            <button class="sidebar-tab active" data-tab="tree">🌲 区域层级</button>
            <button class="sidebar-tab" data-tab="dashboard">📊 库存概览</button>
          </div>
          <div class="app-sidebar-content" id="sidebar-content"></div>
        </aside>
        <main class="app-main" id="main-content">
          <div class="detail-placeholder">← 请在左侧选择操作</div>
        </main>
      </div>
    </div>
  `;

  const sidebarContent = document.getElementById('sidebar-content')!;
  const mainContent = document.getElementById('main-content')!;

  const tabs = app.querySelectorAll('.sidebar-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = (tab as HTMLElement).dataset.tab;
      if (tabName === 'tree') {
        loadTree(sidebarContent, mainContent);
      } else if (tabName === 'dashboard') {
        loadDashboard(sidebarContent, mainContent);
      }
    });
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    authService.logout();
  });

  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      await inventoryApi.exportInventory(selectedNodeId || undefined);
    } catch (err: any) {
      alert(err.message || '导出失败');
    }
  });

  loadTree(sidebarContent, mainContent);
}

async function loadTree(sidebarContent: HTMLElement, mainContent: HTMLElement) {
  sidebarContent.innerHTML = '<div class="loading">加载中</div>';
  try {
    currentTreeData = await nodesApi.getTree();
    const role = authService.getRole();
    const isAdmin = role === 'admin';

    const treeView = createTreeView(
      currentTreeData,
      (node) => onNodeSelect(node, mainContent),
      (parentId) => onNodeAdd(parentId),
      (node) => onNodeEdit(node),
      (node) => onNodeDelete(node)
    );

    if (!isAdmin) {
      treeView.querySelectorAll('.btn-add-child, .btn-edit, .btn-delete').forEach(btn => {
        (btn as HTMLElement).style.display = 'none';
      });
      const addBtn = treeView.querySelector('#add-root-btn') as HTMLElement;
      if (addBtn) addBtn.style.display = 'none';
    }

    sidebarContent.innerHTML = '';
    sidebarContent.appendChild(treeView);
  } catch (err: any) {
    sidebarContent.innerHTML = `<div class="error-message">加载失败: ${err.message}</div>`;
  }
}

async function loadDashboard(sidebarContent: HTMLElement, mainContent: HTMLElement) {
  const dashContainer = createDashboard();
  sidebarContent.innerHTML = '';
  mainContent.innerHTML = '';
  mainContent.appendChild(dashContainer);
  try {
    await renderDashboard(dashContainer);
  } catch (err: any) {
    dashContainer.innerHTML = `<div class="error-message">加载失败: ${err.message}</div>`;
  }
}

async function onNodeSelect(node: TreeNode, mainContent: HTMLElement) {
  selectedNodeId = node.id;
  mainContent.innerHTML = '<div class="loading">加载中</div>';
  try {
    const aggregation = await nodesApi.getAggregation(node.id);
    const detailContainer = createNodeDetail();
    mainContent.innerHTML = '';
    mainContent.appendChild(detailContainer);
    await renderNodeDetail(detailContainer, aggregation);

    const role = authService.getRole();
    if (role === 'admin' || role === 'staff') {
      const addInvBtn = document.createElement('button');
      addInvBtn.className = 'btn btn-sm btn-success';
      addInvBtn.textContent = '+ 添加库存条目';
      addInvBtn.style.marginBottom = '16px';
      addInvBtn.addEventListener('click', () => {
        const form = createInventoryForm(node.id);
        const modal = createModal('添加库存条目', form);
        document.body.appendChild(modal);
        form.addEventListener('inventory:saved', () => {
          onNodeSelect(node, mainContent);
        });
      });
      mainContent.insertBefore(addInvBtn, mainContent.firstChild);
    }

    mainContent.querySelectorAll('.btn-transfer-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const el = btn as HTMLElement;
        const itemData = {
          id: Number(el.dataset.itemId),
          sku: el.dataset.itemSku || '',
          product_name: el.dataset.itemName || '',
          quantity: Number(el.dataset.itemQty),
          unit: el.dataset.itemUnit || '件',
          node_id: node.id,
          min_quantity: 0,
          updated_at: '',
        };
        const form = await createTransferForm(itemData, node.id);
        const modal = createModal('库存调拨', form);
        document.body.appendChild(modal);
        form.addEventListener('transfer:completed', () => {
          onNodeSelect(node, mainContent);
        });
      });
    });
  } catch (err: any) {
    mainContent.innerHTML = `<div class="error-message">加载失败: ${err.message}</div>`;
  }
}

function onNodeAdd(parentId: number | null) {
  const form = createNodeForm(parentId);
  const modal = createModal(parentId ? '添加子节点' : '添加根区域', form);
  document.body.appendChild(modal);
  form.addEventListener('node:saved', () => {
    const sidebarContent = document.getElementById('sidebar-content')!;
    const mainContent = document.getElementById('main-content')!;
    loadTree(sidebarContent, mainContent);
  });
}

function onNodeEdit(node: TreeNode) {
  const form = createNodeForm(node.parent_id, node);
  const modal = createModal('编辑节点', form);
  document.body.appendChild(modal);
  form.addEventListener('node:saved', () => {
    const sidebarContent = document.getElementById('sidebar-content')!;
    const mainContent = document.getElementById('main-content')!;
    loadTree(sidebarContent, mainContent);
  });
}

async function onNodeDelete(node: TreeNode) {
  if (!confirm(`确定删除节点 "${node.name}" 吗？`)) return;
  try {
    await nodesApi.deleteNode(node.id);
    const sidebarContent = document.getElementById('sidebar-content')!;
    const mainContent = document.getElementById('main-content')!;
    loadTree(sidebarContent, mainContent);
    mainContent.innerHTML = '<div class="detail-placeholder">← 请在左侧树中选择一个节点查看详情</div>';
  } catch (err: any) {
    alert(err.message || '删除失败');
  }
}

authService.subscribe(() => {
  renderApp();
});

window.addEventListener('auth:logout', () => {
  renderApp();
});

renderApp();
