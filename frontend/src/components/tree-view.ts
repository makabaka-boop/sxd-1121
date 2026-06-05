import type { TreeNode } from '../types';

export function createTreeView(
  treeData: TreeNode[],
  onNodeSelect: (node: TreeNode) => void,
  onNodeAdd: (parentId: number | null) => void,
  onNodeEdit: (node: TreeNode) => void,
  onNodeDelete: (node: TreeNode) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tree-view';

  const header = document.createElement('div');
  header.className = 'tree-header';
  header.innerHTML = `
    <h3>📂 区域层级</h3>
    <button class="btn btn-sm btn-success" id="add-root-btn">+ 新增区域</button>
  `;
  container.appendChild(header);

  const treeRoot = document.createElement('div');
  treeRoot.className = 'tree-root';
  container.appendChild(treeRoot);

  function renderNode(node: TreeNode, level: number = 0): HTMLElement {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';
    nodeEl.dataset.nodeId = String(node.id);

    const nodeRow = document.createElement('div');
    nodeRow.className = 'tree-node-row';
    nodeRow.style.paddingLeft = `${level * 20 + 8}px`;

    const icon = getTypeIcon(node.node_type);
    const expandIcon = node.children.length > 0
      ? `<span class="tree-expand-icon expanded">▼</span>`
      : `<span class="tree-expand-icon leaf">●</span>`;

    nodeRow.innerHTML = `
      ${expandIcon}
      <span class="tree-node-icon">${icon}</span>
      <span class="tree-node-name">${node.name}</span>
      <span class="tree-node-type badge badge-${node.node_type}">${getTypeLabel(node.node_type)}</span>
      <span class="tree-node-code">${node.code}</span>
      <div class="tree-node-actions">
        <button class="btn btn-xs btn-info btn-add-child" title="添加子节点">+</button>
        <button class="btn btn-xs btn-warning btn-edit" title="编辑">✎</button>
        <button class="btn btn-xs btn-danger btn-delete" title="删除">✕</button>
      </div>
    `;

    nodeRow.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.btn-add-child')) {
        e.stopPropagation();
        onNodeAdd(node.id);
        return;
      }
      if (target.closest('.btn-edit')) {
        e.stopPropagation();
        onNodeEdit(node);
        return;
      }
      if (target.closest('.btn-delete')) {
        e.stopPropagation();
        onNodeDelete(node);
        return;
      }
      if (target.closest('.tree-expand-icon') && node.children.length > 0) {
        const expandEl = target.closest('.tree-expand-icon') as HTMLElement;
        const childContainer = nodeEl.querySelector('.tree-children') as HTMLElement;
        if (childContainer) {
          const isExpanded = expandEl.classList.contains('expanded');
          expandEl.classList.toggle('expanded', !isExpanded);
          expandEl.classList.toggle('collapsed', isExpanded);
          expandEl.textContent = isExpanded ? '▶' : '▼';
          childContainer.style.display = isExpanded ? 'none' : 'block';
        }
        return;
      }
      document.querySelectorAll('.tree-node-row.selected').forEach(el => el.classList.remove('selected'));
      nodeRow.classList.add('selected');
      onNodeSelect(node);
    });

    nodeEl.appendChild(nodeRow);

    if (node.children.length > 0) {
      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children';
      node.children.forEach(child => {
        childContainer.appendChild(renderNode(child, level + 1));
      });
      nodeEl.appendChild(childContainer);
    }

    return nodeEl;
  }

  treeData.forEach(node => {
    treeRoot.appendChild(renderNode(node));
  });

  container.querySelector('#add-root-btn')?.addEventListener('click', () => {
    onNodeAdd(null);
  });

  return container;
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    area: '🏢',
    aisle: '🛤️',
    shelf: '🗄️',
    slot: '📦',
  };
  return icons[type] || '📁';
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    area: '区域',
    aisle: '通道',
    shelf: '货架',
    slot: '格位',
  };
  return labels[type] || type;
}

export { getTypeLabel };
