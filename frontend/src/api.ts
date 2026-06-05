import type { Token, TreeNode, NodeCreate, NodeUpdate, InventoryItem, InventoryItemCreate, InventoryItemUpdate, NodeAggregation, ChangeLog, User, TransferRecord, TransferCreate } from './types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function extractErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
  }
  return JSON.stringify(detail);
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('未授权，请重新登录');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(extractErrorMessage(error.detail) || '请求失败');
  }
  return response.json();
}

export const authApi = {
  async login(username: string, password: string): Promise<Token> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '登录失败' }));
      throw new Error(extractErrorMessage(error.detail) || '登录失败');
    }
    return response.json();
  },

  async getMe(): Promise<User> {
    return apiRequest('/auth/me');
  },

  async register(userData: { username: string; password: string; role: string; display_name: string }): Promise<User> {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
};

export const nodesApi = {
  async getTree(): Promise<TreeNode[]> {
    return apiRequest('/nodes/tree');
  },

  async getAggregation(nodeId: number): Promise<NodeAggregation> {
    return apiRequest(`/nodes/aggregation/${nodeId}`);
  },

  async listNodes(parentId?: number, nodeType?: string): Promise<TreeNode[]> {
    const params = new URLSearchParams();
    if (parentId !== undefined) params.append('parent_id', String(parentId));
    if (nodeType) params.append('node_type', nodeType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/nodes/${query}`);
  },

  async getNode(nodeId: number): Promise<TreeNode> {
    return apiRequest(`/nodes/${nodeId}`);
  },

  async createNode(data: NodeCreate): Promise<TreeNode> {
    return apiRequest('/nodes/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateNode(nodeId: number, data: NodeUpdate): Promise<TreeNode> {
    return apiRequest(`/nodes/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteNode(nodeId: number): Promise<void> {
    return apiRequest(`/nodes/${nodeId}`, { method: 'DELETE' });
  },
};

export const inventoryApi = {
  async listItems(params?: { node_id?: number; sku?: string; low_stock?: boolean; out_of_stock?: boolean }): Promise<InventoryItem[]> {
    const searchParams = new URLSearchParams();
    if (params?.node_id) searchParams.append('node_id', String(params.node_id));
    if (params?.sku) searchParams.append('sku', params.sku);
    if (params?.low_stock) searchParams.append('low_stock', 'true');
    if (params?.out_of_stock) searchParams.append('out_of_stock', 'true');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/inventory/items${query}`);
  },

  async getItem(itemId: number): Promise<InventoryItem> {
    return apiRequest(`/inventory/items/${itemId}`);
  },

  async createItem(data: InventoryItemCreate): Promise<InventoryItem> {
    return apiRequest('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateItem(itemId: number, data: InventoryItemUpdate): Promise<InventoryItem> {
    return apiRequest(`/inventory/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteItem(itemId: number): Promise<void> {
    return apiRequest(`/inventory/items/${itemId}`, { method: 'DELETE' });
  },

  async getChangeLogs(params?: { node_id?: number; change_type?: string; limit?: number }): Promise<ChangeLog[]> {
    const searchParams = new URLSearchParams();
    if (params?.node_id) searchParams.append('node_id', String(params.node_id));
    if (params?.change_type) searchParams.append('change_type', params.change_type);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/inventory/changelogs${query}`);
  },

  async exportInventory(nodeId?: number): Promise<void> {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (nodeId) params.append('node_id', String(nodeId));
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE}/inventory/export${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('导出失败');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  async transferInventory(data: TransferCreate): Promise<TransferRecord> {
    return apiRequest('/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listTransfers(params?: { node_id?: number; limit?: number }): Promise<TransferRecord[]> {
    const searchParams = new URLSearchParams();
    if (params?.node_id) searchParams.append('node_id', String(params.node_id));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/inventory/transfers${query}`);
  },
};
